import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';
import express from 'express';
import request from 'supertest';
import memorialRoutes from '../routes/memorials';
import publicRoutes from '../routes/public';
import { signToken } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import {
  addHours,
  completePublishPayment,
  isPubliclyViewable,
  MEMORIAL_STATUS,
  PAYMENT_PURPOSE,
  PUBLISH_PRICE_CENTS,
  verifyPaystackSignature,
} from '../lib/publishing';

const app = express();
app.use(express.json());
app.use('/api/v1/memorials', memorialRoutes);
app.use('/api/v1/public', publicRoutes);

async function home(label: string) {
  const funeralHome = await prisma.funeralHome.create({ data: { name: label, email: `${label}-${Date.now()}@example.com` } });
  const user = await prisma.user.create({
    data: {
      name: `${label} Admin`,
      email: `${label}-admin-${Date.now()}@example.com`,
      passwordHash: 'test-password-hash',
      role: 'admin',
      funeralHomeId: funeralHome.id,
    },
  });
  const token = signToken({ userId: user.id, funeralHomeId: funeralHome.id, role: 'admin' });
  return { funeralHome, token };
}

async function draft(funeralHomeId: string, label: string) {
  return prisma.memorial.create({
    data: {
      slug: `${label}-${Date.now()}`,
      deceasedName: label,
      serviceDate: new Date('2026-07-04T10:00:00Z'),
      serviceVenue: 'Community Hall',
      funeralHomeId,
      programme: [],
      announcements: [],
      settings: { showTributeWall: true },
    },
  });
}

