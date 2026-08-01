import { prisma } from './prisma';
import { ROLES } from '../middleware/auth';

export const RELEASE_CHANNELS = {
  INTERNAL: 'INTERNAL',
  QA: 'QA',
  BETA: 'BETA',
  EARLY_ACCESS: 'EARLY_ACCESS',
  GENERAL_AVAILABILITY: 'GENERAL_AVAILABILITY',
  DEPRECATED: 'DEPRECATED',
  DISABLED: 'DISABLED',
} as const;

export type ReleaseChannel = (typeof RELEASE_CHANNELS)[keyof typeof RELEASE_CHANNELS];

export const EDITIONS: Record<string, { key: string; name: string; rank: number }> = {
  MEMORIAL: { key: 'MEMORIAL', name: 'MemoryConnect Memorial', rank: 0 },
  FUNERAL_OFFICE: { key: 'FUNERAL_OFFICE', name: 'MemoryConnect Funeral Office', rank: 1 },
  ENTERPRISE: { key: 'ENTERPRISE', name: 'MemoryConnect Enterprise', rank: 2 },
  WHITE_LABEL: { key: 'WHITE_LABEL', name: 'MemoryConnect White Label', rank: 3 },
};

export const PLANS: Record<string, { key: string; name: string; rank: number }> = {
  STARTER: { key: 'STARTER', name: 'Starter', rank: 0 },
  PROFESSIONAL: { key: 'PROFESSIONAL', name: 'Professional', rank: 1 },
  BUSINESS: { key: 'BUSINESS', name: 'Business', rank: 2 },
  ENTERPRISE: { key: 'ENTERPRISE', name: 'Enterprise', rank: 3 },
};

export interface FeatureContextUser {
  userId: string;
  role: string;
}

export interface FeatureContextFuneralHome {
  id: string;
  plan?: string | null;
  edition?: string | null;
}

export interface FeatureResolution {
  key: string;
  name: string;
  enabled: boolean;
  visibility: 'HIDDEN' | 'COMING_SOON' | 'ENABLED';
  reason: string;
}

interface FeatureRow {
  key: string;
  name: string;
  description: string | null;
  category: string;
  releaseChannel: string;
  enabledGlobally: boolean;
  premium: boolean;
  minimumEdition: string | null;
  minimumPlan: string | null;
  rolloutPercent: number;
}

interface CacheEntry {
  value: FeatureRow;
  expiresAt: number;
}

interface DepsCacheEntry {
  value: string[];
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000;
const featureCache = new Map<string, CacheEntry>();
const depsCache = new Map<string, DepsCacheEntry>();

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getFromCache(key: string): FeatureRow | undefined {
  const entry = featureCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    featureCache.delete(key);
    return undefined;
  }
  return entry.value;
}

function putInCache(key: string, value: FeatureRow) {
  featureCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function clearCache() {
  featureCache.clear();
  depsCache.clear();
}

export async function getFeatureDefinition(key: string): Promise<FeatureRow | null> {
  const cached = getFromCache(key);
  if (cached) return cached;
  const feature = await prisma.feature.findUnique({ where: { key } });
  if (!feature) return null;
  const row: FeatureRow = {
    key: feature.key,
    name: feature.name,
    description: feature.description,
    category: feature.category,
    releaseChannel: feature.releaseChannel,
    enabledGlobally: feature.enabledGlobally,
    premium: feature.premium,
    minimumEdition: feature.minimumEdition,
    minimumPlan: feature.minimumPlan,
    rolloutPercent: feature.rolloutPercent,
  };
  putInCache(feature.key, row);
  return row;
}

export async function getAllFeatureDefinitions(): Promise<FeatureRow[]> {
  const features = await prisma.feature.findMany({ orderBy: { key: 'asc' } });
  const rows: FeatureRow[] = features.map((f) => ({
    key: f.key,
    name: f.name,
    description: f.description,
    category: f.category,
    releaseChannel: f.releaseChannel,
    enabledGlobally: f.enabledGlobally,
    premium: f.premium,
    minimumEdition: f.minimumEdition,
    minimumPlan: f.minimumPlan,
    rolloutPercent: f.rolloutPercent,
  }));
  rows.forEach((r) => putInCache(r.key, r));
  return rows;
}

export function invalidateFeatureCache() {
  clearCache();
}

function getDepsFromCache(key: string): string[] | undefined {
  const entry = depsCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    depsCache.delete(key);
    return undefined;
  }
  return entry.value;
}

