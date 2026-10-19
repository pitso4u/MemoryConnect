import fs from 'fs';
import path from 'path';
import { env } from './env';

export function eventsUploadsDir(): string {
  const dir = path.isAbsolute(env.EVENTS_UPLOADS_DIR)
    ? env.EVENTS_UPLOADS_DIR
    : path.join(process.cwd(), env.EVENTS_UPLOADS_DIR);
  return dir;
}

export function ensureEventUploadsDir(eventId: string): string {
  const dir = path.join(eventsUploadsDir(), eventId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function eventPhotoPublicUrl(eventId: string, filename: string): string {
  return `/uploads/${eventId}/${filename}`;
}

export function createEventSlug(title: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'event';
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}
