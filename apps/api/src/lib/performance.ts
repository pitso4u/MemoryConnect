import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export const PERFORMANCE_DAY_MS = 24 * 60 * 60 * 1000;
export const MONITOR_WINDOW_MS = 3 * PERFORMANCE_DAY_MS;

export interface MilestoneDefinition {
  threshold: number;
  badge: string;
  label: string;
}

export const MILESTONES: MilestoneDefinition[] = [
  { threshold: 100, badge: '⭐', label: '100 Views' },
  { threshold: 250, badge: '⭐⭐', label: '250 Views' },
  { threshold: 500, badge: '⭐⭐⭐', label: '500 Views' },
  { threshold: 1000, badge: '🏆', label: '1000 Views' },
];

export type PerformanceEventType = 'view' | 'qr_scan' | 'share';

type PerfClient = Pick<Prisma.TransactionClient, 'memorialPerformance' | 'memorialView'>;

/**
 * Returns the 24-hour window a timestamp falls into relative to publication:
 * Day 1 (0–24h), Day 2 (24–48h), Day 3 (48–72h), or null when outside the
 * 72-hour monitoring window.
 */
export function dayForEvent(publishedAt: Date | null | undefined, now: Date): number | null {
  if (!publishedAt) return null;
  const elapsed = now.getTime() - publishedAt.getTime();
  if (elapsed < 0) return null;
  const day = Math.floor(elapsed / PERFORMANCE_DAY_MS) + 1;
  return day >= 1 && day <= 3 ? day : null;
}

export function windowForDay(publishedAt: Date, day: number): { start: Date; end: Date } {
  return {
    start: new Date(publishedAt.getTime() + (day - 1) * PERFORMANCE_DAY_MS),
    end: new Date(publishedAt.getTime() + day * PERFORMANCE_DAY_MS),
  };
}

export function monitoringActive(publishedAt: Date | null | undefined, now: Date): boolean {
  if (!publishedAt) return false;
  const elapsed = now.getTime() - publishedAt.getTime();
  return elapsed >= 0 && elapsed < MONITOR_WINDOW_MS;
}

export function milestoneForViews(views: number): MilestoneDefinition | null {
  let result: MilestoneDefinition | null = null;
  for (const milestone of MILESTONES) {
    if (views >= milestone.threshold) result = milestone;
  }
  return result;
}

export function ratePerformance(totalViews: number): string {
  if (totalViews >= 500) return 'Outstanding';
  if (totalViews >= 250) return 'Excellent';
  if (totalViews >= 100) return 'Very Good';
  if (totalViews >= 50) return 'Good';
  if (totalViews >= 20) return 'Growing';
  return 'New';
}

export interface DayTotals {
  views: number;
  uniqueVisitors: number;
  qrScans: number;
  shares: number;
}

function buildMilestones(dayViews: [number, number, number]): Array<{ day: number; badge: string; label: string; views: number }> {
  const earned: Array<{ day: number; badge: string; label: string; views: number }> = [];
  dayViews.forEach((views, index) => {
    if (views <= 0) return;
    const milestone = milestoneForViews(views);
    if (!milestone) return;
    earned.push({ day: index + 1, badge: milestone.badge, label: milestone.label, views });
  });
  return earned;
}

/**
 * Applies an analytics event to a memorial's 72-hour performance record.
 * Events inside the monitoring window update the matching day's counters
 * incrementally. Events outside the window are ignored (they flow into the
 * regular 30-day analytics via the memorial viewCount).
 */
