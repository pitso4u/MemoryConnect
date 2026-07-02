import { prisma } from '../lib/prisma';

type SqliteColumn = {
  name: string;
};

async function prepareDatabase() {
  const memorialColumns = await prisma.$queryRawUnsafe<SqliteColumn[]>(
    'PRAGMA table_info("Memorial")',
  );
  const names = new Set(memorialColumns.map((column) => column.name));

  // `deceasedPhotoUrl` replaced `coverPhotoUrl` in the API. Keep the original
  // SQLite column so existing images survive schema synchronization.
  if (names.has('deceasedPhotoUrl') && !names.has('coverPhotoUrl')) {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "Memorial" RENAME COLUMN "deceasedPhotoUrl" TO "coverPhotoUrl"',
    );
    console.log('Preserved memorial photos in the coverPhotoUrl database column.');
  }
}

prepareDatabase()
  .catch((error) => {
    console.error('Database compatibility preparation failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
