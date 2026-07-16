import { prisma } from '../apps/api/src/lib/prisma';
import { MEMORIAL_STATUS } from '../apps/api/src/lib/publishing';

async function main() {
  const result = await prisma.memorial.updateMany({
    where: {
      status: { in: [MEMORIAL_STATUS.PUBLISHED, MEMORIAL_STATUS.LOCKED] },
      publicExpiresAt: { lt: new Date() },
      deletedAt: null,
    },
    data: { status: MEMORIAL_STATUS.EXPIRED },
  });
  console.log(`Expired ${result.count} public memorial(s).`);
}

main().finally(() => prisma.$disconnect());