export async function applyPerformanceEvent(
  tx: PerfClient,
  memorial: { id: string; publishedAt: Date | null },
  eventType: PerformanceEventType,
  options: { visitorHash?: string | null; now: Date },
) {
  const day = dayForEvent(memorial.publishedAt, options.now);
  if (!day) return;

  const performance = await tx.memorialPerformance.upsert({
    where: { memorialId: memorial.id },
    create: { memorialId: memorial.id },
    update: {},
  });

  const dayKey = `day${day}` as 'day1' | 'day2' | 'day3';
  const increments: Prisma.MemorialPerformanceUpdateInput = {};

  if (eventType === 'view') {
    increments[`${dayKey}Views`] = { increment: 1 };
    increments.total72HourViews = { increment: 1 };
    if (options.visitorHash && memorial.publishedAt) {
      const window = windowForDay(memorial.publishedAt, day);
      const seen = await tx.memorialView.count({
        where: {
          memorialId: memorial.id,
          visitorHash: options.visitorHash,
          createdAt: { gte: window.start, lt: options.now },
        },
      });
      if (seen === 0) increments[`${dayKey}UniqueVisitors`] = { increment: 1 };
    }
  } else if (eventType === 'qr_scan') {
    increments[`${dayKey}QrScans`] = { increment: 1 };
  } else if (eventType === 'share') {
    increments[`${dayKey}Shares`] = { increment: 1 };
  }

  const dayViews: [number, number, number] = [
    day === 1 ? performance.day1Views + (eventType === 'view' ? 1 : 0) : performance.day1Views,
    day === 2 ? performance.day2Views + (eventType === 'view' ? 1 : 0) : performance.day2Views,
    day === 3 ? performance.day3Views + (eventType === 'view' ? 1 : 0) : performance.day3Views,
  ];
  const highestDailyViews = Math.max(...dayViews, 0);
  const total72HourViews = dayViews.reduce((sum, views) => sum + views, 0);
  const milestones = buildMilestones(dayViews);
  const highest = milestones.length > 0 ? milestones[milestones.length - 1] : null;

  increments.performanceRating = ratePerformance(total72HourViews);
  increments.highestDailyViews = highestDailyViews;
  increments.milestones = milestones;
  increments.highestMilestoneAwarded = highest ? highest.badge : null;

  await tx.memorialPerformance.update({ where: { id: performance.id }, data: increments });
}

/**
 * Freezes a memorial's 72-hour snapshot once the monitoring window closes.
 * Unique visitor counts are reconciled from the stored raw views so the
 * finalized record is complete even if a race previously missed an event.
 */
export async function finalizePerformance(memorialId: string, now = new Date()): Promise<boolean> {
  const memorial = await prisma.memorial.findUnique({
    where: { id: memorialId },
    select: { id: true, publishedAt: true },
  });
  if (!memorial?.publishedAt) return false;

  const performance = await prisma.memorialPerformance.upsert({
    where: { memorialId },
    create: { memorialId },
    update: {},
  });
  if (performance.finalized) return true;

  const dayTotals: DayTotals[] = [];
  for (const day of [1, 2, 3] as const) {
    const window = windowForDay(memorial.publishedAt, day);
    const uniqueVisitors = await prisma.memorialView.groupBy({
      by: ['visitorHash'],
      where: { memorialId, visitorHash: { not: null }, createdAt: { gte: window.start, lt: window.end } },
      _count: true,
    });
    dayTotals.push({
      views: performance[`day${day}Views`],
      uniqueVisitors: uniqueVisitors.length,
      qrScans: performance[`day${day}QrScans`],
      shares: performance[`day${day}Shares`],
    });
  }

  const dayViews: [number, number, number] = [dayTotals[0].views, dayTotals[1].views, dayTotals[2].views];
  const highestDailyViews = Math.max(...dayViews, 0);
  const total72HourViews = dayViews.reduce((sum, views) => sum + views, 0);
  const milestones = buildMilestones(dayViews);
  const highest = milestones.length > 0 ? milestones[milestones.length - 1] : null;

  await prisma.memorialPerformance.update({
    where: { id: performance.id },
    data: {
      day1UniqueVisitors: dayTotals[0].uniqueVisitors,
      day2UniqueVisitors: dayTotals[1].uniqueVisitors,
      day3UniqueVisitors: dayTotals[2].uniqueVisitors,
      total72HourViews,
      performanceRating: ratePerformance(total72HourViews),
      highestDailyViews,
      milestones,
      highestMilestoneAwarded: highest ? highest.badge : null,
      finalized: true,
      finalizedAt: now,
    },
  });
  return true;
}

/**
 * Finalizes every memorial whose 72-hour monitoring window has closed but has
 * not yet been snapshot. Idempotent and cheap (returns early when finalized).
 */
