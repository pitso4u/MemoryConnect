import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import authRoutes from '../routes/auth';
import { authLimiterStore } from '../middleware/authRateLimit';
import { prisma } from '../lib/prisma';

const app = express();
app.use(express.json());
app.use('/api/v1/auth', authRoutes);

const suffix = Date.now();
let userId = '';
let validLogin = { email: '', password: 'TestPass123!' };

beforeAll(async () => {
  const hash = await bcrypt.hash(validLogin.password, 4);
  const user = await prisma.user.create({
    data: {
      name: 'Rate Limit User',
      email: `ratelimit-${suffix}@example.com`,
      passwordHash: hash,
      passwordSetAt: new Date(),
      role: 'FUNERAL_HOME_ADMIN',
    },
  });
  userId = user.id;
  validLogin.email = user.email;
});

afterAll(async () => {
  await prisma.loginAttempt.deleteMany({ where: { email: { startsWith: 'ratelimit-' } } });
  await prisma.loginAttempt.deleteMany({ where: { email: `nobody-${suffix}@example.com` } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  await authLimiterStore.resetAll();
});

describe('auth rate limiting', () => {
  it('returns 429 after too many failed logins', async () => {
    const body = { email: `nobody-${suffix}@example.com`, password: 'wrong-password' };
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/v1/auth/login').send(body);
      expect(res.status).toBe(401);
    }
    const blocked = await request(app).post('/api/v1/auth/login').send(body);
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toBe('Too many attempts, please try again later');
  });

  it('returns 429 after too many failed registrations', async () => {
    const body = { email: 'not-an-email' };
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/v1/auth/register').send(body);
      expect(res.status).toBe(400);
    }
    const blocked = await request(app).post('/api/v1/auth/register').send(body);
    expect(blocked.status).toBe(429);
  });

  it('does not throttle authenticated checks /my-features and /me', async () => {
    // Unauthenticated, each call is a 401. Because no limiter is attached to
    // these routes, all of them keep returning 401 instead of a 429.
    for (let i = 0; i < 12; i++) {
      const res = await request(app).get('/api/v1/auth/my-features');
      expect(res.status).toBe(401);
    }
    for (let i = 0; i < 12; i++) {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    }
  });

  it('lets successful logins bypass the limiter', async () => {
    for (let i = 0; i < 6; i++) {
      const res = await request(app).post('/api/v1/auth/login').send(validLogin);
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeTruthy();
    }
  });
});
