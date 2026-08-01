import { Router, Request } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, ROLES } from '../middleware/auth';
import { requireFeature } from '../lib/featureService';
import { isZodError } from '../lib/validation';
import { UPLOADS_DIR } from '../lib/uploads';
import { createAssetSchema, updateAssetSchema, createDamageReportSchema } from '@memorialconnect/shared';

const FUNERAL_HOME_OR_ADMIN = [ROLES.FUNERAL_HOME_ADMIN, ROLES.SUPER_ADMIN];

const router = Router();
router.use(authenticate, requireFeature('ASSETS'), requireRole(FUNERAL_HOME_OR_ADMIN));

function paramId(req: Request) {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

function fhId(req: Request): string | undefined {
  return req.user?.role === ROLES.SUPER_ADMIN && req.query.funeralHomeId
    ? String(req.query.funeralHomeId)
    : req.user?.funeralHomeId || undefined;
}

// ── Multer setup for asset uploads ────────────────────────────────────

function ensureAssetsDir(subdir: string) {
  const dir = path.join(UPLOADS_DIR, 'assets', subdir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const photoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, ensureAssetsDir('photos'));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const documentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, ensureAssetsDir('documents'));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

const documentUpload = multer({
  storage: documentStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, ext === '.pdf');
  },
});

function assetPhotoUrl(filename: string): string {
  return `/uploads/assets/photos/${filename}`;
}

function assetDocumentUrl(filename: string): string {
  return `/uploads/assets/documents/${filename}`;
}

function parseDateStrings(data: Record<string, unknown>): Record<string, unknown> {
  const dateFields = ['purchaseDate', 'warrantyExpiry'];
  const result: Record<string, unknown> = { ...data };
  for (const field of dateFields) {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = new Date(result[field] as string);
    }
  }
  return result;
}

// ══════════════════════════════════════════════════════════════════════════
// LIST ASSETS
// ══════════════════════════════════════════════════════════════════════════