export async function finalizeDueMemorials(now = new Date()): Promise<number> {
  const due = await prisma.memorial.findMany({
    where: {
      publishedAt: { not: null, lte: new Date(now.getTime() - MONITOR_WINDOW_MS) },
      performance: { is: { finalized: false } },
      deletedAt: null,
    },
    select: { id: true },
  });
  for (const memorial of due) {
    await finalizePerformance(memorial.id, now).catch(() => false);
  }
  return due.length;
}

export interface PerformancePayload {
  memorialId: string;
  publishedAt: string | null;
  monitoringActive: boolean;
  finalized: boolean;
  days: Array<DayTotals & { day: number; label: string; snapshot: boolean; rating: string }>;
  totals: DayTotals & {
    performanceRating: string;
    highestDailyViews: number;
    highestMilestoneAwarded: string | null;
  };
  milestones: Array<{ day: number; badge: string; label: string; views: number }>;
  trend: Array<{ day: number; views: number; changePercent: number | null }>;
  snapshots: Array<{ day: number; views: number; visitors: number }>;
}

/**
 * Builds the 72-hour performance payload for a memorial, finalizing the
 * snapshot first when the monitoring window has already closed.
 */
export async function buildPerformancePayload(memorial: {
  id: string;
  publishedAt: Date | null;
}, now = new Date()): Promise<PerformancePayload> {
  await finalizeDueMemorials(now);

  const performance = await prisma.memorialPerformance.upsert({
    where: { memorialId: memorial.id },
    create: { memorialId: memorial.id },
    update: {},
  });

  const publishedAt = memorial.publishedAt;
  const active = monitoringActive(publishedAt, now);

  const dayLabels = ['Day 1 (0–24h)', 'Day 2 (24–48h)', 'Day 3 (48–72h)'];
  const days = ([1, 2, 3] as const).map((day, index) => {
    const current = (index + 1) as 1 | 2 | 3;
    const snapshot = Boolean(publishedAt) && (now.getTime() - publishedAt!.getTime() > current * PERFORMANCE_DAY_MS || performance.finalized);
    const views = performance[`day${current}Views`];
    return {
      day: current,
      label: dayLabels[index],
      views,
      uniqueVisitors: performance[`day${current}UniqueVisitors`],
      qrScans: performance[`day${current}QrScans`],
      shares: performance[`day${current}Shares`],
      snapshot,
      rating: ratePerformance(views),
    };
  });

  const dayViews = days.map((day) => day.views) as [number, number, number];
  const total72HourViews = dayViews.reduce((sum, views) => sum + views, 0);
  const highestDailyViews = Math.max(...dayViews, 0);
  const milestones = (performance.milestones as Array<{ day: number; badge: string; label: string; views: number }> | null) || buildMilestones(dayViews);
  const highest = milestones.length > 0 ? milestones[milestones.length - 1] : null;

  const trend = days.map((day, index) => {
    const previous = index > 0 ? days[index - 1].views : 0;
    const changePercent =
      index === 0 ? null
      : previous === 0 ? (day.views > 0 ? 100 : 0)
      : Math.round(((day.views - previous) / previous) * 100);
    return { day: day.day, views: day.views, changePercent };
  });

  let cumulativeViews = 0;
  let cumulativeVisitors = 0;
  const snapshots = days.map((day) => {
    cumulativeViews += day.views;
    cumulativeVisitors += day.uniqueVisitors;
    return { day: day.day, views: cumulativeViews, visitors: cumulativeVisitors };
  });

  return {
    memorialId: memorial.id,
    publishedAt: publishedAt ? publishedAt.toISOString() : null,
    monitoringActive: active,
    finalized: performance.finalized,
    days,
    totals: {
      views: total72HourViews,
      uniqueVisitors: days.reduce((sum, day) => sum + day.uniqueVisitors, 0),
      qrScans: days.reduce((sum, day) => sum + day.qrScans, 0),
      shares: days.reduce((sum, day) => sum + day.shares, 0),
      performanceRating: performance.performanceRating || ratePerformance(total72HourViews),
      highestDailyViews,
      highestMilestoneAwarded: highest ? highest.badge : null,
    },
    milestones,
    trend,
    snapshots,
  };
}
