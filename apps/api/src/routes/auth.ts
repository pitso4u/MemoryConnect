import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, signToken } from '../middleware/auth';
import { registerSchema, loginSchema } from '@memorialconnect/shared';

const router = Router();

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
            role: 'admin',
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
          role: user.role,
          funeralHomeId: funeralHome.id,
        },
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
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

    const token = signToken({
      userId: user.id,
      funeralHomeId: user.funeralHomeId,
      role: user.role,
    });

    res.json({
      success: true,
      data: {
        accessToken: token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          funeralHomeId: user.funeralHomeId,
        },
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.errors[0].message });
    }
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
      role: user.role,
      funeralHomeId: user.funeralHomeId,
      funeralHome: {
        id: user.funeralHome.id,
        name: user.funeralHome.name,
        plan: user.funeralHome.plan,
      },
    },
  });
});

export default router;
