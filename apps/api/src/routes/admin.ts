import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { permanentlyDeleteMemorial } from '../lib/retention';

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

export default router;