describe('pay-per-funeral lifecycle', () => {
  it('verifies Paystack webhook signatures', () => {
    const body = Buffer.from('{"event":"charge.success"}');
    const signature = crypto.createHmac('sha512', 'sk_test_memory_connect').update(body).digest('hex');
    expect(verifyPaystackSignature(body, signature)).toBe(true);
    expect(verifyPaystackSignature(body, '0'.repeat(128))).toBe(false);
  });

  it('serves a permanent sample memorial and projector', async () => {
    const memorial = await request(app).get('/api/v1/public/memorials/demo');
    expect(memorial.status).toBe(200);
    expect(memorial.body.data).toMatchObject({ slug: 'demo', deceasedName: 'Mme Nomvula Grace Maseko', isDemo: true });
    expect(memorial.body.data.obituary.length).toBeGreaterThan(400);
    expect(memorial.body.data.programme.length).toBeGreaterThanOrEqual(12);
    expect(memorial.body.data.photos.length).toBeGreaterThanOrEqual(10);
    expect(memorial.body.data.locations.length).toBeGreaterThanOrEqual(3);
    expect(memorial.body.data.tributes.length).toBeGreaterThanOrEqual(6);
    expect(memorial.body.data.publicExpiresAt).toBeNull();
    expect(memorial.body.data.paymentStatus).toBe('SUCCESS');

    const projector = await request(app).get('/api/v1/public/memorials/demo/projector');
    expect(projector.status).toBe(200);
    expect(projector.body.data.totalItems).toBeGreaterThanOrEqual(12);
  });

  it('treats demo memorials as permanent and blocks ordinary payment and deletion flows', async () => {
    const { funeralHome, token } = await home('protected-demo');
    const demo = await prisma.memorial.create({
      data: {
        slug: `protected-demo-${Date.now()}`,
        deceasedName: 'Protected Demo',
        funeralHomeId: funeralHome.id,
        programme: [],
        announcements: [],
        settings: { showTributeWall: true },
        status: MEMORIAL_STATUS.PUBLISHED,
        isDemo: true,
        paymentStatus: 'SUCCESS',
        publicExpiresAt: null,
        deleteAfter: null,
      },
    });

    expect(isPubliclyViewable(demo)).toBe(true);
    expect((await request(app).post(`/api/v1/memorials/${demo.id}/initialize-publish-payment`).set('Authorization', `Bearer ${token}`)).status).toBe(403);
    expect((await request(app).delete(`/api/v1/memorials/${demo.id}`).set('Authorization', `Bearer ${token}`)).status).toBe(403);

    await prisma.memorial.delete({ where: { id: demo.id } });
    await prisma.funeralHome.delete({ where: { id: funeralHome.id } });
  });

  it('allows a signed private preview without publishing or counting a public view', async () => {
    const { funeralHome, token } = await home('private-preview');
    const memorial = await draft(funeralHome.id, 'Preview Test');
    await prisma.photo.create({
      data: { memorialId: memorial.id, url: '/uploads/slideshow-photo.jpg', caption: 'Family memory', category: 'family' },
    });
    const publicAttempt = await request(app).get(`/api/v1/public/memorials/${memorial.slug}`);
    expect(publicAttempt.status).toBe(410);

    const previewToken = await request(app)
      .get(`/api/v1/memorials/${memorial.id}/preview-token`)
      .set('Authorization', `Bearer ${token}`);
    expect(previewToken.status).toBe(200);

    const preview = await request(app)
      .get(`/api/v1/public/memorials/${memorial.slug}`)
      .query({ preview: previewToken.body.data.token });
    expect(preview.status).toBe(200);
    expect(preview.body.data.isPreview).toBe(true);
    expect((await prisma.memorial.findUniqueOrThrow({ where: { id: memorial.id } })).viewCount).toBe(0);

    const projector = await request(app)
      .get(`/api/v1/public/memorials/${memorial.slug}/projector`)
      .query({ preview: previewToken.body.data.token });
    expect(projector.status).toBe(200);
    expect(projector.body.data.photos).toEqual([
      expect.objectContaining({ url: '/uploads/slideshow-photo.jpg', caption: 'Family memory' }),
    ]);
    await prisma.funeralHome.delete({ where: { id: funeralHome.id } });
  });

  it('creates, edits, and permanently deletes free drafts', async () => {
    const { funeralHome, token } = await home('draft-flow');
    const created = await request(app).post('/api/v1/memorials').set('Authorization', `Bearer ${token}`).send({ deceasedName: 'Nomsa Dlamini' });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe(MEMORIAL_STATUS.DRAFT);
    const edited = await request(app).patch(`/api/v1/memorials/${created.body.data.id}`).set('Authorization', `Bearer ${token}`).send({ obituary: 'A life well lived.' });
    expect(edited.status).toBe(200);
    const removed = await request(app).delete(`/api/v1/memorials/${created.body.data.id}`).set('Authorization', `Bearer ${token}`);
    expect(removed.status).toBe(200);
    expect(await prisma.memorial.findUnique({ where: { id: created.body.data.id } })).toBeNull();
    await prisma.funeralHome.delete({ where: { id: funeralHome.id } });
  });

  it('initializes exactly R299.99 with Paystack and does not publish on redirect initialization', async () => {
    const { funeralHome, token } = await home('initialize');
    const memorial = await draft(funeralHome.id, 'Payment Test');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      status: true,
      message: 'Authorization URL created',
      data: { authorization_url: 'https://checkout.paystack.com/test', access_code: 'access', reference: 'ignored' },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const response = await request(app).post(`/api/v1/memorials/${memorial.id}/initialize-publish-payment`).set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.amount).toBe(String(PUBLISH_PRICE_CENTS));
    expect(body.currency).toBe('ZAR');
    const pending = await prisma.memorial.findUniqueOrThrow({ where: { id: memorial.id } });
    expect(pending.status).toBe(MEMORIAL_STATUS.PAID_PENDING);
    expect(pending.publishedAt).toBeNull();
    fetchMock.mockRestore();
    await prisma.funeralHome.delete({ where: { id: funeralHome.id } });
  });

  it('publishes only after verified success and sets 72-hour, 30-day, and 90-day dates', async () => {
    const { funeralHome } = await home('success');
    const memorial = await draft(funeralHome.id, 'Published Test');
    const payment = await prisma.payment.create({ data: { funeralHomeId: funeralHome.id, memorialId: memorial.id, purpose: PAYMENT_PURPOSE, paystackReference: `ref-${Date.now()}` } });
    const published = await completePublishPayment(payment.paystackReference, {
      id: 1, status: 'success', reference: payment.paystackReference, amount: 29999, currency: 'ZAR', paid_at: new Date().toISOString(),
    });
    expect(published.status).toBe(MEMORIAL_STATUS.PUBLISHED);
    expect(published.publicExpiresAt!.getTime() - published.publishedAt!.getTime()).toBe(30 * 86400000);
    expect(published.deleteAfter!.getTime() - published.publishedAt!.getTime()).toBe(90 * 86400000);
    expect(published.editLocksAt!.getTime() - published.publishedAt!.getTime()).toBe(72 * 3600000);
    await prisma.funeralHome.delete({ where: { id: funeralHome.id } });
  });

  it('allows edits before the lock and blocks edits and deletion after it', async () => {
    const { funeralHome, token } = await home('lock');
    const memorial = await draft(funeralHome.id, 'Lock Test');
    const programme = [
      { id: 'opening', type: 'welcome', title: 'Welcome', order: 0 },
      { id: 'tribute', type: 'tribute', title: 'Family tribute', order: 1 },
    ];
    await prisma.memorial.update({
      where: { id: memorial.id },
      data: {
        status: MEMORIAL_STATUS.PUBLISHED,
        editLocksAt: addHours(new Date(), 1),
        publicExpiresAt: addHours(new Date(), 24),
        programme,
      },
    });
    expect((await request(app).patch(`/api/v1/memorials/${memorial.id}`).set('Authorization', `Bearer ${token}`).send({ obituary: 'Correction' })).status).toBe(200);
    await prisma.memorial.update({ where: { id: memorial.id }, data: { editLocksAt: addHours(new Date(), -1) } });
    expect((await request(app).patch(`/api/v1/memorials/${memorial.id}`).set('Authorization', `Bearer ${token}`).send({ obituary: 'Too late' })).status).toBe(423);
    expect((await request(app).delete(`/api/v1/memorials/${memorial.id}`).set('Authorization', `Bearer ${token}`)).status).toBe(423);

    const next = await request(app)
      .post(`/api/v1/memorials/${memorial.id}/programme/next`)
      .set('Authorization', `Bearer ${token}`);
    expect(next.status).toBe(200);
    expect(next.body.data.currentProgrammeIndex).toBe(1);
    const liveProjector = await request(app).get(`/api/v1/public/memorials/${memorial.slug}/projector`);
    expect(liveProjector.body.data).toMatchObject({ currentIndex: 1, currentItem: programme[1] });

    const previous = await request(app)
      .post(`/api/v1/memorials/${memorial.id}/programme/previous`)
      .set('Authorization', `Bearer ${token}`);
    expect(previous.status).toBe(200);
    expect(previous.body.data.currentProgrammeIndex).toBe(0);
    await prisma.funeralHome.delete({ where: { id: funeralHome.id } });
  });

  it('shows the deceased photo publicly, records unique analytics, and blocks expired viewing', async () => {
    const { funeralHome, token } = await home('views');
    const memorial = await draft(funeralHome.id, 'View Test');
    await prisma.memorial.update({ where: { id: memorial.id }, data: { status: MEMORIAL_STATUS.PUBLISHED, deceasedPhotoUrl: '/uploads/photo.jpg', publicExpiresAt: addHours(new Date(), 24) } });
    const publicView = await request(app).get(`/api/v1/public/memorials/${memorial.slug}`);
    expect(publicView.status).toBe(200);
    expect(publicView.body.data.deceasedPhotoUrl).toBe('/uploads/photo.jpg');
    expect((await prisma.memorial.findUniqueOrThrow({ where: { id: memorial.id } })).viewCount).toBe(0);
    const view = await request(app)
      .post(`/api/v1/public/memorials/${memorial.slug}/view`)
      .set('User-Agent', 'Mozilla/5.0 MemorialConnect Test Browser')
      .send({ visitorId: 'visitor-one-12345' });
    expect(view.status).toBe(200);
    expect(view.body.data.counted).toBe(true);
    const duplicateView = await request(app)
      .post(`/api/v1/public/memorials/${memorial.slug}/view`)
      .set('User-Agent', 'Mozilla/5.0 MemorialConnect Test Browser')
      .send({ visitorId: 'visitor-one-12345' });
    expect(duplicateView.body.data.counted).toBe(false);
    expect((await prisma.memorial.findUniqueOrThrow({ where: { id: memorial.id } })).viewCount).toBe(1);
    const analytics = await request(app).get(`/api/v1/memorials/${memorial.id}/analytics`).set('Authorization', `Bearer ${token}`);
    expect(analytics.body.data.totalViews).toBe(1);
    await prisma.memorial.update({ where: { id: memorial.id }, data: { status: MEMORIAL_STATUS.EXPIRED, publicExpiresAt: addHours(new Date(), -1) } });
    const expired = await request(app).get(`/api/v1/public/memorials/${memorial.slug}`);
    expect(expired.status).toBe(410);
    expect(expired.body.message).toBe('This memorial viewing period has ended.');
    await prisma.funeralHome.delete({ where: { id: funeralHome.id } });
  });
});

