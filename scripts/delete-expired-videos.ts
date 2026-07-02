import { prisma } from '../apps/api/src/lib/prisma';
import { addDays } from '../apps/api/src/lib/publishing';
import { removeMemorialFiles } from '../apps/api/src/lib/retention';

async function main() {
  const cutoff = addDays(new Date(), -30);
  const memorials = await prisma.memorial.findMany({
    where: { publishedAt: { lt: cutoff }, videosDeletedAt: null, deletedAt: null },
    select: { id: true, storageBytes: true },
  });
  let filesDeleted = 0;
  let bytesDeleted = 0;
  for (const memorial of memorials) {
    const removed = removeMemorialFiles(memorial.id, true);
    filesDeleted += removed.filesDeleted;
    bytesDeleted += removed.bytesDeleted;
    await prisma.$transaction([
      prisma.photo.updateMany({ where: { memorialId: memorial.id, mediaType: 'VIDEO', deletedAt: null }, data: { deletedAt: new Date(), storageBytes: 0 } }),
      prisma.memorial.update({ where: { id: memorial.id }, data: { videosDeletedAt: new Date(), storageBytes: Math.max(0, memorial.storageBytes - removed.bytesDeleted) } }),
    ]);
  }
  console.log(`Cleaned videos for ${memorials.length} memorial(s): ${filesDeleted} file(s), ${bytesDeleted} byte(s).`);
}

main().finally(() => prisma.$disconnect());
