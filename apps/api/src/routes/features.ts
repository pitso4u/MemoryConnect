import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, ROLES } from '../middleware/auth';
import { isZodError } from '../lib/validation';
import { invalidateFeatureCache, getAllFeatureDefinitions, resolveFeatures, canAccess, getFeatureVersion, FeatureResolution } from '../lib/featureService';
import {
  createFeatureSchema, updateFeatureSchema, funeralHomeFeatureSchema, userFeatureSchema,
} from '@memorialconnect/shared';

const router = Router();
router.use(authenticate, requireRole([ROLES.SUPER_ADMIN]));

const SEEDED_FEATURES = [
  { key: 'MEMORIALS', name: 'Memorials', description: 'Create and publish digital memorials', category: 'MEMORIALS', releaseChannel: 'GENERAL_AVAILABILITY', enabledGlobally: true, premium: false, minimumEdition: null, minimumPlan: null, rolloutPercent: 100 },
  { key: 'PHOTO_LIGHTBOX', name: 'Photo Lightbox', description: 'Fullscreen photo viewer on memorial pages', category: 'MEMORIALS', releaseChannel: 'GENERAL_AVAILABILITY', enabledGlobally: true, premium: false, minimumEdition: null, minimumPlan: null, rolloutPercent: 100 },
  { key: 'LIVE_STREAM', name: 'Live Stream', description: 'Embed a live stream into the memorial', category: 'MEMORIALS', releaseChannel: 'INTERNAL', enabledGlobally: false, premium: true, minimumEdition: 'FUNERAL_OFFICE', minimumPlan: 'BUSINESS', rolloutPercent: 0 },
  { key: 'GPS', name: 'GPS Directions', description: 'Service locations with map directions', category: 'MEMORIALS', releaseChannel: 'GENERAL_AVAILABILITY', enabledGlobally: true, premium: false, minimumEdition: null, minimumPlan: null, rolloutPercent: 100 },
  { key: 'FEEDBACK', name: 'Funeral Feedback', description: 'Collect attendee feedback after a service', category: 'MEMORIALS', releaseChannel: 'GENERAL_AVAILABILITY', enabledGlobally: true, premium: false, minimumEdition: null, minimumPlan: null, rolloutPercent: 100 },
  { key: 'PROMOTIONS', name: 'Promotions', description: 'Seasonal offers on the marketing page', category: 'MARKETING', releaseChannel: 'GENERAL_AVAILABILITY', enabledGlobally: true, premium: false, minimumEdition: 'FUNERAL_OFFICE', minimumPlan: 'PROFESSIONAL', rolloutPercent: 100 },
  { key: 'BROCHURES', name: 'Digital Brochures', description: 'Publish service brochures with QR codes', category: 'MARKETING', releaseChannel: 'GENERAL_AVAILABILITY', enabledGlobally: true, premium: false, minimumEdition: 'FUNERAL_OFFICE', minimumPlan: 'PROFESSIONAL', rolloutPercent: 100 },
  { key: 'VEHICLES', name: 'Vehicle Management', description: 'Manage hearses, cars, and service vehicles', category: 'VEHICLES', releaseChannel: 'QA', enabledGlobally: false, premium: true, minimumEdition: 'FUNERAL_OFFICE', minimumPlan: 'PROFESSIONAL', rolloutPercent: 0 },
  { key: 'ASSETS', name: 'Asset Management', description: 'Track reusable equipment with QR codes', category: 'ASSETS', releaseChannel: 'QA', enabledGlobally: false, premium: true, minimumEdition: 'FUNERAL_OFFICE', minimumPlan: 'PROFESSIONAL', rolloutPercent: 0 },
  { key: 'FUNERAL_RESOURCES', name: 'Funeral Resources', description: 'Reserve vehicles and assets per memorial', category: 'CASE_MANAGEMENT', releaseChannel: 'QA', enabledGlobally: false, premium: true, minimumEdition: 'FUNERAL_OFFICE', minimumPlan: 'BUSINESS', rolloutPercent: 0 },
  { key: 'CASE_MANAGEMENT', name: 'Case Management', description: 'End-to-end funeral case workflow', category: 'CASE_MANAGEMENT', releaseChannel: 'INTERNAL', enabledGlobally: false, premium: true, minimumEdition: 'FUNERAL_OFFICE', minimumPlan: 'BUSINESS', rolloutPercent: 0 },
  { key: 'STAFF', name: 'Staff Management', description: 'Manage funeral home staff and roles', category: 'STAFF', releaseChannel: 'GENERAL_AVAILABILITY', enabledGlobally: true, premium: false, minimumEdition: null, minimumPlan: 'PROFESSIONAL', rolloutPercent: 100 },
  { key: 'INSURANCE', name: 'Insurance Module', description: 'Funeral insurance administration', category: 'INSURANCE', releaseChannel: 'INTERNAL', enabledGlobally: false, premium: true, minimumEdition: 'ENTERPRISE', minimumPlan: 'BUSINESS', rolloutPercent: 0 },
  { key: 'MEMBERSHIP', name: 'Membership', description: 'Funeral plan membership administration', category: 'MEMBERSHIP', releaseChannel: 'INTERNAL', enabledGlobally: false, premium: true, minimumEdition: 'ENTERPRISE', minimumPlan: 'BUSINESS', rolloutPercent: 0 },
  { key: 'REPORTS', name: 'Reports', description: 'Business and operational reports', category: 'REPORTS', releaseChannel: 'INTERNAL', enabledGlobally: false, premium: true, minimumEdition: 'FUNERAL_OFFICE', minimumPlan: 'BUSINESS', rolloutPercent: 0 },
  { key: 'CRM', name: 'Customer Relationship Management', description: 'Leads, families, and follow-up tracking', category: 'CRM', releaseChannel: 'INTERNAL', enabledGlobally: false, premium: true, minimumEdition: 'FUNERAL_OFFICE', minimumPlan: 'BUSINESS', rolloutPercent: 0 },
  { key: 'API', name: 'API Access', description: 'Programmatic API access for integrations', category: 'API', releaseChannel: 'INTERNAL', enabledGlobally: false, premium: true, minimumEdition: 'ENTERPRISE', minimumPlan: 'ENTERPRISE', rolloutPercent: 0 },
  { key: 'WHITE_LABEL', name: 'White Label', description: 'Remove Memory Connect branding', category: 'WHITE_LABEL', releaseChannel: 'INTERNAL', enabledGlobally: false, premium: true, minimumEdition: 'WHITE_LABEL', minimumPlan: 'ENTERPRISE', rolloutPercent: 0 },
  { key: 'AI_ASSISTANT', name: 'AI Assistant', description: 'AI-powered content and support assistant', category: 'GENERAL', releaseChannel: 'INTERNAL', enabledGlobally: false, premium: true, minimumEdition: 'ENTERPRISE', minimumPlan: 'ENTERPRISE', rolloutPercent: 0 },
] as const;

