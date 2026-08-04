import { execFileSync } from 'node:child_process';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';
import express from 'express';
import request from 'supertest';
import memorialRoutes from '../routes/memorials';
import publicRoutes from '../routes/public';
import { signToken } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { MEMORIAL_STATUS } from '../lib/publishing';
import { milestoneForViews, ratePerformance } from '../lib/performance';

const app = express();
app.use(express.json());
app.use('/api/v1/memorials', memorialRoutes);
app.use('/api/v1/public', publicRoutes);

beforeAll(() => {
  execFileSync('npx', ['prisma', 'db', 'push', '--schema=prisma/schema.prisma', '--skip-generate'], {
    cwd: process.cwd(),
    stdio: 'ignore',
    shell: process.platform === 'win32',
  });
});

afterEach(() => {
  vi.useRealTimers();
});

async function home(label: string) {
  const uniq = crypto.randomUUID().slice(0, 8);
  const funeralHome = await prisma.funeralHome.create({ data: { name: label, email: `${uniq}-${label}@example.com`, analyticsAccessEnabled: true } });
  const user = await prisma.user.create({
    data: {
      name: `${label} Admin`,
      email: `${uniq}-${label}-admin@example.com`,
      passwordHash: 'test-password-hash',
      role: 'admin',
      funeralHomeId: funeralHome.id,
    },
  });
  const token = signToken({ userId: user.id, funeralHomeId: funeralHome.id, role: 'admin' });
  return { funeralHome, token };
}

async function publishedMemorial(funeralHomeId: string, label: string, publishedAt: Date) {
  const uniq = crypto.randomUUID().slice(0, 8);
  return prisma.memorial.create({
    data: {
      slug: `${label.toLowerCase().replace(/\s+/g, '-')}-${uniq}`,
      deceasedName: label,
      funeralHomeId,
      programme: [],
      announcements: [],
      settings: { showTributeWall: true },
      status: MEMORIAL_STATUS.PUBLISHED,
      paymentStatus: 'SUCCESS',
      publishedAt,
      editLocksAt: new Date(publishedAt.getTime() + 2 * 24 * 60 * 60 * 1000),
      publicExpiresAt: new Date(publishedAt.getTime() + 30 * 24 * 60 * 60 * 1000),
      deleteAfter: new Date(publishedAt.getTime() + 90 * 24 * 60 * 60 * 1000),
      deletedAt: null,
    },
  });
}

const USER_AGENT = 'Mozilla/5.0 MemorialConnect Performance Test Browser';

async function view(memorial: { slug: string }, visitorId: string): Promise<boolean> {
  const res = await request(app)
    .post(`/api/v1/public/memorials/${memorial.slug}/view`)
    .set('User-Agent', USER_AGENT)
    .send({ visitorId });
  return res.body.data.counted;
}

async function engagement(slug: string, path: 'qr-scan' | 'share', visitorId: string) {
  const res = await request(app)
    .post(`/api/v1/public/memorials/${slug}/${path}`)
    .set('User-Agent', USER_AGENT)
    .send({ visitorId });
  return res.body.data.counted;
}

