import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import authRoutes from '../routes/auth';
import { prisma } from '../lib/prisma';
import { signToken } from '../middleware/auth';
import { manageAudit } from '../middleware/manageAudit';
import { authLimiterStore } from '../middleware/authRateLimit';

const app = express();
app.use(express.json());
app.use('/api/v1', manageAudit);
app.use('/api/v1/auth', authRoutes);

let managedHomeId = '';
let ownerUserId = '';
let superAdminId = '';
let superToken = '';

beforeAll(async () => {
  const suffix = Date.now();

  const superAdmin = await prisma.user.create({
    data: {
      name: 'Manage Owner',
      email: `manage-owner-${suffix}@example.com`,
      passwordHash: await bcrypt.hash('super-secret-123', 4),
      passwordSetAt: new Date(),
      role: 'SUPER_ADMIN',
      mustChangePassword: false,
      tokenVersion: 7,
    },
  });

  const home = await prisma.funeralHome.create({
    data: {
      name: 'Managed Funeral Home',
      email: `managed-home-${suffix}@example.com`,
      users: {
        create: {
          name: 'Managed Admin',
          email: `managed-admin-${suffix}@example.com`,
          passwordHash: await bcrypt.hash('owner-password-123', 4),
          passwordSetAt: new Date(),
          role: 'FUNERAL_HOME_ADMIN',
        },
      },
    },
    include: { users: true },
  });

  superAdminId = superAdmin.id;
  managedHomeId = home.id;
  ownerUserId = home.users[0].id;
  superToken = signToken({ userId: superAdmin.id, role: 'SUPER_ADMIN' });
});

beforeEach(() => {
  authLimiterStore.resetAll();
});

async function waitForAudit(actorId: string, homeId: string, action: string, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const log = await prisma.platformAuditLog.findFirst({
      where: { actorUserId: actorId, funeralHomeId: homeId, action },
      orderBy: { createdAt: 'desc' },
    });
    if (log) return log;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
}

describe('SUPER_ADMIN manage funeral home context', () => {
  it('scopes owner routes to the managed funeral home when the header is present', { timeout: 30000 }, async () => {
    const response = await request(app)
      .get('/api/v1/auth/funeral-home-profile')
      .set('Authorization', `Bearer ${superToken}`)
      .set('X-Managing-Funeral-Home', managedHomeId);
    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(managedHomeId);
    expect(response.body.data.name).toBe('Managed Funeral Home');
  });

  it('requires the management header even for a SUPER_ADMIN (no implicit home)', { timeout: 30000 }, async () => {
    const response = await request(app)
      .get('/api/v1/auth/funeral-home-profile')
      .set('Authorization', `Bearer ${superToken}`);
    expect(response.status).toBe(403);
  });

  it('rejects a non-SUPER_ADMIN who tries to set the management header', { timeout: 30000 }, async () => {
    const ownerToken = signToken({ userId: ownerUserId, funeralHomeId: managedHomeId, role: 'FUNERAL_HOME_ADMIN' });
    const response = await request(app)
      .get('/api/v1/auth/funeral-home-profile')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Managing-Funeral-Home', managedHomeId);
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('You do not have permission to manage a funeral home');
  });

  it('returns 404 when the managed funeral home does not exist', { timeout: 30000 }, async () => {
    const response = await request(app)
      .get('/api/v1/auth/funeral-home-profile')
      .set('Authorization', `Bearer ${superToken}`)
      .set('X-Managing-Funeral-Home', 'no-such-home');
    expect(response.status).toBe(404);
  });

  it('writes an audit entry attributing the change to the SUPER_ADMIN actor', { timeout: 30000 }, async () => {
    const response = await request(app)
      .patch('/api/v1/auth/funeral-home-profile')
      .set('Authorization', `Bearer ${superToken}`)
      .set('X-Managing-Funeral-Home', managedHomeId)
      .send({ tradingName: 'CoVision Managed' });
    expect(response.status).toBe(200);

    const log = await waitForAudit(superAdminId, managedHomeId, 'SUPER_ADMIN_MANAGED_FUNERAL_HOME_PROFILE');
    expect(log).not.toBeNull();
    expect(log!.targetType).toBe('FUNERAL_HOME');
    expect(log!.targetId).toBe(managedHomeId);
    const details = log!.details as { actorRole?: string; method?: string };
    expect(details.actorRole).toBe('SUPER_ADMIN');
    expect(details.method).toBe('PATCH');
  });

  it('does not record an audit entry for failed management requests', { timeout: 30000 }, async () => {
    const before = await prisma.platformAuditLog.count({ where: { actorUserId: superAdminId } });
    const response = await request(app)
      .patch('/api/v1/auth/funeral-home-profile')
      .set('Authorization', `Bearer ${superToken}`)
      .set('X-Managing-Funeral-Home', managedHomeId)
      .send({ tradingName: 12345 });
    expect(response.status).toBe(400);
    const after = await prisma.platformAuditLog.count({ where: { actorUserId: superAdminId } });
    expect(after).toBe(before);
  });

  it('never touches the owner or managed-admin credentials or sessions', { timeout: 30000 }, async () => {
    const ownerBefore = await prisma.user.findUniqueOrThrow({ where: { id: ownerUserId } });
    const superBefore = await prisma.user.findUniqueOrThrow({ where: { id: superAdminId } });

    await request(app)
      .patch('/api/v1/auth/funeral-home-profile')
      .set('Authorization', `Bearer ${superToken}`)
      .set('X-Managing-Funeral-Home', managedHomeId)
      .send({ phone: '+27123456789' });

    const ownerAfter = await prisma.user.findUniqueOrThrow({ where: { id: ownerUserId } });
    const superAfter = await prisma.user.findUniqueOrThrow({ where: { id: superAdminId } });

    // Owner password state and session version are untouched.
    expect(ownerAfter.passwordHash).toBe(ownerBefore.passwordHash);
    expect(ownerAfter.mustChangePassword).toBe(ownerBefore.mustChangePassword);
    expect(ownerAfter.tokenVersion).toBe(ownerBefore.tokenVersion);

    // The SUPER_ADMIN identity (including session version) is untouched.
    expect(superAfter.passwordHash).toBe(superBefore.passwordHash);
    expect(superAfter.tokenVersion).toBe(superBefore.tokenVersion);

    // A valid owner login still works with the original password.
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: ownerAfter.email, password: 'owner-password-123' });
    expect(login.status).toBe(200);
    expect(login.body.data.requiresPasswordChange).toBe(false);
  });
});

afterAll(async () => {
  await prisma.platformAuditLog.deleteMany({ where: { actorUserId: superAdminId } });
  await prisma.funeralHome.delete({ where: { id: managedHomeId } });
  await prisma.user.delete({ where: { id: superAdminId } });
  await prisma.$disconnect();
});
