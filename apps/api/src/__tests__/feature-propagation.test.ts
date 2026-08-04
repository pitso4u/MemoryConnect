import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import featureRoutes from '../routes/features';
import authRoutes from '../routes/auth';
import { prisma } from '../lib/prisma';
import { signToken } from '../middleware/auth';
import { invalidateFeatureCache } from '../lib/featureService';

const app = express();
app.use(express.json());
app.use('/api/v1/platform/features', featureRoutes);
app.use('/api/v1/auth', authRoutes);

const FEATURE_KEYS = ['BROCHURES', 'PROMOTIONS', 'FEEDBACK'];
const SUFFIX = Date.now();
const keyFor = (base: string) => `PROP_${base}_${SUFFIX}`;
const featureKeys = [...FEATURE_KEYS.map(keyFor)];

let superToken = '';
let homeId = '';
let adminId = '';
let adminToken = '';

async function fetchMyFeature(key: string) {
  const res = await request(app).get('/api/v1/auth/my-features').set('Authorization', `Bearer ${adminToken}`);
  expect(res.status).toBe(200);
  const row = res.body.data.features.find((f: { key: string }) => f.key === key);
  expect(row).toBeTruthy();
  return row as { key: string; enabled: boolean };
}

beforeAll(async () => {
  for (const key of featureKeys) {
    await prisma.feature.create({
      data: {
        key,
        name: key,
        description: 'Regression test feature',
        category: 'GENERAL',
        releaseChannel: 'GENERAL_AVAILABILITY',
        enabledGlobally: false,
        premium: false,
        minimumEdition: null,
        minimumPlan: null,
        rolloutPercent: 0,
      },
    });
  }
  invalidateFeatureCache();
  const superAdmin = await prisma.user.create({
    data: { name: 'Prop Owner', email: `prop-owner-${SUFFIX}@example.com`, passwordHash: 'x', passwordSetAt: new Date(), role: 'SUPER_ADMIN' },
  });
  const home = await prisma.funeralHome.create({
    data: {
      name: `Prop Home ${SUFFIX}`,
      email: `prop-home-${SUFFIX}@example.com`,
      plan: 'PROFESSIONAL',
      edition: 'FUNERAL_OFFICE',
      users: { create: { name: 'Prop Admin', email: `prop-admin-${SUFFIX}@example.com`, passwordHash: 'x', passwordSetAt: new Date(), role: 'FUNERAL_HOME_ADMIN' } },
    },
    include: { users: true },
  });
  superToken = signToken({ userId: superAdmin.id, role: 'SUPER_ADMIN' });
  homeId = home.id;
  adminId = home.users[0].id;
  adminToken = signToken({ userId: adminId, funeralHomeId: home.id, role: 'FUNERAL_HOME_ADMIN' });
});

afterAll(async () => {
  await prisma.funeralHomeFeature.deleteMany({ where: { funeralHomeId: homeId } });
  await prisma.userFeature.deleteMany({ where: { userId: adminId } });
  await prisma.user.deleteMany({ where: { id: adminId } });
  await prisma.funeralHome.delete({ where: { id: homeId } }).catch(() => undefined);
  await prisma.user.deleteMany({ where: { email: { startsWith: 'prop-owner-' } } });
  await prisma.feature.deleteMany({ where: { key: { in: featureKeys } } });
  invalidateFeatureCache();
  await prisma.$disconnect();
});

describe('feature flag propagation', () => {
  it.each(featureKeys)('%s propagates immediately to /auth/my-features after a global toggle', async (key) => {
    const enable = await request(app)
      .patch(`/api/v1/platform/features/${key}`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ enabledGlobally: true, releaseChannel: 'GENERAL_AVAILABILITY', minimumEdition: null, minimumPlan: null, rolloutPercent: 100 });
    expect(enable.status).toBe(200);

    const enabled = await fetchMyFeature(key);
    expect(enabled.enabled).toBe(true);

    const disable = await request(app)
      .patch(`/api/v1/platform/features/${key}`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ enabledGlobally: false, releaseChannel: 'GENERAL_AVAILABILITY', minimumEdition: null, minimumPlan: null, rolloutPercent: 100 });
    expect(disable.status).toBe(200);

    const disabled = await fetchMyFeature(key);
    expect(disabled.enabled).toBe(false);
  });

  it('propagates immediately to /auth/my-features after a funeral home override toggle', async () => {
    const key = featureKeys[0];
    const enable = await request(app)
      .put(`/api/v1/platform/features/funeral-homes/${homeId}/features/${key}`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ enabled: true, releaseChannelOverride: 'BETA' });
    expect(enable.status).toBe(200);

    const enabled = await fetchMyFeature(key);
    expect(enabled.enabled).toBe(true);

    const disable = await request(app)
      .delete(`/api/v1/platform/features/funeral-homes/${homeId}/features/${key}`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(disable.status).toBe(200);

    const disabled = await fetchMyFeature(key);
    expect(disabled.enabled).toBe(false);
  });

  it('rejects a funeral home admin from mutating platform features', async () => {
    const res = await request(app)
      .patch(`/api/v1/platform/features/${featureKeys[0]}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabledGlobally: false });
    expect(res.status).toBe(403);
  });
});
