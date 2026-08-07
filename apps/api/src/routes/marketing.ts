import { Router, Request } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import { prisma } from '../lib/prisma';
import { env } from '../lib/env';
import { authenticate, requireRole, ROLES } from '../middleware/auth';
import { requireFeature } from '../lib/featureService';
import { isZodError } from '../lib/validation';
import { UPLOADS_DIR, ensureUploadsDir } from '../lib/uploads';
import {
  updateMarketingContactSchema, createBrochureCategorySchema, updateBrochureCategorySchema,
  createBrochureSchema, updateBrochureSchema, createPromotionSchema, updatePromotionSchema,
  createBranchSchema, updateBranchSchema,
} from '@memorialconnect/shared';

const router = Router();

function paramId(req: Request) {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

function fhId(req: Request): string | undefined {
  return req.user?.role === ROLES.SUPER_ADMIN && req.query.funeralHomeId
    ? String(req.query.funeralHomeId)
    : req.user?.funeralHomeId || undefined;
}

function createSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

// ── Multer setup for marketing uploads ────────────────────────────────────

function ensureMarketingDir(subdir: string) {
  const dir = path.join(UPLOADS_DIR, 'marketing', subdir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, ensureMarketingDir('images'));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const pdfStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, ensureMarketingDir('pdfs'));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

const pdfUpload = multer({
  storage: pdfStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, ext === '.pdf');
  },
});

function imageUrl(filename: string): string {
  return `/uploads/marketing/images/${filename}`;
}

function pdfUrl(filename: string): string {
  return `/uploads/marketing/pdfs/${filename}`;
}

// ── Feature-gated marketing modules ──────────────────────────────────────
// Digital brochures (incl. categories) and promotions are premium features.
// Guards run after `authenticate` so `req.user` is populated.

router.use('/brochures', authenticate, requireFeature('BROCHURES'));
router.use('/categories', authenticate, requireFeature('BROCHURES'));
router.use('/promotions', authenticate, requireFeature('PROMOTIONS'));

// ══════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════════

