import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { signEventsToken, authenticateEvents } from '../lib/auth';
import { authLimiter } from '../lib/rateLimit';
import { registerSchema, loginSchema } from '@memorialconnect/event-shared';

const router = Router();

router.post('/register', authLimiter, async (req, res) => {
  try {
    const body = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) return res.status(409).json({ success: false, error: 'Email already registered' });
    const passwordHash = await bcrypt.hash(body.password, 12);
    const organiser = await prisma.organiser.create({
      data: {
        name: body.organiserName,
        email: body.email,
        users: { create: { name: body.name, email: body.email, passwordHash } },
      },
      include: { users: true },
    });
    const user = organiser.users[0];
    const token = signEventsToken({ userId: user.id, organiserId: organiser.id, role: user.role });
    res.status(201).json({
      success: true,
      data: {
        accessToken: token,
        user: { id: user.id, email: user.email, name: user.name, organiserId: organiser.id, role: user.role },
        organiser: { id: organiser.id, name: organiser.name },
      },
    });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'errors' in err) {
      const zerr = err as { errors: Array<{ message: string }> };
      return res.status(400).json({ success: false, error: zerr.errors[0]?.message ?? 'Invalid input' });
    }
    console.error(err);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email }, include: { organiser: true } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    if (user.organiser.status !== 'ACTIVE') return res.status(403).json({ success: false, error: 'This organiser account is suspended. Contact Events support.' });
    const token = signEventsToken({ userId: user.id, organiserId: user.organiserId, role: user.role });
    res.json({
      success: true,
      data: {
        accessToken: token,
        user: { id: user.id, email: user.email, name: user.name, organiserId: user.organiserId, role: user.role },
        organiser: { id: user.organiser.id, name: user.organiser.name },
      },
    });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'errors' in err) {
      const zerr = err as { errors: Array<{ message: string }> };
      return res.status(400).json({ success: false, error: zerr.errors[0]?.message ?? 'Invalid input' });
    }
    console.error(err);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

router.get('/me', authenticateEvents, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.eventsUser!.userId },
    include: { organiser: true },
  });
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organiserId: user.organiserId,
      organiser: { id: user.organiser.id, name: user.organiser.name },
    },
  });
});

export default router;
