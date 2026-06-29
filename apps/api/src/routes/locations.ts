import { Router, Request } from 'express';
import {
  createMemorialLocationSchema,
  updateMemorialLocationSchema,
} from '@memorialconnect/shared';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { isZodError } from '../lib/validation';

const router = Router({ mergeParams: true });

function routeParam(req: Request, key: 'id' | 'locationId'): string {
  const value = req.params[key];
  return Array.isArray(value) ? value[0] : value;
}

async function ownedMemorialId(req: Request): Promise<string | null> {
  const id = routeParam(req, 'id');
  const memorial = await prisma.memorial.findFirst({
    where: { id, funeralHomeId: req.user!.funeralHomeId },
    select: { id: true },
  });
  return memorial?.id ?? null;
}

router.get('/', authenticate, async (req, res) => {
  const memorialId = await ownedMemorialId(req);
  if (!memorialId) return res.status(404).json({ success: false, error: 'Memorial not found' });

  const locations = await prisma.memorialLocation.findMany({
    where: { memorialId },
    orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({ success: true, data: locations });
});

router.post('/', authenticate, async (req, res) => {
  try {
    const memorialId = await ownedMemorialId(req);
    if (!memorialId) return res.status(404).json({ success: false, error: 'Memorial not found' });

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
    const memorialId = await ownedMemorialId(req);
    if (!memorialId) return res.status(404).json({ success: false, error: 'Memorial not found' });

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
  const memorialId = await ownedMemorialId(req);
  if (!memorialId) return res.status(404).json({ success: false, error: 'Memorial not found' });

  const locationId = routeParam(req, 'locationId');
  const existing = await prisma.memorialLocation.findFirst({ where: { id: locationId, memorialId } });
  if (!existing) return res.status(404).json({ success: false, error: 'Location not found' });

  await prisma.memorialLocation.delete({ where: { id: locationId } });
  res.json({ success: true, data: null });
});

export default router;