async function audit(
  actor: { userId: string; name?: string },
  action: string,
  featureKey: string,
  targetType: string,
  targetId?: string | null,
  funeralHomeId?: string | null,
  details?: Record<string, unknown>,
) {
  await prisma.featureAuditLog.create({
    data: {
      actorUserId: actor.userId,
      actorName: actor.name,
      action,
      featureKey,
      targetType,
      targetId: targetId || null,
      funeralHomeId: funeralHomeId || null,
      details: details ? JSON.stringify(details) : null,
    },
  });
}

// ── SEED ───────────────────────────────────────────────────────────────────

router.post('/seed', async (req, res) => {
  try {
    let created = 0;
    for (const f of SEEDED_FEATURES) {
      const exists = await prisma.feature.findUnique({ where: { key: f.key } });
      if (!exists) {
        await prisma.feature.create({ data: { ...f } });
        created++;
      }
    }
    invalidateFeatureCache();
    res.json({ success: true, data: { created, total: SEEDED_FEATURES.length } });
  } catch (error) {
    console.error('Seed features error:', error);
    res.status(500).json({ success: false, error: 'Failed to seed features' });
  }
});

// ── LIST / DASHBOARD ───────────────────────────────────────────────────────

router.get('/', async (_req, res) => {
  try {
    const [features, auditCount, allDependencies] = await Promise.all([
      prisma.feature.findMany({
        orderBy: { updatedAt: 'desc' },
        include: {
          funeralHomeOverrides: { select: { id: true, funeralHomeId: true, enabled: true, releaseChannelOverride: true } },
          userOverrides: { select: { id: true, userId: true, enabled: true, expiresAt: true } },
        },
      }),
      prisma.featureAuditLog.count(),
      prisma.featureDependency.findMany({ select: { featureKey: true, dependsOnFeature: true } }),
    ]);
    const depsByKey = new Map<string, string[]>();
    const requiredByMap = new Map<string, string[]>();
    for (const dep of allDependencies) {
      depsByKey.set(dep.featureKey, [...(depsByKey.get(dep.featureKey) ?? []), dep.dependsOnFeature]);
      requiredByMap.set(dep.dependsOnFeature, [...(requiredByMap.get(dep.dependsOnFeature) ?? []), dep.featureKey]);
    }
    const data = features.map((f) => ({
      ...f,
      funeralHomeOverrides: f.funeralHomeOverrides,
      userOverrides: f.userOverrides,
      dependencies: (depsByKey.get(f.key) ?? []).sort(),
      requiredBy: (requiredByMap.get(f.key) ?? []).sort(),
    }));
    res.json({ success: true, data: { features: data, auditCount, featureVersion: await getFeatureVersion() } });
  } catch (error) {
    console.error('List features error:', error);
    res.status(500).json({ success: false, error: 'Failed to load features' });
  }
});