function putDepsInCache(key: string, value: string[]) {
  depsCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Feature keys this feature depends on (they must be enabled first). */
export async function getDependencyKeys(featureKey: string): Promise<string[]> {
  const cached = getDepsFromCache(featureKey);
  if (cached) return cached;
  const rows = await prisma.featureDependency.findMany({
    where: { featureKey },
    select: { dependsOnFeature: true },
    orderBy: { dependsOnFeature: 'asc' },
  });
  const keys = rows.map((row) => row.dependsOnFeature);
  putDepsInCache(featureKey, keys);
  return keys;
}

/** Feature keys that require this feature as a dependency. */
export async function getRequiredByKeys(featureKey: string): Promise<string[]> {
  const rows = await prisma.featureDependency.findMany({
    where: { dependsOnFeature: featureKey },
    select: { featureKey: true },
    orderBy: { featureKey: 'asc' },
  });
  return rows.map((row) => row.featureKey);
}

function inRollout(featureKey: string, funeralHomeId: string, percent: number): boolean {
  if (percent >= 100) return true;
  if (percent <= 0) return false;
  const bucket = hashString(`${featureKey}:${funeralHomeId}`) % 100;
  return bucket < percent;
}

function planRank(plan?: string | null): number {
  const key = (plan || '').toUpperCase();
  return PLANS[key]?.rank ?? -1;
}

function editionRank(edition?: string | null): number {
  const key = (edition || '').toUpperCase();
  return EDITIONS[key]?.rank ?? -1;
}

async function getFuneralHomeOverride(funeralHomeId: string, featureKey: string) {
  return prisma.funeralHomeFeature.findUnique({
    where: { funeralHomeId_featureKey: { funeralHomeId, featureKey } },
  });
}

async function getUserOverride(userId: string, featureKey: string) {
  return prisma.userFeature.findUnique({
    where: { userId_featureKey: { userId, featureKey } },
  });
}

/**
 * Feature resolution engine.
 *
 * Evaluation chain (in order):
 *   1. Release channel (Role + channel visibility)
 *   2. Override whitelist / explicit deny (funeral home, then user)
 *   3. Global flag (enabledGlobally)
 *   4. Edition (minimumEdition)
 *   5. Subscription plan (minimumPlan)
 *   6. Rollout percentage
 *   7. Feature dependencies (all must resolve enabled)
 *
 * An enabled funeral-home or user override acts as an opt-in that grants the
 * feature early (bypassing channel opt-in, global flag, edition, plan, and
 * rollout). A disabled override always denies.
 *
 * The `visited` parameter tracks the in-progress evaluation stack to protect
 * against circular dependencies and is only used for internal recursion.
 */
export async function canAccess(
  user: FeatureContextUser,
  funeralHome: FeatureContextFuneralHome | null | undefined,
  featureKey: string,
  visited: string[] = [],
): Promise<FeatureResolution> {
  const feature = await getFeatureDefinition(featureKey);
  if (!feature) {
    return { key: featureKey, name: featureKey, enabled: false, visibility: 'HIDDEN', reason: 'Feature not registered' };
  }
  if (visited.includes(feature.key)) {
    return { key: feature.key, name: feature.name, enabled: false, visibility: 'HIDDEN', reason: 'Circular feature dependency' };
  }

  const role = (user.role || '').toUpperCase();
  const isSuperAdmin = role === ROLES.SUPER_ADMIN;
  const isInternal = isSuperAdmin || role === 'INTERNAL_TESTER';

  const [fhOverride, userOverride] = await Promise.all([
    funeralHome ? getFuneralHomeOverride(funeralHome.id, feature.key) : Promise.resolve(null),
    getUserOverride(user.userId, feature.key),
  ]);
  const userOverrideActive = userOverride && !(userOverride.expiresAt && new Date(userOverride.expiresAt) < new Date());
  const whitelisted = Boolean(fhOverride?.enabled || (userOverrideActive && userOverride?.enabled));

  // 1. RELEASE CHANNEL + ROLE gating
  const channel = feature.releaseChannel;
  if (channel === RELEASE_CHANNELS.DISABLED) {
    return { key: feature.key, name: feature.name, enabled: false, visibility: 'HIDDEN', reason: 'Disabled globally' };
  }
  if (channel === RELEASE_CHANNELS.INTERNAL && !isInternal) {
    return { key: feature.key, name: feature.name, enabled: false, visibility: 'HIDDEN', reason: 'Internal only' };
  }
  if (channel === RELEASE_CHANNELS.QA && !isInternal && !whitelisted) {
    return { key: feature.key, name: feature.name, enabled: false, visibility: 'HIDDEN', reason: 'QA channel - not opted in' };
  }
  if (channel === RELEASE_CHANNELS.BETA && !isInternal && !whitelisted) {
    return { key: feature.key, name: feature.name, enabled: false, visibility: 'COMING_SOON', reason: 'Beta channel - not opted in' };
  }
  if (channel === RELEASE_CHANNELS.EARLY_ACCESS && !isInternal && !whitelisted) {
    return { key: feature.key, name: feature.name, enabled: false, visibility: 'COMING_SOON', reason: 'Early access only' };
  }

  // 2. OVERRIDE whitelist / explicit deny
  if (fhOverride && !fhOverride.enabled) {
    return { key: feature.key, name: feature.name, enabled: false, visibility: 'HIDDEN', reason: 'Disabled for this funeral home' };
  }
  if (userOverrideActive && !userOverride!.enabled) {
    return { key: feature.key, name: feature.name, enabled: false, visibility: 'HIDDEN', reason: 'Disabled for this user' };
  }

  let granted: FeatureResolution;
  if (whitelisted) {
    granted = {
      key: feature.key,
      name: feature.name,
      enabled: true,
      visibility: 'ENABLED',
      reason: fhOverride?.enabled ? 'Enabled for this funeral home' : 'Enabled for this user',
    };
  } else {
    // 3. GLOBAL FLAG
    if (!feature.enabledGlobally && !isSuperAdmin) {
      return { key: feature.key, name: feature.name, enabled: false, visibility: 'COMING_SOON', reason: 'Not yet released' };
    }

    // 4. EDITION
    if (feature.minimumEdition && funeralHome) {
      if (editionRank(funeralHome.edition) < editionRank(feature.minimumEdition) && !isSuperAdmin) {
        return { key: feature.key, name: feature.name, enabled: false, visibility: 'COMING_SOON', reason: `Requires ${feature.minimumEdition} edition` };
      }
    }

    // 5. SUBSCRIPTION PLAN
    if (feature.minimumPlan && funeralHome) {
      if (planRank(funeralHome.plan) < planRank(feature.minimumPlan) && !isSuperAdmin) {
        return { key: feature.key, name: feature.name, enabled: false, visibility: 'COMING_SOON', reason: `Requires ${feature.minimumPlan} plan` };
      }
    }

    // 6. ROLLOUT PERCENTAGE
    if (funeralHome && !isSuperAdmin && !inRollout(feature.key, funeralHome.id, feature.rolloutPercent)) {
      return { key: feature.key, name: feature.name, enabled: false, visibility: 'COMING_SOON', reason: `Rollout at ${feature.rolloutPercent}%` };
    }

    if (isSuperAdmin) {
      granted = { key: feature.key, name: feature.name, enabled: true, visibility: 'ENABLED', reason: 'Super admin access' };
    } else {
      const deprecatedNote = channel === RELEASE_CHANNELS.DEPRECATED ? ' (deprecated)' : '';
      granted = { key: feature.key, name: feature.name, enabled: true, visibility: 'ENABLED', reason: `General availability${deprecatedNote}` };
    }
  }

  // 7. FEATURE DEPENDENCIES — every dependency must be enabled
  const dependencyKeys = await getDependencyKeys(feature.key);
  for (const dependencyKey of dependencyKeys) {
    const dependency = await canAccess(user, funeralHome, dependencyKey, [...visited, feature.key]);
    if (!dependency.enabled) {
      if (dependency.reason.includes('Circular')) {
        return {
          key: feature.key,
          name: feature.name,
          enabled: false,
          visibility: 'HIDDEN',
          reason: dependency.reason,
        };
      }
      return {
        key: feature.key,
        name: feature.name,
        enabled: false,
        visibility: dependency.visibility === 'HIDDEN' ? 'HIDDEN' : 'COMING_SOON',
        reason: `Requires ${dependency.key}`,
      };
    }
  }

  return granted;
}

/**
 * Resolve all registered features for a given context.
 */
export async function resolveFeatures(
  user: FeatureContextUser,
  funeralHome: FeatureContextFuneralHome | null | undefined,
): Promise<FeatureResolution[]> {
  const features = await getAllFeatureDefinitions();
  const results: FeatureResolution[] = [];
  for (const feature of features) {
    results.push(await canAccess(user, funeralHome, feature.key));
  }
  return results;
}

/**
 * Route middleware: blocks a request when the caller does not have the feature.
 */
export function requireFeature(featureKey: string) {
  return async (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
    const funeralHome = req.user.funeralHomeId
      ? await prisma.funeralHome.findUnique({ where: { id: req.user.funeralHomeId }, select: { id: true, plan: true, edition: true } })
      : null;
    const result = await canAccess(req.user, funeralHome, featureKey);
    if (!result.enabled) {
      return res.status(403).json({ success: false, error: `Feature "${featureKey}" is not available for this account` });
    }
    next();
  };
}
