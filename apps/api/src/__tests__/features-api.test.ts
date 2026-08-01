import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import featureRoutes from '../routes/features';
import authRoutes from '../routes/auth';
import { prisma } from '../lib/prisma';
import { signToken } from '../middleware/auth';

const app = express();
app.use(express.json());
app.use('/api/v1/platform/features', featureRoutes);
app.use('/api/v1/auth', authRoutes);

let superToken = '';
let homeId = '';
let adminId = '';
let adminToken = '';
let featureKey = '';

beforeAll(async () => {
  const suffix = Date.now();
  const superAdmin = await prisma.user.create({
    data: { name: 'Feature Owner', email: `feat-owner-${suffix}@example.com`, passwordHash: 'x', passwordSetAt: new Date(), role: 'SUPER_ADMIN' },
  });
  const home = await prisma.funeralHome.create({
    data: {
      name: `Feature Api Home ${suffix}`,
      email: `feat-home-${suffix}@example.com`,
      plan: 'PROFESSIONAL',
      edition: 'FUNERAL_OFFICE',
      users: { create: { name: 'Feature Admin', email: `feat-admin-${suffix}@example.com`, passwordHash: 'x', passwordSetAt: new Date(), role: 'FUNERAL_HOME_ADMIN' } },
    },
    include: { users: true },
  });
  superToken = signToken({ userId: superAdmin.id, role: 'SUPER_ADMIN' });
  homeId = home.id;
  adminId = home.users[0].id;
  adminToken = signToken({ userId: adminId, funeralHomeId: home.id, role: 'FUNERAL_HOME_ADMIN' });
});

afterAll(async () => {
  await prisma.featureAuditLog.deleteMany({ where: { featureKey: { startsWith: 'API_' } } });
  await prisma.funeralHomeFeature.deleteMany({ where: { funeralHomeId: homeId } });
  if (featureKey) await prisma.feature.deleteMany({ where: { key: featureKey } }).catch(() => undefined);
  await prisma.user.deleteMany({ where: { id: adminId } });
  await prisma.funeralHome.delete({ where: { id: homeId } }).catch(() => undefined);
  await prisma.user.deleteMany({ where: { email: { startsWith: 'feat-owner-' } } });
  await prisma.$disconnect();
});

describe('feature management API', () => {
  it('rejects funeral home admins', async () => {
    const response = await request(app).get('/api/v1/platform/features').set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(403);
  });

  it('allows SUPER_ADMIN to create a feature and records an audit entry', async () => {
    const response = await request(app)
      .post('/api/v1/platform/features')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ key: `API_${Date.now()}`, name: 'API Feature', releaseChannel: 'QA', enabledGlobally: false, rolloutPercent: 0 });
    expect(response.status).toBe(201);
    featureKey = response.body.data.key;
    const audit = await prisma.featureAuditLog.findFirst({ where: { featureKey, action: 'CREATE' }, orderBy: { createdAt: 'desc' } });
    expect(audit).toBeTruthy();
  });

  it('lists features to SUPER_ADMIN', async () => {
    const response = await request(app).get('/api/v1/platform/features').set('Authorization', `Bearer ${superToken}`);
    expect(response.status).toBe(200);
    expect(response.body.data.features.length).toBeGreaterThan(0);
    expect(response.body.data.auditCount).toBeGreaterThan(0);
  });

  it('sets a funeral home override that resolves through /auth/my-features', async () => {
    const override = await request(app)
      .put(`/api/v1/platform/features/funeral-homes/${homeId}/features/${featureKey}`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ enabled: true, releaseChannelOverride: 'BETA' });
    expect(override.status).toBe(200);

    const myFeatures = await request(app).get('/api/v1/auth/my-features').set('Authorization', `Bearer ${adminToken}`);
    expect(myFeatures.status).toBe(200);
    const row = myFeatures.body.data.features.find((f: { key: string }) => f.key === featureKey);
    expect(row).toBeTruthy();
    expect(row.enabled).toBe(true);
  });

  it('removes a funeral home override', async () => {
    const remove = await request(app)
      .delete(`/api/v1/platform/features/funeral-homes/${homeId}/features/${featureKey}`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(remove.status).toBe(200);
    const myFeatures = await request(app).get('/api/v1/auth/my-features').set('Authorization', `Bearer ${adminToken}`);
    const row = myFeatures.body.data.features.find((f: { key: string }) => f.key === featureKey);
    expect(row.enabled).toBe(false);
  });

  it('adds and removes a feature dependency', async () => {
    const dependency = await request(app)
      .post('/api/v1/platform/features')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ key: `API_DEP_${Date.now()}`, name: 'API Dependency', releaseChannel: 'GENERAL_AVAILABILITY', enabledGlobally: true, rolloutPercent: 100 });
    expect(dependency.status).toBe(201);
    const depKey = dependency.body.data.key;

    const add = await request(app)
      .put(`/api/v1/platform/features/dependencies/${featureKey}/depends-on/${depKey}`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(add.status).toBe(201);

    const list = await request(app).get('/api/v1/platform/features/dependencies').set('Authorization', `Bearer ${superToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.some((d: { featureKey: string; dependsOnFeature: string }) => d.featureKey === featureKey && d.dependsOnFeature === depKey)).toBe(true);

    const remove = await request(app)
      .delete(`/api/v1/platform/features/dependencies/${featureKey}/depends-on/${depKey}`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(remove.status).toBe(200);

    await prisma.feature.deleteMany({ where: { key: depKey } });
  });

  it('rejects a dependency that would create a cycle', async () => {
    const a = await prisma.feature.create({ data: { key: `API_CYCLE_A_${Date.now()}`, name: 'Cycle A', releaseChannel: 'INTERNAL', enabledGlobally: false } });
    const b = await prisma.feature.create({ data: { key: `API_CYCLE_B_${Date.now()}`, name: 'Cycle B', releaseChannel: 'INTERNAL', enabledGlobally: false } });

    const first = await request(app)
      .put(`/api/v1/platform/features/dependencies/${a.key}/depends-on/${b.key}`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(first.status).toBe(201);

    const cycle = await request(app)
      .put(`/api/v1/platform/features/dependencies/${b.key}/depends-on/${a.key}`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(cycle.status).toBe(409);

    await prisma.feature.deleteMany({ where: { key: { in: [a.key, b.key] } } });
  });

  it('rejects a self-dependency', async () => {
    const response = await request(app)
      .put(`/api/v1/platform/features/dependencies/${featureKey}/depends-on/${featureKey}`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(response.status).toBe(400);
  });
});