router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const homeId = fhId(req);
    if (!homeId) return res.status(400).json({ success: false, message: 'Funeral home ID required' });

    const [brochures, publishedBrochures, promotions, activePromotions, enquiries, branches, views, contact] =
      await Promise.all([
        prisma.brochure.count({ where: { funeralHomeId: homeId } }),
        prisma.brochure.count({ where: { funeralHomeId: homeId, published: true } }),
        prisma.promotion.count({ where: { funeralHomeId: homeId } }),
        prisma.promotion.count({ where: { funeralHomeId: homeId, published: true, endDate: { gte: new Date() } } }),
        prisma.enquiry.count({ where: { funeralHomeId: homeId } }),
        prisma.branch.count({ where: { funeralHomeId: homeId } }),
        prisma.analyticsEvent.count({ where: { funeralHomeId: homeId, eventType: 'page_view' } }),
        prisma.marketingContact.findUnique({ where: { funeralHomeId: homeId } }),
      ]);

    const recentEnquiries = await prisma.enquiry.findMany({
      where: { funeralHomeId: homeId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { brochure: { select: { title: true, slug: true } } },
    });

    res.json({
      success: true,
      data: {
        totalBrochures: brochures,
        publishedBrochures,
        totalPromotions: promotions,
        activePromotions,
        totalEnquiries: enquiries,
        totalBranches: branches,
        totalViews: views,
        recentEnquiries,
        contactConfigured: Boolean(contact?.businessName),
      },
    });
  } catch (error) {
    console.error('Marketing dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to load dashboard' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// CONTACT INFORMATION
// ══════════════════════════════════════════════════════════════════════════

router.get('/contact', authenticate, async (req, res) => {
  try {
    const homeId = fhId(req);
    if (!homeId) return res.status(400).json({ success: false, message: 'Funeral home ID required' });
    const contact = await prisma.marketingContact.findUnique({ where: { funeralHomeId: homeId } });
    res.json({ success: true, data: contact || null });
  } catch (error) {
    console.error('Get contact error:', error);
    res.status(500).json({ success: false, message: 'Failed to load contact info' });
  }
});

router.put('/contact', authenticate, async (req, res) => {
  try {
    const homeId = fhId(req);
    if (!homeId) return res.status(400).json({ success: false, message: 'Funeral home ID required' });
    const body = updateMarketingContactSchema.parse(req.body);
    const contact = await prisma.marketingContact.upsert({
      where: { funeralHomeId: homeId },
      create: { funeralHomeId: homeId, ...body },
      update: body,
    });
    res.json({ success: true, data: contact });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error('Update contact error:', error);
    res.status(500).json({ success: false, message: 'Failed to update contact info' });
  }
});

router.post('/contact/logo', authenticate, (req, res) => {
  upload.single('logo')(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: 'Upload failed' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file provided' });
    try {
      const homeId = fhId(req);
      if (!homeId) return res.status(400).json({ success: false, message: 'Funeral home ID required' });
      const url = imageUrl(req.file.filename);
      const contact = await prisma.marketingContact.upsert({
        where: { funeralHomeId: homeId },
        create: { funeralHomeId: homeId, logoUrl: url },
        update: { logoUrl: url },
      });
      res.json({ success: true, data: { logoUrl: url, contact } });
    } catch (error) {
      console.error('Upload logo error:', error);
      res.status(500).json({ success: false, message: 'Failed to upload logo' });
    }
  });
});

router.post('/contact/cover', authenticate, (req, res) => {
  upload.single('cover')(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: 'Upload failed' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file provided' });
    try {
      const homeId = fhId(req);
      if (!homeId) return res.status(400).json({ success: false, message: 'Funeral home ID required' });
      const url = imageUrl(req.file.filename);
      const contact = await prisma.marketingContact.upsert({
        where: { funeralHomeId: homeId },
        create: { funeralHomeId: homeId, coverImageUrl: url },
        update: { coverImageUrl: url },
      });
      res.json({ success: true, data: { coverImageUrl: url, contact } });
    } catch (error) {
      console.error('Upload cover error:', error);
      res.status(500).json({ success: false, message: 'Failed to upload cover image' });
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════
// BROCHURE CATEGORIES
// ══════════════════════════════════════════════════════════════════════════

router.get('/categories', authenticate, async (req, res) => {
  try {
    const homeId = fhId(req);
    if (!homeId) return res.status(400).json({ success: false, message: 'Funeral home ID required' });
    const categories = await prisma.brochureCategory.findMany({
      where: { funeralHomeId: homeId },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { brochures: true } } },
    });
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ success: false, message: 'Failed to load categories' });
  }
});

router.post('/categories', authenticate, async (req, res) => {
  try {
    const homeId = fhId(req);
    if (!homeId) return res.status(400).json({ success: false, message: 'Funeral home ID required' });
    const body = createBrochureCategorySchema.parse(req.body);
    const slug = body.slug || createSlug(body.name);
    const category = await prisma.brochureCategory.create({
      data: { funeralHomeId: homeId, ...body, slug },
    });
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    if ((error as any)?.code === 'P2002') return res.status(409).json({ success: false, message: 'A category with this slug already exists' });
    console.error('Create category error:', error);
    res.status(500).json({ success: false, message: 'Failed to create category' });
  }
});

router.get('/categories/:id', authenticate, async (req, res) => {
  try {
    const category = await prisma.brochureCategory.findUnique({ where: { id: paramId(req) } });
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    const homeId = fhId(req);
    if (homeId && category.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    res.json({ success: true, data: category });
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ success: false, message: 'Failed to load category' });
  }
});

