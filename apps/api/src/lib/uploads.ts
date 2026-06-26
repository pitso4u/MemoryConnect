import fs from 'fs';
import path from 'path';

export const UPLOADS_DIR = path.join(__dirname, '../../uploads');

export function ensureUploadsDir(memorialId: string): string {
  const dir = path.join(UPLOADS_DIR, memorialId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function photoPublicUrl(memorialId: string, filename: string): string {
  return `/uploads/${memorialId}/${filename}`;
}
