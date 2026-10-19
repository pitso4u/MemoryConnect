import { prisma } from '../lib/prisma';

function createSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

async function main() {
  console.log('Generating slugs for existing funeral homes...');
  const homes = await prisma.funeralHome.findMany({ where: { slug: null } });
  let updated = 0;
  for (const home of homes) {
    let slug = createSlug(home.name);
    if (!slug) slug = `fh-${home.id.slice(0, 8)}`;
    let uniqueSlug = slug;
    let counter = 1;
    while (await prisma.funeralHome.findUnique({ where: { slug: uniqueSlug } })) {
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }
    await prisma.funeralHome.update({ where: { id: home.id }, data: { slug: uniqueSlug } });
    updated++;
    console.log(`  ${home.name} → ${uniqueSlug}`);
  }

  // Seed default brochure categories for each home
  console.log('\nSeeding default brochure categories...');
  const allHomes = await prisma.funeralHome.findMany({ select: { id: true } });
  const defaultCategories = [
    'Funeral Packages', 'Membership Plans', 'Insurance Products', 'Promotions',
    'Flowers', 'Transport', 'Tombstones', 'Catering', 'Company Profile', 'Other',
  ];
  let categoriesCreated = 0;
  for (const home of allHomes) {
    const existing = await prisma.brochureCategory.count({ where: { funeralHomeId: home.id } });
    if (existing > 0) continue;
    for (let i = 0; i < defaultCategories.length; i++) {
      const name = defaultCategories[i];
      const slug = createSlug(name);
      await prisma.brochureCategory.create({
        data: {
          funeralHomeId: home.id,
          name,
          slug,
          displayOrder: i,
          isDefault: true,
        },
      });
      categoriesCreated++;
    }
  }

  console.log(`\nDone! ${updated} slugs generated, ${categoriesCreated} default categories created.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
