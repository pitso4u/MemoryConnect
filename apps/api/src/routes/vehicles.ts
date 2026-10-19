import { Router, Request } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, ROLES } from '../middleware/auth';
import { requireFeature } from '../lib/featureService';
import { isZodError } from '../lib/validation';
import { UPLOADS_DIR } from '../lib/uploads';
import { createVehicleSchema, updateVehicleSchema } from '@memorialconnect/shared';

const FUNERAL_HOME_OR_ADMIN = [ROLES.FUNERAL_HOME_ADMIN, ROLES.SUPER_ADMIN];

const router = Router();
router.use(authenticate, requireFeature('VEHICLES'), requireRole(FUNERAL_HOME_OR_ADMIN));

function paramId(req: Request) {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

function fhId(req: Request): string | undefined {
  return req.user?.role === ROLES.SUPER_ADMIN && req.query.funeralHomeId
    ? String(req.query.funeralHomeId)
    : req.user?.funeralHomeId || undefined;
}

// ── Multer setup for vehicle uploads ────────────────────────────────────

function ensureVehiclesDir(subdir: string) {
  const dir = path.join(UPLOADS_DIR, 'vehicles', subdir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const photoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, ensureVehiclesDir('photos'));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const documentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, ensureVehiclesDir('documents'));
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

function vehiclePhotoUrl(filename: string): string {
  return `/uploads/vehicles/photos/${filename}`;
}

function vehicleDocumentUrl(filename: string): string {
  return `/uploads/vehicles/documents/${filename}`;
}

function parseDateStrings(data: Record<string, unknown>): Record<string, unknown> {
  const dateFields = ['insuranceExpiry', 'roadworthyExpiry', 'licenseDiskExpiry', 'nextServiceDate'];
  const result: Record<string, unknown> = { ...data };
  for (const field of dateFields) {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = new Date(result[field] as string);
    }
  }
  return result;
}

// ══════════════════════════════════════════════════════════════════════════
// LIST VEHICLES
// ══════════════════════════════════════════════════════════════════════════

