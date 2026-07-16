import { prisma } from '../apps/api/src/lib/prisma';
import { permanentlyDeleteMemorial } from '../apps/api/src/lib/retention';

async function main() {
  const memorials = await prisma.memorial.findMany({
    where: { deleteAfter: { lt: new Date() } },
    select: { id: true },
  });
  let filesDeleted = 0;
  let bytesDeleted = 0;
  for (const memorial of memorials) {
    const removed = await permanentlyDeleteMemorial(memorial.id);
    filesDeleted += removed.filesDeleted;
    bytesDeleted += removed.bytesDeleted;
  }
  console.log(`Deleted ${memorials.length} memorial(s), ${filesDeleted} file(s), and ${bytesDeleted} byte(s).`);
}

main().finally(() => prisma.$disconnect());