router.get('/all', async (_req, res) => {
  try {
    const definitions = await getAllFeatureDefinitions();
    res.json({ success: true, data: definitions });
  } catch (error) {
    console.error('Get all feature definitions error:', error);
    res.status(500).json({ success: false, error: 'Failed to load feature definitions' });
  }
});

router.get('/audit-log', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const logs = await prisma.featureAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('Get feature audit log error:', error);
    res.status(500).json({ success: false, error: 'Failed to load audit log' });
  }
});

router.get('/funeral-homes', async (_req, res) => {
  try {
    const homes = await prisma.funeralHome.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        plan: true,
        edition: true,
        status: true,
        featureOverrides: { select: { id: true, featureKey: true, enabled: true, releaseChannelOverride: true, enabledAt: true } },
      },
    });
    res.json({ success: true, data: homes });
  } catch (error) {
    console.error('List funeral home overrides error:', error);
    res.status(500).json({ success: false, error: 'Failed to load funeral homes' });
  }
});

// ── FEATURE CRUD ───────────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  try {
    const body = createFeatureSchema.parse(req.body);
    const feature = await prisma.feature.create({ data: body });
    invalidateFeatureCache();
    await audit(
      { userId: req.user!.userId, name: (req as any).user?.name },
      'CREATE',
      feature.key,
      'FEATURE',
      feature.id,
      null,
      { name: feature.name, releaseChannel: feature.releaseChannel },
    );
    res.status(201).json({ success: true, data: feature });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, error: error.errors[0].message });
    if ((error as any)?.code === 'P2002') return res.status(409).json({ success: false, error: 'A feature with this key already exists' });
    console.error('Create feature error:', error);
    res.status(500).json({ success: false, error: 'Failed to create feature' });
  }
});

router.patch('/:key', async (req, res) => {
  try {
    const body = updateFeatureSchema.parse(req.body);
    const existing = await prisma.feature.findUnique({ where: { key: String(req.params.key) } });
    if (!existing) return res.status(404).json({ success: false, error: 'Feature not found' });
    const feature = await prisma.feature.update({
      where: { key: existing.key },
      data: body,
    });
    invalidateFeatureCache();
    await audit(
      { userId: req.user!.userId, name: (req as any).user?.name },
      'UPDATE',
      feature.key,
      'FEATURE',
      feature.id,
      null,
      { changes: body },
    );
    res.json({ success: true, data: feature });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, error: error.errors[0].message });
    console.error('Update feature error:', error);
    res.status(500).json({ success: false, error: 'Failed to update feature' });
  }
});

router.delete('/:key', async (req, res) => {
  try {
    const existing = await prisma.feature.findUnique({ where: { key: String(req.params.key) } });
    if (!existing) return res.status(404).json({ success: false, error: 'Feature not found' });
    await prisma.feature.delete({ where: { key: existing.key } });
    invalidateFeatureCache();
    await audit(
      { userId: req.user!.userId, name: (req as any).user?.name },
      'DELETE',
      existing.key,
      'FEATURE',
      existing.id,
      null,
      { name: existing.name },
    );
    res.json({ success: true, data: null });
  } catch (error) {
    console.error('Delete feature error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete feature' });
  }
});

// ── FEATURE DEPENDENCIES ─────────────────────────────────────────────────

router.get('/dependencies', async (_req, res) => {
  try {
    const deps = await prisma.featureDependency.findMany({
      orderBy: [{ featureKey: 'asc' }, { dependsOnFeature: 'asc' }],
    });
    res.json({ success: true, data: deps });
  } catch (error) {
    console.error('List feature dependencies error:', error);
    res.status(500).json({ success: false, error: 'Failed to load dependencies' });
  }
});

