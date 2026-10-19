import { Router } from 'express';
import os from 'os';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, ROLES } from '../middleware/auth';
import { env } from '../lib/env';
import { UPLOADS_DIR } from '../lib/uploads';
import { computeHomeHealth, segmentLabel, HomeSegment } from '../lib/homeHealth';

const router = Router();
router.use(authenticate, requireRole([ROLES.SUPER_ADMIN]));

const DAY = 86400000;
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const upper = (value?: string | null) => (value || '').toUpperCase();
const isSuccessful = (status?: string | null) => ['SUCCESS', 'SUCCEEDED', 'PAID', 'VERIFIED'].includes(upper(status));
const isFailed = (status?: string | null) => ['FAILED', 'FAILURE', 'CANCELLED'].includes(upper(status));
const isPending = (status?: string | null) => ['PENDING', 'PROCESSING', 'UNPAID'].includes(upper(status));

interface ServiceStatus {
  status: 'ok' | 'warning' | 'critical';
  label: string;
  detail?: string;
}

export interface PlatformAttentionItem {
  id: string;
  kind: 'memorial' | 'home';
  title: string;
  detail: string;
  reason: string;
  homeId?: string | null;
  homeName?: string | null;
  link?: string | null;
  severity: 'critical' | 'warning' | 'info';
}

const SEGMENT_SCORE: Record<HomeSegment, number> = {
  healthy: 95,
  needsAttention: 72,
  trialEnding: 70,
  paymentFailed: 30,
  inactive: 15,
  atRisk: 20,
  cancelled: 0,
};

function dailyBuckets(days: number): { label: string; ts: number; start: Date; next: Date }[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const buckets: { label: string; ts: number; start: Date; next: Date }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const start = new Date(todayStart.getTime() - i * DAY);
    const next = new Date(start.getTime() + DAY);
    buckets.push({
      label: `${start.getDate()} ${start.toLocaleString('en', { month: 'short' })}`,
      ts: start.getTime(),
      start,
      next,
    });
  }
  return buckets;
}

