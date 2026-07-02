import fs from 'fs';
import path from 'path';
import { prisma } from './prisma';
import { UPLOADS_DIR } from './uploads';

export function removeMemorialFiles(memorialId: string, onlyVideos = false) {
  const directory = path.resolve(UPLOADS_DIR, memorialId);
  const uploadsRoot = path.resolve(UPLOADS_DIR) + path.sep;
  if (!directory.startsWith(uploadsRoot) || !fs.existsSync(directory)) return { filesDeleted: 0, bytesDeleted: 0 };

  let filesDeleted = 0;
  let bytesDeleted = 0;
  const videoExtensions = new Set(['.mp4', '.mov', '.webm', '.avi', '.mkv']);
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const filePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(filePath);
        if (onlyVideos && fs.readdirSync(filePath).length === 0) fs.rmdirSync(filePath);
        continue;
      }
      if (onlyVideos && !videoExtensions.has(path.extname(entry.name).toLowerCase())) continue;
      const stat = fs.statSync(filePath);
      fs.unlinkSync(filePath);
      filesDeleted += 1;
      bytesDeleted += stat.size;
    }
  };
  walk(directory);
  if (!onlyVideos) fs.rmSync(directory, { recursive: true, force: true });
  return { filesDeleted, bytesDeleted };
}

export async function permanentlyDeleteMemorial(memorialId: string) {
  const removed = removeMemorialFiles(memorialId);
  await prisma.$transaction(async (tx) => {
    await tx.memorial.update({ where: { id: memorialId }, data: { paymentId: null } });
    await tx.memorial.delete({ where: { id: memorialId } });
  });
  return removed;
}
