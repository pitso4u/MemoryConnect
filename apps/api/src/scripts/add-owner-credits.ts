import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const OWNER_EMAIL = 'memoryconnect.platform@gmail.com';
const CREDITS_TO_ADD = 100;
const CREDIT_PRICE_CENTS = CREDITS_TO_ADD * 29_999; // R299.99 for 100 credits

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
  return withoutScheme;
}

function createCreditPurchaseReference(funeralHomeId: string) {
  return `mc-credits-${funeralHomeId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

async function main() {
  const confirm = hasArg('--confirm', '--yes');
  const production = isProductionEnvironment();
  const dbUrl = process.env.DATABASE_URL ?? '';

  console.log('─'.repeat(72));
  console.log('MemoryConnect Owner Demo Credits Addition');
  console.log('─'.repeat(72));
  console.log(`Environment: ${production ? 'PRODUCTION' : process.env.NODE_ENV || 'development'}`);
  console.log(`Database: ${resolveDatabasePath(dbUrl)}`);
  
  if (production) {
    console.log(`Confirm flag: ${confirm ? 'yes' : 'NO'}`);
    if (!confirm) {
      console.error('\nRefusing to run: production environment detected. Pass --confirm to proceed.');
      process.exit(1);
    }
  }

  const prisma = new PrismaClient();
  try {
    await runCreditAddition(prisma, production || !confirm);
  } finally {
    await prisma.$disconnect();
  }
}

async function runCreditAddition(prisma: PrismaClient, dryRun: boolean) {
  const home = await prisma.funeralHome.findUnique({
    where: { email: OWNER_EMAIL },
    select: {
      id: true,
      name: true,
      email: true,
      memorialCreditsRemaining: true,
      memorialCreditsPurchased: true,
    },
  });

  if (!home) {
    console.error(`\n❌ Error: No funeral home found with email "${OWNER_EMAIL}"`);
    process.exit(1);
  }

  console.log(`\nFound account:`);
  console.log(`  Funeral Home: ${home.name}`);
  console.log(`  Email: ${home.email}`);
  console.log(`  ID: ${home.id}`);
  console.log(`  Current memorialCreditsRemaining: ${home.memorialCreditsRemaining}`);
  console.log(`  Current memorialCreditsPurchased: ${home.memorialCreditsPurchased}`);
  console.log(`\nCredits to add: ${CREDITS_TO_ADD}`);

  if (dryRun) {
    console.log('\nDry-run preview (no changes made):');
    console.log(`  Would update memorialCreditsRemaining: ${home.memorialCreditsRemaining} → ${home.memorialCreditsRemaining + CREDITS_TO_ADD}`);
    console.log(`  Would update memorialCreditsPurchased: ${home.memorialCreditsPurchased} → ${home.memorialCreditsPurchased + CREDITS_TO_ADD}`);
    return;
  }

  const reference = createCreditPurchaseReference(home.id);
  const now = new Date();
  
  const [updatedHome, creditPurchase] = await prisma.$transaction([
    prisma.funeralHome.update({
      where: { email: OWNER_EMAIL },
      data: {
        memorialCreditsRemaining: { increment: CREDITS_TO_ADD },
        memorialCreditsPurchased: { increment: CREDITS_TO_ADD },
        lastCreditPurchaseAt: now,
      },
      select: {
        name: true,
        email: true,
        memorialCreditsRemaining: true,
        memorialCreditsPurchased: true,
      },
    }),
    prisma.creditPurchase.create({
      data: {
        funeralHomeId: home.id,
        credits: CREDITS_TO_ADD,
        amountCents: CREDIT_PRICE_CENTS,
        currency: 'ZAR',
        status: 'SUCCESS',
        paystackReference: reference,
        paidAt: now,
        createdAt: now,
        updatedAt: now,
      },
    }),
  ]);

  console.log('\n✅ Credits added successfully!');
  console.log(`  Updated memorialCreditsRemaining: ${updatedHome.memorialCreditsRemaining}`);
  console.log(`  Updated memorialCreditsPurchased: ${updatedHome.memorialCreditsPurchased}`);
  console.log(`  Created CreditPurchase record: ${creditPurchase.id}`);
  console.log(`  Purpose: OWNER_DEMO allocation (for advertising samples and demonstrations)`);
}

main().catch((error) => {
  console.error('\nError:', error);
  process.exitCode = 1;
});