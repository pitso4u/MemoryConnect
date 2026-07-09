import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, ROLES } from '../middleware/auth';
import { env } from '../lib/env';

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
  const [homes, users, memorials, payments, views] = await Promise.all([
    prisma.funeralHome.findMany({ select: { id: true, status: true, createdAt: true } }),
    prisma.user.findMany({ select: { role: true, passwordSetAt: true } }),
    prisma.memorial.findMany({ select: { status: true, editLocksAt: true, publicExpiresAt: true, deletedAt: true, publishedAt: true } }),
    prisma.payment.findMany({ select: { amountCents: true, status: true, paidAt: true, createdAt: true } }),
    prisma.memorialView.count(),
  ]);
  const successful = payments.filter((payment) => isSuccessful(payment.status));
  const revenue = (from?: Date) => successful
    .filter((payment) => !from || (payment.paidAt || payment.createdAt) >= from)
    .reduce((sum, payment) => sum + payment.amountCents, 0);

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
      payments: { select: { amountCents: true, status: true, paidAt: true, updatedAt: true } },
      memorials: { select: { updatedAt: true } },
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
        ...home.memorials.map((memorial) => memorial.updatedAt),
        ...home.payments.map((payment) => payment.updatedAt),
      ] as Date[];
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
      familyInvitations: { orderBy: { createdAt: 'desc' }, take: 100, include: { memorial: { select: { deceasedName: true } } } },
      platformAuditLogs: { orderBy: { createdAt: 'desc' }, take: 100, include: { actor: { select: { name: true, email: true } } } },
    },
  });
  if (!home) return res.status(404).json({ success: false, error: 'Funeral home not found' });
  await audit(req.user!.userId, 'FUNERAL_HOME_DETAIL_VIEWED', 'FUNERAL_HOME', home.id, home.id);
  res.json({ success: true, data: home });
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
  const [totalViews, viewsToday, memorials, homes] = await Promise.all([
    prisma.memorialView.count(),
    prisma.memorialView.count({ where: { createdAt: { gte: today } } }),
    prisma.memorial.findMany({
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
  ]);
  const byRevenue = homes.map((home) => ({
    id: home.id,
    name: home.name,
    revenueCents: home.payments.filter((payment) => isSuccessful(payment.status)).reduce((sum, payment) => sum + payment.amountCents, 0),
  })).sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 10);
  const byMemorials = homes.map((home) => ({ id: home.id, name: home.name, memorialCount: home._count.memorials }))
    .sort((a, b) => b.memorialCount - a.memorialCount).slice(0, 10);
  res.json({ success: true, data: { totalViews, viewsToday, mostViewedMemorials: memorials, topHomesByMemorials: byMemorials, topHomesByRevenue: byRevenue } });
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
  await audit(req.user!.userId, 'MEMORIAL_DELETED', 'MEMORIAL', memorial.id, memorial.funeralHomeId, { deceasedName: memorial.deceasedName });
  await prisma.memorial.delete({ where: { id: memorial.id } });
  res.json({ success: true, data: null });
});

export default router;
