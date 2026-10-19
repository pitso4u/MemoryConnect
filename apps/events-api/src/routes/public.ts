import { Router } from 'express';
import QRCode from 'qrcode';
import { z } from 'zod';
import { Prisma } from '../../generated-client';
import { prisma } from '../lib/prisma';
import { env } from '../lib/env';
import { messageSchema } from '@memorialconnect/event-shared';
import { eventsVisitorHash, isExpired, isLikelyBot, isPubliclyViewable } from '../lib/analytics';
import { applyPerformanceEvent, finalizeDueEvents } from '../lib/performance';
import { engagementLimiter, messageLimiter } from '../lib/rateLimit';
import { isZodError, zodMessage } from '../lib/validation';

const router = Router();

type VisibilityRow = { status: string; expiresAt: Date | null } | null;
type StatusRes = {
  status: (code: number) => { json: (body: unknown) => unknown };
  json: (body: unknown) => unknown;
};

// DRAFT and ARCHIVED are never publicly accessible (404 — no existence leak).
// PUBLISHED with a past expiresAt is explicitly EXPIRED (410).
function visibilityCheck(event: VisibilityRow, res: StatusRes): 'ok' | 'done' {
  if (!event || event.status === 'DRAFT' || event.status === 'ARCHIVED') {
    res.status(404).json({ success: false, error: 'Event not found' });
    return 'done';
  }
  if (!isPubliclyViewable(event.status, event.expiresAt)) {
    if (event.status === 'PUBLISHED' && isExpired(event.expiresAt)) {
      res.status(410).json({ success: false, error: 'This event page has expired.', code: 'EVENT_EXPIRED' });
    } else {
      res.status(404).json({ success: false, error: 'Event not found' });
    }
    return 'done';
  }
  return 'ok';
}

const publicInclude = {
  photos: { orderBy: { order: 'asc' } },
  messages: { where: { approved: true }, orderBy: { createdAt: 'desc' } },
  locations: { orderBy: { order: 'asc' } },
  agenda: { orderBy: { order: 'asc' } },
} satisfies Prisma.EventInclude;

const viewSchema = z.object({ visitorId: z.string().trim().min(12).max(200) });

function slugOf(req: { params: { slug?: string } }): string {
  return Array.isArray(req.params.slug) ? req.params.slug[0] : (req.params.slug as string);
}

router.get('/events/:slug', async (req, res) => {
  const event = await prisma.event.findUnique({ where: { slug: slugOf(req) }, include: publicInclude });
  if (visibilityCheck(event, res) !== 'ok' || !event) return;
  res.json({ success: true, data: event });
});

router.get('/events/:slug/qr', async (req, res) => {
  const event = await prisma.event.findUnique({ where: { slug: slugOf(req) } });
  if (visibilityCheck(event, res) !== 'ok' || !event) return;
  const url = `${env.EVENTS_PUBLIC_URL}/${event.slug}`;
  const png = await QRCode.toBuffer(url, { width: 512, margin: 2 });
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(png);
});

router.post('/events/:slug/view', engagementLimiter, async (req, res) => {
  try {
    const body = viewSchema.parse(req.body || {});
    const event = await prisma.event.findUnique({ where: { slug: slugOf(req) } });
    if (visibilityCheck(event, res) !== 'ok' || !event) return;
    const userAgent = req.get('user-agent')?.slice(0, 500) || null;
    if (isLikelyBot(userAgent)) return res.json({ success: true, data: { counted: false } });
    const hash = eventsVisitorHash(body.visitorId);
    const now = new Date();
    let counted = false;
    const updated = await prisma.$transaction(async (tx) => {
      try {
        await tx.eventView.create({ data: { eventId: event.id, visitorHash: hash, userAgent, createdAt: now } });
        counted = true;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          counted = false;
          return event;
        }
        throw error;
      }
      const updatedEvent = await tx.event.update({ where: { id: event.id }, data: { viewCount: { increment: 1 } } });
      await applyPerformanceEvent(tx, { id: event.id, publishedAt: event.publishedAt }, 'view', { visitorHash: hash, now }).catch(() => undefined);
      return updatedEvent;
    });
    res.json({ success: true, data: { counted, viewCount: updated.viewCount } });
  } catch (error) {
    if (isZodError(error)) {
      return res.status(400).json({ success: false, error: zodMessage(error) });
    }
    console.error(error);
    res.status(500).json({ success: false, error: 'Failed to record view' });
  }
});

async function recordEngagement(slug: string, type: 'qr_scan' | 'share', res: StatusRes) {
  const event = await prisma.event.findUnique({ where: { slug } });
  if (visibilityCheck(event, res) !== 'ok' || !event) return;
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.analyticsEvent.create({ data: { eventId: event.id, type, createdAt: now } });
    await applyPerformanceEvent(tx, { id: event.id, publishedAt: event.publishedAt }, type, { visitorHash: null, now }).catch(() => undefined);
  });
  return res.json({ success: true, data: { counted: true } });
}

router.post('/events/:slug/qr-scan', engagementLimiter, async (req, res) => {
  try {
    await recordEngagement(slugOf(req), 'qr_scan', res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Failed to record scan' });
  }
});

router.post('/events/:slug/share', engagementLimiter, async (req, res) => {
  try {
    await recordEngagement(slugOf(req), 'share', res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Failed to record share' });
  }
});

router.post('/events/:slug/messages', messageLimiter, async (req, res) => {
  try {
    const body = messageSchema.parse(req.body);
    const event = await prisma.event.findUnique({ where: { slug: slugOf(req) } });
    if (visibilityCheck(event, res) !== 'ok' || !event) return;
    if (event.isDemo) {
      return res.status(403).json({ success: false, error: 'Messages are disabled on example pages.' });
    }
    // v1: auto-approve guest messages for celebration flow; organiser can delete.
    // Spam protection: per-IP rate limit (messageLimiter) + 1000-char cap (schema).
    const created = await prisma.eventMessage.create({
      data: { eventId: event.id, authorName: body.authorName.trim(), message: body.message.trim(), approved: true },
    });
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (isZodError(error)) {
      return res.status(400).json({ success: false, error: zodMessage(error) });
    }
    console.error(error);
    res.status(500).json({ success: false, error: 'Failed to submit message' });
  }
});

// Performance maintenance: finalize closed 72-hour windows.
router.get('/performance/maintenance', async (_req, res) => {
  const finalized = await finalizeDueEvents().catch(() => 0);
  res.json({ success: true, data: { finalized } });
});

export default router;