// A feature can only be activated if its dependencies are enabled. This endpoint
// guards against circular graphs so the resolution engine can never deadlock.
router.put('/dependencies/:key/depends-on/:dependsOnFeature', async (req, res) => {
  try {
    const featureKey = String(req.params.key);
    const dependsOnFeature = String(req.params.dependsOnFeature);
    if (featureKey === dependsOnFeature) {
      return res.status(400).json({ success: false, error: 'A feature cannot depend on itself' });
    }
    const [feature, dependency] = await Promise.all([
      prisma.feature.findUnique({ where: { key: featureKey } }),
      prisma.feature.findUnique({ where: { key: dependsOnFeature } }),
    ]);
    if (!feature || !dependency) return res.status(404).json({ success: false, error: 'Feature not found' });

    // Cycle detection: walk the dependency graph from `dependsOnFeature`; if we
    // ever reach `featureKey` the new edge would create a loop.
    const reachable = new Set<string>([dependsOnFeature]);
    const queue = [dependsOnFeature];
    while (queue.length) {
      const current = queue.shift()!;
      const children = await prisma.featureDependency.findMany({
        where: { featureKey: current },
        select: { dependsOnFeature: true },
      });
      for (const child of children) {
        if (child.dependsOnFeature === featureKey) {
          return res.status(409).json({ success: false, error: 'This dependency would create a circular feature graph' });
        }
        if (!reachable.has(child.dependsOnFeature)) {
          reachable.add(child.dependsOnFeature);
          queue.push(child.dependsOnFeature);
        }
      }
    }

    const record = await prisma.featureDependency.upsert({
      where: { featureKey_dependsOnFeature: { featureKey, dependsOnFeature } },
      update: {},
      create: { featureKey, dependsOnFeature },
    });
    invalidateFeatureCache();
    await audit(
      { userId: req.user!.userId, name: (req as any).user?.name },
      'ADD_DEPENDENCY',
      featureKey,
      'DEPENDENCY',
      feature.id,
      null,
      { dependsOn: dependsOnFeature },
    );
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    console.error('Add feature dependency error:', error);
    res.status(500).json({ success: false, error: 'Failed to add dependency' });
  }
});

router.delete('/dependencies/:key/depends-on/:dependsOnFeature', async (req, res) => {
  try {
    const featureKey = String(req.params.key);
    const dependsOnFeature = String(req.params.dependsOnFeature);
    const existing = await prisma.featureDependency.findUnique({
      where: { featureKey_dependsOnFeature: { featureKey, dependsOnFeature } },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Dependency not found' });
    await prisma.featureDependency.delete({ where: { id: existing.id } });
    invalidateFeatureCache();
    await audit(
      { userId: req.user!.userId, name: (req as any).user?.name },
      'REMOVE_DEPENDENCY',
      featureKey,
      'DEPENDENCY',
      null,
      null,
      { dependsOn: dependsOnFeature },
    );
    res.json({ success: true, data: null });
  } catch (error) {
    console.error('Remove feature dependency error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove dependency' });
  }
});

// ── FUNERAL HOME OVERRIDES ────────────────────────────────────────────────

router.put('/funeral-homes/:id/features/:key', async (req, res) => {
  try {
    const body = funeralHomeFeatureSchema.parse(req.body);
    const feature = await prisma.feature.findUnique({ where: { key: String(req.params.key) } });
    if (!feature) return res.status(404).json({ success: false, error: 'Feature not found' });
    const home = await prisma.funeralHome.findUnique({ where: { id: String(req.params.id) } });
    if (!home) return res.status(404).json({ success: false, error: 'Funeral home not found' });

    const data: Record<string, unknown> = {
      enabled: body.enabled,
      releaseChannelOverride: body.releaseChannelOverride || null,
      enabledBy: req.user!.userId,
      enabledAt: new Date(),
    };
    const override = await prisma.funeralHomeFeature.upsert({
      where: { funeralHomeId_featureKey: { funeralHomeId: home.id, featureKey: feature.key } },
      update: data,
      create: {
        funeralHomeId: home.id,
        featureKey: feature.key,
        enabled: body.enabled,
        releaseChannelOverride: body.releaseChannelOverride || null,
        enabledBy: req.user!.userId,
        enabledAt: new Date(),
      },
    });
    invalidateFeatureCache();
    await audit(
      { userId: req.user!.userId, name: (req as any).user?.name },
      body.enabled ? 'ENABLE' : 'DISABLE',
      feature.key,
      'FUNERAL_HOME',
      home.id,
      home.id,
      { funeralHomeName: home.name, ...body },
    );
    res.json({ success: true, data: override });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, error: error.errors[0].message });
    console.error('Set funeral home override error:', error);
    res.status(500).json({ success: false, error: 'Failed to set funeral home override' });
  }
});

