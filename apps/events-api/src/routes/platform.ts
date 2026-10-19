import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateEvents, requireEventsSuperuser } from '../lib/auth';
import { buildEventPerformanceSummary, finalizeDueEvents } from '../lib/performance';

const router = Router();
router.use(authenticateEvents, requireEventsSuperuser);

async function audit(req: Parameters<typeof authenticateEvents>[0], action: string, targetType: string, targetId: string, organiserId?: string | null, details?: Record<string, unknown>) {
  await prisma.platformAuditLog.create({ data: {
    actorUserId: req.eventsUser!.userId,
    action,
    targetType,
    targetId,
    organiserId: organiserId ?? null,
    details: details ? JSON.stringify(details) : null,
  } });
}

router.get('/performance-summary', async (_req, res) => {
  await finalizeDueEvents();
  const events = await prisma.event.findMany({
    where: { publishedAt: { not: null } },
    include: { performance: true },
  });
  const now = new Date();
  const trending = events
    .filter((event) => {
      const elapsed = now.getTime() - (event.publishedAt?.getTime() ?? 0);
      const day = Math.floor(elapsed / (24 * 60 * 60 * 1000)) + 1;
      return day >= 1 && day <= 3;
    })
    .map((event) => {
      const elapsed = now.getTime() - (event.publishedAt?.getTime() ?? 0);
      const day = Math.min(3, Math.max(1, Math.floor(elapsed / (24 * 60 * 60 * 1000)) + 1));
      const perf = event.performance;
      const currentDayViews = day === 1 ? perf?.day1Views : day === 2 ? perf?.day2Views : perf?.day3Views ?? 0;
      return {
        id: event.id,
        slug: event.slug,
        title: event.title,
        status: event.status,
        publishedAt: event.publishedAt!.toISOString(),
        day,
        currentDayViews: currentDayViews ?? 0,
        total72HourViews: perf?.total72HourViews ?? 0,
        uniqueVisitors: (day === 1 ? perf?.day1UniqueVisitors : day === 2 ? perf?.day2UniqueVisitors : perf?.day3UniqueVisitors) ?? 0,
        performanceRating: perf?.performanceRating ?? 'New',
        highestMilestoneAwarded: perf?.highestMilestoneAwarded ?? null,
        finalized: Boolean(perf?.finalized),
      };
    })
    .sort((a, b) => b.currentDayViews - a.currentDayViews)
    .slice(0, 10);
  res.json({ success: true, data: { trending } });
});

router.get('/overview', async (_req, res) => {
  const [organisers, activeOrganisers, users, events, published, drafts, payments, successfulPayments, pendingPayments, views] = await Promise.all([
    prisma.organiser.count(), prisma.organiser.count({ where: { status: 'ACTIVE' } }), prisma.user.count(),
    prisma.event.count(), prisma.event.count({ where: { status: 'PUBLISHED' } }), prisma.event.count({ where: { status: 'DRAFT' } }),
    prisma.eventPayment.count(), prisma.eventPayment.findMany({ where: { status: 'SUCCESS' }, select: { amountCents: true } }),
    prisma.eventPayment.count({ where: { status: 'PENDING' } }), prisma.eventView.count(),
  ]);
  res.json({ success: true, data: {
    organisers, activeOrganisers, users, events, published, drafts, payments, pendingPayments, views,
    revenueCents: successfulPayments.reduce((sum, payment) => sum + payment.amountCents, 0),
  } });
});

router.get('/organisers', async (_req, res) => {
  const rows = await prisma.organiser.findMany({
    include: { _count: { select: { users: true, events: true } } }, orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: rows });
});

router.post('/organisers/:id/suspend', async (req, res) => {
  const organiser = await prisma.organiser.findUnique({ where: { id: req.params.id } });
  if (!organiser) return res.status(404).json({ success: false, error: 'Organiser not found' });
  const updated = await prisma.organiser.update({ where: { id: organiser.id }, data: { status: 'SUSPENDED', suspendedAt: new Date() } });
  await audit(req, 'ORGANISER_SUSPENDED', 'ORGANISER', organiser.id, organiser.id, { previousStatus: organiser.status });
  res.json({ success: true, data: updated });
});

router.post('/organisers/:id/reactivate', async (req, res) => {
  const organiser = await prisma.organiser.findUnique({ where: { id: req.params.id } });
  if (!organiser) return res.status(404).json({ success: false, error: 'Organiser not found' });
  const updated = await prisma.organiser.update({ where: { id: organiser.id }, data: { status: 'ACTIVE', suspendedAt: null } });
  await audit(req, 'ORGANISER_REACTIVATED', 'ORGANISER', organiser.id, organiser.id, { previousStatus: organiser.status });
  res.json({ success: true, data: updated });
});

router.get('/events', async (_req, res) => {
  const rows = await prisma.event.findMany({
    include: { organiser: { select: { id: true, name: true, email: true, status: true } }, _count: { select: { views: true, messages: true, photos: true } } },
    orderBy: { updatedAt: 'desc' }, take: 500,
  });
  res.json({ success: true, data: rows });
});

router.post('/events/:id/status', async (req, res) => {
  const status = req.body?.status;
  if (!['DRAFT', 'ARCHIVED'].includes(status)) return res.status(400).json({ success: false, error: 'Status must be DRAFT or ARCHIVED' });
  const event = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
  const updated = await prisma.event.update({ where: { id: event.id }, data: { status } });
  await audit(req, status === 'ARCHIVED' ? 'EVENT_ARCHIVED' : 'EVENT_UNPUBLISHED', 'EVENT', event.id, event.organiserId, { previousStatus: event.status });
  res.json({ success: true, data: updated });
});

router.get('/payments', async (_req, res) => {
  const rows = await prisma.eventPayment.findMany({
    include: { event: { select: { id: true, title: true, slug: true, organiser: { select: { id: true, name: true, email: true } } } } },
    orderBy: { createdAt: 'desc' }, take: 500,
  });
  res.json({ success: true, data: rows });
});

router.get('/audit-logs', async (_req, res) => {
  const rows = await prisma.platformAuditLog.findMany({
    include: { actor: { select: { name: true, email: true } }, organiser: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' }, take: 250,
  });
  res.json({ success: true, data: rows });
});

export default router;
