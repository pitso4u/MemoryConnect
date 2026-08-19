import { prisma } from '../lib/prisma';
import { migrateMemorialViews } from '../lib/viewAnalytics';

type SqliteColumn = {
  name: string;
};

async function prepareDatabase() {
  const paymentColumns = await prisma.$queryRawUnsafe<SqliteColumn[]>(
    'PRAGMA table_info("Payment")',
  );
  const paymentNames = new Set(paymentColumns.map((column) => column.name));

  // Builds using the per-funeral schema originally called this table Payment.
  // Move it to its permanent name before restoring the legacy Payment mapping.
  if (paymentNames.has('memorialId')) {
    const memorialPaymentColumns = await prisma.$queryRawUnsafe<SqliteColumn[]>(
      'PRAGMA table_info("MemorialPayment")',
    );
    if (memorialPaymentColumns.length === 0) {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Payment" RENAME TO "MemorialPayment"',
      );
      console.log('Moved per-funeral payments to the MemorialPayment table.');
    }
  }

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

  // Rewrites legacy daily-bucket memorial views to lifetime-unique records
  // before `prisma db push` applies the new schema.
  await migrateMemorialViews();
}

prepareDatabase()
  .catch((error) => {
    console.error('Database compatibility preparation failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
