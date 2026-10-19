import { Router, Request } from 'express';
import {
  createMemorialLocationSchema,
  updateMemorialLocationSchema,
} from '@memorialconnect/shared';
import { prisma } from '../lib/prisma';
import { authenticate, canAccessMemorial, isFamilyRole } from '../middleware/auth';
import { isZodError } from '../lib/validation';
import { isEditLocked } from '../lib/publishing';

const router = Router({ mergeParams: true });

function routeParam(req: Request, key: 'id' | 'locationId'): string {
  const value = req.params[key];
  return Array.isArray(value) ? value[0] : value;
}

async function ownedMemorial(req: Request) {
  const id = routeParam(req, 'id');
  const access = await canAccessMemorial(req.user!, id);
  if (!access) return null;
  return prisma.memorial.findFirst({ where: { id: access.id } });
}

router.get('/', authenticate, async (req, res) => {
  const memorial = await ownedMemorial(req);
  if (!memorial) return res.status(404).json({ success: false, error: 'Memorial not found' });

  const locations = await prisma.memorialLocation.findMany({
    where: { memorialId: memorial.id },
    orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({ success: true, data: locations });
});

router.post('/', authenticate, async (req, res) => {
  try {
    const memorial = await ownedMemorial(req);
    if (!memorial) return res.status(404).json({ success: false, error: 'Memorial not found' });
    if (memorial.isDemo && req.user!.role.toUpperCase() !== 'SUPER_ADMIN') return res.status(403).json({ success: false, error: 'Only a platform owner can update demo locations.' });
    if (isEditLocked(memorial) && req.user!.role.toUpperCase() !== 'SUPER_ADMIN') return res.status(423).json({ success: false, error: 'This funeral programme is locked because it has already been published and shared.' });
    const memorialId = memorial.id;

    const body = createMemorialLocationSchema.parse(req.body);
    const lastLocation = await prisma.memorialLocation.aggregate({
      where: { memorialId },
      _max: { orderIndex: true },
    });
    const location = await prisma.memorialLocation.create({
      data: {
        memorialId,
        ...body,
        addressText: body.addressText || null,
        notes: body.notes || null,
        orderIndex: body.orderIndex ?? (lastLocation._max.orderIndex ?? -1) + 1,
      },
    });
    if (isFamilyRole(req.user!.role)) {
      await prisma.memorialAuditLog.create({
        data: { memorialId, userId: req.user!.userId, action: 'gps_location_suggested', details: { locationId: location.id, name: location.name } },
      });
    }
    res.status(201).json({ success: true, data: location });
  } catch (error) {
    if (isZodError(error)) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    console.error('Create memorial location error:', error);
    res.status(500).json({ success: false, error: 'Failed to create location' });
  }
});

router.patch('/:locationId', authenticate, async (req, res) => {
  try {
    const memorial = await ownedMemorial(req);
    if (!memorial) return res.status(404).json({ success: false, error: 'Memorial not found' });
    if (isFamilyRole(req.user!.role)) {
      return res.status(403).json({ success: false, error: 'Family users cannot modify approved locations' });
    }
    if (memorial.isDemo && req.user!.role.toUpperCase() !== 'SUPER_ADMIN') return res.status(403).json({ success: false, error: 'Only a platform owner can update demo locations.' });
    if (isEditLocked(memorial) && req.user!.role.toUpperCase() !== 'SUPER_ADMIN') return res.status(423).json({ success: false, error: 'This funeral programme is locked because it has already been published and shared.' });
    const memorialId = memorial.id;

    const locationId = routeParam(req, 'locationId');
    const existing = await prisma.memorialLocation.findFirst({ where: { id: locationId, memorialId } });
    if (!existing) return res.status(404).json({ success: false, error: 'Location not found' });

    const body = updateMemorialLocationSchema.parse(req.body);
    const location = await prisma.memorialLocation.update({
      where: { id: locationId },
      data: {
        ...body,
        addressText: body.addressText === undefined ? undefined : body.addressText || null,
        notes: body.notes === undefined ? undefined : body.notes || null,
      },
    });
    res.json({ success: true, data: location });
  } catch (error) {
    if (isZodError(error)) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    console.error('Update memorial location error:', error);
    res.status(500).json({ success: false, error: 'Failed to update location' });
  }
});

router.delete('/:locationId', authenticate, async (req, res) => {
  const memorial = await ownedMemorial(req);
  if (!memorial) return res.status(404).json({ success: false, error: 'Memorial not found' });
  if (isFamilyRole(req.user!.role)) {
    return res.status(403).json({ success: false, error: 'Family users cannot delete locations' });
  }
  if (memorial.isDemo && req.user!.role.toUpperCase() !== 'SUPER_ADMIN') return res.status(403).json({ success: false, error: 'Only a platform owner can update demo locations.' });
  if (isEditLocked(memorial) && req.user!.role.toUpperCase() !== 'SUPER_ADMIN') return res.status(423).json({ success: false, error: 'This funeral programme is locked because it has already been published and shared.' });
  const memorialId = memorial.id;

  const locationId = routeParam(req, 'locationId');
  const existing = await prisma.memorialLocation.findFirst({ where: { id: locationId, memorialId } });
  if (!existing) return res.status(404).json({ success: false, error: 'Location not found' });

  await prisma.memorialLocation.delete({ where: { id: locationId } });
  res.json({ success: true, data: null });
});

export default router;
