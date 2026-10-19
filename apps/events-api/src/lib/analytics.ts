import crypto from 'crypto';
import { env } from './env';

export function isLikelyBot(userAgent?: string | null): boolean {
  if (!userAgent) return true;
  return /bot|crawler|spider|preview|facebookexternalhit|whatsapp|slackbot|telegrambot|headless/i.test(userAgent);
}

export function eventsVisitorHash(visitorId: string): string {
  return crypto.createHash('sha256').update(`${env.EVENTS_JWT_SECRET}:events-visitor:${visitorId}`).digest('hex');
}

// Explicit Events lifecycle (NOT Memorial's 30/90-day rules):
// DRAFT --publish--> PUBLISHED --expiry--> EXPIRED, --archive--> ARCHIVED.
// Only PUBLISHED with no past expiresAt is publicly viewable.
export function isExpired(expiresAt: Date | null | undefined, now = new Date()): boolean {
  return Boolean(expiresAt && expiresAt <= now);
}

export function isPubliclyViewable(
  status: string,
  expiresAt?: Date | null,
  now = new Date(),
): boolean {
  return status === 'PUBLISHED' && !isExpired(expiresAt, now);
}