router.delete('/funeral-homes/:id/features/:key', async (req, res) => {
  try {
    const homeId = String(req.params.id);
    const featureKey = String(req.params.key);
    const existing = await prisma.funeralHomeFeature.findUnique({
      where: { funeralHomeId_featureKey: { funeralHomeId: homeId, featureKey } },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Override not found' });
    await prisma.funeralHomeFeature.delete({ where: { id: existing.id } });
    invalidateFeatureCache();
    await audit(
      { userId: req.user!.userId, name: (req as any).user?.name },
      'REMOVE_OVERRIDE',
      featureKey,
      'FUNERAL_HOME',
      homeId,
      homeId,
      {},
    );
    res.json({ success: true, data: null });
  } catch (error) {
    console.error('Remove funeral home override error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove override' });
  }
});

// ── USER OVERRIDES ─────────────────────────────────────────────────────────

router.put('/users/:id/features/:key', async (req, res) => {
  try {
    const body = userFeatureSchema.parse(req.body);
    const feature = await prisma.feature.findUnique({ where: { key: String(req.params.key) } });
    if (!feature) return res.status(404).json({ success: false, error: 'Feature not found' });
    const targetUser = await prisma.user.findUnique({ where: { id: String(req.params.id) } });
    if (!targetUser) return res.status(404).json({ success: false, error: 'User not found' });

    const data: Record<string, unknown> = {
      enabled: body.enabled,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      enabledBy: req.user!.userId,
    };
    const override = await prisma.userFeature.upsert({
      where: { userId_featureKey: { userId: targetUser.id, featureKey: feature.key } },
      update: data,
      create: {
        userId: targetUser.id,
        featureKey: feature.key,
        enabled: body.enabled,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        enabledBy: req.user!.userId,
      },
    });
    invalidateFeatureCache();
    await audit(
      { userId: req.user!.userId, name: (req as any).user?.name },
      body.enabled ? 'ENABLE' : 'DISABLE',
      feature.key,
      'USER',
      targetUser.id,
      targetUser.funeralHomeId || null,
      { userName: targetUser.name, ...body },
    );
    res.json({ success: true, data: override });
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, error: error.errors[0].message });
    console.error('Set user override error:', error);
    res.status(500).json({ success: false, error: 'Failed to set user override' });
  }
});

router.delete('/users/:id/features/:key', async (req, res) => {
  try {
    const userId = String(req.params.id);
    const featureKey = String(req.params.key);
    const existing = await prisma.userFeature.findUnique({
      where: { userId_featureKey: { userId, featureKey } },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Override not found' });
    await prisma.userFeature.delete({ where: { id: existing.id } });
    invalidateFeatureCache();
    await audit(
      { userId: req.user!.userId, name: (req as any).user?.name },
      'REMOVE_OVERRIDE',
      featureKey,
      'USER',
      userId,
      null,
      {},
    );
    res.json({ success: true, data: null });
  } catch (error) {
    console.error('Remove user override error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove user override' });
  }
});

// ── RESOLUTION / PREVIEW ───────────────────────────────────────────────────

router.get('/resolve/:funeralHomeId', async (req, res) => {
  try {
    const home = await prisma.funeralHome.findUnique({
      where: { id: String(req.params.funeralHomeId) },
      select: { id: true, plan: true, edition: true, name: true, tradingName: true },
    });
    if (!home) return res.status(404).json({ success: false, error: 'Funeral home not found' });
    const resolutions = await resolveFeatures(
      { userId: req.user!.userId, role: req.user!.role },
      { id: home.id, plan: home.plan, edition: home.edition },
    );
    res.json({ success: true, data: { funeralHome: home, features: resolutions } });
  } catch (error) {
    console.error('Resolve features error:', error);
    res.status(500).json({ success: false, error: 'Failed to resolve features' });
  }
});

router.get('/resolve-all', async (req, res) => {
  try {
    const homes = await prisma.funeralHome.findMany({
      select: { id: true, plan: true, edition: true, name: true },
    });
    const features = await getAllFeatureDefinitions();
    const rows: Array<{ funeralHomeId: string; name: string; features: FeatureResolution[] }> = [];
    for (const home of homes) {
      const resolutions: FeatureResolution[] = [];
      for (const f of features) {
        resolutions.push(await canAccess(
          { userId: req.user!.userId, role: req.user!.role },
          { id: home.id, plan: home.plan, edition: home.edition },
          f.key,
        ));
      }
      rows.push({ funeralHomeId: home.id, name: home.name, features: resolutions });
    }
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Resolve all features error:', error);
    res.status(500).json({ success: false, error: 'Failed to resolve features' });
  }
});

export default router;
