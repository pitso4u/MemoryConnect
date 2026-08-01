import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../lib/prisma';
import {
  canAccess, resolveFeatures, invalidateFeatureCache,
} from '../lib/featureService';
import { ROLES } from '../middleware/auth';

const withCleanup = async () => {
  const suffix = Date.now();
  const superAdmin = await prisma.user.create({
    data: { name: 'Super Admin', email: `feature-super-${suffix}@example.com`, passwordHash: 'x', passwordSetAt: new Date(), role: 'SUPER_ADMIN' },
  });
  const home = await prisma.funeralHome.create({
    data: {
      name: `Feature Home ${suffix}`,
      email: `feature-home-${suffix}@example.com`,
      plan: 'BUSINESS',
      edition: 'FUNERAL_OFFICE',
      users: {
        create: { name: 'FH Admin', email: `feature-admin-${suffix}@example.com`, passwordHash: 'x', passwordSetAt: new Date(), role: 'FUNERAL_HOME_ADMIN' },
      },
    },
    include: { users: true },
  });
  return { superAdmin, home, admin: home.users[0] };
};

async function createFeature(overrides: Record<string, unknown> = {}) {
  return prisma.feature.create({
    data: {
      key: `TEST_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      name: 'Test Feature',
      description: 'Unit test feature',
      category: 'GENERAL',
      releaseChannel: 'GENERAL_AVAILABILITY',
      enabledGlobally: true,
      premium: false,
      minimumEdition: null,
      minimumPlan: null,
      rolloutPercent: 100,
      ...overrides,
    },
  });
}

describe('feature resolution engine', () => {
  let context: Awaited<ReturnType<typeof withCleanup>>;

  beforeAll(async () => {
    invalidateFeatureCache();
    context = await withCleanup();
  });

  afterAll(async () => {
    if (context) {
      await prisma.featureDependency.deleteMany({ where: { featureKey: { startsWith: 'TEST_' } } });
      await prisma.featureDependency.deleteMany({ where: { dependsOnFeature: { startsWith: 'TEST_' } } });
      await prisma.userFeature.deleteMany({ where: { userId: context.admin.id } });
      await prisma.funeralHomeFeature.deleteMany({ where: { funeralHomeId: context.home.id } });
      await prisma.feature.deleteMany({ where: { key: { startsWith: 'TEST_' } } });
      await prisma.user.deleteMany({ where: { id: context.admin.id } });
      await prisma.funeralHome.delete({ where: { id: context.home.id } });
      await prisma.user.delete({ where: { id: context.superAdmin.id } });
      invalidateFeatureCache();
    }
    await prisma.$disconnect();
  });

  it('returns HIDDEN for an unregistered feature', async () => {
    const result = await canAccess(
      { userId: context.admin.id, role: 'FUNERAL_HOME_ADMIN' },
      { id: context.home.id, plan: context.home.plan, edition: context.home.edition },
      'DOES_NOT_EXIST',
    );
    expect(result.enabled).toBe(false);
    expect(result.visibility).toBe('HIDDEN');
  });

  it('blocks INTERNAL channel features for funeral home admins', async () => {
    const feature = await createFeature({ key: 'TEST_INTERNAL', releaseChannel: 'INTERNAL', enabledGlobally: true });
    const result = await canAccess(
      { userId: context.admin.id, role: 'FUNERAL_HOME_ADMIN' },
      { id: context.home.id, plan: context.home.plan, edition: context.home.edition },
      feature.key,
    );
    expect(result.enabled).toBe(false);
  });

  it('allows INTERNAL channel features for SUPER_ADMIN', async () => {
    const result = await canAccess(
      { userId: context.superAdmin.id, role: 'SUPER_ADMIN' },
      { id: context.home.id, plan: context.home.plan, edition: context.home.edition },
      'TEST_INTERNAL',
    );
    expect(result.enabled).toBe(true);
  });

  it('blocks QA channel features unless whitelisted by a funeral home override', async () => {
    const feature = await createFeature({ key: 'TEST_QA', releaseChannel: 'QA', enabledGlobally: false });
    const user = { userId: context.admin.id, role: 'FUNERAL_HOME_ADMIN' };
    const home = { id: context.home.id, plan: context.home.plan, edition: context.home.edition };

    const denied = await canAccess(user, home, feature.key);
    expect(denied.enabled).toBe(false);

    await prisma.funeralHomeFeature.create({
      data: { funeralHomeId: context.home.id, featureKey: feature.key, enabled: true, enabledBy: context.superAdmin.id, enabledAt: new Date() },
    });
    const granted = await canAccess(user, home, feature.key);
    expect(granted.enabled).toBe(true);
    expect(granted.visibility).toBe('ENABLED');
  });

  it('respects an explicit DISABLED funeral home override', async () => {
    const feature = await createFeature({ key: 'TEST_DISABLE_OVERRIDE' });
    await prisma.funeralHomeFeature.create({
      data: { funeralHomeId: context.home.id, featureKey: feature.key, enabled: false, enabledBy: context.superAdmin.id, enabledAt: new Date() },
    });
    const result = await canAccess(
      { userId: context.admin.id, role: 'FUNERAL_HOME_ADMIN' },
      { id: context.home.id, plan: context.home.plan, edition: context.home.edition },
      feature.key,
    );
    expect(result.enabled).toBe(false);
    expect(result.visibility).toBe('HIDDEN');
  });

  it('gates by edition', async () => {
    const feature = await createFeature({ key: 'TEST_EDITION', minimumEdition: 'ENTERPRISE' });
    const result = await canAccess(
      { userId: context.admin.id, role: 'FUNERAL_HOME_ADMIN' },
      { id: context.home.id, plan: context.home.plan, edition: 'FUNERAL_OFFICE' },
      feature.key,
    );
    expect(result.enabled).toBe(false);
    expect(result.reason).toContain('ENTERPRISE');
  });

  it('gates by subscription plan', async () => {
    const feature = await createFeature({ key: 'TEST_PLAN', minimumPlan: 'ENTERPRISE' });
    const result = await canAccess(
      { userId: context.admin.id, role: 'FUNERAL_HOME_ADMIN' },
      { id: context.home.id, plan: 'BUSINESS', edition: context.home.edition },
      feature.key,
    );
    expect(result.enabled).toBe(false);
    expect(result.reason).toContain('ENTERPRISE plan');
  });

  it('gates by rollout percentage at 0% and grants at 100%', async () => {
    const feature = await createFeature({ key: 'TEST_ROLLOUT' });
    const user = { userId: context.admin.id, role: 'FUNERAL_HOME_ADMIN' };
    const home = { id: context.home.id, plan: context.home.plan, edition: context.home.edition };

    await prisma.feature.update({ where: { key: feature.key }, data: { rolloutPercent: 0 } });
    invalidateFeatureCache();
    expect((await canAccess(user, home, feature.key)).enabled).toBe(false);

    await prisma.feature.update({ where: { key: feature.key }, data: { rolloutPercent: 100 } });
    invalidateFeatureCache();
    expect((await canAccess(user, home, feature.key)).enabled).toBe(true);
  });

  it('gates by global flag', async () => {
    const feature = await createFeature({ key: 'TEST_GLOBAL_OFF', enabledGlobally: false, rolloutPercent: 100 });
    const result = await canAccess(
      { userId: context.admin.id, role: 'FUNERAL_HOME_ADMIN' },
      { id: context.home.id, plan: context.home.plan, edition: context.home.edition },
      feature.key,
    );
    expect(result.enabled).toBe(false);
    expect(result.visibility).toBe('COMING_SOON');
  });

  it('always enables GA features for a qualifying funeral home admin', async () => {
    const feature = await createFeature({ key: 'TEST_GA_OK' });
    const result = await canAccess(
      { userId: context.admin.id, role: 'FUNERAL_HOME_ADMIN' },
      { id: context.home.id, plan: context.home.plan, edition: context.home.edition },
      feature.key,
    );
    expect(result.enabled).toBe(true);
    expect(result.visibility).toBe('ENABLED');
  });

  it('grants a user override even when the feature is not yet released', async () => {
    const feature = await createFeature({ key: 'TEST_USER_OVERRIDE', releaseChannel: 'QA', enabledGlobally: false });
    await prisma.userFeature.create({
      data: { userId: context.admin.id, featureKey: feature.key, enabled: true, enabledBy: context.superAdmin.id },
    });
    const result = await canAccess(
      { userId: context.admin.id, role: 'FUNERAL_HOME_ADMIN' },
      { id: context.home.id, plan: context.home.plan, edition: context.home.edition },
      feature.key,
    );
    expect(result.enabled).toBe(true);
  });

  it('treats an expired user override as absent', async () => {
    const feature = await createFeature({ key: 'TEST_EXPIRED', releaseChannel: 'QA', enabledGlobally: false });
    await prisma.userFeature.create({
      data: { userId: context.admin.id, featureKey: feature.key, enabled: true, expiresAt: new Date(Date.now() - 60_000), enabledBy: context.superAdmin.id },
    });
    const result = await canAccess(
      { userId: context.admin.id, role: 'FUNERAL_HOME_ADMIN' },
      { id: context.home.id, plan: context.home.plan, edition: context.home.edition },
      feature.key,
    );
    expect(result.enabled).toBe(false);
  });

  it('resolveFeatures returns every registered feature with a reason', async () => {
    const results = await resolveFeatures(
      { userId: context.superAdmin.id, role: ROLES.SUPER_ADMIN },
      { id: context.home.id, plan: context.home.plan, edition: context.home.edition },
    );
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(typeof result.key).toBe('string');
      expect(typeof result.enabled).toBe('boolean');
      expect(typeof result.reason).toBe('string');
    }
  });

  it('blocks a child feature when a dependency is not enabled', async () => {
    const dependency = await createFeature({ key: 'TEST_DEP_PARENT', releaseChannel: 'QA', enabledGlobally: false });
    const child = await createFeature({ key: 'TEST_DEP_CHILD' });
    await prisma.featureDependency.create({ data: { featureKey: child.key, dependsOnFeature: dependency.key } });
    // Whitelist the child but NOT its dependency — the child must stay blocked.
    await prisma.funeralHomeFeature.create({
      data: { funeralHomeId: context.home.id, featureKey: child.key, enabled: true, enabledBy: context.superAdmin.id, enabledAt: new Date() },
    });
    const result = await canAccess(
      { userId: context.admin.id, role: 'FUNERAL_HOME_ADMIN' },
      { id: context.home.id, plan: context.home.plan, edition: context.home.edition },
      child.key,
    );
    expect(result.enabled).toBe(false);
    expect(result.reason).toContain(dependency.key);
  });

  it('enables a child feature when every dependency resolves enabled', async () => {
    const dependency = await createFeature({ key: 'TEST_DEP_PARENT_OK' });
    const child = await createFeature({ key: 'TEST_DEP_CHILD_OK' });
    await prisma.featureDependency.create({ data: { featureKey: child.key, dependsOnFeature: dependency.key } });
    const result = await canAccess(
      { userId: context.admin.id, role: 'FUNERAL_HOME_ADMIN' },
      { id: context.home.id, plan: context.home.plan, edition: context.home.edition },
      child.key,
    );
    expect(result.enabled).toBe(true);
    expect(result.visibility).toBe('ENABLED');
  });

  it('grants a GA dependency (MEMORIALS) to a case-management-style child', async () => {
    const dependency = await createFeature({ key: 'TEST_GA_PARENT', releaseChannel: 'GENERAL_AVAILABILITY', enabledGlobally: true });
    const child = await createFeature({ key: 'TEST_GA_CHILD' });
    await prisma.featureDependency.create({ data: { featureKey: child.key, dependsOnFeature: dependency.key } });
    const result = await canAccess(
      { userId: context.admin.id, role: 'FUNERAL_HOME_ADMIN' },
      { id: context.home.id, plan: context.home.plan, edition: context.home.edition },
      child.key,
    );
    expect(result.enabled).toBe(true);
  });

  it('does not deadlock on a circular dependency', async () => {
    const a = await createFeature({ key: 'TEST_CYCLE_A' });
    const b = await createFeature({ key: 'TEST_CYCLE_B' });
    await prisma.featureDependency.create({ data: { featureKey: a.key, dependsOnFeature: b.key } });
    await prisma.featureDependency.create({ data: { featureKey: b.key, dependsOnFeature: a.key } });
    const result = await canAccess(
      { userId: context.admin.id, role: 'FUNERAL_HOME_ADMIN' },
      { id: context.home.id, plan: context.home.plan, edition: context.home.edition },
      a.key,
    );
    expect(result.enabled).toBe(false);
    expect(result.reason).toContain('Circular');
  });
});