describe('72-hour memorial performance', () => {
  it('accumulates Day 1 views, unique visitors, QR scans and shares', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-04T09:15:00Z'));
    const { funeralHome, token } = await home('perf-day1');
    const memorial = await publishedMemorial(funeralHome.id, 'Day One Perf', new Date('2026-08-04T09:15:00Z'));

    expect(await view(memorial, 'visitor-a-1234567')).toBe(true);
    expect(await view(memorial, 'visitor-a-1234567')).toBe(false);
    expect(await view(memorial, 'visitor-b-1234567')).toBe(true);
    expect(await view(memorial, 'visitor-c-1234567')).toBe(true);
    expect(await engagement(memorial.slug, 'qr-scan', 'visitor-a-1234567')).toBe(true);
    expect(await engagement(memorial.slug, 'share', 'visitor-a-1234567')).toBe(true);

    const analytics = await request(app).get(`/api/v1/memorials/${memorial.id}/analytics`).set('Authorization', `Bearer ${token}`);
    const performance = analytics.body.data.performance;
    expect(performance.monitoringActive).toBe(true);
    expect(performance.days[0]).toMatchObject({ day: 1, views: 3, uniqueVisitors: 3, qrScans: 1, shares: 1 });
    expect(performance.totals).toMatchObject({ views: 3, uniqueVisitors: 3, qrScans: 1, shares: 1 });
    expect(performance.trend[0]).toMatchObject({ day: 1, views: 3, changePercent: null });

    await prisma.funeralHome.delete({ where: { id: funeralHome.id } });
  });

  it('keeps Day 2 and Day 3 in their own 24-hour windows', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const publishedAt = new Date('2026-08-04T09:15:00Z');
    vi.setSystemTime(new Date('2026-08-05T09:15:00Z'));
    const { funeralHome, token } = await home('perf-days');
    const memorial = await publishedMemorial(funeralHome.id, 'Day Two Perf', publishedAt);

    expect(await view(memorial, 'visitor-a-1234567')).toBe(true);
    expect(await view(memorial, 'visitor-b-1234567')).toBe(true);

    vi.setSystemTime(new Date('2026-08-06T09:15:00Z'));
    expect(await view(memorial, 'visitor-a-1234567')).toBe(true);
    expect(await view(memorial, 'visitor-c-1234567')).toBe(true);

    const analytics = await request(app).get(`/api/v1/memorials/${memorial.id}/analytics`).set('Authorization', `Bearer ${token}`);
    const performance = analytics.body.data.performance;
    expect(performance.days[0]).toMatchObject({ views: 0, uniqueVisitors: 0 });
    expect(performance.days[1]).toMatchObject({ views: 2, uniqueVisitors: 2 });
    expect(performance.days[2]).toMatchObject({ views: 2, uniqueVisitors: 2 });
    expect(performance.totals.views).toBe(4);
    expect(performance.trend[1]).toMatchObject({ day: 2, views: 2 });
    expect(performance.trend[2].views).toBe(2);

    await prisma.funeralHome.delete({ where: { id: funeralHome.id } });
  });

  it('finalizes the snapshot after 72 hours and preserves the Day 1-3 breakdown', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const publishedAt = new Date('2026-08-01T09:15:00Z');
    vi.setSystemTime(new Date('2026-08-01T09:15:00Z'));
    const { funeralHome, token } = await home('perf-transition');
    const memorial = await publishedMemorial(funeralHome.id, 'Transition Perf', publishedAt);

    await view(memorial, 'visitor-a-1234567');
    vi.setSystemTime(new Date('2026-08-02T09:15:00Z'));
    await view(memorial, 'visitor-a-1234567');
    await view(memorial, 'visitor-b-1234567');
    vi.setSystemTime(new Date('2026-08-03T09:15:00Z'));
    await view(memorial, 'visitor-c-1234567');

    vi.setSystemTime(new Date('2026-08-05T09:15:00Z'));
    const analytics = await request(app).get(`/api/v1/memorials/${memorial.id}/analytics`).set('Authorization', `Bearer ${token}`);
    const performance = analytics.body.data.performance;
    expect(performance.finalized).toBe(true);
    expect(performance.monitoringActive).toBe(false);
    expect(performance.days[0]).toMatchObject({ views: 1, uniqueVisitors: 1, snapshot: true });
    expect(performance.days[1]).toMatchObject({ views: 2, uniqueVisitors: 2, snapshot: true });
    expect(performance.days[2]).toMatchObject({ views: 1, uniqueVisitors: 1, snapshot: true });
    expect(performance.snapshots).toEqual([
      { day: 1, views: 1, visitors: 1 },
      { day: 2, views: 3, visitors: 3 },
      { day: 3, views: 4, visitors: 4 },
    ]);

    const stored = await prisma.memorialPerformance.findUniqueOrThrow({ where: { memorialId: memorial.id } });
    expect(stored.finalized).toBe(true);
    expect(stored.total72HourViews).toBe(4);
    expect(stored.day1Views).toBe(1);
    expect(stored.day2Views).toBe(2);
    expect(stored.day3Views).toBe(1);

    await prisma.funeralHome.delete({ where: { id: funeralHome.id } });
  });

  it('awards milestone badges when a single day crosses the thresholds', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-04T09:15:00Z'));
    const { funeralHome, token } = await home('perf-milestone');
    const memorial = await publishedMemorial(funeralHome.id, 'Milestone Perf', new Date('2026-08-04T09:15:00Z'));

    for (let i = 0; i < 250; i++) {
      expect(await view(memorial, `visitor-${String(i).padStart(8, '0')}-${i}`)).toBe(true);
    }

    const analytics = await request(app).get(`/api/v1/memorials/${memorial.id}/analytics`).set('Authorization', `Bearer ${token}`);
    const performance = analytics.body.data.performance;
    expect(performance.totals.highestMilestoneAwarded).toBe('⭐⭐');
    expect(performance.totals.highestDailyViews).toBe(250);
    expect(performance.totals.performanceRating).toBe('Excellent');
    expect(performance.milestones.map((m: { badge: string }) => m.badge)).toEqual(['⭐⭐']);

    await prisma.funeralHome.delete({ where: { id: funeralHome.id } });
  }, 60_000);

  it('ranks trending memorials by current-day views in the funeral home summary', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-04T09:15:00Z'));
    const { funeralHome, token } = await home('perf-trending');
    const a = await publishedMemorial(funeralHome.id, 'Trend A Perf', new Date('2026-08-04T09:15:00Z'));
    const b = await publishedMemorial(funeralHome.id, 'Trend B Perf', new Date('2026-08-04T09:15:00Z'));

    await view(a, 'visitor-a-1234567');
    await view(a, 'visitor-b-1234567');
    await view(b, 'visitor-c-1234567');

    const summary = await request(app).get('/api/v1/memorials/performance/summary').set('Authorization', `Bearer ${token}`);
    expect(summary.body.data.trending[0].id).toBe(a.id);
    expect(summary.body.data.trending[0].currentDayViews).toBe(2);
    expect(summary.body.data.trending[1].id).toBe(b.id);
    expect(summary.body.data.trending[1].currentDayViews).toBe(1);
    expect(summary.body.data.averages.day1Views).toBe(2);
    expect(summary.body.data.bestPerforming?.id).toBe(a.id);
    expect(summary.body.data.monitoringCount).toBe(2);

    await prisma.funeralHome.delete({ where: { id: funeralHome.id } });
  }, 60_000);

  it('classifies performance rating and milestone thresholds', () => {
    expect(ratePerformance(5)).toBe('New');
    expect(ratePerformance(20)).toBe('Growing');
    expect(ratePerformance(50)).toBe('Good');
    expect(ratePerformance(100)).toBe('Very Good');
    expect(ratePerformance(250)).toBe('Excellent');
    expect(ratePerformance(500)).toBe('Outstanding');
    expect(milestoneForViews(99)).toBeNull();
    expect(milestoneForViews(100)?.badge).toBe('⭐');
    expect(milestoneForViews(250)?.badge).toBe('⭐⭐');
    expect(milestoneForViews(500)?.badge).toBe('⭐⭐⭐');
    expect(milestoneForViews(1000)?.badge).toBe('🏆');
  });
});

afterAll(async () => prisma.$disconnect());
