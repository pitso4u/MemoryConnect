import { prisma } from '../lib/prisma';

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
  { key: 'CRM', name: 'CRM', description: 'Leads, families, and follow-up tracking', category: 'CRM', releaseChannel: 'INTERNAL', enabledGlobally: false, premium: true, minimumEdition: 'FUNERAL_OFFICE', minimumPlan: 'BUSINESS', rolloutPercent: 0 },
  { key: 'API', name: 'API Access', description: 'Programmatic API access for integrations', category: 'API', releaseChannel: 'INTERNAL', enabledGlobally: false, premium: true, minimumEdition: 'ENTERPRISE', minimumPlan: 'ENTERPRISE', rolloutPercent: 0 },
  { key: 'WHITE_LABEL', name: 'White Label', description: 'Remove Memory Connect branding', category: 'WHITE_LABEL', releaseChannel: 'INTERNAL', enabledGlobally: false, premium: true, minimumEdition: 'WHITE_LABEL', minimumPlan: 'ENTERPRISE', rolloutPercent: 0 },
  { key: 'AI_ASSISTANT', name: 'AI Assistant', description: 'AI-powered content and support assistant', category: 'GENERAL', releaseChannel: 'INTERNAL', enabledGlobally: false, premium: true, minimumEdition: 'ENTERPRISE', minimumPlan: 'ENTERPRISE', rolloutPercent: 0 },
] as const;

async function main() {
  console.log('Seeding feature registry...');
  let created = 0;
  let updated = 0;
  for (const feature of SEEDED_FEATURES) {
    const existing = await prisma.feature.findUnique({ where: { key: feature.key } });
    if (!existing) {
      await prisma.feature.create({ data: { ...feature } });
      created++;
      console.log(`  + ${feature.key}`);
    } else {
      await prisma.feature.update({ where: { key: feature.key }, data: { ...feature } });
      updated++;
    }
  }
  console.log(`Done. ${created} created, ${updated} already present.`);

  // Feature dependencies — a child feature only activates when every dependency
  // resolves enabled. Example: Case Management requires Memorials; Funeral
  // Resources requires both Vehicles and Assets.
  const dependencies: Array<[string, string]> = [
    ['CASE_MANAGEMENT', 'MEMORIALS'],
    ['FUNERAL_RESOURCES', 'VEHICLES'],
    ['FUNERAL_RESOURCES', 'ASSETS'],
  ];
  let depsAdded = 0;
  for (const [featureKey, dependsOnFeature] of dependencies) {
    const existing = await prisma.featureDependency.findUnique({
      where: { featureKey_dependsOnFeature: { featureKey, dependsOnFeature } },
    });
    if (!existing) {
      await prisma.featureDependency.create({ data: { featureKey, dependsOnFeature } });
      depsAdded++;
      console.log(`  ${featureKey} -> ${dependsOnFeature}`);
    }
  }
   console.log(`Dependencies: ${depsAdded} added.`);

  // Defensive self-healing: prune any dependency edges that are not part of the
  // canonical graph above. These rows were never produced by the seed and, when
  // present (e.g. written ad hoc in a prior session), block GA features such as
  // FEEDBACK, PHOTO_LIGHTBOX and GPS because they depend on disabled features.
  // Keeping the seed idempotent + clean prevents the regression from recurring.
  await prisma.featureDependency.deleteMany({
    where: {
      NOT: {
        OR: dependencies.map(([featureKey, dependsOnFeature]) => ({
          featureKey,
          dependsOnFeature,
        })),
      },
    },
  });
  console.log('Pruned non-canonical feature dependencies.');

  // Apply an example rollout override: enable VEHICLES for the first funeral home
  const firstHome = await prisma.funeralHome.findFirst({ orderBy: { createdAt: 'asc' } });
  if (firstHome) {
    await prisma.funeralHomeFeature.upsert({
      where: { funeralHomeId_featureKey: { funeralHomeId: firstHome.id, featureKey: 'VEHICLES' } },
      update: { enabled: true, releaseChannelOverride: 'BETA', enabledAt: new Date() },
      create: {
        funeralHomeId: firstHome.id,
        featureKey: 'VEHICLES',
        enabled: true,
        releaseChannelOverride: 'BETA',
        enabledAt: new Date(),
        enabledBy: 'SYSTEM_SEED',
      },
    });
    await prisma.funeralHomeFeature.upsert({
      where: { funeralHomeId_featureKey: { funeralHomeId: firstHome.id, featureKey: 'ASSETS' } },
      update: { enabled: true, releaseChannelOverride: 'BETA', enabledAt: new Date() },
      create: {
        funeralHomeId: firstHome.id,
        featureKey: 'ASSETS',
        enabled: true,
        releaseChannelOverride: 'BETA',
        enabledAt: new Date(),
        enabledBy: 'SYSTEM_SEED',
      },
    });
    console.log(`  Beta enabled VEHICLES + ASSETS for ${firstHome.name}`);
  }
}

main()
  .catch((error) => {
    console.error('Seed features failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