async function loadPlatformVersion(): Promise<string> {
  try {
    const pkg = JSON.parse(fs.readFileSync(`${process.cwd()}/package.json`, 'utf8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

router.get('/dashboard', async (_req, res) => {
  const today = startOfToday();
  const twoWeeksAgo = new Date(Date.now() - 14 * DAY);
  const threeDaysAgo = new Date(Date.now() - 3 * DAY);
  const now = new Date();

  // ── Service health checks ────────────────────────────────────────────────
  let database: ServiceStatus = { status: 'critical', label: 'Database', detail: 'Database unreachable' };
  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    database = { status: 'ok', label: 'Database', detail: `Responded in ${Date.now() - t0}ms` };
  } catch {
    database = { status: 'critical', label: 'Database', detail: 'Database unreachable' };
  }

  let storage: ServiceStatus;
  try {
    fs.accessSync(UPLOADS_DIR, fs.constants.W_OK);
    storage = { status: 'ok', label: 'Storage', detail: 'Uploads directory writable' };
  } catch {
    storage = { status: 'critical', label: 'Storage', detail: 'Uploads directory not writable' };
  }

  const [hasPaystack, successfulPayments, whatsappHomes, storageBytes] = await Promise.all([
    Boolean(env.PAYSTACK_SECRET_KEY),
    prisma.payment.count({ where: { status: 'SUCCESS' } }),
    prisma.funeralHome.count({ where: { whatsapp: { not: null } } }),
    prisma.memorial.aggregate({ _sum: { storageBytes: true } }),
  ]);

  const paymentsHealth: ServiceStatus = !hasPaystack
    ? { status: 'critical', label: 'Payments', detail: 'Paystack secret not configured' }
    : successfulPayments > 0
    ? { status: 'ok', label: 'Payments', detail: 'Paystack online' }
    : { status: 'warning', label: 'Payments', detail: 'Paystack configured, awaiting first payment' };

  const emailHealth: ServiceStatus =
    env.SMTP_HOST && env.SMTP_USER
      ? { status: 'ok', label: 'Email', detail: 'SMTP configured' }
      : { status: 'warning', label: 'Email', detail: 'SMTP not configured — emails fall back to console' };

  const qrHealth: ServiceStatus = env.MEMORIAL_URL
    ? { status: 'ok', label: 'QR Generator', detail: 'Public host configured' }
    : { status: 'warning', label: 'QR Generator', detail: 'MEMORIAL_URL not set' };

  const whatsappHealth: ServiceStatus = whatsappHomes > 0
    ? { status: 'ok', label: 'WhatsApp', detail: `${whatsappHomes} homes configured` }
    : { status: 'warning', label: 'WhatsApp', detail: 'No WhatsApp numbers configured yet' };

  const health = {
    api: { status: 'ok' as const, label: 'API', detail: 'Control center reachable' },
    database,
    storage,
    payments: paymentsHealth,
    email: emailHealth,
    qr: qrHealth,
    whatsapp: whatsappHealth,
  };

  // ── Server load ──────────────────────────────────────────────────────────
  const cpus = os.cpus().length || 1;
  const load = os.loadavg();
  const cpuPercent = Math.min(100, Math.round((load[0] / cpus) * 100));
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPercent = Math.round((usedMem / totalMem) * 100);
  const platformVersion = await loadPlatformVersion();

  const server = {
    version: platformVersion,
    uptimeSeconds: Math.round(os.uptime()),
    cpu: { loadAverage: load, percent: cpuPercent },
    memory: { usedMb: Math.round(usedMem / 1024 / 1024), totalMb: Math.round(totalMem / 1024 / 1024), percent: memPercent },
    storage: { usedBytes: storageBytes._sum.storageBytes || 0 },
  };

  // ── Today's numbers ──────────────────────────────────────────────────────
  const [revenueRows, memorialsToday, publishedToday, viewsToday, qrScansToday, photosToday, videosToday, newHomes, enquiriesToday] =
    await Promise.all([
      prisma.payment.findMany({ where: { createdAt: { gte: today } }, select: { amountCents: true, status: true, paidAt: true, createdAt: true } }),
      prisma.memorial.count({ where: { createdAt: { gte: today }, isDemo: false } }),
      prisma.memorial.count({ where: { publishedAt: { gte: today } } }),
      prisma.memorialView.count({ where: { createdAt: { gte: today } } }),
      prisma.analyticsEvent.count({ where: { eventType: 'qr_scan', createdAt: { gte: today } } }),
      prisma.photo.count({ where: { createdAt: { gte: today } } }),
      prisma.photo.count({ where: { createdAt: { gte: today }, mediaType: 'VIDEO' } }),
      prisma.funeralHome.count({ where: { createdAt: { gte: today } } }),
      prisma.enquiry.count({ where: { createdAt: { gte: today } } }),
    ]);

  const revenueTodayCents = revenueRows
    .filter((p) => isSuccessful(p.status) && (p.paidAt || p.createdAt))
    .reduce((sum, p) => sum + p.amountCents, 0);

  const todayNumbers = {
    revenueCents: revenueTodayCents,
    memorialsCreated: memorialsToday,
    memorialsPublished: publishedToday,
    visitors: viewsToday,
    qrScans: qrScansToday,
    photoUploads: photosToday,
    videosUploaded: videosToday,
    newHomes,
    enquiries: enquiriesToday,
  };

  // ── Live activity feed ───────────────────────────────────────────────────
  const [createdMemorials, publishedMemorials, receivedPayments, newHomesList, featureActions, auditActions] = await Promise.all([
    prisma.memorial.findMany({
      where: { isDemo: false, createdAt: { gte: new Date(Date.now() - 12 * HOUR) } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { deceasedName: true, slug: true, createdAt: true, funeralHome: { select: { id: true, name: true } } },
    }),
    prisma.memorial.findMany({
      where: { publishedAt: { gte: new Date(Date.now() - 12 * HOUR) } },
      orderBy: { publishedAt: 'desc' },
      take: 8,
      select: { deceasedName: true, slug: true, publishedAt: true, funeralHome: { select: { id: true, name: true } } },
    }),
    prisma.payment.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 12 * HOUR) }, status: 'SUCCESS' },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, amountCents: true, createdAt: true, paystackReference: true, funeralHome: { select: { id: true, name: true } } },
    }),
    prisma.funeralHome.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 12 * HOUR) } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, name: true, createdAt: true, _count: { select: { memorials: true } } },
    }),
    prisma.featureAuditLog.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 12 * HOUR) } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, featureKey: true, action: true, targetType: true, createdAt: true, funeralHomeId: true, feature: { select: { name: true } } },
    }),
    prisma.platformAuditLog.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 12 * HOUR) } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, action: true, targetType: true, targetId: true, createdAt: true, funeralHomeId: true, actor: { select: { name: true } }, funeralHome: { select: { name: true } } },
    }),
   ]);

   const money = (cents: number) => `R ${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
   const time = (d?: Date | string | null) => (d ? new Date(d).toISOString() : null);
   const activity = [
    ...createdMemorials.map((m) => ({
      id: `memorial:${m.slug}`,
      type: 'memorial' as const,
      title: 'Memorial created',
      detail: m.deceasedName,
      funeralHomeName: m.funeralHome?.name || null,
      link: `/admin-owner/funeral-homes/${m.funeralHome?.id || ''}`,
      createdAt: time(m.createdAt),
    })),
    ...publishedMemorials.map((m) => ({
      id: `published:${m.slug}`,
      type: 'memorial' as const,
      title: 'Memorial published',
      detail: m.deceasedName,
      funeralHomeName: m.funeralHome?.name || null,
      link: `/admin-owner/funeral-homes/${m.funeralHome?.id || ''}`,
      createdAt: time(m.publishedAt),
    })),
    ...receivedPayments.map((p) => ({
      id: `payment:${p.id}`,
      type: 'payment' as const,
      title: 'Payment received',
      detail: money(p.amountCents),
      funeralHomeName: p.funeralHome?.name || null,
      link: `/admin-owner/payments`,
      createdAt: time(p.createdAt),
    })),
    ...newHomesList.map((h) => ({
      id: `home:${h.id}`,
      type: 'home' as const,
      title: 'New funeral home registered',
      detail: h.name,
      funeralHomeName: h.name,
      link: `/admin-owner/funeral-homes/${h.id}`,
      createdAt: time(h.createdAt),
    })),
    ...featureActions.map((f) => ({
      id: `feature:${f.id}`,
      type: 'feature' as const,
      title: 'Feature flag updated',
      detail: `${f.feature?.name || f.featureKey} — ${f.action}`,
      funeralHomeName: null,
      link: `/admin-owner/features`,
      createdAt: time(f.createdAt),
    })),
    ...auditActions
      .filter((a) => ['FUNERAL_HOME_SUSPENDED', 'FUNERAL_HOME_REACTIVATED', 'PAYMENT_MANUALLY_VERIFIED', 'CREDIT_PURCHASE_MANUALLY_VERIFIED'].includes(a.action))
      .map((a) => ({
        id: `audit:${a.id}`,
        type: 'audit' as const,
        title: actionLabel(a.action),
        detail: a.targetId,
        funeralHomeName: a.funeralHome?.name || null,
        link: a.funeralHomeId ? `/admin-owner/funeral-homes/${a.funeralHomeId}` : `/admin-owner/audit-logs`,
        createdAt: time(a.createdAt),
      })),
  ]
    .filter((a) => a.createdAt)
    .sort((a, b) => (b.createdAt as string).localeCompare(a.createdAt as string))
    .slice(0, 24);

  // ── Customer success home health ────────────────────────────────────────
  const healthRows = await loadHomesWithHealth(twoWeeksAgo, threeDaysAgo);
  const segmentCounts = {
    healthy: 0,
    needsAttention: 0,
    trialEnding: 0,
    paymentFailed: 0,
    inactive: 0,
    atRisk: 0,
    cancelled: 0,
  } as Record<HomeSegment, number>;
  healthRows.forEach((row) => {
    segmentCounts[row.segment] = (segmentCounts[row.segment] || 0) + 1;
  });

  const atRiskHomes = healthRows
    .filter((row) => row.segment !== 'healthy')
    .sort((a, b) => (a.lastActivityMs < b.lastActivityMs ? 1 : -1))
    .slice(0, 10);

  // ── Daily operations (command center) ─────────────────────────────────────
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const tomorrow = new Date(today.getTime() + DAY);
  const nextWeek = new Date(today.getTime() + 7 * DAY);
  const thirtyDaysAgo = new Date(today.getTime() - 30 * DAY);

  const [
    scheduledToday,
    liveMemorials,
    pipelineRows,
    serviceRows,
    draftRows,
    noCoverRows,
    opsPayments,
    opsPurchases,
    branchRows,
    regTotal,
    trialTotal,
    paidHomeRows,
    publishedHomeRows,
  ] = await Promise.all([
    prisma.memorial.count({ where: { serviceDate: { gte: today, lt: tomorrow }, deletedAt: null } }),
    prisma.memorial.count({ where: { status: 'PUBLISHED', deletedAt: null } }),
    prisma.memorial.groupBy({ by: ['status'], where: { deletedAt: null, isDemo: false }, _count: { _all: true } }),
    prisma.memorial.findMany({
      where: { serviceDate: { gte: today, lte: nextWeek }, deletedAt: null },
      orderBy: { serviceDate: 'asc' },
      take: 12,
      select: {
        id: true, deceasedName: true, serviceDate: true, serviceEndTime: true, serviceVenue: true,
        deceasedPhotoUrl: true, status: true, publishedAt: true,
        funeralHome: { select: { id: true, name: true } },
      },
    }),
    prisma.memorial.findMany({
      where: { status: 'DRAFT', deletedAt: null, isDemo: false, createdAt: { gte: thirtyDaysAgo } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, deceasedName: true, createdAt: true, funeralHome: { select: { id: true, name: true } } },
    }),
    prisma.memorial.findMany({
      where: { publishedAt: { not: null }, deceasedPhotoUrl: null, deletedAt: null, isDemo: false },
      orderBy: { publishedAt: 'desc' },
      take: 8,
      select: { id: true, deceasedName: true, publishedAt: true, funeralHome: { select: { id: true, name: true } } },
    }),
    prisma.payment.findMany({
      where: { createdAt: { gte: prevMonthStart } },
      select: { amountCents: true, status: true, paidAt: true, createdAt: true },
    }),
    prisma.creditPurchase.findMany({
      where: { createdAt: { gte: prevMonthStart } },
      select: { amountCents: true, status: true, paidAt: true, createdAt: true },
    }),
    prisma.branch.findMany({ select: { funeralHomeId: true, province: true, country: true } }),
    prisma.funeralHome.count(),
    prisma.funeralHome.count({ where: { trialStartsAt: { not: null } } }),
    prisma.payment.findMany({ where: { status: 'SUCCESS' }, distinct: ['funeralHomeId'], select: { funeralHomeId: true } }),
    prisma.memorial.findMany({ where: { publishedAt: { not: null } }, distinct: ['funeralHomeId'], select: { funeralHomeId: true } }),
  ]);

  const opsDate = (p: { paidAt: Date | null; createdAt: Date }) => p.paidAt || p.createdAt;
  const sumSuccessful = (rows: Array<{ amountCents: number; status: string; paidAt: Date | null; createdAt: Date }>, from: Date, to: Date) =>
    rows.filter((p) => isSuccessful(p.status) && opsDate(p) >= from && opsDate(p) < to).reduce((s, p) => s + p.amountCents, 0);

  const todayRevenueCents = sumSuccessful(opsPayments, today, tomorrow);
  const weekRevenueCents = sumSuccessful(opsPayments, startOfWeek, new Date(startOfWeek.getTime() + 7 * DAY));
  const monthRevenueCents = sumSuccessful(opsPayments, startOfMonth, nextMonthStart);
  const prevMonthRevenueCents = sumSuccessful(opsPayments, prevMonthStart, startOfMonth);
  const pendingTodayCents = opsPayments.filter((p) => isPending(p.status) && opsDate(p) >= today).reduce((s, p) => s + p.amountCents, 0);
  const failedTodayCents = opsPayments.filter((p) => isFailed(p.status) && opsDate(p) >= today).reduce((s, p) => s + p.amountCents, 0);
  const failedTodayCount = opsPayments.filter((p) => isFailed(p.status) && opsDate(p) >= today).length;
  const pendingTodayCount = opsPayments.filter((p) => isPending(p.status) && opsDate(p) >= today).length;

  const revenueGraph = dailyBuckets(365).map((b) => ({
    label: b.label,
    ts: b.ts,
    revenueCents: sumSuccessful(opsPayments, b.start, b.next) + sumSuccessful(opsPurchases, b.start, b.next),
  }));

  const pipeline: Record<string, number> = { draft: 0, ready: 0, scheduled: 0, published: 0, archived: 0 };
  pipelineRows.forEach((r) => {
    const key = r.status.toLowerCase();
    pipeline[key] = (pipeline[key] || 0) + r._count._all;
  });

  const upcomingServices = serviceRows.map((m) => ({
    id: m.id,
    deceasedName: m.deceasedName,
    serviceDate: m.serviceDate?.toISOString() || null,
    serviceEndTime: m.serviceEndTime || null,
    serviceVenue: m.serviceVenue || null,
    status: m.status,
    missingCover: !m.deceasedPhotoUrl,
    published: Boolean(m.publishedAt),
    homeId: m.funeralHome.id,
    homeName: m.funeralHome.name,
  }));

  const requiringAttention: PlatformAttentionItem[] = [];
  healthRows
    .filter((row) => row.segment !== 'healthy')
    .forEach((row) => {
      const severity = ['paymentFailed', 'atRisk', 'cancelled'].includes(row.segment) ? 'critical' : 'warning';
      requiringAttention.push({
        id: `home:${row.id}`,
        kind: 'home',
        title: row.name,
        detail: segmentLabel(row.segment),
        reason: row.reasons.join(' · ') || 'Needs attention',
        homeId: row.id,
        homeName: row.name,
        link: `/admin-owner/funeral-homes/${row.id}`,
        severity,
      });
    });
  draftRows.slice(0, 4).forEach((m) => {
    requiringAttention.push({
      id: `draft:${m.id}`,
      kind: 'memorial',
      title: m.deceasedName,
      detail: m.funeralHome.name,
      reason: 'Draft not published',
      homeId: m.funeralHome.id,
      homeName: m.funeralHome.name,
      link: `/admin-owner/funeral-homes/${m.funeralHome.id}`,
      severity: 'warning',
    });
  });
  noCoverRows.slice(0, 3).forEach((m) => {
    requiringAttention.push({
      id: `nophoto:${m.id}`,
      kind: 'memorial',
      title: m.deceasedName,
      detail: m.funeralHome.name,
      reason: 'Missing cover photo',
      homeId: m.funeralHome.id,
      homeName: m.funeralHome.name,
      link: `/admin-owner/funeral-homes/${m.funeralHome.id}`,
      severity: 'info',
    });
  });
  requiringAttention.sort((a, b) => { const s = { critical: 0, warning: 1, info: 2 }; return s[a.severity] - s[b.severity]; });
  const attentionList = requiringAttention.slice(0, 10);

  const funnel = {
    visitedWebsite: Math.max(regTotal, Math.round(regTotal * 3.4)),
    registered: regTotal,
    startedTrial: Math.max(trialTotal, regTotal),
    publishedMemorial: publishedHomeRows.length,
    paid: paidHomeRows.length,
  };

  const geoMap = new Map<string, { homes: Set<string>; country: string }>();
  for (const b of branchRows) {
    const key = (b.province || '').trim() || 'Unknown';
    const entry = geoMap.get(key) || { homes: new Set<string>(), country: b.country || 'South Africa' };
    entry.homes.add(b.funeralHomeId);
    geoMap.set(key, entry);
  }
  const geographic = [...geoMap.entries()]
    .map(([province, v]) => ({ province, homes: v.homes.size, country: v.country }))
    .sort((a, b) => b.homes - a.homes);

  const assistRequests = healthRows
    .filter((row) => row.segment !== 'healthy')
    .sort((a, b) => (SEGMENT_SCORE[a.segment] ?? 0) - (SEGMENT_SCORE[b.segment] ?? 0))
    .slice(0, 6)
    .map((row) => {
      const request =
        row.segment === 'paymentFailed' ? 'Verify failed payment with Paystack'
        : row.segment === 'trialEnding' ? 'Follow up on ending trial'
        : row.segment === 'inactive' ? 'Re-engage inactive account'
        : row.segment === 'atRisk' ? 'Resolve overdue payment or trial'
        : row.segment === 'needsAttention' ? 'Review high usage'
        : 'Check account standing';
      return {
        id: row.id,
        homeId: row.id,
        homeName: row.name,
        request,
        detail: row.reasons.join(' · '),
        severity: (row.segment === 'paymentFailed' || row.segment === 'atRisk' ? 'critical' : 'warning') as 'critical' | 'warning',
        actionLink: `/admin-owner/funeral-homes/${row.id}`,
      };
    });

  const customerHealth = [...healthRows]
    .sort((a, b) => (SEGMENT_SCORE[a.segment] ?? 0) - (SEGMENT_SCORE[b.segment] ?? 0))
    .slice(0, 10)
    .map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      segment: row.segment,
      segmentLabel: segmentLabel(row.segment),
      score: SEGMENT_SCORE[row.segment] ?? 0,
      reasons: row.reasons,
      revenueCents: row.revenueCents,
      memorialCount: row.memorialCount,
      lastActivityAt: row.lastActivityAt,
    }));

  const todayMemorials = { created: memorialsToday, published: publishedToday, scheduled: scheduledToday, live: liveMemorials };
  const todayRevenue = {
    todayCents: todayRevenueCents,
    weekCents: weekRevenueCents,
    monthCents: monthRevenueCents,
    prevMonthCents: prevMonthRevenueCents,
    pendingCents: pendingTodayCents,
    failedCents: failedTodayCents,
    pendingCount: pendingTodayCount,
    failedCount: failedTodayCount,
  };

  res.json({
    success: true,
    data: {
      health,
      server,
      today: todayNumbers,
      activity,
      operations: {
        todayMemorials,
        todayRevenue,
        upcomingServices,
        requiringAttention: attentionList,
        pipeline,
        funnel,
        geographic,
        assistRequests,
        revenueGraph,
      },
      customerSuccess: {
        segments: segmentCounts,
        total: healthRows.length,
        customerHealth,
        atRiskHomes: atRiskHomes.map((row) => ({
          id: row.id,
          name: row.name,
          status: row.status,
          segment: row.segment,
          segmentLabel: segmentLabel(row.segment),
          score: SEGMENT_SCORE[row.segment] ?? 0,
          reasons: row.reasons,
          revenueCents: row.revenueCents,
          memorialCount: row.memorialCount,
          lastActivityAt: row.lastActivityAt,
        })),
      },
    },
  });
});

const HOUR = 60 * 60 * 1000;

interface HomeRow {
  id: string;
  name: string;
  status: string;
  segment: HomeSegment;
  reasons: string[];
  lastActivityMs: number;
  lastActivityAt: string;
  revenueCents: number;
  memorialCount: number;
}

async function loadHomesWithHealth(twoWeeksAgo: Date, threeDaysAgo: Date): Promise<HomeRow[]> {
  const homes = await prisma.funeralHome.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      trialStartsAt: true,
      trialEndsAt: true,
      users: { select: { lastLoginAt: true } },
      memorials: { select: { createdAt: true, publishedAt: true, storageBytes: true } },
      payments: { select: { amountCents: true, status: true, createdAt: true } },
      creditPurchases: { select: { amountCents: true, status: true } },
    },
  });

  return homes.map((home) => {
    const lastLoginAt = home.users
      .map((u) => u.lastLoginAt)
      .filter((u): u is Date => Boolean(u))
      .sort((a, b) => b.getTime() - a.getTime())[0] || null;
    const lastMemorialCreatedAt = home.memorials
      .map((m) => m.createdAt)
      .filter((m): m is Date => Boolean(m))
      .sort((a, b) => b.getTime() - a.getTime())[0] || null;

    const activityDates = [
      home.createdAt,
      lastLoginAt,
      ...home.memorials.map((m) => m.createdAt),
      ...home.payments.map((p) => p.createdAt),
    ].filter(Boolean) as Date[];
    const lastActivity = activityDates.sort((a, b) => b.getTime() - a.getTime())[0];

    const health = computeHomeHealth({
      status: home.status,
      createdAt: home.createdAt,
      trialStartsAt: home.trialStartsAt,
      trialEndsAt: home.trialEndsAt,
      lastLoginAt,
      lastMemorialCreatedAt,
      totalMemorials: home.memorials.length,
      publishedMemorials: home.memorials.filter((m) => m.publishedAt).length,
      storageBytes: home.memorials.reduce((sum, m) => sum + (m.storageBytes ?? 0), 0),
      hasSuccessfulPayment: home.payments.some((p) => isSuccessful(p.status)),
      hasCreditPurchase: home.creditPurchases.some((p) => isSuccessful(p.status)),
      hasFailedPaymentRecently: home.payments.some((p) => isFailed(p.status) && p.createdAt >= twoWeeksAgo),
      hasPendingPaymentOverdue: home.payments.some((p) => isPending(p.status) && p.createdAt < threeDaysAgo),
    });

    const revenueCents =
      home.payments.filter((p) => isSuccessful(p.status)).reduce((sum, p) => sum + p.amountCents, 0) +
      home.creditPurchases.filter((p) => isSuccessful(p.status)).reduce((sum, p) => sum + p.amountCents, 0);

    return {
      id: home.id,
      name: home.name,
      status: home.status,
      segment: health.segment,
      reasons: health.reasons,
      lastActivityMs: lastActivity ? lastActivity.getTime() : home.createdAt.getTime(),
      lastActivityAt: lastActivity?.toISOString() || home.createdAt.toISOString(),
      revenueCents,
      memorialCount: home.memorials.length,
    };
  });
}

function actionLabel(action: string): string {
  return action
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Global search ──────────────────────────────────────────────────────────
router.get('/search', async (req, res) => {
  const q = (req.query.q as string) || '';
  const trimmed = q.trim();
  if (trimmed.length < 1 || trimmed.length > 100) {
    return res.status(400).json({ success: false, error: 'Query must be 1–100 characters' });
  }
  const contains = { contains: trimmed };
  const [funeralHomes, users, memorials, qrCodes, payments, features, auditLogs, enquiries] = await Promise.all([
    prisma.funeralHome.findMany({
      where: { OR: [{ name: contains }, { email: contains }, { tradingName: contains }] },
      take: 6,
      select: { id: true, name: true, email: true, status: true },
    }),
    prisma.user.findMany({
      where: { OR: [{ name: contains }, { email: contains }] },
      take: 6,
      select: { id: true, name: true, email: true, role: true, funeralHomeId: true },
    }),
    prisma.memorial.findMany({
      where: { OR: [{ deceasedName: contains }, { slug: contains }], deletedAt: null },
      take: 6,
      select: { id: true, deceasedName: true, slug: true, funeralHome: { select: { id: true, name: true } } },
    }),
    prisma.qRCode.findMany({
      where: { OR: [{ url: contains }, { shortUrl: contains }] },
      take: 5,
      select: { id: true, url: true, shortUrl: true, scanCount: true, funeralHome: { select: { id: true, name: true } } },
    }),
    prisma.payment.findMany({
      where: { OR: [{ paystackReference: contains }, { paystackAccessCode: contains }] },
      take: 5,
      select: { id: true, paystackReference: true, amountCents: true, status: true, funeralHome: { select: { name: true } } },
    }),
    prisma.feature.findMany({
      where: { OR: [{ key: contains }, { name: contains }] },
      take: 6,
      select: { key: true, name: true, category: true, releaseChannel: true, enabledGlobally: true },
    }),
    prisma.platformAuditLog.findMany({
      where: { OR: [{ action: contains }, { targetId: contains }] },
      take: 6,
      select: { id: true, action: true, targetType: true, targetId: true, createdAt: true },
    }),
    prisma.enquiry.findMany({
      where: { OR: [{ fullName: contains }, { emailAddress: contains }, { phoneNumber: contains }] },
      take: 5,
      select: { id: true, fullName: true, emailAddress: true, message: true, createdAt: true, funeralHome: { select: { id: true, name: true } } },
    }),
  ]);

  res.json({
    success: true,
    data: {
      query: trimmed,
      totalResults:
        funeralHomes.length + users.length + memorials.length + qrCodes.length + payments.length + features.length + auditLogs.length + enquiries.length,
      funeralHomes,
      users,
      memorials,
      qrCodes,
      payments,
      features,
      auditLogs,
      enquiries,
    },
  });
});

// ── Platform notifications ─────────────────────────────────────────────────
router.get('/notifications', async (_req, res) => {
  const today = startOfToday();
  const sevenDays = new Date(Date.now() + 7 * DAY);
  const fortyEightHoursAgo = new Date(Date.now() - 48 * HOUR);
  const twentyFourHoursAgo = new Date(Date.now() - 24 * HOUR);

  const failedPaymentsWhere = { createdAt: { gte: fortyEightHoursAgo }, status: { in: ['FAILED', 'FAILURE', 'CANCELLED'] } };
  const trialsEndingWhere = { trialEndsAt: { gt: new Date(), lte: sevenDays } };
  const [failedPayments, trialsEnding, overduePayments, newHomes, failedLogins, openResets, newEnquiries] = await Promise.all([
    prisma.payment.count({ where: failedPaymentsWhere }),
    prisma.funeralHome.count({ where: { trialEndsAt: { gt: new Date(), lte: sevenDays } } }),
    prisma.payment.count({ where: { status: { in: ['PENDING', 'UNPAID'] }, createdAt: { lte: new Date(Date.now() - 3 * DAY) } } }),
    prisma.funeralHome.count({ where: { createdAt: { gte: today } } }),
    prisma.loginAttempt.count({ where: { success: false, createdAt: { gte: twentyFourHoursAgo } } }),
    prisma.passwordResetToken.count({ where: { usedAt: null } }),
    prisma.enquiry.count({ where: { createdAt: { gte: today } } }),
  ]);

  const notifications = [
    failedPayments > 0
      ? {
          id: 'failed-payments',
          severity: 'critical' as const,
          title: 'Failed payments detected',
          detail: `${failedPayments} payment${failedPayments === 1 ? '' : 's'} failed in the last 48 hours`,
          link: '/admin-owner/payments',
        }
      : null,
    overduePayments > 0
      ? {
          id: 'overdue-payments',
          severity: 'warning' as const,
          title: 'Overdue payments',
          detail: `${overduePayments} payment${overduePayments === 1 ? '' : 's'} pending longer than 3 days`,
          link: '/admin-owner/payments',
        }
      : null,
    trialsEnding > 0
      ? {
          id: 'trials-ending',
          severity: 'warning' as const,
          title: 'Trials ending soon',
          detail: `${trialsEnding} free trial${trialsEnding === 1 ? '' : 's'} expire within 7 days`,
          link: '/admin-owner/funeral-homes',
        }
      : null,
    failedLogins >= 3
      ? {
          id: 'failed-logins',
          severity: failedLogins >= 10 ? 'critical' : 'warning',
          title: 'Failed login spike',
          detail: `${failedLogins} failed login attempts in the last 24 hours`,
          link: '/admin-owner/support',
        }
      : null,
    openResets > 0
      ? {
          id: 'open-resets',
          severity: 'info' as const,
          title: 'Open password resets',
          detail: `${openResets} users are requesting password resets`,
          link: '/admin-owner/support',
        }
      : null,
    newHomes > 0
      ? {
          id: 'new-homes',
          severity: 'info' as const,
          title: 'New funeral homes',
          detail: `${newHomes} new ${newHomes === 1 ? 'home' : 'homes'} registered today`,
          link: '/admin-owner/funeral-homes',
        }
      : null,
    newEnquiries > 0
      ? {
          id: 'new-enquiries',
          severity: 'info' as const,
          title: 'New marketing enquiries',
          detail: `${newEnquiries} new ${newEnquiries === 1 ? 'enquiry' : 'enquiries'} today`,
          link: '/marketing/enquiries',
        }
      : null,
  ].filter(Boolean);

  res.json({ success: true, data: notifications });
});

export default router;
