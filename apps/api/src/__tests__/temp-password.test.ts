import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import authRoutes from '../routes/auth';
import platformRoutes from '../routes/platform';
import { prisma } from '../lib/prisma';
import { signToken } from '../middleware/auth';
import { authLimiterStore } from '../middleware/authRateLimit';

const app = express();
app.use(express.json());
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/platform', platformRoutes);

let homeId = '';
let userId = '';
let superAdminId = '';
let superToken = '';

beforeAll(async () => {
  const suffix = Date.now();
  const superAdmin = await prisma.user.create({
    data: {
      name: 'Temp Owner',
      email: `temp-owner-${suffix}@example.com`,
      passwordHash: 'not-used',
      passwordSetAt: new Date(),
      role: 'SUPER_ADMIN',
    },
  });
  const home = await prisma.funeralHome.create({
    data: {
      name: 'Temp Test Funeral Home',
      email: `temp-home-${suffix}@example.com`,
      users: {
        create: {
          name: 'Temp Admin',
          email: `temp-admin-${suffix}@example.com`,
          passwordHash: await bcrypt.hash('old-password-123', 4),
          passwordSetAt: new Date(),
          role: 'FUNERAL_HOME_ADMIN',
        },
      },
    },
    include: { users: true },
  });

  superAdminId = superAdmin.id;
  homeId = home.id;
  userId = home.users[0].id;
  superToken = signToken({ userId: superAdmin.id, role: 'SUPER_ADMIN' });
});

beforeEach(() => {
  authLimiterStore.resetAll();
});

async function generateTempPassword() {
  const response = await request(app)
    .post(`/api/v1/platform/users/${userId}/generate-temp-password`)
    .set('Authorization', `Bearer ${superToken}`);
  expect(response.status).toBe(200);
  return response.body.data as { tempPassword: string; expiresAt: string };
}

async function freshTempState() {
  const { tempPassword } = await generateTempPassword();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return { tempPassword, tokenVersion: user.tokenVersion };
}

describe('temporary password forced-change flow', () => {
  it('login with an active temporary password authenticates but restricts access', { timeout: 30000 }, async () => {
    const { tempPassword } = await freshTempState();

    const login = await request(app).post('/api/v1/auth/login').send({ email: (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).email, password: tempPassword });
    expect(login.status).toBe(200);
    expect(login.body.data.requiresPasswordChange).toBe(true);
    const restrictedToken = login.body.data.accessToken as string;

    // The restricted token cannot reach normal app endpoints.
    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${restrictedToken}`);
    expect(me.status).toBe(403);
    expect(me.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('invalidates previously issued sessions when a temporary password is generated', { timeout: 30000 }, async () => {
    const before = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const staleToken = signToken({ userId, funeralHomeId: homeId, role: 'FUNERAL_HOME_ADMIN', tokenVersion: before.tokenVersion });
    expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${staleToken}`)).status).toBe(200);

    await generateTempPassword();

    expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${staleToken}`)).status).toBe(401);
  });

  it('rejects an expired temporary password at login', { timeout: 30000 }, async () => {
    const { tempPassword } = await freshTempState();
    await prisma.user.update({ where: { id: userId }, data: { temporaryPasswordExpiresAt: new Date(Date.now() - 1000) } });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const login = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: tempPassword });
    expect(login.status).toBe(403);
    expect(login.body.code).toBe('TEMP_PASSWORD_EXPIRED');
  });

  it('completes the forced change and unlocks normal access', { timeout: 30000 }, async () => {
    const { tempPassword } = await freshTempState();
    const email = (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).email;

    const login = await request(app).post('/api/v1/auth/login').send({ email, password: tempPassword });
    expect(login.body.data.requiresPasswordChange).toBe(true);
    const restrictedToken = login.body.data.accessToken as string;

    const change = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${restrictedToken}`)
      .send({ currentPassword: tempPassword, newPassword: 'brand-new-password-456' });
    expect(change.status).toBe(200);
    expect(change.body.data.requiresPasswordChange).toBe(false);
    const freshToken = change.body.data.accessToken as string;

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(updated.mustChangePassword).toBe(false);
    expect(updated.temporaryPasswordExpiresAt).toBeNull();
    expect(await bcrypt.compare('brand-new-password-456', updated.passwordHash)).toBe(true);

    // The fresh token works everywhere; the old restricted token is revoked.
    expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${freshToken}`)).status).toBe(200);
    expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${restrictedToken}`)).status).toBe(401);

    // The new password logs in as a normal session.
    const relogin = await request(app).post('/api/v1/auth/login').send({ email, password: 'brand-new-password-456' });
    expect(relogin.status).toBe(200);
    expect(relogin.body.data.requiresPasswordChange).toBe(false);
  });

  it('rejects a change with the wrong current password', { timeout: 30000 }, async () => {
    const { tempPassword, tokenVersion } = await freshTempState();
    const email = (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).email;

    const login = await request(app).post('/api/v1/auth/login').send({ email, password: tempPassword });
    const restrictedToken = login.body.data.accessToken as string;

    const change = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${restrictedToken}`)
      .send({ currentPassword: 'wrong-current-password', newPassword: 'brand-new-password-456' });
    expect(change.status).toBe(401);

    const unchanged = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(unchanged.mustChangePassword).toBe(true);
    expect(unchanged.tokenVersion).toBe(tokenVersion);
  });

  it('validates the new password length', { timeout: 30000 }, async () => {
    const { tempPassword } = await freshTempState();
    const email = (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).email;

    const login = await request(app).post('/api/v1/auth/login').send({ email, password: tempPassword });
    const restrictedToken = login.body.data.accessToken as string;

    const change = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${restrictedToken}`)
      .send({ currentPassword: tempPassword, newPassword: 'short' });
    expect(change.status).toBe(400);
  });
});

afterAll(async () => {
  await prisma.platformAuditLog.deleteMany({ where: { actorUserId: superAdminId } });
  await prisma.funeralHome.delete({ where: { id: homeId } });
  await prisma.user.delete({ where: { id: superAdminId } });
  await prisma.$disconnect();
});
