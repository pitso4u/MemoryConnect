import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import marketingRoutes from '../routes/marketing';
import feedbackRoutes from '../routes/feedback';
import { prisma } from '../lib/prisma';
import { signToken } from '../middleware/auth';
import { invalidateFeatureCache } from '../lib/featureService';

const app = express();
app.use(express.json());
app.use('/api/v1/marketing', marketingRoutes);
app.use('/api/v1', feedbackRoutes);

let basicAdminToken = '';
let eligibleAdminToken = '';
let basicHomeId = '';
let eligibleHomeId = '';

const FEATURE_KEYS = ['BROCHURES', 'PROMOTIONS', 'FEEDBACK'] as const;

async function ensureFeature(key: string, overrides: Record<string, unknown> = {}) {
  const data = {
    key,
    name: key,
    description: `Test ${key}`,
    category: 'MARKETING',
    releaseChannel: 'GENERAL_AVAILABILITY',
    enabledGlobally: true,
    premium: false,
    minimumEdition: 'FUNERAL_OFFICE',
    minimumPlan: 'PROFESSIONAL',
    rolloutPercent: 100,
    ...overrides,
  };
  await prisma.feature.upsert({ where: { key }, update: data, create: data });
}

beforeAll(async () => {
  const suffix = Date.now();

  // Feature definitions must exist for funeralHomeFeature FKs.
  await ensureFeature('BROCHURES');
  await ensureFeature('PROMOTIONS');
  // FEEDBACK is a base (MEMORIAL) feature with no minimum edition.
  await ensureFeature('FEEDBACK', { category: 'MEMORIALS', minimumEdition: null, minimumPlan: null });

  // Home that does NOT qualify for BROCHURES/PROMOTIONS (edition below minimum).
  const basicHome = await prisma.funeralHome.create({
    data: {
      name: `Guard Basic ${suffix}`,
      email: `guard-basic-${suffix}@example.com`,
      plan: 'PROFESSIONAL',
      edition: 'MEMORIAL',
      users: { create: { name: 'Guard Basic Admin', email: `guard-basic-admin-${suffix}@example.com`, passwordHash: 'x', passwordSetAt: new Date(), role: 'FUNERAL_HOME_ADMIN' } },
    },
    include: { users: true },
  });
  basicHomeId = basicHome.id;
  basicAdminToken = signToken({ userId: basicHome.users[0].id, funeralHomeId: basicHome.id, role: 'FUNERAL_HOME_ADMIN' });

  // Home that qualifies for BROCHURES (FUNERAL_OFFICE + PROFESSIONAL).
  const eligibleHome = await prisma.funeralHome.create({
    data: {
      name: `Guard Eligible ${suffix}`,
      email: `guard-eligible-${suffix}@example.com`,
      plan: 'PROFESSIONAL',
      edition: 'FUNERAL_OFFICE',
      users: { create: { name: 'Guard Eligible Admin', email: `guard-eligible-admin-${suffix}@example.com`, passwordHash: 'x', passwordSetAt: new Date(), role: 'FUNERAL_HOME_ADMIN' } },
    },
    include: { users: true },
  });
  eligibleHomeId = eligibleHome.id;
  eligibleAdminToken = signToken({ userId: eligibleHome.users[0].id, funeralHomeId: eligibleHome.id, role: 'FUNERAL_HOME_ADMIN' });

  invalidateFeatureCache();
});

afterAll(async () => {
  await prisma.funeralHomeFeature.deleteMany({ where: { funeralHomeId: { in: [basicHomeId, eligibleHomeId] } } });
  await prisma.brochureCategory.deleteMany({ where: { funeralHomeId: { in: [basicHomeId, eligibleHomeId] } } });
  await prisma.promotion.deleteMany({ where: { funeralHomeId: { in: [basicHomeId, eligibleHomeId] } } });
  await prisma.funeralHome.deleteMany({ where: { id: { in: [basicHomeId, eligibleHomeId] } } });
  await prisma.feature.deleteMany({ where: { key: { in: [...FEATURE_KEYS] } } });
  invalidateFeatureCache();
  await prisma.$disconnect();
});

