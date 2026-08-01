import { Router, Request } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import { prisma } from '../lib/prisma';
import { authenticate, canAccessMemorial, canManageFuneralHome, isFamilyRole, isFuneralHomeRole, normalizeRole, ROLES, signPreviewToken } from '../middleware/auth';
import { createMemorialSlug, formatMemorial } from '../lib/utils';
import { env } from '../lib/env';
import { initializePaystackTransaction, verifyPaystackTransaction } from '../lib/paystack';
import {
  completePublishPayment,
  createPublishReference,
  isEditLocked,
  MEMORIAL_STATUS,
  PAYMENT_PURPOSE,
  PAYMENT_STATUS,
  PUBLISH_CURRENCY,
  PUBLISH_PRICE_CENTS,
  publishMemorialWithEntitlement,
} from '../lib/publishing';
import { computeEntitlement, canPublishFree } from '../lib/entitlement';
import { getPlatformSettings } from '../lib/platformSettings';
import { permanentlyDeleteMemorial } from '../lib/retention';
import { isZodError } from '../lib/validation';
import { brandFromFuneralHome } from '@memorialconnect/shared';
import { ensureUploadsDir, photoPublicUrl } from '../lib/uploads';

const router = Router();

function paramId(req: Request) {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

const createSchema = z.object({
  deceasedName: z.string().min(2),
  dateOfBirth: z.string().optional(),
  dateOfDeath: z.string().optional(),
  serviceDate: z.string().optional(),
  serviceEndTime: z.string().optional(),
  serviceVenue: z.string().optional(),
  timezone: z.string().optional(),
  logoUrl: z.string().regex(/^(https?:\/\/|\/)/).optional().or(z.literal('')),
});

const updateSchema = z.object({
  deceasedName: z.string().min(2).optional(),
  dateOfBirth: z.string().optional().nullable(),
  dateOfDeath: z.string().optional().nullable(),
  serviceDate: z.string().optional().nullable(),
  serviceEndTime: z.string().optional().nullable(),
  serviceVenue: z.string().optional().nullable(),
  timezone: z.string().optional().nullable(),
  deceasedPhotoUrl: z.string().optional().nullable(),
  logoUrl: z.string().regex(/^(https?:\/\/|\/)/).optional().or(z.literal('')).nullable(),
  obituary: z.string().optional().nullable(),
  biography: z.record(z.unknown()).optional(),
  programme: z.array(z.record(z.unknown())).optional(),
  currentProgrammeIndex: z.number().int().min(0).optional(),
  announcements: z.array(z.record(z.unknown())).optional(),
  settings: z.record(z.unknown()).optional(),
});

function lockedResponse(res: any) {
  return res.status(423).json({
    success: false,
    code: 'MEMORIAL_LOCKED',
    error: 'This funeral programme is locked because it has already been published and shared.',
  });
}

async function syncLockedMemorials(funeralHomeId: string) {
  await prisma.memorial.updateMany({
    where: {
      funeralHomeId,
      isDemo: false,
      status: MEMORIAL_STATUS.PUBLISHED,
      editLocksAt: { lte: new Date() },
      publicExpiresAt: { gt: new Date() },
    },
    data: { status: MEMORIAL_STATUS.LOCKED },
  });
}

router.get('/', authenticate, async (req, res) => {
  try {
    if (isFamilyRole(req.user!.role)) {
      const access = await prisma.memorialAccess.findMany({
        where: { userId: req.user!.userId, memorial: { status: { not: MEMORIAL_STATUS.DELETED } } },
        include: { memorial: { include: { funeralHome: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return res.json({ success: true, data: access.map((item) => ({
        ...formatMemorial(item.memorial as unknown as Record<string, unknown>),
        funeralHome: { ...item.memorial.funeralHome, brand: brandFromFuneralHome(item.memorial.funeralHome) },
      })) });
    }
    if (!req.user!.funeralHomeId || !isFuneralHomeRole(req.user!.role)) {
      return res.status(403).json({ success: false, error: 'Funeral home access required' });
    }
    await syncLockedMemorials(req.user!.funeralHomeId);
    const memorials = await prisma.memorial.findMany({
      where: { funeralHomeId: req.user!.funeralHomeId, status: { not: MEMORIAL_STATUS.DELETED } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ success: true, data: memorials.map((item) => formatMemorial(item as unknown as Record<string, unknown>)) });
  } catch (error) {
    console.error('List memorials error:', error);
    res.status(500).json({ success: false, error: 'Failed to load memorials' });
  }
});

router.post('/', authenticate, async (req, res) => {
  if (!req.user!.funeralHomeId || !isFuneralHomeRole(req.user!.role)) {
    return res.status(403).json({ success: false, error: 'Only funeral home users can create memorials' });
  }
  try {
    const body = createSchema.parse(req.body);
    const memorial = await prisma.memorial.create({
      data: {
        slug: createMemorialSlug(),
        deceasedName: body.deceasedName,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        dateOfDeath: body.dateOfDeath ? new Date(body.dateOfDeath) : null,
        serviceDate: body.serviceDate ? new Date(body.serviceDate) : null,
        serviceEndTime: body.serviceEndTime || undefined,
        serviceVenue: body.serviceVenue,
        timezone: body.timezone || undefined,
        logoUrl: body.logoUrl || null,
        funeralHomeId: req.user!.funeralHomeId,
        programme: [],
        announcements: [],
        settings: { theme: 'elegant', showTributeWall: true, moderateTributes: true },
      },
    });
    res.status(201).json({ success: true, data: formatMemorial(memorial as unknown as Record<string, unknown>) });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, error: error.errors[0].message });
    console.error('Create memorial error:', error);
    res.status(500).json({ success: false, error: 'Failed to create memorial' });
  }
});

const logoStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const id = paramId(req);
    cb(null, ensureUploadsDir(id));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const safe = `logo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, safe);
  },
});

const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
    }
  },
});

router.post('/:id/logo', authenticate, (req, res) => {
  const id = paramId(req);
  logoUpload.single('logo')(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });

    try {
      const access = await canAccessMemorial(req.user!, id);
      if (!access) return res.status(404).json({ success: false, error: 'Memorial not found' });

      const file = req.file as Express.Multer.File;
      if (!file) return res.status(400).json({ success: false, error: 'No logo file provided' });

      const logoUrl = photoPublicUrl(id, file.filename);
      await prisma.memorial.update({ where: { id }, data: { logoUrl } });

      res.json({ success: true, data: { logoUrl } });
    } catch (error) {
      console.error('Logo upload error:', error);
      res.status(500).json({ success: false, error: 'Failed to upload logo' });
    }
  });
});

router.get('/:id/analytics', authenticate, async (req, res) => {
  if (!req.user!.funeralHomeId || !isFuneralHomeRole(req.user!.role)) {
    return res.status(403).json({ success: false, error: 'Analytics are only available to funeral home users' });
  }
  const access = await prisma.funeralHome.findUnique({ where: { id: req.user!.funeralHomeId }, select: { analyticsAccessEnabled: true } });
  if (!access?.analyticsAccessEnabled) return res.status(403).json({ success: false, error: 'Analytics access is not enabled for this funeral home' });
  const memorial = await prisma.memorial.findFirst({ where: { id: paramId(req), funeralHomeId: req.user!.funeralHomeId } });
  if (!memorial) return res.status(404).json({ success: false, error: 'Memorial not found' });

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
  const homeMemorials = await prisma.memorial.findMany({
    where: { funeralHomeId: req.user!.funeralHomeId, status: { not: MEMORIAL_STATUS.DELETED } },
    select: { id: true, deceasedName: true, viewCount: true },
  });
  const [viewsToday, viewsLast7Days] = await Promise.all([
    prisma.memorialView.count({ where: { memorialId: memorial.id, createdAt: { gte: today } } }),
    prisma.memorialView.count({ where: { memorialId: memorial.id, createdAt: { gte: sevenDaysAgo } } }),
  ]);
  const topViewedMemorials = [...homeMemorials]
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 5);
  res.json({
    success: true,
    data: {
      totalViews: memorial.viewCount,
      viewsToday,
      viewsLast7Days,
      viewsByMemorial: homeMemorials,
      topViewedMemorials,
    },
  });
});

router.get('/:id/preview-token', authenticate, async (req, res) => {
  const access = await canAccessMemorial(req.user!, paramId(req));
  if (!access) return res.status(404).json({ success: false, error: 'Memorial not found' });
  const memorial = await prisma.memorial.findFirst({
    where: { id: access.id, deletedAt: null },
    select: { id: true, funeralHomeId: true },
  });
  if (!memorial) return res.status(404).json({ success: false, error: 'Memorial not found' });
  res.json({
    success: true,
    data: { token: signPreviewToken(memorial.id, memorial.funeralHomeId), expiresInSeconds: 900 },
  });
});

router.post('/:id/initialize-publish-payment', authenticate, async (req, res) => {
  if (!canManageFuneralHome(req.user!.role) || !req.user!.funeralHomeId) {
    return res.status(403).json({ success: false, error: 'Only funeral home admins can publish memorials' });
  }
  const id = paramId(req);
  const memorial = await prisma.memorial.findFirst({
    where: { id, funeralHomeId: req.user!.funeralHomeId },
    include: { funeralHome: { select: { email: true, trialStartsAt: true, trialEndsAt: true, trialMemorialsUsed: true, memorialCreditsPurchased: true, memorialCreditsRemaining: true, lastCreditPurchaseAt: true } } },
  });
  if (!memorial) return res.status(404).json({ success: false, error: 'Memorial not found' });
  if (memorial.isDemo) return res.status(403).json({ success: false, error: 'The demo memorial does not require payment.' });
  if (![MEMORIAL_STATUS.DRAFT, MEMORIAL_STATUS.PAID_PENDING].includes(memorial.status as 'DRAFT' | 'PAID_PENDING')) {
    return res.status(409).json({ success: false, error: 'Only a draft funeral can enter the publishing payment flow' });
  }

  const missing = [
    !memorial.deceasedName && 'deceased name',
    !memorial.serviceDate && 'service date',
    !memorial.serviceVenue && 'service venue',
  ].filter(Boolean);
  if (missing.length) {
    return res.status(400).json({ success: false, code: 'INCOMPLETE_MEMORIAL', error: `Add the ${missing.join(', ')} before publishing.` });
  }

  // Trial allowance and prepaid credits publish the memorial without a
  // Paystack charge (creation always stays free; the charge is on publishing).
  const settings = await getPlatformSettings();
  const entitlement = computeEntitlement(memorial.funeralHome, settings);
  if (canPublishFree(entitlement)) {
    const published = await publishMemorialWithEntitlement(memorial.id, memorial.funeralHomeId, entitlement.mode);
    return res.json({
      success: true,
      data: {
        free: true,
        mode: entitlement.mode,
        memorial: formatMemorial(published as unknown as Record<string, unknown>),
      },
    });
  }

  if (!env.PAYSTACK_SECRET_KEY) {
    return res.status(503).json({
      success: false,
      code: 'PAYSTACK_NOT_CONFIGURED',
      error: 'Paystack is not configured. Add PAYSTACK_SECRET_KEY to apps/api/.env and restart the API.',
    });
  }
  const reference = createPublishReference(id);
  const payment = await prisma.$transaction(async (tx) => {
    await tx.payment.updateMany({
      where: { memorialId: id, status: PAYMENT_STATUS.PENDING },
      data: { status: PAYMENT_STATUS.ABANDONED },
    });
    const created = await tx.payment.create({
      data: {
        funeralHomeId: memorial.funeralHomeId,
        memorialId: id,
        amountCents: PUBLISH_PRICE_CENTS,
        currency: PUBLISH_CURRENCY,
        purpose: PAYMENT_PURPOSE,
        status: PAYMENT_STATUS.PENDING,
        paystackReference: reference,
      },
    });
    await tx.memorial.update({
      where: { id },
      data: { status: MEMORIAL_STATUS.PAID_PENDING, paymentStatus: PAYMENT_STATUS.PENDING, paymentId: created.id },
    });
    return created;
  });

  try {
    const callbackBase = (env.ADMIN_URL || 'http://localhost:5173').replace(/\/$/, '');
    const checkout = await initializePaystackTransaction({
      email: memorial.funeralHome.email,
      amount: PUBLISH_PRICE_CENTS,
      currency: PUBLISH_CURRENCY,
      reference,
      callbackUrl: `${callbackBase}/memorial/${id}?reference=${encodeURIComponent(reference)}`,
      metadata: { purpose: PAYMENT_PURPOSE, memorialId: id, funeralHomeId: memorial.funeralHomeId },
    });
    await prisma.payment.update({
      where: { id: payment.id },
      data: { paystackAccessCode: checkout.access_code, authorizationUrl: checkout.authorization_url },
    });
    res.json({ success: true, data: { authorizationUrl: checkout.authorization_url, accessCode: checkout.access_code, reference } });
  } catch (error) {
    await prisma.$transaction([
      prisma.payment.update({ where: { id: payment.id }, data: { status: PAYMENT_STATUS.FAILED } }),
      prisma.memorial.update({ where: { id }, data: { status: MEMORIAL_STATUS.DRAFT, paymentStatus: PAYMENT_STATUS.FAILED } }),
    ]);
    console.error('Initialize publish payment error:', error);
    res.status(502).json({ success: false, error: 'Paystack could not start the publishing payment' });
  }
});

router.get('/:id/verify-publish-payment/:reference', authenticate, async (req, res) => {
  if (!canManageFuneralHome(req.user!.role) || !req.user!.funeralHomeId) {
    return res.status(403).json({ success: false, error: 'Only funeral home admins can verify publishing payments' });
  }
  const memorial = await prisma.memorial.findFirst({ where: { id: paramId(req), funeralHomeId: req.user!.funeralHomeId } });
  if (!memorial) return res.status(404).json({ success: false, error: 'Memorial not found' });
  if (memorial.isDemo) return res.status(403).json({ success: false, error: 'The demo memorial does not use the payment flow.' });
  const reference = Array.isArray(req.params.reference) ? req.params.reference[0] : req.params.reference;
  const payment = await prisma.payment.findFirst({ where: { memorialId: memorial.id, paystackReference: reference } });
  if (!payment) return res.status(404).json({ success: false, error: 'Payment not found' });
  try {
    const transaction = await verifyPaystackTransaction(payment.paystackReference);
    const published = await completePublishPayment(payment.paystackReference, transaction);
    res.json({ success: true, data: formatMemorial(published as unknown as Record<string, unknown>) });
  } catch (error) {
    console.error('Verify publish payment error:', error);
    res.status(402).json({ success: false, error: error instanceof Error ? error.message : 'Payment could not be verified' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    if (req.user!.funeralHomeId) await syncLockedMemorials(req.user!.funeralHomeId);
    const access = await canAccessMemorial(req.user!, paramId(req));
    if (!access) return res.status(404).json({ success: false, error: 'Memorial not found' });
    const memorial = await prisma.memorial.findFirst({
      where: { id: access.id },
      include: {
        photos: { where: { deletedAt: null }, orderBy: { order: 'asc' } },
        tributes: { orderBy: { createdAt: 'desc' } },
        locations: { orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }] },
        funeralHome: true,
      },
    });
    if (!memorial) return res.status(404).json({ success: false, error: 'Memorial not found' });
    res.json({
      success: true,
      data: {
        ...formatMemorial(memorial as unknown as Record<string, unknown>),
        photos: memorial.photos,
        tributes: memorial.tributes,
        locations: memorial.locations,
        funeralHome: { ...memorial.funeralHome, brand: brandFromFuneralHome(memorial.funeralHome) },
      },
    });
  } catch (error) {
    console.error('Get memorial error:', error);
    res.status(500).json({ success: false, error: 'Failed to load memorial' });
  }
});

router.patch('/:id', authenticate, async (req, res) => {
  try {
    const id = paramId(req);
    const body = updateSchema.parse(req.body);
    const access = await canAccessMemorial(req.user!, id);
    if (!access) return res.status(404).json({ success: false, error: 'Memorial not found' });
    const existing = await prisma.memorial.findFirst({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: 'Memorial not found' });
    if (existing.isDemo && req.user!.role.toUpperCase() !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Only a platform owner can update the demo memorial.' });
    }
    if (existing.status === MEMORIAL_STATUS.DELETED) return res.status(410).json({ success: false, error: 'Memorial has been deleted' });
    if (isEditLocked(existing) && req.user!.role.toUpperCase() !== 'SUPER_ADMIN') return lockedResponse(res);

    const { biography, programme, announcements, settings, timezone, serviceEndTime, ...rest } = body;
    const role = normalizeRole(req.user!.role);
    if (role === ROLES.FAMILY_CONTRIBUTOR) {
      const allowed = ['obituary', 'biography', 'programme'] as const;
      const attempted = Object.keys(body).filter((key) => !allowed.includes(key as typeof allowed[number]));
      if (attempted.length) return res.status(403).json({ success: false, error: 'Family contributors can only suggest obituary and programme content' });
    }
    if (isFamilyRole(role) && (announcements || settings || rest.deceasedName !== undefined || rest.serviceDate !== undefined || rest.serviceVenue !== undefined || rest.deceasedPhotoUrl !== undefined)) {
      return res.status(403).json({ success: false, error: 'Family users cannot edit funeral home controlled publishing details' });
    }
    const memorial = await prisma.memorial.update({
      where: { id },
      data: {
        ...rest,
        biography: biography as any | undefined,
        programme: programme as any | undefined,
        announcements: announcements as any | undefined,
        settings: settings as any | undefined,
        dateOfBirth: body.dateOfBirth !== undefined ? body.dateOfBirth ? new Date(body.dateOfBirth) : null : undefined,
        dateOfDeath: body.dateOfDeath !== undefined ? body.dateOfDeath ? new Date(body.dateOfDeath) : null : undefined,
        serviceDate: body.serviceDate !== undefined ? body.serviceDate ? new Date(body.serviceDate) : null : undefined,
        timezone: body.timezone !== undefined ? (body.timezone || undefined) : undefined,
        serviceEndTime: body.serviceEndTime !== undefined ? (body.serviceEndTime || undefined) : undefined,
      },
    });
    if (body.obituary !== undefined || body.biography !== undefined) {
      await prisma.memorialAuditLog.create({
        data: { memorialId: id, userId: req.user!.userId, action: 'biography_edited', details: { fields: Object.keys(body) } },
      });
    }
    res.json({ success: true, data: formatMemorial(memorial as unknown as Record<string, unknown>) });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, error: error.errors[0].message });
    console.error('Update memorial error:', error);
    res.status(500).json({ success: false, error: 'Failed to update memorial' });
  }
});

for (const [path, direction] of [['/:id/programme/next', 1], ['/:id/programme/previous', -1]] as const) {
  router.post(path, authenticate, async (req, res) => {
    if (isFamilyRole(req.user!.role)) {
      return res.status(403).json({ success: false, error: 'Family users cannot control the live programme' });
    }
    if (!req.user!.funeralHomeId) {
      return res.status(403).json({ success: false, error: 'Funeral home access required' });
    }
    const memorial = await prisma.memorial.findFirst({
      where: { id: paramId(req), funeralHomeId: req.user!.funeralHomeId, deletedAt: null },
    });
    if (!memorial) return res.status(404).json({ success: false, error: 'Memorial not found' });
    if (memorial.isDemo && req.user!.role.toUpperCase() !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Only a platform owner can control the demo memorial.' });
    }
    // Moving the live cursor is an operator action, not an edit to locked memorial content.
    // It must remain available while a published service is being presented.
    const programme = memorial.programme as unknown[];
    const lastIndex = Math.max(0, programme.length - 1);
    const boundedIndex = Math.max(0, Math.min(memorial.currentProgrammeIndex, lastIndex));
    const currentProgrammeIndex = Math.max(0, Math.min(boundedIndex + direction, lastIndex));
    const updated = await prisma.memorial.update({ where: { id: memorial.id }, data: { currentProgrammeIndex } });
    res.json({ success: true, data: formatMemorial(updated as unknown as Record<string, unknown>) });
  });
}

router.delete('/:id', authenticate, async (req, res) => {
  if (!canManageFuneralHome(req.user!.role) || !req.user!.funeralHomeId) {
    return res.status(403).json({ success: false, error: 'Only a funeral home admin can delete a memorial' });
  }
  const memorial = await prisma.memorial.findFirst({ where: { id: paramId(req), funeralHomeId: req.user!.funeralHomeId } });
  if (!memorial) return res.status(404).json({ success: false, error: 'Memorial not found' });
  if (memorial.isDemo && req.user!.role.toUpperCase() !== 'SUPER_ADMIN') {
    return res.status(403).json({ success: false, error: 'Only a platform owner can delete the demo memorial.' });
  }
  if (isEditLocked(memorial) && req.user!.role.toUpperCase() !== 'SUPER_ADMIN') return lockedResponse(res);
  if (![MEMORIAL_STATUS.DRAFT, MEMORIAL_STATUS.PAID_PENDING, MEMORIAL_STATUS.PUBLISHED].includes(memorial.status as any)) {
    return lockedResponse(res);
  }
  await prisma.memorialAuditLog.create({
    data: { memorialId: memorial.id, userId: req.user!.userId, action: 'memorial_deleted', details: { status: memorial.status } },
  });
  const deleted = await permanentlyDeleteMemorial(memorial.id);
  res.json({ success: true, data: deleted });
});

export default router;
