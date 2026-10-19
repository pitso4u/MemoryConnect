import { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { authLimiter } from '../middleware/authRateLimit';
import { authenticate, canManageFuneralHome, isFuneralHomeRole, normalizeRole, ROLES, signToken } from '../middleware/auth';
import { registerSchema, loginSchema } from '@memorialconnect/shared';
import { brandFromFuneralHome } from '@memorialconnect/shared';
import { isZodError } from '../lib/validation';
import { z } from 'zod';
import { UPLOADS_DIR } from '../lib/uploads';
import { getPlatformSettings } from '../lib/platformSettings';
import { addDays } from '../lib/publishing';

const router = Router();

const urlOrPath = z.string().regex(/^(https?:\/\/|\/)/, 'Must be a valid URL or relative path').optional().nullable().or(z.literal(''));

const profileSchema = z.object({
  name: z.string().min(2).optional(),
  tradingName: z.string().max(160).optional().nullable(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  logoUrl: urlOrPath,
  iconUrl: urlOrPath,
  primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional().nullable(),
  secondaryColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional().nullable(),
  accentColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional().nullable(),
  backgroundColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional().nullable(),
  textColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional().nullable(),
  fontFamily: z.string().max(80).optional().nullable(),
  buttonStyle: z.string().max(40).optional().nullable(),
  cardStyle: z.string().max(40).optional().nullable(),
  borderRadius: z.string().max(20).optional().nullable(),
  whatsapp: z.string().max(40).optional().nullable(),
  websiteUrl: z.string().url().optional().nullable().or(z.literal('')),
  facebookUrl: z.string().url().optional().nullable().or(z.literal('')),
  instagramUrl: z.string().url().optional().nullable().or(z.literal('')),
  tiktokUrl: z.string().url().optional().nullable().or(z.literal('')),
  footerText: z.string().max(500).optional().nullable(),
  copyrightText: z.string().max(200).optional().nullable(),
  whiteLabelEnabled: z.boolean().optional(),
  themeTemplate: z.string().max(80).optional().nullable(),
  homeBackgroundUrl: urlOrPath,
  loginBackgroundUrl: urlOrPath,
  memorialHeroUrl: urlOrPath,
  projectorBackgroundUrl: urlOrPath,
  pdfWatermarkUrl: urlOrPath,
  splashScreenUrl: urlOrPath,
  memorialStyle: z.string().max(80).optional().nullable(),
  animationLevel: z.string().max(80).optional().nullable(),
  galleryLayout: z.string().max(80).optional().nullable(),
  timelineStyle: z.string().max(80).optional().nullable(),
  programmeStyle: z.string().max(80).optional().nullable(),
});

function withBrand<T extends Record<string, unknown>>(funeralHome: T) {
  return { ...funeralHome, brand: brandFromFuneralHome(funeralHome) };
}

async function trialForNewHome() {
  const settings = await getPlatformSettings();
  if (!settings.trialEnabled) return {};
  return {
    trialStartsAt: new Date(),
    trialEndsAt: addDays(new Date(), settings.trialDays),
  };
}

router.post('/register', authLimiter, async (req, res) => {
  try {
    const body = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const baseSlug = body.funeralHomeName
      .toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/--+/g, '-').replace(/^-+|-+$/g, '').slice(0, 200);
    let slug = baseSlug;
    let slugCounter = 1;
    while (await prisma.funeralHome.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${slugCounter}`;
      slugCounter++;
    }
    const funeralHome = await prisma.funeralHome.create({
      data: {
        name: body.funeralHomeName,
        slug,
        email: body.email,
        ...await trialForNewHome(),
        users: {
          create: {
            name: body.name,
            email: body.email,
            passwordHash,
            passwordSetAt: new Date(),
            role: ROLES.FUNERAL_HOME_ADMIN,
          },
        },
      },
      include: { users: true },
    });

    const user = funeralHome.users[0];
    const token = signToken({
      userId: user.id,
      funeralHomeId: funeralHome.id,
      role: user.role,
    });

    res.status(201).json({
      success: true,
      data: {
        accessToken: token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: normalizeRole(user.role),
          funeralHomeId: funeralHome.id,
        },
      },
    });
  } catch (err) {
    if (isZodError(err)) {
      return res.status(400).json({ success: false, error: err.errors[0].message });
    }
    console.error(err);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: body.email },
      include: { funeralHome: true },
    });

    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      await prisma.loginAttempt.create({ data: { email: body.email.toLowerCase(), success: false } });
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    if (user.funeralHome && user.funeralHome.status === 'SUSPENDED') {
      await prisma.loginAttempt.create({ data: { email: body.email.toLowerCase(), success: false } });
      return res.status(403).json({ success: false, error: 'This funeral home account has been suspended. Please contact Memory Connect support.' });
    }

    const userPublic = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: normalizeRole(user.role),
      funeralHomeId: user.funeralHomeId,
    };

    // Credentials are valid but this session must complete the forced password
    // change before the rest of the app is reachable. Issue a restricted token
    // that is only accepted by the change-password endpoint.
    if (user.mustChangePassword) {
      const expired = !user.temporaryPasswordExpiresAt || user.temporaryPasswordExpiresAt.getTime() <= Date.now();
      if (expired) {
        await prisma.loginAttempt.create({ data: { email: body.email.toLowerCase(), success: false } });
        return res.status(403).json({
          success: false,
          error: 'Your temporary password has expired. Please use the reset password flow.',
          code: 'TEMP_PASSWORD_EXPIRED',
        });
      }
      await prisma.loginAttempt.create({ data: { email: body.email.toLowerCase(), success: true } });
      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      const token = signToken(
        { userId: user.id, funeralHomeId: user.funeralHomeId, role: normalizeRole(user.role), tokenVersion: user.tokenVersion, scope: 'password_change' },
        { expiresIn: '30m' },
      );
      return res.json({
        success: true,
        data: { accessToken: token, requiresPasswordChange: true, user: userPublic },
      });
    }

    await prisma.loginAttempt.create({ data: { email: body.email.toLowerCase(), success: true } });
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const token = signToken({
      userId: user.id,
      funeralHomeId: user.funeralHomeId,
      role: normalizeRole(user.role),
      tokenVersion: user.tokenVersion,
    });

    res.json({
      success: true,
      data: {
        accessToken: token,
        requiresPasswordChange: false,
        user: userPublic,
      },
    });
  } catch (err) {
    if (isZodError(err)) {
      return res.status(400).json({ success: false, error: err.errors[0].message });
    }
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

router.post('/change-password', authenticate, async (req, res) => {
  try {
    const body = changePasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    if (user.mustChangePassword) {
      const expired = !user.temporaryPasswordExpiresAt || user.temporaryPasswordExpiresAt.getTime() <= Date.now();
      if (expired) {
        return res.status(403).json({
          success: false,
          error: 'Your temporary password has expired. Please use the reset password flow.',
          code: 'TEMP_PASSWORD_EXPIRED',
        });
      }
    }
    if (!(await bcrypt.compare(body.currentPassword, user.passwordHash))) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(body.newPassword, 12),
        passwordSetAt: new Date(),
        mustChangePassword: false,
        temporaryPasswordExpiresAt: null,
        tokenVersion: { increment: 1 },
      },
    });
    const token = signToken({
      userId: user.id,
      funeralHomeId: user.funeralHomeId,
      role: normalizeRole(user.role),
      tokenVersion: updated.tokenVersion,
    });
    res.json({
      success: true,
      data: {
        accessToken: token,
        requiresPasswordChange: false,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: normalizeRole(user.role),
          funeralHomeId: user.funeralHomeId,
        },
      },
    });
  } catch (err) {
    if (isZodError(err)) return res.status(400).json({ success: false, error: err.errors[0].message });
    console.error('Change password error:', err);
    res.status(500).json({ success: false, error: 'Failed to change password' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    include: { funeralHome: true },
  });

  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: normalizeRole(user.role),
      funeralHomeId: user.funeralHomeId,
      funeralHome: user.funeralHome ? {
        id: user.funeralHome.id,
        name: user.funeralHome.name,
        email: user.funeralHome.email,
        phone: user.funeralHome.phone,
        address: user.funeralHome.address,
        logoUrl: user.funeralHome.logoUrl,
        primaryColor: user.funeralHome.primaryColor,
        secondaryColor: user.funeralHome.secondaryColor,
        websiteUrl: user.funeralHome.websiteUrl,
        facebookUrl: user.funeralHome.facebookUrl,
        plan: user.funeralHome.plan,
        edition: user.funeralHome.edition,
        brand: brandFromFuneralHome(user.funeralHome),
        analyticsAccessEnabled: user.funeralHome.analyticsAccessEnabled,
        apiAccessEnabled: user.funeralHome.apiAccessEnabled,
        dedicatedSupportEnabled: user.funeralHome.dedicatedSupportEnabled,
      } : null,
    },
  });
});

router.get('/my-features', authenticate, async (req, res) => {
  try {
    const { resolveFeatures, getFeatureVersion } = await import('../lib/featureService');
    const version = await getFeatureVersion();
    const ifNoneMatch = req.header('If-None-Match');
    if (ifNoneMatch && ifNoneMatch === String(version)) {
      return res.status(304).end();
    }
    const funeralHome = req.user!.funeralHomeId
      ? await prisma.funeralHome.findUnique({
          where: { id: req.user!.funeralHomeId },
          select: { id: true, plan: true, edition: true },
        })
      : null;
    const features = await resolveFeatures(req.user!, funeralHome);
    res.setHeader('ETag', String(version));
    res.json({ success: true, data: { featureVersion: version, features } });
  } catch (error) {
    console.error('Get my features error:', error);
    res.status(500).json({ success: false, error: 'Failed to load feature availability' });
  }
});

router.get('/funeral-home-profile', authenticate, async (req, res) => {
  if (!isFuneralHomeRole(req.user!.role) || !req.user!.funeralHomeId) {
    return res.status(403).json({ success: false, error: 'Funeral home access required' });
  }
  const funeralHome = await prisma.funeralHome.findUnique({
    where: { id: req.user!.funeralHomeId },
    include: { branches: { orderBy: { name: 'asc' } }, users: { select: { id: true, name: true, email: true, role: true } } },
  });
  if (!funeralHome) return res.status(404).json({ success: false, error: 'Funeral home not found' });
  res.json({ success: true, data: withBrand(funeralHome as unknown as Record<string, unknown>) });
});

router.patch('/funeral-home-profile', authenticate, async (req, res) => {
  if (!canManageFuneralHome(req.user!.role) || !req.user!.funeralHomeId) {
    return res.status(403).json({ success: false, error: 'Only an admin can update the funeral home profile' });
  }
  try {
    const body = profileSchema.parse(req.body);
    const clean = Object.fromEntries(Object.entries(body).map(([key, value]) => [key, value === '' ? null : value]));
    const funeralHome = await prisma.funeralHome.update({ where: { id: req.user!.funeralHomeId }, data: clean });
    res.json({ success: true, data: withBrand(funeralHome as unknown as Record<string, unknown>) });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, error: error.errors[0].message });
    res.status(500).json({ success: false, error: 'Failed to update funeral home profile' });
  }
});

const logoStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const funeralHomeId = req.user!.funeralHomeId;
    const dir = path.join(UPLOADS_DIR, `funeral-home-${funeralHomeId}`);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
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

router.post('/funeral-home-logo', authenticate, (req, res) => {
  if (!canManageFuneralHome(req.user!.role) || !req.user!.funeralHomeId) {
    return res.status(403).json({ success: false, error: 'Only an admin can update the funeral home logo' });
  }
  const funeralHomeId = req.user!.funeralHomeId;
  logoUpload.single('logo')(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    try {
      const file = req.file as Express.Multer.File;
      if (!file) return res.status(400).json({ success: false, error: 'No logo file provided' });

      const logoUrl = `/uploads/funeral-home-${funeralHomeId}/${file.filename}`;
      const funeralHome = await prisma.funeralHome.update({
        where: { id: funeralHomeId },
        data: { logoUrl },
      });
      res.json({ success: true, data: { logoUrl, brand: brandFromFuneralHome(funeralHome as unknown as Record<string, unknown>) } });
    } catch (error) {
      console.error('Funeral home logo upload error:', error);
      res.status(500).json({ success: false, error: 'Failed to upload logo' });
    }
  });
});

export default router;