router.get('/', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const homeId = fhId(req);
    if (!homeId) return res.status(400).json({ success: false, message: 'Funeral home ID required' });
    const status = req.query.status as string | undefined;
    const where: Record<string, unknown> = { funeralHomeId: homeId };
    if (status) where.status = status;
    const vehicles = await prisma.vehicle.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: vehicles });
  } catch (error) {
    console.error('Get vehicles error:', error);
    res.status(500).json({ success: false, message: 'Failed to load vehicles' });
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

    const [total, available, booked, maintenance, inactive, licenseExpiringSoon] = await Promise.all([
      prisma.vehicle.count({ where: { funeralHomeId: homeId } }),
      prisma.vehicle.count({ where: { funeralHomeId: homeId, status: 'Available' } }),
      prisma.vehicle.count({ where: { funeralHomeId: homeId, status: 'Booked' } }),
      prisma.vehicle.count({ where: { funeralHomeId: homeId, status: 'Maintenance' } }),
      prisma.vehicle.count({ where: { funeralHomeId: homeId, status: 'Inactive' } }),
      prisma.vehicle.count({
        where: {
          funeralHomeId: homeId,
          licenseDiskExpiry: { lte: thirtyDaysFromNow, gte: new Date() },
        },
      }),
    ]);

    res.json({
      success: true,
      data: { total, available, booked, maintenance, inactive, licenseExpiringSoon },
    });
  } catch (error) {
    console.error('Vehicle dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to load dashboard' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// GET SINGLE VEHICLE
// ══════════════════════════════════════════════════════════════════════════

router.get('/:id', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: paramId(req) },
      include: {
        photos: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { createdAt: 'desc' } },
        serviceHistories: { orderBy: { serviceDate: 'desc' } },
        fuelLogs: { orderBy: { date: 'desc' } },
        maintenanceLogs: { orderBy: { date: 'desc' } },
      },
    });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    const homeId = fhId(req);
    if (homeId && vehicle.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    res.json({ success: true, data: vehicle });
  } catch (error) {
    console.error('Get vehicle error:', error);
    res.status(500).json({ success: false, message: 'Failed to load vehicle' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// CREATE VEHICLE
// ══════════════════════════════════════════════════════════════════════════

router.post('/', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const homeId = fhId(req);
    if (!homeId) return res.status(400).json({ success: false, message: 'Funeral home ID required' });
    const body = createVehicleSchema.parse(req.body);
    const data = parseDateStrings(body as Record<string, unknown>);
    const vehicle = await prisma.vehicle.create({
      data: { ...data, funeralHomeId: homeId } as any,
    });
    res.status(201).json({ success: true, data: vehicle });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error('Create vehicle error:', error);
    res.status(500).json({ success: false, message: 'Failed to create vehicle' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// UPDATE VEHICLE
// ══════════════════════════════════════════════════════════════════════════

router.patch('/:id', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const body = updateVehicleSchema.parse(req.body);
    const existing = await prisma.vehicle.findUnique({ where: { id: paramId(req) } });
    if (!existing) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    const homeId = fhId(req);
    if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    const data = parseDateStrings(body as Record<string, unknown>);
    const vehicle = await prisma.vehicle.update({
      where: { id: existing.id },
      data: data as any,
    });
    res.json({ success: true, data: vehicle });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error('Update vehicle error:', error);
    res.status(500).json({ success: false, message: 'Failed to update vehicle' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// DELETE VEHICLE
// ══════════════════════════════════════════════════════════════════════════

router.delete('/:id', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const existing = await prisma.vehicle.findUnique({ where: { id: paramId(req) } });
    if (!existing) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    const homeId = fhId(req);
    if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    await prisma.vehicle.delete({ where: { id: existing.id } });
    res.json({ success: true, data: null });
  } catch (error) {
    console.error('Delete vehicle error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete vehicle' });
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
      const existing = await prisma.vehicle.findUnique({ where: { id: paramId(req) } });
      if (!existing) return res.status(404).json({ success: false, message: 'Vehicle not found' });
      const homeId = fhId(req);
      if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
      const photoData = files.map((f) => ({ url: vehiclePhotoUrl(f.filename), vehicleId: existing.id }));
      await prisma.vehiclePhoto.createMany({ data: photoData });
      const photos = await prisma.vehiclePhoto.findMany({ where: { vehicleId: existing.id }, orderBy: { createdAt: 'desc' } });
      res.json({ success: true, data: photos });
    } catch (error) {
      console.error('Upload vehicle photos error:', error);
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
    const photo = await prisma.vehiclePhoto.findUnique({ where: { id: photoId } });
    if (!photo) return res.status(404).json({ success: false, message: 'Photo not found' });
    const vehicle = await prisma.vehicle.findUnique({ where: { id: paramId(req) } });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    const homeId = fhId(req);
    if (homeId && vehicle.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    await prisma.vehiclePhoto.delete({ where: { id: photo.id } });
    res.json({ success: true, data: null });
  } catch (error) {
    console.error('Delete vehicle photo error:', error);
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
      const existing = await prisma.vehicle.findUnique({ where: { id: paramId(req) } });
      if (!existing) return res.status(404).json({ success: false, message: 'Vehicle not found' });
      const homeId = fhId(req);
      if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
      const url = vehicleDocumentUrl(req.file.filename);
      const name = req.body.name || req.file.originalname;
      const docType = req.body.type || null;
      const document = await prisma.vehicleDocument.create({
        data: { vehicleId: existing.id, name, url, type: docType },
      });
      res.status(201).json({ success: true, data: document });
    } catch (error) {
      console.error('Upload vehicle document error:', error);
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
    const document = await prisma.vehicleDocument.findUnique({ where: { id: docId } });
    if (!document) return res.status(404).json({ success: false, message: 'Document not found' });
    const vehicle = await prisma.vehicle.findUnique({ where: { id: paramId(req) } });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    const homeId = fhId(req);
    if (homeId && vehicle.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    await prisma.vehicleDocument.delete({ where: { id: document.id } });
    res.json({ success: true, data: null });
  } catch (error) {
    console.error('Delete vehicle document error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete document' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// ADD SERVICE HISTORY
// ══════════════════════════════════════════════════════════════════════════

router.post('/:id/service-history', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const existing = await prisma.vehicle.findUnique({ where: { id: paramId(req) } });
    if (!existing) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    const homeId = fhId(req);
    if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    const body = z.object({
      serviceDate: z.string().refine((v) => !isNaN(Date.parse(v)), 'Invalid date'),
      description: z.string().max(2000).optional().nullable(),
      mileageAtService: z.number().int().min(0).optional().nullable(),
      cost: z.number().min(0).optional().nullable(),
      provider: z.string().max(200).optional().nullable(),
      nextServiceDate: z.string().optional().nullable(),
      notes: z.string().max(5000).optional().nullable(),
    }).parse(req.body);
    const data: Record<string, unknown> = { ...body, vehicleId: existing.id, serviceDate: new Date(body.serviceDate) };
    if (body.nextServiceDate) data.nextServiceDate = new Date(body.nextServiceDate);
    const history = await prisma.vehicleServiceHistory.create({ data: data as any });
    res.status(201).json({ success: true, data: history });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error('Add service history error:', error);
    res.status(500).json({ success: false, message: 'Failed to add service history' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// DELETE SERVICE HISTORY
// ══════════════════════════════════════════════════════════════════════════

router.delete('/:id/service-history/:historyId', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const historyId = String(req.params.historyId);
    const history = await prisma.vehicleServiceHistory.findUnique({ where: { id: historyId } });
    if (!history) return res.status(404).json({ success: false, message: 'Service history record not found' });
    const vehicle = await prisma.vehicle.findUnique({ where: { id: paramId(req) } });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    const homeId = fhId(req);
    if (homeId && vehicle.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    await prisma.vehicleServiceHistory.delete({ where: { id: history.id } });
    res.json({ success: true, data: null });
  } catch (error) {
    console.error('Delete service history error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete service history record' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// ADD FUEL LOG
// ══════════════════════════════════════════════════════════════════════════

router.post('/:id/fuel-log', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const existing = await prisma.vehicle.findUnique({ where: { id: paramId(req) } });
    if (!existing) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    const homeId = fhId(req);
    if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    const body = z.object({
      date: z.string().refine((v) => !isNaN(Date.parse(v)), 'Invalid date'),
      amount: z.number().min(0),
      cost: z.number().min(0),
      mileage: z.number().int().min(0).optional().nullable(),
      fuelType: z.string().max(50).optional().nullable(),
      station: z.string().max(200).optional().nullable(),
      receiptUrl: z.string().max(500).optional().nullable(),
      notes: z.string().max(5000).optional().nullable(),
    }).parse(req.body);
    const data = { ...body, vehicleId: existing.id, date: new Date(body.date) } as any;
    const log = await prisma.vehicleFuelLog.create({ data });
    res.status(201).json({ success: true, data: log });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error('Add fuel log error:', error);
    res.status(500).json({ success: false, message: 'Failed to add fuel log entry' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// DELETE FUEL LOG
// ══════════════════════════════════════════════════════════════════════════

router.delete('/:id/fuel-log/:logId', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const logId = String(req.params.logId);
    const log = await prisma.vehicleFuelLog.findUnique({ where: { id: logId } });
    if (!log) return res.status(404).json({ success: false, message: 'Fuel log entry not found' });
    const vehicle = await prisma.vehicle.findUnique({ where: { id: paramId(req) } });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    const homeId = fhId(req);
    if (homeId && vehicle.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    await prisma.vehicleFuelLog.delete({ where: { id: log.id } });
    res.json({ success: true, data: null });
  } catch (error) {
    console.error('Delete fuel log error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete fuel log entry' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// ADD MAINTENANCE LOG
// ══════════════════════════════════════════════════════════════════════════

router.post('/:id/maintenance-log', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const existing = await prisma.vehicle.findUnique({ where: { id: paramId(req) } });
    if (!existing) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    const homeId = fhId(req);
    if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    const body = z.object({
      date: z.string().refine((v) => !isNaN(Date.parse(v)), 'Invalid date'),
      type: z.string().min(1).max(200),
      description: z.string().max(2000).optional().nullable(),
      cost: z.number().min(0).optional().nullable(),
      provider: z.string().max(200).optional().nullable(),
      mileageAtService: z.number().int().min(0).optional().nullable(),
      nextServiceDue: z.string().optional().nullable(),
      status: z.string().max(50).optional(),
      notes: z.string().max(5000).optional().nullable(),
    }).parse(req.body);
    const data: Record<string, unknown> = { ...body, vehicleId: existing.id, date: new Date(body.date) };
    if (body.nextServiceDue) data.nextServiceDue = new Date(body.nextServiceDue);
    const log = await prisma.vehicleMaintenanceLog.create({ data: data as any });
    res.status(201).json({ success: true, data: log });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error('Add maintenance log error:', error);
    res.status(500).json({ success: false, message: 'Failed to add maintenance log' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// UPDATE MAINTENANCE LOG STATUS
// ══════════════════════════════════════════════════════════════════════════

router.patch('/:id/maintenance-log/:logId', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const logId = String(req.params.logId);
    const log = await prisma.vehicleMaintenanceLog.findUnique({ where: { id: logId } });
    if (!log) return res.status(404).json({ success: false, message: 'Maintenance log not found' });
    const vehicle = await prisma.vehicle.findUnique({ where: { id: paramId(req) } });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    const homeId = fhId(req);
    if (homeId && vehicle.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    const body = z.object({
      status: z.string().min(1).max(50),
    }).parse(req.body);
    const updated = await prisma.vehicleMaintenanceLog.update({
      where: { id: log.id },
      data: { status: body.status },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error('Update maintenance log error:', error);
    res.status(500).json({ success: false, message: 'Failed to update maintenance log' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// DELETE MAINTENANCE LOG
// ══════════════════════════════════════════════════════════════════════════

router.delete('/:id/maintenance-log/:logId', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const logId = String(req.params.logId);
    const log = await prisma.vehicleMaintenanceLog.findUnique({ where: { id: logId } });
    if (!log) return res.status(404).json({ success: false, message: 'Maintenance log not found' });
    const vehicle = await prisma.vehicle.findUnique({ where: { id: paramId(req) } });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    const homeId = fhId(req);
    if (homeId && vehicle.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    await prisma.vehicleMaintenanceLog.delete({ where: { id: log.id } });
    res.json({ success: true, data: null });
  } catch (error) {
    console.error('Delete maintenance log error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete maintenance log' });
  }
});

export default router;
