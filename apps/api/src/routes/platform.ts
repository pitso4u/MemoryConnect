import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, ROLES } from '../middleware/auth';
import { env } from '../lib/env';
import { getPlatformSettings, updatePlatformSettings } from '../lib/platformSettings';
import { computeHomeHealth, HomeHealth } from '../lib/homeHealth';
import {
  dayForEvent,
  finalizeDueMemorials,
  MILESTONES,
  MONITOR_WINDOW_MS,
} from '../lib/performance';

const router = Router();
router.use(authenticate, requireRole([ROLES.SUPER_ADMIN]));

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const startOfMonth = () => {
  const date = startOfToday();
  date.setDate(1);
  return date;
};

const upper = (value?: string | null) => (value || '').toUpperCase();
const isSuccessful = (status?: string | null) => ['SUCCESS', 'SUCCEEDED', 'PAID', 'VERIFIED'].includes(upper(status));
const isPending = (status?: string | null) => ['PENDING', 'PROCESSING', 'UNPAID'].includes(upper(status));
const isFailed = (status?: string | null) => ['FAILED', 'FAILURE', 'CANCELLED'].includes(upper(status));
const adminBaseUrl = () => (env.ADMIN_URL || 'https://admin.memoryconnect.co.za').replace(/\/$/, '');

async function audit(
  actorUserId: string,
  action: string,
  targetType: string,
  targetId: string,
  funeralHomeId?: string | null,
  details?: Record<string, unknown>,
) {
  return prisma.platformAuditLog.create({
    data: { actorUserId, action, targetType, targetId, funeralHomeId: funeralHomeId || null, details: details as never },
  });
}

