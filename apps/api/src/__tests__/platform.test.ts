import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import platformRoutes from '../routes/platform';
import { prisma } from '../lib/prisma';
import { signToken } from '../middleware/auth';

const app = express();
app.use(express.json());
app.use('/api/v1/platform', platformRoutes);

let superAdminId = '';
let superToken = '';
let homeId = '';
let adminId = '';
let adminToken = '';

beforeAll(async () => {
  const suffix = Date.now();
  const superAdmin = await prisma.user.create({
    data: {
      name: 'Platform Owner',
      email: `owner-${suffix}@example.com`,
      passwordHash: 'not-used',
      passwordSetAt: new Date(),
      role: 'SUPER_ADMIN',
    },
  });
  const home = await prisma.funeralHome.create({
    data: {
      name: 'Platform Test Funeral Home',
      email: `home-${suffix}@example.com`,
      users: {
        create: {
          name: 'Funeral Home Admin',
          email: `admin-${suffix}@example.com`,
          passwordHash: 'not-used',
          passwordSetAt: new Date(),
          role: 'FUNERAL_HOME_ADMIN',
        },
      },
      memorials: {
        create: {
          slug: `platform-test-${suffix}`,
          deceasedName: 'Platform Test Memorial',
          programme: [],
          announcements: [],
          settings: {},
        },
      },
    },
    include: { users: true, memorials: true },
  });
  await prisma.payment.create({
    data: {
      funeralHomeId: home.id,
      memorialId: home.memorials[0].id,
      amountCents: 29999,
      status: 'SUCCESS',
      paidAt: new Date(),
      paystackReference: `platform-ref-${suffix}`,
    },
  });

  superAdminId = superAdmin.id;
  homeId = home.id;
  adminId = home.users[0].id;
  superToken = signToken({ userId: superAdmin.id, role: 'SUPER_ADMIN' });
  adminToken = signToken({ userId: adminId, funeralHomeId: home.id, role: 'FUNERAL_HOME_ADMIN' });
});

describe('platform owner API', () => {
  it('rejects funeral home admins', async () => {
    const response = await request(app).get('/api/v1/platform/summary').set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(403);
  });

  it('returns platform counts and revenue to SUPER_ADMIN', async () => {
    const response = await request(app).get('/api/v1/platform/summary').set('Authorization', `Bearer ${superToken}`);
    expect(response.status).toBe(200);
    expect(response.body.data.registrations.total).toBeGreaterThanOrEqual(1);
    expect(response.body.data.users.total).toBeGreaterThanOrEqual(2);
    expect(response.body.data.memorials.total).toBeGreaterThanOrEqual(1);
    expect(response.body.data.payments.totalRevenueCents).toBeGreaterThanOrEqual(29999);
  });

  it('suspends and reactivates a funeral home with audit logs', async () => {
    const suspended = await request(app).post(`/api/v1/platform/funeral-homes/${homeId}/suspend`).set('Authorization', `Bearer ${superToken}`);
    expect(suspended.status).toBe(200);
    expect(suspended.body.data.status).toBe('SUSPENDED');
    expect(await prisma.platformAuditLog.count({ where: { action: 'FUNERAL_HOME_SUSPENDED', targetId: homeId } })).toBe(1);
    expect((await request(app).get('/api/v1/platform/summary').set('Authorization', `Bearer ${adminToken}`)).status).toBe(403);

    const reactivated = await request(app).post(`/api/v1/platform/funeral-homes/${homeId}/reactivate`).set('Authorization', `Bearer ${superToken}`);
    expect(reactivated.status).toBe(200);
    expect(reactivated.body.data.status).toBe('ACTIVE');
  });

  it('generates password reset links without exposing passwords and audits the action', async () => {
    const response = await request(app).post(`/api/v1/platform/users/${adminId}/send-password-reset`).set('Authorization', `Bearer ${superToken}`);
    expect(response.status).toBe(200);
    expect(response.body.data.resetUrl).toContain('/reset-password/');
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(await prisma.platformAuditLog.count({ where: { action: 'PASSWORD_RESET_SENT', targetId: adminId } })).toBe(1);
  });
});

afterAll(async () => {
  await prisma.platformAuditLog.deleteMany({ where: { actorUserId: superAdminId } });
  await prisma.funeralHome.delete({ where: { id: homeId } });
  await prisma.user.delete({ where: { id: superAdminId } });
  await prisma.$disconnect();
});