router.patch('/categories/:id', authenticate, async (req, res) => {
  try {
    const body = updateBrochureCategorySchema.parse(req.body);
    const existing = await prisma.brochureCategory.findUnique({ where: { id: paramId(req) } });
    if (!existing) return res.status(404).json({ success: false, message: 'Category not found' });
    const homeId = fhId(req);
    if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    if (body.slug && body.slug !== existing.slug) {
      const dup = await prisma.brochureCategory.findFirst({ where: { funeralHomeId: existing.funeralHomeId, slug: body.slug, id: { not: existing.id } } });
      if (dup) return res.status(409).json({ success: false, message: 'A category with this slug already exists' });
    }
    const category = await prisma.brochureCategory.update({
      where: { id: existing.id },
      data: body,
    });
    res.json({ success: true, data: category });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error('Update category error:', error);
    res.status(500).json({ success: false, message: 'Failed to update category' });
  }
});

router.delete('/categories/:id', authenticate, async (req, res) => {
  try {
    const existing = await prisma.brochureCategory.findUnique({ where: { id: paramId(req) } });
    if (!existing) return res.status(404).json({ success: false, message: 'Category not found' });
    const homeId = fhId(req);
    if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    await prisma.brochureCategory.delete({ where: { id: existing.id } });
    res.json({ success: true, data: null });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete category' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// DIGITAL BROCHURES
// ══════════════════════════════════════════════════════════════════════════

router.get('/brochures', authenticate, async (req, res) => {
  try {
    const homeId = fhId(req);
    if (!homeId) return res.status(400).json({ success: false, message: 'Funeral home ID required' });
    const brochures = await prisma.brochure.findMany({
      where: { funeralHomeId: homeId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      include: { category: true, gallery: { orderBy: { displayOrder: 'asc' } }, _count: { select: { enquiries: true } } },
    });
    res.json({ success: true, data: brochures });
  } catch (error) {
    console.error('Get brochures error:', error);
    res.status(500).json({ success: false, message: 'Failed to load brochures' });
  }
});

router.post('/brochures', authenticate, async (req, res) => {
  try {
    const homeId = fhId(req);
    if (!homeId) return res.status(400).json({ success: false, message: 'Funeral home ID required' });
    const body = createBrochureSchema.parse(req.body);
    let slug = body.slug || createSlug(body.title);
    if (!slug) return res.status(400).json({ success: false, message: 'Could not generate slug' });
    let uniqueSlug = slug;
    let counter = 1;
    // Slug uniqueness is scoped to the funeral home so two homes can safely
    // share the same package slug.
    while (await prisma.brochure.findFirst({ where: { funeralHomeId: homeId, slug: uniqueSlug } })) {
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }
    const { gallery, ...brochureData } = body;
    const brochure = await prisma.brochure.create({
      data: {
        ...brochureData,
        slug: uniqueSlug,
        funeralHomeId: homeId,
        gallery: gallery?.length ? {
          create: gallery,
        } : undefined,
      },
      include: { category: true, gallery: { orderBy: { displayOrder: 'asc' } } },
    });
    res.status(201).json({ success: true, data: brochure });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error('Create brochure error:', error);
    res.status(500).json({ success: false, message: 'Failed to create brochure' });
  }
});

router.get('/brochures/:id', authenticate, async (req, res) => {
  try {
    const brochure = await prisma.brochure.findUnique({
      where: { id: paramId(req) },
      include: { category: true, gallery: { orderBy: { displayOrder: 'asc' } }, _count: { select: { enquiries: true } } },
    });
    if (!brochure) return res.status(404).json({ success: false, message: 'Brochure not found' });
    const homeId = fhId(req);
    if (homeId && brochure.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    res.json({ success: true, data: brochure });
  } catch (error) {
    console.error('Get brochure error:', error);
    res.status(500).json({ success: false, message: 'Failed to load brochure' });
  }
});

router.patch('/brochures/reorder', authenticate, async (req, res) => {
  try {
    const homeId = fhId(req);
    if (!homeId) return res.status(400).json({ success: false, message: 'Funeral home ID required' });
    const body = z.object({ order: z.array(z.object({ id: z.string(), displayOrder: z.number().int().min(0) })) }).parse(req.body);
    await Promise.all(body.order.map((item) =>
      prisma.brochure.updateMany({ where: { id: item.id, funeralHomeId: homeId }, data: { displayOrder: item.displayOrder } }),
    ));
    res.json({ success: true, data: null });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error('Reorder brochures error:', error);
    res.status(500).json({ success: false, message: 'Failed to reorder brochures' });
  }
});

router.patch('/brochures/:id', authenticate, async (req, res) => {
  try {
    const body = updateBrochureSchema.parse(req.body);
    const existing = await prisma.brochure.findUnique({ where: { id: paramId(req) } });
    if (!existing) return res.status(404).json({ success: false, message: 'Brochure not found' });
    const homeId = fhId(req);
    if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    if (body.slug && body.slug !== existing.slug) {
      const dup = await prisma.brochure.findFirst({
        where: { funeralHomeId: existing.funeralHomeId, slug: body.slug, id: { not: existing.id } },
      });
      if (dup) return res.status(409).json({ success: false, message: 'A brochure with this slug already exists in this funeral home' });
    }
    const { gallery, ...brochureData } = body;
    const brochure = await prisma.brochure.update({
      where: { id: existing.id },
      data: brochureData,
      include: { category: true, gallery: { orderBy: { displayOrder: 'asc' } } },
    });
    if (gallery) {
      await prisma.brochureGallery.deleteMany({ where: { brochureId: existing.id } });
      if (gallery.length > 0) {
        await prisma.brochureGallery.createMany({
          data: gallery.map((g) => ({ ...g, brochureId: existing.id })),
        });
      }
      brochure.gallery = await prisma.brochureGallery.findMany({ where: { brochureId: existing.id }, orderBy: { displayOrder: 'asc' } });
    }
    res.json({ success: true, data: brochure });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error('Update brochure error:', error);
    res.status(500).json({ success: false, message: 'Failed to update brochure' });
  }
});

router.delete('/brochures/:id', authenticate, async (req, res) => {
  try {
    const existing = await prisma.brochure.findUnique({ where: { id: paramId(req) } });
    if (!existing) return res.status(404).json({ success: false, message: 'Brochure not found' });
    const homeId = fhId(req);
    if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    await prisma.brochure.delete({ where: { id: existing.id } });
    res.json({ success: true, data: null });
  } catch (error) {
    console.error('Delete brochure error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete brochure' });
  }
});

router.post('/brochures/:id/duplicate', authenticate, async (req, res) => {
  try {
    const existing = await prisma.brochure.findUnique({
      where: { id: paramId(req) },
      include: { gallery: true },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Brochure not found' });
    const homeId = fhId(req);
    if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    let slug = createSlug(`${existing.title}-copy`);
    let uniqueSlug = slug;
    let counter = 1;
    while (await prisma.brochure.findFirst({ where: { funeralHomeId: existing.funeralHomeId, slug: uniqueSlug } })) {
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }
    const brochure = await prisma.brochure.create({
      data: {
        funeralHomeId: existing.funeralHomeId,
        categoryId: existing.categoryId,
        title: `${existing.title} (Copy)`,
        slug: uniqueSlug,
        coverImageUrl: existing.coverImageUrl,
        description: existing.description,
        pdfUrl: existing.pdfUrl,
        includedItems: existing.includedItems == null ? undefined : (existing.includedItems as string[]),
        price: existing.price,
        depositRequired: existing.depositRequired,
        monthlyPaymentAvailable: existing.monthlyPaymentAvailable,
        financeAvailable: existing.financeAvailable,
        ctaEnabled: existing.ctaEnabled,
        ctaType: existing.ctaType,
        ctaText: existing.ctaText,
        ctaUrl: existing.ctaUrl,
        whatsappNumber: existing.whatsappNumber,
        phoneNumber: existing.phoneNumber,
        emailAddress: existing.emailAddress,
        contactPerson: existing.contactPerson,
        branchName: existing.branchName,
        websiteUrl: existing.websiteUrl,
        seoTitle: existing.seoTitle,
        seoDescription: existing.seoDescription,
        published: false,
        featured: false,
        displayOrder: existing.displayOrder + 1,
        gallery: existing.gallery.length ? {
          create: existing.gallery.map((g) => ({ url: g.url, caption: g.caption, displayOrder: g.displayOrder })),
        } : undefined,
      },
      include: { category: true, gallery: { orderBy: { displayOrder: 'asc' } } },
    });
    res.status(201).json({ success: true, data: brochure });
  } catch (error) {
    console.error('Duplicate brochure error:', error);
    res.status(500).json({ success: false, message: 'Failed to duplicate brochure' });
  }
});

router.post('/brochures/:id/cover', authenticate, (req, res) => {
  upload.single('cover')(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: 'Upload failed' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file provided' });
    try {
      const existing = await prisma.brochure.findUnique({ where: { id: paramId(req) } });
      if (!existing) return res.status(404).json({ success: false, message: 'Brochure not found' });
      const homeId = fhId(req);
      if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
      const url = imageUrl(req.file.filename);
      const brochure = await prisma.brochure.update({ where: { id: existing.id }, data: { coverImageUrl: url } });
      res.json({ success: true, data: { coverImageUrl: url, brochure } });
    } catch (error) {
      console.error('Upload cover error:', error);
      res.status(500).json({ success: false, message: 'Failed to upload cover' });
    }
  });
});

router.post('/brochures/:id/gallery', authenticate, (req, res) => {
  upload.array('gallery', 20)(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: 'Upload failed' });
    const files = req.files as Express.Multer.File[];
    if (!files?.length) return res.status(400).json({ success: false, message: 'No files provided' });
    try {
      const existing = await prisma.brochure.findUnique({ where: { id: paramId(req) } });
      if (!existing) return res.status(404).json({ success: false, message: 'Brochure not found' });
      const homeId = fhId(req);
      if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
      const galleryData = files.map((f, i) => ({ url: imageUrl(f.filename), brochureId: existing.id, displayOrder: i }));
      await prisma.brochureGallery.createMany({ data: galleryData });
      const gallery = await prisma.brochureGallery.findMany({ where: { brochureId: existing.id }, orderBy: { displayOrder: 'asc' } });
      res.json({ success: true, data: gallery });
    } catch (error) {
      console.error('Upload gallery error:', error);
      res.status(500).json({ success: false, message: 'Failed to upload gallery images' });
    }
  });
});

router.delete('/brochures/:id/gallery/:galleryId', authenticate, async (req, res) => {
  try {
    const galleryId = Array.isArray(req.params.galleryId) ? req.params.galleryId[0] : req.params.galleryId;
    if (!galleryId) return res.status(400).json({ success: false, message: 'Gallery item id required' });
    const item = await prisma.brochureGallery.findUnique({ where: { id: galleryId } });
    if (!item) return res.status(404).json({ success: false, message: 'Gallery item not found' });
    const brochure = await prisma.brochure.findUnique({ where: { id: item.brochureId } });
    if (!brochure) return res.status(404).json({ success: false, message: 'Brochure not found' });
    const homeId = fhId(req);
    if (homeId && brochure.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    await prisma.brochureGallery.delete({ where: { id: item.id } });
    res.json({ success: true, data: null });
  } catch (error) {
    console.error('Delete gallery item error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete gallery item' });
  }
});

router.post('/brochures/:id/pdf', authenticate, (req, res) => {
  pdfUpload.single('pdf')(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message === 'File too large' ? 'PDF must be under 50MB' : 'Upload failed' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file provided' });
    try {
      const existing = await prisma.brochure.findUnique({ where: { id: paramId(req) } });
      if (!existing) return res.status(404).json({ success: false, message: 'Brochure not found' });
      const homeId = fhId(req);
      if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
      const url = pdfUrl(req.file.filename);
      const brochure = await prisma.brochure.update({ where: { id: existing.id }, data: { pdfUrl: url } });
      res.json({ success: true, data: { pdfUrl: url, brochure } });
    } catch (error) {
      console.error('Upload PDF error:', error);
      res.status(500).json({ success: false, message: 'Failed to upload PDF' });
    }
  });
});

router.get('/brochures/:id/qr-code', authenticate, async (req, res) => {
  try {
    const existing = await prisma.brochure.findUnique({
      where: { id: paramId(req) },
      include: { funeralHome: { select: { slug: true } } },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Brochure not found' });
    const homeId = fhId(req);
    if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });

    const memorialOrigin = (env.MEMORIAL_URL || 'http://localhost:5174').replace(/\/$/, '');
    // Canonical URL is tenant-scoped: /services/{funeralHomeSlug}/{brochureSlug}.
    // Homes without a slug fall back to the legacy /services/{slug} form, which
    // still resolves via the legacy redirect.
    const fhSlug = existing.funeralHome?.slug;
    const publicUrl = fhSlug
      ? `${memorialOrigin}/services/${fhSlug}/${existing.slug}`
      : `${memorialOrigin}/services/${existing.slug}`;

    const qrDir = ensureMarketingDir('qr');
    const qrFilename = `qr-${existing.id}.png`;
    const qrPath = path.join(qrDir, qrFilename);
    await QRCode.toFile(qrPath, publicUrl, { width: 400, margin: 2, color: { dark: '#000000', light: '#ffffff' } });
    const qrUrl = `/uploads/marketing/qr/${qrFilename}`;
    const existingQr = await prisma.qRCode.findFirst({ where: { brochureId: existing.id } });
    if (existingQr) {
      await prisma.qRCode.update({ where: { id: existingQr.id }, data: { imagePath: qrUrl, url: publicUrl } });
    } else {
      await prisma.qRCode.create({ data: { brochureId: existing.id, funeralHomeId: existing.funeralHomeId, url: publicUrl, imagePath: qrUrl } });
    }
    res.json({ success: true, data: { qrCodeUrl: qrUrl, publicUrl } });
  } catch (error) {
    console.error('Generate QR error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate QR code' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// PROMOTIONS
// ══════════════════════════════════════════════════════════════════════════

router.get('/promotions', authenticate, async (req, res) => {
  try {
    const homeId = fhId(req);
    if (!homeId) return res.status(400).json({ success: false, message: 'Funeral home ID required' });
    const promotions = await prisma.promotion.findMany({
      where: { funeralHomeId: homeId },
      orderBy: { createdAt: 'desc' },
    });
    const now = new Date();
    res.json({
      success: true,
      data: promotions.map((p) => ({ ...p, active: p.published && p.endDate >= now && p.startDate <= now })),
    });
  } catch (error) {
    console.error('Get promotions error:', error);
    res.status(500).json({ success: false, message: 'Failed to load promotions' });
  }
});

router.post('/promotions', authenticate, async (req, res) => {
  try {
    const homeId = fhId(req);
    if (!homeId) return res.status(400).json({ success: false, message: 'Funeral home ID required' });
    const body = createPromotionSchema.parse(req.body);
    const promotion = await prisma.promotion.create({
      data: { ...body, funeralHomeId: homeId, startDate: new Date(body.startDate), endDate: new Date(body.endDate) },
    });
    res.status(201).json({ success: true, data: promotion });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error('Create promotion error:', error);
    res.status(500).json({ success: false, message: 'Failed to create promotion' });
  }
});

router.get('/promotions/:id', authenticate, async (req, res) => {
  try {
    const promotion = await prisma.promotion.findUnique({ where: { id: paramId(req) } });
    if (!promotion) return res.status(404).json({ success: false, message: 'Promotion not found' });
    const homeId = fhId(req);
    if (homeId && promotion.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    res.json({ success: true, data: promotion });
  } catch (error) {
    console.error('Get promotion error:', error);
    res.status(500).json({ success: false, message: 'Failed to load promotion' });
  }
});

router.patch('/promotions/:id', authenticate, async (req, res) => {
  try {
    const body = updatePromotionSchema.parse(req.body);
    const existing = await prisma.promotion.findUnique({ where: { id: paramId(req) } });
    if (!existing) return res.status(404).json({ success: false, message: 'Promotion not found' });
    const homeId = fhId(req);
    if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    const data: Record<string, unknown> = { ...body };
    if (body.startDate) data.startDate = new Date(body.startDate);
    if (body.endDate) data.endDate = new Date(body.endDate);
    const promotion = await prisma.promotion.update({ where: { id: existing.id }, data });
    res.json({ success: true, data: promotion });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error('Update promotion error:', error);
    res.status(500).json({ success: false, message: 'Failed to update promotion' });
  }
});

router.delete('/promotions/:id', authenticate, async (req, res) => {
  try {
    const existing = await prisma.promotion.findUnique({ where: { id: paramId(req) } });
    if (!existing) return res.status(404).json({ success: false, message: 'Promotion not found' });
    const homeId = fhId(req);
    if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    await prisma.promotion.delete({ where: { id: existing.id } });
    res.json({ success: true, data: null });
  } catch (error) {
    console.error('Delete promotion error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete promotion' });
  }
});

router.post('/promotions/:id/banner', authenticate, (req, res) => {
  upload.single('banner')(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: 'Upload failed' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file provided' });
    try {
      const existing = await prisma.promotion.findUnique({ where: { id: paramId(req) } });
      if (!existing) return res.status(404).json({ success: false, message: 'Promotion not found' });
      const homeId = fhId(req);
      if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
      const url = imageUrl(req.file.filename);
      const promotion = await prisma.promotion.update({ where: { id: existing.id }, data: { bannerImageUrl: url } });
      res.json({ success: true, data: { bannerImageUrl: url, promotion } });
    } catch (error) {
      console.error('Upload banner error:', error);
      res.status(500).json({ success: false, message: 'Failed to upload banner' });
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════
// BRANCHES
// ══════════════════════════════════════════════════════════════════════════

router.get('/branches', authenticate, async (req, res) => {
  try {
    const homeId = fhId(req);
    if (!homeId) return res.status(400).json({ success: false, message: 'Funeral home ID required' });
    const branches = await prisma.branch.findMany({
      where: { funeralHomeId: homeId },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: branches });
  } catch (error) {
    console.error('Get branches error:', error);
    res.status(500).json({ success: false, message: 'Failed to load branches' });
  }
});

router.post('/branches', authenticate, async (req, res) => {
  try {
    const homeId = fhId(req);
    if (!homeId) return res.status(400).json({ success: false, message: 'Funeral home ID required' });
    const body = createBranchSchema.parse(req.body);
    const branch = await prisma.branch.create({ data: { ...body, funeralHomeId: homeId } });
    res.status(201).json({ success: true, data: branch });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error('Create branch error:', error);
    res.status(500).json({ success: false, message: 'Failed to create branch' });
  }
});

router.get('/branches/:id', authenticate, async (req, res) => {
  try {
    const branch = await prisma.branch.findUnique({ where: { id: paramId(req) } });
    if (!branch) return res.status(404).json({ success: false, message: 'Branch not found' });
    const homeId = fhId(req);
    if (homeId && branch.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    res.json({ success: true, data: branch });
  } catch (error) {
    console.error('Get branch error:', error);
    res.status(500).json({ success: false, message: 'Failed to load branch' });
  }
});

router.patch('/branches/:id', authenticate, async (req, res) => {
  try {
    const body = updateBranchSchema.parse(req.body);
    const existing = await prisma.branch.findUnique({ where: { id: paramId(req) } });
    if (!existing) return res.status(404).json({ success: false, message: 'Branch not found' });
    const homeId = fhId(req);
    if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    const branch = await prisma.branch.update({ where: { id: existing.id }, data: body });
    res.json({ success: true, data: branch });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error('Update branch error:', error);
    res.status(500).json({ success: false, message: 'Failed to update branch' });
  }
});

router.delete('/branches/:id', authenticate, async (req, res) => {
  try {
    const existing = await prisma.branch.findUnique({ where: { id: paramId(req) } });
    if (!existing) return res.status(404).json({ success: false, message: 'Branch not found' });
    const homeId = fhId(req);
    if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    await prisma.branch.delete({ where: { id: existing.id } });
    res.json({ success: true, data: null });
  } catch (error) {
    console.error('Delete branch error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete branch' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// ENQUIRIES
// ══════════════════════════════════════════════════════════════════════════

router.get('/enquiries', authenticate, async (req, res) => {
  try {
    const homeId = fhId(req);
    if (!homeId) return res.status(400).json({ success: false, message: 'Funeral home ID required' });
    const enquiries = await prisma.enquiry.findMany({
      where: { funeralHomeId: homeId },
      orderBy: { createdAt: 'desc' },
      include: { brochure: { select: { title: true, slug: true } } },
    });
    res.json({ success: true, data: enquiries });
  } catch (error) {
    console.error('Get enquiries error:', error);
    res.status(500).json({ success: false, message: 'Failed to load enquiries' });
  }
});

router.get('/enquiries/:id', authenticate, async (req, res) => {
  try {
    const enquiry = await prisma.enquiry.findUnique({
      where: { id: paramId(req) },
      include: { brochure: { select: { title: true, slug: true } } },
    });
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    const homeId = fhId(req);
    if (homeId && enquiry.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    res.json({ success: true, data: enquiry });
  } catch (error) {
    console.error('Get enquiry error:', error);
    res.status(500).json({ success: false, message: 'Failed to load enquiry' });
  }
});

router.delete('/enquiries/:id', authenticate, async (req, res) => {
  try {
    const existing = await prisma.enquiry.findUnique({ where: { id: paramId(req) } });
    if (!existing) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    const homeId = fhId(req);
    if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    await prisma.enquiry.delete({ where: { id: existing.id } });
    res.json({ success: true, data: null });
  } catch (error) {
    console.error('Delete enquiry error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete enquiry' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ══════════════════════════════════════════════════════════════════════════

router.get('/analytics', authenticate, async (req, res) => {
  try {
    const homeId = fhId(req);
    if (!homeId) return res.status(400).json({ success: false, message: 'Funeral home ID required' });
    const days = parseInt(String(req.query.days || '30'), 10);

    const since = new Date();
    since.setDate(since.getDate() - days);

    const events = await prisma.analyticsEvent.findMany({
      where: { funeralHomeId: homeId, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
    });

    const brochuresWithViews = await prisma.brochure.findMany({
      where: { funeralHomeId: homeId },
      select: { id: true, title: true, slug: true, viewCount: true },
      orderBy: { viewCount: 'desc' },
      take: 20,
    });

    const totalViews = events.filter((e) => e.eventType === 'page_view').length;
    const uniqueVisitors = new Set(events.filter((e) => e.visitorId).map((e) => e.visitorId)).size;
    const totalQrScans = events.filter((e) => e.eventType === 'qr_scan').length;
    const totalPdfDownloads = events.filter((e) => e.eventType === 'pdf_download').length;
    const totalPhoneClicks = events.filter((e) => e.eventType === 'phone_click').length;
    const totalWhatsappClicks = events.filter((e) => e.eventType === 'whatsapp_click').length;
    const totalCtaClicks = events.filter((e) => e.eventType === 'cta_click').length;
    const totalEnquiries = events.filter((e) => e.eventType === 'enquiry').length;
    const conversionRate = totalViews > 0 ? Math.round((totalEnquiries / totalViews) * 10000) / 100 : 0;

    const viewsByDay: Record<string, number> = {};
    events.filter((e) => e.eventType === 'page_view').forEach((e) => {
      const day = e.createdAt.toISOString().slice(0, 10);
      viewsByDay[day] = (viewsByDay[day] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        totalViews,
        totalUniqueVisitors: uniqueVisitors,
        totalQrScans,
        totalPdfDownloads,
        totalPhoneClicks,
        totalWhatsappClicks,
        totalCtaClicks,
        totalEnquiries,
        conversionRate,
        viewsByDay: Object.entries(viewsByDay).map(([date, count]) => ({ date, count })),
        brochureViews: brochuresWithViews,
      },
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to load analytics' });
  }
});

export default router;