describe('feature-gated backend routes', () => {
  it('blocks brochure routes for a home without the BROCHURES feature', async () => {
    const response = await request(app)
      .get('/api/v1/marketing/brochures')
      .set('Authorization', `Bearer ${basicAdminToken}`);
    expect(response.status).toBe(403);
  });

  it('blocks category routes for a home without BROCHURES', async () => {
    const response = await request(app)
      .get('/api/v1/marketing/categories')
      .set('Authorization', `Bearer ${basicAdminToken}`);
    expect(response.status).toBe(403);
  });

  it('blocks promotion routes for a home without PROMOTIONS', async () => {
    const response = await request(app)
      .get('/api/v1/marketing/promotions')
      .set('Authorization', `Bearer ${basicAdminToken}`);
    expect(response.status).toBe(403);
  });

  it('allows brochure routes for a home with the BROCHURES feature', async () => {
    const response = await request(app)
      .get('/api/v1/marketing/brochures')
      .set('Authorization', `Bearer ${eligibleAdminToken}`);
    expect(response.status).toBe(200);
  });

  it('allows promotion routes for a home with the PROMOTIONS feature', async () => {
    const response = await request(app)
      .get('/api/v1/marketing/promotions')
      .set('Authorization', `Bearer ${eligibleAdminToken}`);
    expect(response.status).toBe(200);
  });

  it('allows an override to opt a home into BROCHURES early', async () => {
    await prisma.funeralHomeFeature.upsert({
      where: { funeralHomeId_featureKey: { funeralHomeId: basicHomeId, featureKey: 'BROCHURES' } },
      update: { enabled: true, releaseChannelOverride: 'BETA' },
      create: { funeralHomeId: basicHomeId, featureKey: 'BROCHURES', enabled: true, releaseChannelOverride: 'BETA', enabledBy: 'TEST' },
    });
    invalidateFeatureCache();

    const response = await request(app)
      .get('/api/v1/marketing/brochures')
      .set('Authorization', `Bearer ${basicAdminToken}`);
    expect(response.status).toBe(200);
  });

  it('blocks admin feedback routes when FEEDBACK is disabled for the home', async () => {
    await prisma.funeralHomeFeature.upsert({
      where: { funeralHomeId_featureKey: { funeralHomeId: basicHomeId, featureKey: 'FEEDBACK' } },
      update: { enabled: false },
      create: { funeralHomeId: basicHomeId, featureKey: 'FEEDBACK', enabled: false, enabledBy: 'TEST' },
    });
    invalidateFeatureCache();

    const memorial = await prisma.memorial.create({
      data: { funeralHomeId: basicHomeId, deceasedName: 'Guard Deceased', slug: `guard-deceased-${Date.now()}`, programme: [], announcements: [], settings: {} },
    });
    const response = await request(app)
      .get(`/api/v1/admin/memorials/${memorial.id}/feedback`)
      .set('Authorization', `Bearer ${basicAdminToken}`);
    expect(response.status).toBe(403);
    await prisma.memorial.deleteMany({ where: { id: memorial.id } });
  });

  it('allows admin feedback routes when the home has FEEDBACK enabled', async () => {
    const memorial = await prisma.memorial.create({
      data: { funeralHomeId: eligibleHomeId, deceasedName: 'Guard Eligible Deceased', slug: `guard-eligible-${Date.now()}`, programme: [], announcements: [], settings: {} },
    });
    const response = await request(app)
      .get(`/api/v1/admin/memorials/${memorial.id}/feedback`)
      .set('Authorization', `Bearer ${eligibleAdminToken}`);
    expect(response.status).toBe(200);
    await prisma.memorial.deleteMany({ where: { id: memorial.id } });
  });

  it('does not let FEEDBACK depend on disabled internal features (regression for dependency bug)', async () => {
    const deps = await prisma.featureDependency.findMany({ where: { featureKey: 'FEEDBACK' } });
    const blocked = deps.map((d) => d.dependsOnFeature);
    expect(blocked).not.toContain('FUNERAL_RESOURCES');
    expect(blocked).toEqual([]);
  });
});
