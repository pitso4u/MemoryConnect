import { prisma } from './prisma';
import { PERFORMANCE_DAY_MS, buildMilestones, ratePerformance } from './performance';

type SqliteColumn = {
  name: string;
};

/**
 * Migrates legacy memorial-view analytics to lifetime-unique semantics.
 *
 * The old schema deduplicated on (memorialId, visitorHash, dateBucket), so the
 * same visitor returning on a new day was recorded as a brand-new view. The new
 * model enforces ONE visitor + ONE memorial = ONE view, forever.
 *
 * This runs before `prisma db push` (dev and production both invoke it) so the
 * unique index can be created on already-deduplicated data and the legacy
 * dateBucket column is dropped without a data-loss warning. It is idempotent
 * and only touches databases that still carry the legacy daily-bucket index.
 */
export async function migrateMemorialViews() {
  const viewTable = await prisma.$queryRawUnsafe<SqliteColumn[]>(
    'PRAGMA table_info("MemorialView")',
  );
  if (viewTable.length === 0) return;

  const indexes = await prisma.$queryRawUnsafe<{ name: string }[]>(
    'PRAGMA index_list("MemorialView")',
  );
  const isLegacy = indexes.some((index) => index.name.includes('dateBucket'));
  if (!isLegacy) return;

  // Legacy rows without an identity get a unique anonymous hash so the NOT
  // NULL unique index can be created without data loss.
  await prisma.$executeRawUnsafe(
    'UPDATE "MemorialView" SET "visitorHash" = lower(hex(randomblob(16))) WHERE "visitorHash" IS NULL OR "visitorHash" = \'\';',
  );

  // Keep the earliest record per (memorialId, visitorHash), drop the rest.
  const rows = await prisma.memorialView.findMany({
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, memorialId: true, visitorHash: true },
  });
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const row of rows) {
    const key = `${row.memorialId}|${row.visitorHash}`;
    if (seen.has(key)) duplicates.push(row.id);
    else seen.add(key);
  }
  if (duplicates.length > 0) {
    await prisma.memorialView.deleteMany({ where: { id: { in: duplicates } } });
    console.log(`Removed ${duplicates.length} duplicate memorial views.`);
  }

  // Drop the legacy daily-bucket index and column so `prisma db push` can apply
  // the lifetime-unique schema without refusing on a data-loss warning.
  const columns = new Set(viewTable.map((column) => column.name));
  for (const index of indexes) {
    if (index.name.includes('dateBucket')) {
      await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "${index.name}"`);
    }
  }
  if (columns.has('dateBucket')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "MemorialView" DROP COLUMN "dateBucket"');
  }

  // Recalculate lifetime totals from the deduplicated rows.
  const groups = await prisma.memorialView.groupBy({
    by: ['memorialId'],
    _count: true,
  });
  for (const group of groups) {
    await prisma.memorial.update({
      where: { id: group.memorialId },
      data: { viewCount: group._count },
    });
  }
  if (groups.length > 0) {
    console.log(`Recalculated lifetime view counts for ${groups.length} memorials.`);
  }

  await recalcPerformance();
}

/**
 * Rebuilds the 72-hour performance counters from the deduplicated raw views so
 * day snapshots no longer reflect inflated daily-bucket duplicates.
 */
export async function recalcPerformance() {
  const memorials = await prisma.memorial.findMany({
    where: { publishedAt: { not: null } },
    select: { id: true, publishedAt: true },
  });

  let updated = 0;
  for (const memorial of memorials) {
    const publishedAt = memorial.publishedAt!;
    const windows = [1, 2, 3].map((day) => ({
      start: new Date(publishedAt.getTime() + (day - 1) * PERFORMANCE_DAY_MS),
      end: new Date(publishedAt.getTime() + day * PERFORMANCE_DAY_MS),
    }));

    const rows = await prisma.memorialView.findMany({
      where: {
        memorialId: memorial.id,
        createdAt: { gte: windows[0].start, lt: windows[2].end },
      },
      select: { createdAt: true, visitorHash: true },
    });
    if (rows.length === 0) continue;

    const counts: [number, number, number] = [0, 0, 0];
    const unique: [Set<string>, Set<string>, Set<string>] = [new Set(), new Set(), new Set()];
    for (const row of rows) {
      const day = windows.findIndex((window) => row.createdAt >= window.start && row.createdAt < window.end);
      if (day === -1) continue;
      counts[day] += 1;
      unique[day].add(row.visitorHash);
    }

    const total = counts.reduce((sum, count) => sum + count, 0);
    const highestDailyViews = Math.max(...counts, 0);
    const milestones = buildMilestones(counts);
    const highest = milestones.length > 0 ? milestones[milestones.length - 1] : null;

    const performance = await prisma.memorialPerformance.upsert({
      where: { memorialId: memorial.id },
      create: { memorialId: memorial.id },
      update: {},
    });
    await prisma.memorialPerformance.update({
      where: { id: performance.id },
      data: {
        day1Views: counts[0],
        day2Views: counts[1],
        day3Views: counts[2],
        day1UniqueVisitors: unique[0].size,
        day2UniqueVisitors: unique[1].size,
        day3UniqueVisitors: unique[2].size,
        total72HourViews: total,
        highestDailyViews,
        performanceRating: ratePerformance(total),
        milestones,
        highestMilestoneAwarded: highest ? highest.badge : null,
      },
    });
    updated += 1;
  }
  if (updated > 0) {
    console.log(`Recalculated 72-hour performance snapshots for ${updated} memorials.`);
  }
}