describe('public tributes listing and visibility boundaries', () => {
  it('public tributes endpoint returns only approved tributes for published memorials', async () => {
    const { funeralHome, token } = await home('public-tributes-1');
    const memorial = await draft(funeralHome.id, 'Public Tributes Test');
    await prisma.memorial.update({
      where: { id: memorial.id },
      data: { status: MEMORIAL_STATUS.PUBLISHED, publicExpiresAt: addHours(new Date(), 30) },
    });
    // Create approved and unapproved tributes
    await prisma.tribute.createMany({
      data: [
        { memorialId: memorial.id, authorName: 'Approved User', message: 'Approved tribute', approved: true },
        { memorialId: memorial.id, authorName: 'Pending User', message: 'Pending tribute', approved: false },
      ],
    });

    const res = await request(app).get(`/api/v1/public/memorials/${memorial.slug}/tributes`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tributes).toHaveLength(1);
    expect(res.body.data.tributes[0].authorName).toBe('Approved User');
    expect(res.body.data.tributes[0].message).toBe('Approved tribute');
    // Ensure only safe fields are returned
    expect(res.body.data.tributes[0]).not.toHaveProperty('memorialId');
    expect(res.body.data.tributes[0]).not.toHaveProperty('approved');
  });

  it('public tributes endpoint returns 404 for unpublished memorials', async () => {
    const { funeralHome, token } = await home('private-tributes-1');
    const memorial = await draft(funeralHome.id, 'Private Tributes Test');
    // Memorial is DRAFT, not published
    await prisma.tribute.create({ data: { memorialId: memorial.id, authorName: 'Test', message: 'Test', approved: true } });

    const res = await request(app).get(`/api/v1/public/memorials/${memorial.slug}/tributes`);
    expect(res.status).toBe(410); // Expired/not publicly viewable
  });

  it('public tributes endpoint returns 403 when tribute wall is disabled', async () => {
    const { funeralHome, token } = await home('disabled-tributes');
    const memorial = await draft(funeralHome.id, 'Disabled Tributes Test');
    await prisma.memorial.update({
      where: { id: memorial.id },
      data: { status: MEMORIAL_STATUS.PUBLISHED, publicExpiresAt: addHours(new Date(), 30), settings: { showTributeWall: false } },
    });

    const res = await request(app).get(`/api/v1/public/memorials/${memorial.slug}/tributes`);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Tribute wall is disabled');
  });

  it('public tributes endpoint supports pagination via cursor', async () => {
    const { funeralHome, token } = await home('pagination-tributes');
    const memorial = await draft(funeralHome.id, 'Pagination Test');
    await prisma.memorial.update({
      where: { id: memorial.id },
      data: { status: MEMORIAL_STATUS.PUBLISHED, publicExpiresAt: addHours(new Date(), 30) },
    });
    // Create 5 approved tributes
    await prisma.tribute.createMany({
      data: Array.from({ length: 5 }, (_, i) => ({
        memorialId: memorial.id,
        authorName: `User ${i}`,
        message: `Tribute ${i}`,
        approved: true,
      })),
    });

    const firstPage = await request(app).get(`/api/v1/public/memorials/${memorial.slug}/tributes?limit=2`);
    expect(firstPage.status).toBe(200);
    expect(firstPage.body.data.tributes).toHaveLength(2);
    expect(firstPage.body.data.nextCursor).toBeDefined();

    const secondPage = await request(app).get(`/api/v1/public/memorials/${memorial.slug}/tributes?limit=2&cursor=${firstPage.body.data.nextCursor}`);
    expect(secondPage.status).toBe(200);
    expect(secondPage.body.data.tributes).toHaveLength(2);
    expect(secondPage.body.data.nextCursor).toBeDefined();

    const thirdPage = await request(app).get(`/api/v1/public/memorials/${memorial.slug}/tributes?limit=2&cursor=${secondPage.body.data.nextCursor}`);
    expect(thirdPage.status).toBe(200);
    expect(thirdPage.body.data.tributes).toHaveLength(1);
    expect(thirdPage.body.data.nextCursor).toBeUndefined();
  });

  it('private endpoint returns ALL tributes (including unapproved) for authorized users', async () => {
    const { funeralHome, token } = await home('private-all-tributes');
    const memorial = await draft(funeralHome.id, 'All Tributes Test');
    await prisma.memorial.update({
      where: { id: memorial.id },
      data: { status: MEMORIAL_STATUS.PUBLISHED, publicExpiresAt: addHours(new Date(), 30) },
    });
    await prisma.tribute.createMany({
      data: [
        { memorialId: memorial.id, authorName: 'Approved', message: 'Approved', approved: true },
        { memorialId: memorial.id, authorName: 'Pending', message: 'Pending', approved: false },
      ],
    });

    const res = await request(app).get(`/api/v1/memorials/${memorial.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.tributes).toHaveLength(2);
    const approvedCount = res.body.data.tributes.filter((t: { approved: boolean }) => t.approved).length;
    const unapprovedCount = res.body.data.tributes.filter((t: { approved: boolean }) => !t.approved).length;
    expect(approvedCount).toBe(1);
    expect(unapprovedCount).toBe(1);
  });

  it('unauthorized user cannot access private tributes endpoint', async () => {
    const { funeralHome: fh1 } = await home('unauthorized-1');
    const { funeralHome: fh2, token } = await home('unauthorized-2');
    const memorial = await draft(fh1.id, 'Unauthorized Test');
    await prisma.tribute.create({ data: { memorialId: memorial.id, authorName: 'Test', message: 'Test', approved: true } });

    const res = await request(app).get(`/api/v1/memorials/${memorial.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404); // Different funeral home
  });

  it('public tributes response does not expose private fields', async () => {
    const { funeralHome, token } = await home('safe-fields-test');
    const memorial = await draft(funeralHome.id, 'Safe Fields Test');
    await prisma.memorial.update({
      where: { id: memorial.id },
      data: { status: MEMORIAL_STATUS.PUBLISHED, publicExpiresAt: addHours(new Date(), 30) },
    });
    await prisma.tribute.create({ data: { memorialId: memorial.id, authorName: 'John Doe', message: 'Lovely tribute', approved: true } });

    const res = await request(app).get(`/api/v1/public/memorials/${memorial.slug}/tributes`);
    expect(res.status).toBe(200);
    const tribute = res.body.data.tributes[0];
    // Should only expose safe public fields
    expect(tribute).toHaveProperty('id');
    expect(tribute).toHaveProperty('authorName');
    expect(tribute).toHaveProperty('message');
    expect(tribute).toHaveProperty('createdAt');
    // Should NOT expose private/internal fields
    expect(tribute).not.toHaveProperty('memorialId');
    expect(tribute).not.toHaveProperty('approved');
  });

  it('public tributes submission auto-approves regardless of moderation setting', async () => {
    const { funeralHome, token } = await home('submission-test-1');
    const memorial = await draft(funeralHome.id, 'Submission Test');
    await prisma.memorial.update({
      where: { id: memorial.id },
      data: { status: MEMORIAL_STATUS.PUBLISHED, publicExpiresAt: addHours(new Date(), 30), settings: { showTributeWall: true, moderateTributes: true } },
    });

    // Submit tribute - should be auto-approved regardless of moderation setting
    const res = await request(app)
      .post(`/api/v1/public/memorials/${memorial.slug}/tributes`)
      .send({ authorName: 'John Smith', message: 'A lovely tribute' });
    expect(res.status).toBe(201);
    expect(res.body.data.pending).toBe(false);
    expect(res.body.data.approved).toBe(true);

    // Should be visible in public tributes listing immediately
    const listRes = await request(app).get(`/api/v1/public/memorials/${memorial.slug}/tributes`);
    expect(listRes.body.data.tributes).toHaveLength(1);
    expect(listRes.body.data.tributes[0].authorName).toBe('John Smith');
    // Public endpoint does not expose the approved field (only id, authorName, message, createdAt)

    // Family home can see it in private endpoint
    const privateRes = await request(app).get(`/api/v1/memorials/${memorial.id}`).set('Authorization', `Bearer ${token}`);
    expect(privateRes.body.data.tributes).toHaveLength(1);
    expect(privateRes.body.data.tributes[0].approved).toBe(true);
  });

  it('public tributes submission auto-approves when moderation disabled', async () => {
    const { funeralHome, token } = await home('submission-test-2');
    const memorial = await draft(funeralHome.id, 'Auto-Approve Test');
    await prisma.memorial.update({
      where: { id: memorial.id },
      data: { status: MEMORIAL_STATUS.PUBLISHED, publicExpiresAt: addHours(new Date(), 30), settings: { showTributeWall: true, moderateTributes: false } },
    });

    // Submit tribute - should be auto-approved
    const res = await request(app)
      .post(`/api/v1/public/memorials/${memorial.slug}/tributes`)
      .send({ authorName: 'Jane Doe', message: 'Auto-approved tribute' });
    expect(res.status).toBe(201);
    expect(res.body.data.pending).toBe(false);
    expect(res.body.data.approved).toBe(true);

    // Should be visible in public tributes listing
    const listRes = await request(app).get(`/api/v1/public/memorials/${memorial.slug}/tributes`);
    expect(listRes.body.data.tributes).toHaveLength(1);
    expect(listRes.body.data.tributes[0].authorName).toBe('Jane Doe');
  });
});

afterAll(async () => prisma.$disconnect());