router.get('/', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const homeId = fhId(req);
    if (!homeId) return res.status(400).json({ success: false, message: 'Funeral home ID required' });
    const category = req.query.category as string | undefined;
    const status = req.query.status as string | undefined;
    const branchId = req.query.branchId as string | undefined;
    const where: Record<string, unknown> = { funeralHomeId: homeId };
    if (category) where.category = category;
    if (status) where.status = status;
    if (branchId) where.branchId = branchId;
    const assets = await prisma.asset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: assets });
  } catch (error) {
    console.error('Get assets error:', error);
    res.status(500).json({ success: false, message: 'Failed to load assets' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════════

router.get('/dashboard', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const homeId = fhId(req);
    if (!homeId) return res.status(400).json({ success: false, message: 'Funeral home ID required' });

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const [total, byCategory, byStatus, warrantyExpiringSoon] = await Promise.all([
      prisma.asset.count({ where: { funeralHomeId: homeId } }),
      prisma.asset.groupBy({
        by: ['category'],
        where: { funeralHomeId: homeId },
        _count: true,
      }),
      prisma.asset.groupBy({
        by: ['status'],
        where: { funeralHomeId: homeId },
        _count: true,
      }),
      prisma.asset.count({
        where: {
          funeralHomeId: homeId,
          warrantyExpiry: { lte: thirtyDaysFromNow, gte: new Date() },
        },
      }),
    ]);

    res.json({
      success: true,
      data: { total, byCategory, byStatus, warrantyExpiringSoon },
    });
  } catch (error) {
    console.error('Asset dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to load dashboard' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// GET SINGLE ASSET
// ══════════════════════════════════════════════════════════════════════════

router.get('/:id', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const asset = await prisma.asset.findUnique({
      where: { id: paramId(req) },
      include: {
        photos: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { createdAt: 'desc' } },
        movementHistories: { orderBy: { movedAt: 'desc' } },
        damageReports: true,
        branch: true,
      },
    });
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    const homeId = fhId(req);
    if (homeId && asset.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    res.json({ success: true, data: asset });
  } catch (error) {
    console.error('Get asset error:', error);
    res.status(500).json({ success: false, message: 'Failed to load asset' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// CREATE ASSET
// ══════════════════════════════════════════════════════════════════════════

router.post('/', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const homeId = fhId(req);
    if (!homeId) return res.status(400).json({ success: false, message: 'Funeral home ID required' });
    const body = createAssetSchema.parse(req.body);
    const data = parseDateStrings(body as Record<string, unknown>);
    const asset = await prisma.asset.create({
      data: { ...data, funeralHomeId: homeId } as any,
    });
    res.status(201).json({ success: true, data: asset });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error('Create asset error:', error);
    res.status(500).json({ success: false, message: 'Failed to create asset' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// UPDATE ASSET
// ══════════════════════════════════════════════════════════════════════════

router.patch('/:id', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const body = updateAssetSchema.parse(req.body);
    const existing = await prisma.asset.findUnique({ where: { id: paramId(req) } });
    if (!existing) return res.status(404).json({ success: false, message: 'Asset not found' });
    const homeId = fhId(req);
    if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    const data = parseDateStrings(body as Record<string, unknown>);
    const asset = await prisma.asset.update({
      where: { id: existing.id },
      data: data as any,
    });
    res.json({ success: true, data: asset });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error('Update asset error:', error);
    res.status(500).json({ success: false, message: 'Failed to update asset' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// DELETE ASSET
// ══════════════════════════════════════════════════════════════════════════

router.delete('/:id', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const existing = await prisma.asset.findUnique({ where: { id: paramId(req) } });
    if (!existing) return res.status(404).json({ success: false, message: 'Asset not found' });
    const homeId = fhId(req);
    if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    await prisma.asset.delete({ where: { id: existing.id } });
    res.json({ success: true, data: null });
  } catch (error) {
    console.error('Delete asset error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete asset' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// UPLOAD PHOTOS
// ══════════════════════════════════════════════════════════════════════════

router.post('/:id/photos', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), (req, res) => {
  photoUpload.array('photos', 20)(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: 'Upload failed' });
    const files = req.files as Express.Multer.File[];
    if (!files?.length) return res.status(400).json({ success: false, message: 'No files provided' });
    try {
      const existing = await prisma.asset.findUnique({ where: { id: paramId(req) } });
      if (!existing) return res.status(404).json({ success: false, message: 'Asset not found' });
      const homeId = fhId(req);
      if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
      const photoData = files.map((f) => ({ url: assetPhotoUrl(f.filename), assetId: existing.id }));
      await prisma.assetPhoto.createMany({ data: photoData });
      const photos = await prisma.assetPhoto.findMany({ where: { assetId: existing.id }, orderBy: { createdAt: 'desc' } });
      res.json({ success: true, data: photos });
    } catch (error) {
      console.error('Upload asset photos error:', error);
      res.status(500).json({ success: false, message: 'Failed to upload photos' });
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════
// DELETE PHOTO
// ══════════════════════════════════════════════════════════════════════════

router.delete('/:id/photos/:photoId', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const photoId = String(req.params.photoId);
    const photo = await prisma.assetPhoto.findUnique({ where: { id: photoId } });
    if (!photo) return res.status(404).json({ success: false, message: 'Photo not found' });
    const asset = await prisma.asset.findUnique({ where: { id: paramId(req) } });
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    const homeId = fhId(req);
    if (homeId && asset.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    await prisma.assetPhoto.delete({ where: { id: photo.id } });
    res.json({ success: true, data: null });
  } catch (error) {
    console.error('Delete asset photo error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete photo' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// UPLOAD DOCUMENT
// ══════════════════════════════════════════════════════════════════════════

router.post('/:id/documents', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), (req, res) => {
  documentUpload.single('document')(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message === 'File too large' ? 'Document must be under 50MB' : 'Upload failed' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file provided' });
    try {
      const existing = await prisma.asset.findUnique({ where: { id: paramId(req) } });
      if (!existing) return res.status(404).json({ success: false, message: 'Asset not found' });
      const homeId = fhId(req);
      if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
      const url = assetDocumentUrl(req.file.filename);
      const name = req.body.name || req.file.originalname;
      const docType = req.body.type || null;
      const document = await prisma.assetDocument.create({
        data: { assetId: existing.id, name, url, type: docType },
      });
      res.status(201).json({ success: true, data: document });
    } catch (error) {
      console.error('Upload asset document error:', error);
      res.status(500).json({ success: false, message: 'Failed to upload document' });
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════
// DELETE DOCUMENT
// ══════════════════════════════════════════════════════════════════════════

router.delete('/:id/documents/:docId', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const docId = String(req.params.docId);
    const document = await prisma.assetDocument.findUnique({ where: { id: docId } });
    if (!document) return res.status(404).json({ success: false, message: 'Document not found' });
    const asset = await prisma.asset.findUnique({ where: { id: paramId(req) } });
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    const homeId = fhId(req);
    if (homeId && asset.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    await prisma.assetDocument.delete({ where: { id: document.id } });
    res.json({ success: true, data: null });
  } catch (error) {
    console.error('Delete asset document error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete document' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// RECORD MOVEMENT
// ══════════════════════════════════════════════════════════════════════════

router.post('/:id/movements', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const existing = await prisma.asset.findUnique({ where: { id: paramId(req) } });
    if (!existing) return res.status(404).json({ success: false, message: 'Asset not found' });
    const homeId = fhId(req);
    if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    const body = z.object({
      fromLocation: z.string().max(500).optional().nullable(),
      toLocation: z.string().max(500).min(1, 'Destination is required'),
      fromBranch: z.string().optional().nullable(),
      toBranch: z.string().optional().nullable(),
      movedBy: z.string().max(200).optional().nullable(),
      notes: z.string().max(2000).optional().nullable(),
    }).parse(req.body);
    const movement = await prisma.assetMovementHistory.create({
      data: { ...body, assetId: existing.id } as any,
    });
    res.status(201).json({ success: true, data: movement });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error('Record movement error:', error);
    res.status(500).json({ success: false, message: 'Failed to record movement' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// REPORT DAMAGE
// ══════════════════════════════════════════════════════════════════════════

router.post('/:id/damage-reports', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const existing = await prisma.asset.findUnique({ where: { id: paramId(req) } });
    if (!existing) return res.status(404).json({ success: false, message: 'Asset not found' });
    const homeId = fhId(req);
    if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    const body = createDamageReportSchema.parse(req.body);
    const data: Record<string, unknown> = { ...body, assetId: existing.id };
    if (body.date) data.date = new Date(body.date);
    const report = await prisma.assetDamageReport.create({ data: data as any });
    res.status(201).json({ success: true, data: report });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error('Report damage error:', error);
    res.status(500).json({ success: false, message: 'Failed to report damage' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// UPDATE DAMAGE REPORT STATUS
// ══════════════════════════════════════════════════════════════════════════

router.patch('/:id/damage-reports/:reportId', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const reportId = String(req.params.reportId);
    const report = await prisma.assetDamageReport.findUnique({ where: { id: reportId } });
    if (!report) return res.status(404).json({ success: false, message: 'Damage report not found' });
    const asset = await prisma.asset.findUnique({ where: { id: paramId(req) } });
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    const homeId = fhId(req);
    if (homeId && asset.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    const body = z.object({
      status: z.enum(['Open', 'Investigating', 'Resolved', 'Closed']),
    }).parse(req.body);
    const updated = await prisma.assetDamageReport.update({
      where: { id: report.id },
      data: { status: body.status },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error('Update damage report error:', error);
    res.status(500).json({ success: false, message: 'Failed to update damage report' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// QR CODE
// ══════════════════════════════════════════════════════════════════════════

router.get('/:id/qr-code', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const asset = await prisma.asset.findUnique({ where: { id: paramId(req) } });
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    const homeId = fhId(req);
    if (homeId && asset.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });

    if (asset.barcodeQrCode) {
      return res.json({ success: true, data: { barcodeQrCode: asset.barcodeQrCode } });
    }

    const qrData = JSON.stringify({ id: asset.id, name: asset.name, category: asset.category });
    const barcodeQrCode = await QRCode.toDataURL(qrData);

    await prisma.asset.update({
      where: { id: asset.id },
      data: { barcodeQrCode },
    });

    res.json({ success: true, data: { barcodeQrCode } });
  } catch (error) {
    console.error('QR code error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate QR code' });
  }
});

export default router;
