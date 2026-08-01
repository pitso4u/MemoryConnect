import { Router, Request } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, ROLES } from '../middleware/auth';
import { requireFeature } from '../lib/featureService';
import { isZodError } from '../lib/validation';
import { createReservationSchema } from '@memorialconnect/shared';

const FUNERAL_HOME_OR_ADMIN = [ROLES.FUNERAL_HOME_ADMIN, ROLES.SUPER_ADMIN];

const router = Router();
router.use(authenticate, requireFeature('FUNERAL_RESOURCES'), requireRole(FUNERAL_HOME_OR_ADMIN));

function paramId(req: Request) {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

function fhId(req: Request): string | undefined {
  return req.user?.role === ROLES.SUPER_ADMIN && req.query.funeralHomeId
    ? String(req.query.funeralHomeId)
    : req.user?.funeralHomeId || undefined;
}

const reservationIncludes = {
  memorial: { select: { id: true, deceasedName: true, slug: true, status: true, serviceDate: true } },
  vehicle: { select: { id: true, name: true, registrationNumber: true } },
  asset: { select: { id: true, name: true, category: true } },
} as const;

// ══════════════════════════════════════════════════════════════════════════
// LIST RESERVATIONS
// ══════════════════════════════════════════════════════════════════════════

router.get('/', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const homeId = fhId(req);
    if (!homeId) return res.status(400).json({ success: false, message: 'Funeral home ID required' });
    const memorialId = req.query.memorialId as string | undefined;
    const where: Record<string, unknown> = { funeralHomeId: homeId };
    if (memorialId) where.memorialId = memorialId;
    const reservations = await prisma.funeralResourceReservation.findMany({
      where,
      include: reservationIncludes,
      orderBy: { reservedAt: 'desc' },
    });
    res.json({ success: true, data: reservations });
  } catch (error) {
    console.error('Get funeral resources error:', error);
    res.status(500).json({ success: false, message: 'Failed to load reservations' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// CHECK AVAILABILITY
// ══════════════════════════════════════════════════════════════════════════

router.get('/availability', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const homeId = fhId(req);
    if (!homeId) return res.status(400).json({ success: false, message: 'Funeral home ID required' });
    const { vehicleId, assetId, date } = req.query;
    if (!vehicleId && !assetId) {
      return res.status(400).json({ success: false, message: 'Provide vehicleId or assetId' });
    }
    if (!date || typeof date !== 'string') {
      return res.status(400).json({ success: false, message: 'Date query param required (ISO string)' });
    }
    const where: Record<string, unknown> = {
      funeralHomeId: homeId,
      status: { in: ['Reserved', 'CheckedOut'] },
    };
    if (vehicleId) where.vehicleId = String(vehicleId);
    if (assetId) where.assetId = String(assetId);
    const activeCount = await prisma.funeralResourceReservation.count({ where });
    res.json({ success: true, data: { date, available: activeCount === 0 } });
  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({ success: false, message: 'Failed to check availability' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// GET RESERVATIONS BY MEMORIAL
// ══════════════════════════════════════════════════════════════════════════

router.get('/memorial/:memorialId', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const homeId = fhId(req);
    if (!homeId) return res.status(400).json({ success: false, message: 'Funeral home ID required' });
    const reservations = await prisma.funeralResourceReservation.findMany({
      where: { funeralHomeId: homeId, memorialId: String(req.params.memorialId) },
      include: reservationIncludes,
      orderBy: { reservedAt: 'desc' },
    });
    res.json({ success: true, data: reservations });
  } catch (error) {
    console.error('Get memorial reservations error:', error);
    res.status(500).json({ success: false, message: 'Failed to load reservations' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// CREATE RESERVATION
// ══════════════════════════════════════════════════════════════════════════

router.post('/', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const homeId = fhId(req);
    if (!homeId) return res.status(400).json({ success: false, message: 'Funeral home ID required' });
    const body = createReservationSchema.parse(req.body);

    if (body.vehicleId) {
      const existing = await prisma.funeralResourceReservation.findFirst({
        where: {
          funeralHomeId: homeId,
          memorialId: body.memorialId,
          vehicleId: body.vehicleId,
          status: { in: ['Reserved', 'CheckedOut'] },
        },
      });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Vehicle is already reserved for this memorial' });
      }
    }

    if (body.assetId) {
      const existing = await prisma.funeralResourceReservation.findFirst({
        where: {
          funeralHomeId: homeId,
          memorialId: body.memorialId,
          assetId: body.assetId,
          status: { in: ['Reserved', 'CheckedOut'] },
        },
      });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Asset is already reserved for this memorial' });
      }
    }

    const reservation = await prisma.funeralResourceReservation.create({
      data: {
        funeralHomeId: homeId,
        memorialId: body.memorialId,
        vehicleId: body.vehicleId || null,
        assetId: body.assetId || null,
        quantity: body.quantity || 1,
        reservedBy: body.reservedBy || null,
        notes: body.notes || null,
      },
      include: reservationIncludes,
    });
    res.status(201).json({ success: true, data: reservation });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, message: error.errors[0].message });
    console.error('Create reservation error:', error);
    res.status(500).json({ success: false, message: 'Failed to create reservation' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// UPDATE RESERVATION
// ══════════════════════════════════════════════════════════════════════════

router.patch('/:id', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const existing = await prisma.funeralResourceReservation.findUnique({ where: { id: paramId(req) } });
    if (!existing) return res.status(404).json({ success: false, message: 'Reservation not found' });
    const homeId = fhId(req);
    if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });

    const body = req.body;
    const updateData: Record<string, unknown> = {};

    if (body.action === 'check-in') {
      updateData.checkedInAt = new Date();
      updateData.status = 'Reserved';
    } else if (body.action === 'check-out') {
      updateData.checkedOutAt = new Date();
      updateData.status = 'CheckedOut';
    } else if (body.action === 'return') {
      updateData.returnedAt = new Date();
      updateData.status = 'Returned';
    } else if (body.action === 'cancel') {
      updateData.status = 'Cancelled';
    } else if (body.status) {
      updateData.status = body.status;
    }

    if (body.notes !== undefined) updateData.notes = body.notes;

    const reservation = await prisma.funeralResourceReservation.update({
      where: { id: existing.id },
      data: updateData,
      include: reservationIncludes,
    });
    res.json({ success: true, data: reservation });
  } catch (error) {
    console.error('Update reservation error:', error);
    res.status(500).json({ success: false, message: 'Failed to update reservation' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// DELETE RESERVATION
// ══════════════════════════════════════════════════════════════════════════

router.delete('/:id', authenticate, requireRole(FUNERAL_HOME_OR_ADMIN), async (req, res) => {
  try {
    const existing = await prisma.funeralResourceReservation.findUnique({ where: { id: paramId(req) } });
    if (!existing) return res.status(404).json({ success: false, message: 'Reservation not found' });
    const homeId = fhId(req);
    if (homeId && existing.funeralHomeId !== homeId) return res.status(403).json({ success: false, message: 'Access denied' });
    await prisma.funeralResourceReservation.delete({ where: { id: existing.id } });
    res.json({ success: true, data: null });
  } catch (error) {
    console.error('Delete reservation error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete reservation' });
  }
});

export default router;