async function paymentRows() {
  return prisma.payment.findMany({
    include: {
      funeralHome: { select: { id: true, name: true } },
      memorial: { select: { id: true, deceasedName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

router.get('/summary', async (_req, res) => {
  const today = startOfToday();
  const month = startOfMonth();
  const [homes, users, memorials, payments, views, creditPurchases] = await Promise.all([
    prisma.funeralHome.findMany({ select: { id: true, status: true, createdAt: true, trialStartsAt: true, trialEndsAt: true, trialMemorialsUsed: true, memorialCreditsRemaining: true } }),
    prisma.user.findMany({ select: { role: true, passwordSetAt: true } }),
    prisma.memorial.findMany({ where: { isDemo: false }, select: { status: true, editLocksAt: true, publicExpiresAt: true, deletedAt: true, publishedAt: true } }),
    prisma.payment.findMany({ select: { amountCents: true, status: true, paidAt: true, createdAt: true } }),
    prisma.memorialView.count({ where: { memorial: { isDemo: false } } }),
    prisma.creditPurchase.findMany({ select: { amountCents: true, status: true, paidAt: true, createdAt: true } }),
  ]);
  const successful = payments.filter((payment) => isSuccessful(payment.status));
  const successfulPurchases = creditPurchases.filter((purchase) => isSuccessful(purchase.status));
  const revenue = (from?: Date) => successful
    .filter((payment) => !from || (payment.paidAt || payment.createdAt) >= from)
    .reduce((sum, payment) => sum + payment.amountCents, 0)
    + successfulPurchases
      .filter((purchase) => !from || (purchase.paidAt || purchase.createdAt) >= from)
      .reduce((sum, purchase) => sum + purchase.amountCents, 0);

  const now = new Date();
  res.json({
    success: true,
    data: {
      registrations: {
        total: homes.length,
        today: homes.filter((home) => home.createdAt >= today).length,
        month: homes.filter((home) => home.createdAt >= month).length,
        pending: homes.filter((home) => upper(home.status) === 'PENDING').length,
        active: homes.filter((home) => upper(home.status) === 'ACTIVE').length,
        inactive: homes.filter((home) => upper(home.status) !== 'ACTIVE').length,
      },
      trials: {
        active: homes.filter((home) => home.trialEndsAt && home.trialEndsAt > now).length,
        expired: homes.filter((home) => home.trialStartsAt && (!home.trialEndsAt || home.trialEndsAt <= now)).length,
      },
      users: {
        total: users.length,
        withoutPassword: users.filter((user) => !user.passwordSetAt).length,
      },
      payments: {
        totalRevenueCents: revenue(),
        todayRevenueCents: revenue(today),
        monthRevenueCents: revenue(month),
        successful: successful.length,
        failed: payments.filter((payment) => isFailed(payment.status)).length,
        pending: payments.filter((payment) => isPending(payment.status)).length,
        creditPurchases: successfulPurchases.length,
        creditPurchaseRevenueCents: successfulPurchases.reduce((sum, purchase) => sum + purchase.amountCents, 0),
      },
      memorials: {
        total: memorials.length,
        draft: memorials.filter((memorial) => upper(memorial.status) === 'DRAFT' && !memorial.deletedAt).length,
        published: memorials.filter((memorial) => upper(memorial.status) === 'PUBLISHED' && !memorial.deletedAt).length,
        locked: memorials.filter((memorial) => memorial.editLocksAt && memorial.editLocksAt <= new Date() && !memorial.deletedAt).length,
        expired: memorials.filter((memorial) => memorial.publicExpiresAt && memorial.publicExpiresAt <= new Date() && !memorial.deletedAt).length,
        deleted: memorials.filter((memorial) => Boolean(memorial.deletedAt)).length,
        publishedThisMonth: memorials.filter((memorial) => memorial.publishedAt && memorial.publishedAt >= month).length,
      },
      totalPublicViews: views,
    },
  });
});

router.get('/funeral-homes', async (_req, res) => {
  const homes = await prisma.funeralHome.findMany({
    include: {
      users: { select: { name: true, email: true, role: true, lastLoginAt: true }, orderBy: { createdAt: 'asc' } },
      _count: { select: { memorials: true } },
      payments: { select: { amountCents: true, status: true, paidAt: true, createdAt: true, updatedAt: true } },
      memorials: { select: { createdAt: true, publishedAt: true, storageBytes: true, updatedAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({
    success: true,
    data: homes.map((home) => {
      const admin = home.users.find((user) => upper(user.role) === ROLES.FUNERAL_HOME_ADMIN) || home.users[0];
      const activityDates = [
        home.updatedAt,
        ...home.users.map((user) => user.lastLoginAt).filter(Boolean),
        ...home.memorials.map((memorial) => memorial.createdAt),
        ...home.memorials.map((memorial) => memorial.updatedAt),
        ...home.payments.map((payment) => payment.updatedAt),
      ] as Date[];
      const lastLoginAt = home.users
        .map((user) => user.lastLoginAt)
        .filter((u): u is Date => Boolean(u))
        .sort((a, b) => b.getTime() - a.getTime())[0] || null;
      const lastMemorialCreatedAt = home.memorials
        .map((memorial) => memorial.createdAt)
        .sort((a, b) => b.getTime() - a.getTime())[0] || null;
      const storageBytes = home.memorials.reduce((sum, memorial) => sum + (memorial.storageBytes ?? 0), 0);
      const health = computeHomeHealth({
        status: home.status,
        createdAt: home.createdAt,
        trialStartsAt: home.trialStartsAt,
        trialEndsAt: home.trialEndsAt,
        lastLoginAt,
        lastMemorialCreatedAt,
        totalMemorials: home._count.memorials,
        publishedMemorials: home.memorials.filter((memorial) => memorial.publishedAt).length,
        storageBytes,
        hasSuccessfulPayment: home.payments.some((payment) => isSuccessful(payment.status)),
        hasCreditPurchase: false,
        hasFailedPaymentRecently: home.payments.some((payment) => isFailed(payment.status)),
        hasPendingPaymentOverdue: home.payments.some((payment) => isPending(payment.status)),
      });
      return {
        id: home.id,
        name: home.name,
        ownerName: admin?.name || null,
        email: home.email,
        phone: home.phone,
        registeredAt: home.createdAt,
        memorialCount: home._count.memorials,
        paymentsTotalCents: home.payments.filter((payment) => isSuccessful(payment.status)).reduce((sum, payment) => sum + payment.amountCents, 0),
        lastActivityAt: activityDates.sort((a, b) => b.getTime() - a.getTime())[0] || home.createdAt,
        status: home.status,
        trialStartsAt: home.trialStartsAt,
        trialEndsAt: home.trialEndsAt,
        trialMemorialsUsed: home.trialMemorialsUsed,
        memorialCreditsPurchased: home.memorialCreditsPurchased,
        memorialCreditsRemaining: home.memorialCreditsRemaining,
        health: { segment: health.segment, label: health.label, color: health.color, reasons: health.reasons },
      };
    }),
  });
});

router.get('/funeral-homes/:id', async (req, res) => {
  const home = await prisma.funeralHome.findUnique({
    where: { id: req.params.id },
    include: {
      users: { select: { id: true, name: true, email: true, role: true, passwordSetAt: true, lastLoginAt: true, createdAt: true } },
      memorials: { orderBy: { createdAt: 'desc' }, take: 100 },
      payments: { orderBy: { createdAt: 'desc' }, take: 100, include: { memorial: { select: { deceasedName: true } } } },
      creditPurchases: { orderBy: { createdAt: 'desc' }, take: 100 },
      familyInvitations: { orderBy: { createdAt: 'desc' }, take: 100, include: { memorial: { select: { deceasedName: true } } } },
      platformAuditLogs: { orderBy: { createdAt: 'desc' }, take: 100, include: { actor: { select: { name: true, email: true } } } },
      featureOverrides: {
        orderBy: { enabledAt: 'desc' },
        include: { feature: { select: { key: true, name: true, releaseChannel: true, premium: true } } },
      },
      vehicles: { orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, name: true, registrationNumber: true, vehicleType: true, status: true } },
      assets: { orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, name: true, category: true, status: true } },
      _count: { select: { users: true, memorials: true, vehicles: true, assets: true } },
    },
  });
  if (!home) return res.status(404).json({ success: false, error: 'Funeral home not found' });
  await audit(req.user!.userId, 'FUNERAL_HOME_DETAIL_VIEWED', 'FUNERAL_HOME', home.id, home.id);
  const lastLoginAt = home.users
    .map((user) => user.lastLoginAt)
    .filter((u): u is Date => Boolean(u))
    .sort((a, b) => b.getTime() - a.getTime())[0] || null;
  const lastMemorialCreatedAt = home.memorials
    .map((memorial) => memorial.createdAt)
    .sort((a, b) => b.getTime() - a.getTime())[0] || null;
  const storageBytes = home.memorials.reduce((sum, memorial) => sum + (memorial.storageBytes ?? 0), 0);
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000);
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
  const health = computeHomeHealth({
    status: home.status,
    createdAt: home.createdAt,
    trialStartsAt: home.trialStartsAt,
    trialEndsAt: home.trialEndsAt,
    lastLoginAt,
    lastMemorialCreatedAt,
    totalMemorials: home._count.memorials,
    publishedMemorials: home.memorials.filter((memorial) => memorial.status === 'PUBLISHED').length,
    storageBytes,
    hasSuccessfulPayment: home.payments.some((payment) => isSuccessful(payment.status)),
    hasCreditPurchase: home.creditPurchases.some((purchase) => isSuccessful(purchase.status)),
    hasFailedPaymentRecently: home.payments.some((payment) => isFailed(payment.status) && payment.createdAt >= twoWeeksAgo),
    hasPendingPaymentOverdue: home.payments.some((payment) => isPending(payment.status) && payment.createdAt < threeDaysAgo),
  });
  res.json({
    success: true,
    data: {
      ...home,
      storageBytes,
      health: { segment: health.segment, label: health.label, color: health.color, reasons: health.reasons },
    },
  });
});

router.get('/payments', async (_req, res) => {
  const payments = await paymentRows();
  res.json({ success: true, data: payments });
});

router.get('/users', async (_req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true, name: true, email: true, role: true, passwordSetAt: true, lastLoginAt: true, createdAt: true,
      funeralHome: { select: { id: true, name: true, status: true } },
      passwordResetTokens: { where: { usedAt: null }, select: { id: true, createdAt: true, expiresAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: users });
});

router.get('/support', async (_req, res) => {
  const now = new Date();
  const [resetRequests, failedLogins, pendingInvites, expiredInvites, usersWithoutPasswords] = await Promise.all([
    prisma.passwordResetToken.findMany({
      where: { usedAt: null },
      include: { user: { select: { id: true, name: true, email: true, funeralHome: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.loginAttempt.findMany({ where: { success: false }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.familyInvitation.count({ where: { acceptedAt: null, expiresAt: { gt: now } } }),
    prisma.familyInvitation.count({ where: { acceptedAt: null, expiresAt: { lte: now } } }),
    prisma.user.findMany({
      where: { passwordSetAt: null },
      select: { id: true, name: true, email: true, role: true, funeralHome: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);
  res.json({ success: true, data: { resetRequests, failedLogins, pendingInvites, expiredInvites, usersWithoutPasswords } });
});

router.get('/analytics', async (_req, res) => {
  const today = startOfToday();
  const now = new Date();
  await finalizeDueMemorials(now);

  const [totalViews, viewsToday, memorials, homes, performanceRows, publishedMemorials] = await Promise.all([
    prisma.memorialView.count({ where: { memorial: { isDemo: false } } }),
    prisma.memorialView.count({ where: { createdAt: { gte: today }, memorial: { isDemo: false } } }),
    prisma.memorial.findMany({
      where: { isDemo: false },
      select: { id: true, deceasedName: true, slug: true, viewCount: true, funeralHome: { select: { id: true, name: true } } },
      orderBy: { viewCount: 'desc' },
      take: 10,
    }),
    prisma.funeralHome.findMany({
      select: {
        id: true, name: true,
        _count: { select: { memorials: true } },
        payments: { select: { amountCents: true, status: true } },
      },
    }),
    prisma.memorialPerformance.findMany({
      where: { memorial: { isDemo: false } },
      include: { memorial: { select: { id: true, deceasedName: true, slug: true, status: true, publishedAt: true, funeralHome: { select: { id: true, name: true } } } } },
    }),
    prisma.memorial.findMany({
      where: { isDemo: false, publishedAt: { not: null }, deletedAt: null },
      select: { id: true, deceasedName: true, slug: true, status: true, publishedAt: true, funeralHome: { select: { id: true, name: true } } },
    }),
  ]);
  const byRevenue = homes.map((home) => ({
    id: home.id,
    name: home.name,
    revenueCents: home.payments.filter((payment) => isSuccessful(payment.status)).reduce((sum, payment) => sum + payment.amountCents, 0),
  })).sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 10);
  const byMemorials = homes.map((home) => ({ id: home.id, name: home.name, memorialCount: home._count.memorials }))
    .sort((a, b) => b.memorialCount - a.memorialCount).slice(0, 10);

  const trendingMemorials = publishedMemorials
    .map((memorial) => {
      const performance = performanceRows.find((row) => row.memorialId === memorial.id);
      const day = dayForEvent(memorial.publishedAt, now);
      const currentDayViews =
        day === 1 ? (performance?.day1Views || 0)
        : day === 2 ? (performance?.day2Views || 0)
        : (performance?.day3Views || 0);
      return {
        id: memorial.id,
        slug: memorial.slug,
        deceasedName: memorial.deceasedName,
        funeralHome: { id: memorial.funeralHome.id, name: memorial.funeralHome.name },
        day,
        currentDayViews,
        total72HourViews: performance?.total72HourViews || 0,
        performanceRating: performance?.performanceRating || 'New',
        highestMilestoneAwarded: performance?.highestMilestoneAwarded || null,
        monitoring: day !== null,
      };
    })
    .filter((memorial) => memorial.monitoring)
    .sort((a, b) => b.currentDayViews - a.currentDayViews)
    .slice(0, 10);

  const withStats = performanceRows.map((performance) => ({
    day1Views: performance.day1Views,
    day2Views: performance.day2Views,
    day3Views: performance.day3Views,
    total72HourViews: performance.total72HourViews,
    highestMilestoneAwarded: performance.highestMilestoneAwarded,
    memorial: performance.memorial,
  }));

  const average = (picker: (row: { day1Views: number; day2Views: number; day3Views: number }) => number) => {
    if (withStats.length === 0) return 0;
    return Math.round(withStats.reduce((sum, row) => sum + picker(row), 0) / withStats.length);
  };
  const averageFirstDayViews = average((row) => row.day1Views);
  const average72HourViews = withStats.length
    ? Math.round(withStats.reduce((sum, row) => sum + row.total72HourViews, 0) / withStats.length)
    : 0;
  const memorialsOver100Views = withStats.filter((row) => row.total72HourViews >= MILESTONES[0].threshold).length;
  const memorialsOver500Views = withStats.filter((row) => row.total72HourViews >= MILESTONES[2].threshold).length;
  const monitoringCount = publishedMemorials.filter((memorial) => {
    const elapsed = now.getTime() - memorial.publishedAt!.getTime();
    return elapsed >= 0 && elapsed < MONITOR_WINDOW_MS;
  }).length;

  res.json({
    success: true,
    data: {
      totalViews,
      viewsToday,
      mostViewedMemorials: memorials,
      topHomesByMemorials: byMemorials,
      topHomesByRevenue: byRevenue,
      performance: {
        averageFirstDayViews,
        average72HourViews,
        memorialsOver100Views,
        memorialsOver500Views,
        monitoringCount,
        trendingMemorials,
      },
    },
  });
});

router.get('/audit-logs', async (_req, res) => {
  const logs = await prisma.platformAuditLog.findMany({
    include: { actor: { select: { name: true, email: true } }, funeralHome: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 250,
  });
  res.json({ success: true, data: logs });
});

router.post('/funeral-homes/:id/suspend', async (req, res) => {
  const home = await prisma.funeralHome.findUnique({ where: { id: req.params.id } });
  if (!home) return res.status(404).json({ success: false, error: 'Funeral home not found' });
  const updated = await prisma.funeralHome.update({ where: { id: home.id }, data: { status: 'SUSPENDED', suspendedAt: new Date() } });
  await audit(req.user!.userId, 'FUNERAL_HOME_SUSPENDED', 'FUNERAL_HOME', home.id, home.id, { previousStatus: home.status });
  res.json({ success: true, data: updated });
});

router.post('/funeral-homes/:id/reactivate', async (req, res) => {
  const home = await prisma.funeralHome.findUnique({ where: { id: req.params.id } });
  if (!home) return res.status(404).json({ success: false, error: 'Funeral home not found' });
  const updated = await prisma.funeralHome.update({ where: { id: home.id }, data: { status: 'ACTIVE', suspendedAt: null } });
  await audit(req.user!.userId, 'FUNERAL_HOME_REACTIVATED', 'FUNERAL_HOME', home.id, home.id, { previousStatus: home.status });
  res.json({ success: true, data: updated });
});

router.post('/users/:id/send-password-reset', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });
  await audit(req.user!.userId, 'PASSWORD_RESET_SENT', 'USER', user.id, user.funeralHomeId, { email: user.email, expiresAt });
  res.json({ success: true, data: { resetUrl: `${adminBaseUrl()}/reset-password/${token}`, email: user.email, expiresAt } });
});

router.post('/invites/:id/resend', async (req, res) => {
  const invitation = await prisma.familyInvitation.findUnique({ where: { id: req.params.id } });
  if (!invitation) return res.status(404).json({ success: false, error: 'Invitation not found' });
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const updated = await prisma.familyInvitation.update({
    where: { id: invitation.id },
    data: { token, tokenHash, expiresAt, acceptedAt: null },
  });
  await audit(req.user!.userId, 'FAMILY_INVITE_RESENT', 'FAMILY_INVITATION', invitation.id, invitation.funeralHomeId, { expiresAt });
  res.json({ success: true, data: { ...updated, inviteUrl: `${adminBaseUrl()}/family/invite/${token}` } });
});

router.post('/payments/:id/verify', async (req, res) => {
  if (req.body?.confirmed !== true) return res.status(400).json({ success: false, error: 'Explicit confirmation is required' });
  const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
  if (!payment) return res.status(404).json({ success: false, error: 'Payment not found' });
  const paidAt = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const verified = await tx.payment.update({ where: { id: payment.id }, data: { status: 'SUCCESS', paidAt } });
    await tx.memorial.update({ where: { id: payment.memorialId }, data: { paymentStatus: 'PAID', paymentId: payment.id } });
    return verified;
  });
  await audit(req.user!.userId, 'PAYMENT_MANUALLY_VERIFIED', 'PAYMENT', payment.id, payment.funeralHomeId, {
    reference: payment.paystackReference,
    previousStatus: payment.status,
  });
  res.json({ success: true, data: updated });
});

router.delete('/memorials/:id', async (req, res) => {
  if (req.body?.confirmed !== true) return res.status(400).json({ success: false, error: 'Explicit confirmation is required' });
  const memorial = await prisma.memorial.findUnique({ where: { id: req.params.id } });
  if (!memorial) return res.status(404).json({ success: false, error: 'Memorial not found' });
  if (memorial.isDemo) return res.status(403).json({ success: false, error: 'The permanent demo memorial cannot be deleted from this screen. Use the demo seed to reset it.' });
  await audit(req.user!.userId, 'MEMORIAL_DELETED', 'MEMORIAL', memorial.id, memorial.funeralHomeId, { deceasedName: memorial.deceasedName });
  await prisma.memorial.delete({ where: { id: memorial.id } });
  res.json({ success: true, data: null });
});

const commercialSettingsSchema = z.object({
  trialEnabled: z.boolean().optional(),
  trialDays: z.number().int().min(1).max(365).optional(),
  freeMemorialLimit: z.number().int().min(1).max(1000).optional(),
  singleMemorialPriceCents: z.number().int().min(1).optional(),
  currency: z.string().min(3).max(8).optional(),
  subscriptionsEnabled: z.boolean().optional(),
  creditBundles: z.array(z.object({
    credits: z.number().int().positive(),
    priceCents: z.number().int().positive(),
  })).optional(),
});

router.get('/commercial-settings', async (_req, res) => {
  const settings = await getPlatformSettings();
  res.json({ success: true, data: settings });
});

router.patch('/commercial-settings', async (req, res) => {
  try {
    const body = commercialSettingsSchema.parse(req.body ?? {});
    const settings = await updatePlatformSettings(body);
    await audit(req.user!.userId, 'COMMERCIAL_SETTINGS_UPDATED', 'PLATFORM_SETTING', 'commercial', null, body as unknown as Record<string, unknown>);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    throw error;
  }
});

router.get('/credit-purchases', async (_req, res) => {
  const purchases = await prisma.creditPurchase.findMany({
    include: { funeralHome: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: purchases });
});

router.post('/credit-purchases/:id/verify', async (req, res) => {
  if (req.body?.confirmed !== true) return res.status(400).json({ success: false, error: 'Explicit confirmation is required' });
  const purchase = await prisma.creditPurchase.findUnique({ where: { id: req.params.id } });
  if (!purchase) return res.status(404).json({ success: false, error: 'Credit purchase not found' });
  const paidAt = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const verified = await tx.creditPurchase.update({ where: { id: purchase.id }, data: { status: 'SUCCESS', paidAt } });
    await tx.funeralHome.update({
      where: { id: purchase.funeralHomeId },
      data: {
        memorialCreditsPurchased: { increment: purchase.credits },
        memorialCreditsRemaining: { increment: purchase.credits },
        lastCreditPurchaseAt: paidAt,
      },
    });
    return verified;
  });
  await audit(req.user!.userId, 'CREDIT_PURCHASE_MANUALLY_VERIFIED', 'CREDIT_PURCHASE', purchase.id, purchase.funeralHomeId, {
    reference: purchase.paystackReference,
    previousStatus: purchase.status,
  });
  res.json({ success: true, data: updated });
});

// ── REVENUE CENTER ────────────────────────────────────────────────────────────

const MONTHS = 12;
function revenueMonthBuckets(): { label: string; start: Date; next: Date }[] {
  const buckets: { label: string; start: Date; next: Date }[] = [];
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  for (let i = MONTHS - 1; i >= 0; i--) {
    const monthStart = new Date(start.getFullYear(), start.getMonth() - i, 1);
    const nextMonth = new Date(start.getFullYear(), start.getMonth() - i + 1, 1);
    buckets.push({
      label: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
      start: monthStart,
      next: nextMonth,
    });
  }
  return buckets;
}

router.get('/revenue', async (_req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      select: { amountCents: true, status: true, paidAt: true, createdAt: true, funeralHomeId: true },
      orderBy: { createdAt: 'desc' },
    });
    const purchases = await prisma.creditPurchase.findMany({
      select: { amountCents: true, status: true, paidAt: true, createdAt: true, funeralHomeId: true },
      orderBy: { createdAt: 'desc' },
    });

    const buckets = revenueMonthBuckets();
    const byHome = new Map<string, { name: string; revenueCents: number }>();

    const trend = buckets.map((bucket) => {
      const paymentsCents = payments
        .filter((p) => isSuccessful(p.status) && (p.paidAt || p.createdAt) >= bucket.start && (p.paidAt || p.createdAt) < bucket.next)
        .reduce((sum, p) => sum + p.amountCents, 0);
      const creditsCents = purchases
        .filter((p) => isSuccessful(p.status) && (p.paidAt || p.createdAt) >= bucket.start && (p.paidAt || p.createdAt) < bucket.next)
        .reduce((sum, p) => sum + p.amountCents, 0);
      for (const p of payments) {
        if (isSuccessful(p.status) && (p.paidAt || p.createdAt) >= bucket.start && (p.paidAt || p.createdAt) < bucket.next) {
          byHome.set(p.funeralHomeId, { name: '', revenueCents: (byHome.get(p.funeralHomeId)?.revenueCents ?? 0) + p.amountCents });
        }
      }
      for (const p of purchases) {
        if (isSuccessful(p.status) && (p.paidAt || p.createdAt) >= bucket.start && (p.paidAt || p.createdAt) < bucket.next) {
          byHome.set(p.funeralHomeId, { name: '', revenueCents: (byHome.get(p.funeralHomeId)?.revenueCents ?? 0) + p.amountCents });
        }
      }
      return { month: bucket.label, paymentsCents, creditsCents, totalCents: paymentsCents + creditsCents };
    });

    const totalRevenueCents = (trend[trend.length - 1]?.totalCents ?? 0);
    const thisYearCents = trend.reduce((sum, t) => sum + t.totalCents, 0);
    const lastMonthCents = trend[trend.length - 2]?.totalCents ?? 0;
    const thisMonthCents = trend[trend.length - 1]?.totalCents ?? 0;
    const growthPct = lastMonthCents > 0 ? ((thisMonthCents - lastMonthCents) / lastMonthCents) * 100 : 0;

    const homeNamesById = new Map<string, string>(
      (await prisma.funeralHome.findMany({ select: { id: true, name: true } })).map((h) => [h.id, h.name]),
    );

    const topHomes = [...byHome.entries()]
      .map(([id, agg]) => ({ id, name: homeNamesById.get(id) ?? id, revenueCents: agg.revenueCents }))
      .sort((a, b) => b.revenueCents - a.revenueCents)
      .slice(0, 10);

    res.json({
      success: true,
      data: {
        trend,
        summary: {
          thisYearCents,
          thisMonthCents,
          lastMonthCents,
          growthPct: Math.round(growthPct * 10) / 10,
        },
        topHomes,
        statusBreakdown: {
          payments: {
            successful: payments.filter((p) => isSuccessful(p.status)).length,
            failed: payments.filter((p) => isFailed(p.status)).length,
            pending: payments.filter((p) => isPending(p.status)).length,
          },
          creditPurchases: {
            successful: purchases.filter((p) => isSuccessful(p.status)).length,
            failed: purchases.filter((p) => isFailed(p.status)).length,
            pending: purchases.filter((p) => isPending(p.status)).length,
          },
        },
      },
    });
  } catch (error) {
    console.error('Get platform revenue error:', error);
    res.status(500).json({ success: false, error: 'Failed to load revenue data' });
  }
});

export default router;
