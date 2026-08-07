import path from 'path';
import { Prisma, PrismaClient } from '@prisma/client';
import { removeMemorialFiles } from '../lib/retention';

// ─────────────────────────────────────────────────────────────────────────────
// Reset MemoryConnect production (test) data.
//
// Removes every payment, credit purchase, credit wallet/usage ledger entry,
// generated credit balance, and every non-demo memorial together with its
// related records (photos, tributes, guests, views, feedback, audit logs,
// resource reservations, …). Funeral home accounts, users, platform settings,
// plans, pricing, feature flags and all other configuration are left intact.
//
// The permanent demo memorial (isDemo = true) is seed data and is preserved.
//
// Safety:
//   - Development/staging: runs directly.
//   - Production (NODE_ENV=production or production DB path): requires the
//     `--confirm` flag, otherwise the script aborts without touching anything.
//   - `--dry-run` previews the affected rows without deleting anything.
//
// Usage:
//   npm run reset:test-data -w @memorialconnect/api            # dev/staging
//   npm run reset:test-data:confirm -w @memorialconnect/api    # production
//   npm run reset:test-data:dry-run -w @memorialconnect/api    # preview only
//
// The dedicated npm scripts hardcode the flags because some npm versions
// swallow flag-style arguments passed after `--` (e.g. `-- --dry-run`).
// Running the script directly also works:
//   npx tsx apps/api/src/scripts/reset-test-data.ts --confirm
//   npx tsx apps/api/src/scripts/reset-test-data.ts --dry-run
// ─────────────────────────────────────────────────────────────────────────────

const PRODUCTION_DB_MARKERS = ['/data/memoryconnect.db', 'memoryconnect.db'];

function hasArg(...names: string[]) {
  return names.some((name) => process.argv.includes(name));
}

function isProductionEnvironment() {
  const nodeEnv = (process.env.NODE_ENV ?? '').toLowerCase();
  const dbUrl = process.env.DATABASE_URL ?? '';
  return nodeEnv === 'production' || PRODUCTION_DB_MARKERS.some((marker) => dbUrl.includes(marker));
}

function resolveDatabasePath(dbUrl: string): string {
  if (!dbUrl) return '(unset)';
  const withoutScheme = dbUrl.replace(/^file:/, '');
  return path.isAbsolute(withoutScheme) ? withoutScheme : path.resolve(process.cwd(), 'prisma', withoutScheme);
}

function fmt(n: number): string {
  return String(n).padStart(6);
}

function money(cents: number): string {
  return `R${(cents / 100).toFixed(2)}`;
}

type Tx = Prisma.TransactionClient;

async function deleteAll(tx: Tx, model: string, where: object): Promise<number> {
  const client = tx[model as keyof Tx] as unknown as { deleteMany(args: object): Promise<{ count: number }> };
  const { count } = await client.deleteMany({ where });
  return count;
}

async function countRows(prisma: PrismaClient, model: string, where: object): Promise<number> {
  const client = prisma[model as keyof PrismaClient] as unknown as { count(args: object): Promise<number> };
  return client.count({ where });
}

async function main() {
  const confirm = hasArg('--confirm', '--yes');
  const dryRun = hasArg('--dry-run');
  const production = isProductionEnvironment();
  const dbUrl = process.env.DATABASE_URL ?? '';

  console.log('─'.repeat(72));
  console.log('MemoryConnect test-data reset');
  console.log('─'.repeat(72));
  console.log(`Environment        : ${production ? 'PRODUCTION' : process.env.NODE_ENV || 'development'}`);
  console.log(`Database           : ${resolveDatabasePath(dbUrl)}`);
  console.log(`Mode               : ${dryRun ? 'DRY RUN (no changes)' : 'live'}`);
  if (production) {
    console.log(`Confirm flag       : ${confirm ? 'yes' : 'NO'}`);
    if (!confirm) {
      console.error('\nRefusing to run: production environment detected. Pass --confirm to proceed.');
      console.error('Nothing was changed.');
      process.exit(1);
    }
  }

  const prisma = new PrismaClient();
  try {
    await runReset(prisma, dryRun);
  } finally {
    await prisma.$disconnect();
  }
}

