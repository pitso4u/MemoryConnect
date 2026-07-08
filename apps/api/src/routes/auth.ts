import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { authenticate, canManageFuneralHome, isFuneralHomeRole, normalizeRole, ROLES, signToken } from '../middleware/auth';
import { registerSchema, loginSchema } from '@memorialconnect/shared';
import { brandFromFuneralHome } from '@memorialconnect/shared';
import { isZodError } from '../lib/validation';
import { z } from 'zod';

const router = Router();

const profileSchema = z.object({
  name: z.string().min(2).optional(),
  tradingName: z.string().max(160).optional().nullable(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  logoUrl: z.string().url().optional().nullable().or(z.literal('')),
  iconUrl: z.string().url().optional().nullable().or(z.literal('')),
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
  homeBackgroundUrl: z.string().url().optional().nullable().or(z.literal('')),
  loginBackgroundUrl: z.string().url().optional().nullable().or(z.literal('')),
  memorialHeroUrl: z.string().url().optional().nullable().or(z.literal('')),
  projectorBackgroundUrl: z.string().url().optional().nullable().or(z.literal('')),
  pdfWatermarkUrl: z.string().url().optional().nullable().or(z.literal('')),
  splashScreenUrl: z.string().url().optional().nullable().or(z.literal('')),
  memorialStyle: z.string().max(80).optional().nullable(),
  animationLevel: z.string().max(80).optional().nullable(),
  galleryLayout: z.string().max(80).optional().nullable(),
  timelineStyle: z.string().max(80).optional().nullable(),
  programmeStyle: z.string().max(80).optional().nullable(),
});

function withBrand<T extends Record<string, unknown>>(funeralHome: T) {
  return { ...funeralHome, brand: brandFromFuneralHome(funeralHome) };
}

router.post('/register', async (req, res) => {
  try {
    const body = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const funeralHome = await prisma.funeralHome.create({
      data: {
        name: body.funeralHomeName,
        email: body.email,
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

router.post('/login', async (req, res) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: body.email },
      include: { funeralHome: true },
    });

    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const token = signToken({
      userId: user.id,
      funeralHomeId: user.funeralHomeId,
      role: normalizeRole(user.role),
    });

    res.json({
      success: true,
      data: {
        accessToken: token,
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
    if (isZodError(err)) {
      return res.status(400).json({ success: false, error: err.errors[0].message });
    }
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Login failed' });
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
        brand: brandFromFuneralHome(user.funeralHome),
        analyticsAccessEnabled: user.funeralHome.analyticsAccessEnabled,
        apiAccessEnabled: user.funeralHome.apiAccessEnabled,
        dedicatedSupportEnabled: user.funeralHome.dedicatedSupportEnabled,
      } : null,
    },
  });
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

export default router;
