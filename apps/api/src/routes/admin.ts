import { Router } from 'express';
import { authenticate, requireRole, ROLES, signQAToken } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { permanentlyDeleteMemorial } from '../lib/retention';
import { env } from '../lib/env';

const router = Router();

router.post('/memorials/:id/hard-delete', authenticate, async (req, res) => {
  if (req.user!.role.toUpperCase() !== 'SUPER_ADMIN') {
    return res.status(403).json({ success: false, error: 'Only SUPER_ADMIN can override memorial retention' });
  }
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const memorial = await prisma.memorial.findUnique({ where: { id } });
  if (!memorial) return res.status(404).json({ success: false, error: 'Memorial not found' });
  const deleted = await permanentlyDeleteMemorial(memorial.id);
  res.json({ success: true, data: deleted });
});

router.get('/memorials/:id/public-url', authenticate, requireRole([ROLES.SUPER_ADMIN]), async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const memorial = await prisma.memorial.findUnique({
    where: { id },
    select: { id: true, slug: true, funeralHomeId: true },
  });
  if (!memorial) return res.status(404).json({ success: false, error: 'Memorial not found' });

  const memorialBaseUrl = (env.MEMORIAL_URL || 'https://memoryconnect.co.za').replace(/\/$/, '');
  const qaToken = signQAToken(req.user!.userId, memorial.id);
  const publicUrl = `${memorialBaseUrl}/${memorial.slug}?qa=${qaToken}`;

  res.json({
    success: true,
    data: {
      slug: memorial.slug,
      publicUrl,
      qrCodeUrl: `${memorialBaseUrl}/${memorial.slug}`,
    },
  });
});

export default router;