async function runReset(prisma: PrismaClient, dryRun: boolean) {
  // Memorials to remove: everything except the permanent demo seed memorial.
  const testMemorials = await prisma.memorial.findMany({
    where: { isDemo: false },
    select: { id: true, slug: true },
  });
  const demoMemorials = await prisma.memorial.count({ where: { isDemo: true } });

  // Memorial-scoped deletes: child rows belonging to test memorials only, so
  // the demo seed memorial and its content survive untouched.
  const memorialWhere = { memorial: { isDemo: false } };
  const orderedDeletes: Array<[string, object]> = [
    ['FuneralResourceReservation', memorialWhere],
    ['MemorialAuditLog', memorialWhere],
    ['FuneralFeedback', memorialWhere],
    ['MemorialAccess', memorialWhere],
    ['FamilyInvitation', memorialWhere],
    ['MemorialPerformance', memorialWhere],
    ['MemorialView', memorialWhere],
    ['MemorialLocation', memorialWhere],
    ['Photo', memorialWhere],
    ['Tribute', memorialWhere],
    ['UsageLedger', memorialWhere],
    ['Payment', {}],
    ['CreditPurchase', {}],
    ['LegacyPayment', {}],
    ['Subscription', {}],
  ];

  console.log('\nPlanned removal:');
  console.log(`  test memorials        : ${fmt(testMemorials.length)}${demoMemorials ? `  (${demoMemorials} demo seed memorial kept)` : ''}`);

  if (dryRun) {
    console.log('\nDry-run preview (rows that would be removed):');
    for (const [model, where] of orderedDeletes) {
      const count = await countRows(prisma, model, where);
      console.log(`  ${model.padEnd(28)} ${fmt(count)}`);
    }
    console.log('\nDry run complete. No data was changed.');
    return;
  }

  console.log('\nRemoving records…');

  const summary: Record<string, number> = {};

  await prisma.$transaction(
    async (tx) => {
      // Break the CurrentMemorialPayment link so Payment rows can be removed
      // freely (the FK is ON DELETE SET NULL anyway).
      const cleared = await tx.memorial.updateMany({
        where: { paymentId: { not: null } },
        data: { paymentId: null },
      });
      summary['memorial.paymentId (unlinked)'] = cleared.count;

      // Children before parents, respecting foreign-key constraints.
      for (const [model, where] of orderedDeletes) {
        summary[model] = (summary[model] ?? 0) + (await deleteAll(tx, model, where));
      }

      // Parents last.
      summary['Memorial'] = (summary['Memorial'] ?? 0) + (await deleteAll(tx, 'Memorial', { isDemo: false }));

      // Reset generated test credits on every funeral home wallet.
      const creditReset = await tx.funeralHome.updateMany({
        data: {
          memorialCreditsPurchased: 0,
          memorialCreditsRemaining: 0,
          lastCreditPurchaseAt: null,
          trialMemorialsUsed: 0,
        },
      });
      summary['funeralHome (credit wallets reset)'] = creditReset.count;
    },
    { timeout: 120_000 },
  );

  // Remove orphaned media files on disk for the deleted memorials.
  let filesDeleted = 0;
  let bytesDeleted = 0;
  for (const memorial of testMemorials) {
    try {
      const removed = removeMemorialFiles(memorial.id);
      filesDeleted += removed.filesDeleted;
      bytesDeleted += removed.bytesDeleted;
    } catch (error) {
      console.error(`  ! could not clean up files for ${memorial.slug}: ${(error as Error).message}`);
    }
  }
  if (filesDeleted > 0) {
    summary['media files deleted'] = filesDeleted;
  }

  console.log('\nSummary — records removed:');
  for (const [model, count] of Object.entries(summary)) {
    console.log(`  ${model.padEnd(34)} ${fmt(count)}`);
  }
  if (filesDeleted > 0) {
    console.log(`  (${(bytesDeleted / 1024 / 1024).toFixed(2)} MB of media removed from disk)`);
  }

  // ── Verification ──────────────────────────────────────────────────────────
  // The Platform Revenue dashboard computes everything live from Payment and
  // CreditPurchase, so there is no materialized cache to regenerate. Recompute
  // the same figures here to confirm the dashboard will display zeros.
  console.log('\nVerification — platform revenue after reset:');
  const [payments, purchases] = await Promise.all([
    prisma.payment.findMany({ select: { amountCents: true, status: true, paidAt: true, createdAt: true } }),
    prisma.creditPurchase.findMany({ select: { amountCents: true, status: true, paidAt: true, createdAt: true } }),
  ]);
  const successful = payments.filter((p) => ['SUCCESS'].includes(p.status.toUpperCase()));
  const successfulPurchases = purchases.filter((p) => ['SUCCESS'].includes(p.status.toUpperCase()));
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const within = (d: Date | null, from: Date) => (d ?? new Date(0)).getTime() >= from.getTime();
  const revenue = (from?: Date) =>
    successful.filter((p) => !from || within(p.paidAt ?? p.createdAt, from)).reduce((s, p) => s + p.amountCents, 0) +
    successfulPurchases.filter((p) => !from || within(p.paidAt ?? p.createdAt, from)).reduce((s, p) => s + p.amountCents, 0);
  const thisYear = revenue(startOfYear);
  const thisMonth = revenue(startOfMonth);
  const lastMonth = revenue(prevMonthStart) - thisMonth;
  const growthPct = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

  const remainingMemorials = await prisma.memorial.count();
  const remainingPayments = await prisma.payment.count();
  const remainingCredits = await prisma.creditPurchase.count();
  const creditWalletsNonZero = await prisma.funeralHome.count({
    where: { OR: [{ memorialCreditsRemaining: { gt: 0 } }, { memorialCreditsPurchased: { gt: 0 } }] },
  });

  const ok = (cond: boolean) => (cond ? 'OK' : 'MISMATCH');
  console.log(`  Revenue this year      : ${money(thisYear)}   (${ok(thisYear === 0)})`);
  console.log(`  Revenue this month     : ${money(thisMonth)}   (${ok(thisMonth === 0)})`);
  console.log(`  Total captured         : ${String(successful.length + successfulPurchases.length).padStart(5)}   (${ok(successful.length + successfulPurchases.length === 0)})`);
  console.log(`  Month-over-month       : ${Math.round(growthPct * 10) / 10}%   (${ok(growthPct === 0)})`);
  console.log(`  Payments remaining     : ${remainingPayments}`);
  console.log(`  Credit purchases remain: ${remainingCredits}`);
  console.log(`  Memorials remaining    : ${remainingMemorials} (demo seed preserved)`);
  console.log(`  Homes with credit left : ${creditWalletsNonZero}`);

  const allZero =
    thisYear === 0 && thisMonth === 0 && successful.length + successfulPurchases.length === 0 && growthPct === 0 && remainingCredits === 0;
  console.log(allZero ? '\n✅ Reset verified: platform revenue dashboard will show zeros.' : '\n⚠️  Reset incomplete — please investigate the flagged values above.');
}

main()
  .catch((error) => {
    console.error('\nReset failed:', error);
    process.exitCode = 1;
  });
