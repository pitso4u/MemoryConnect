import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticateEvents } from '../lib/auth';
import { createEventSlug } from '../lib/uploads';
import { env } from '../lib/env';
import { initializeEventsPayment, verifyEventsPayment } from '../lib/paystack';
import {
  completeEventPublishPayment,
  createEventPublishReference,
  EVENT_PUBLISH_CURRENCY,
  EVENT_PUBLISH_PRICE_CENTS,
  EVENT_PUBLISH_PURPOSE,
} from '../lib/publishing';
import { buildPerformancePayload, buildEventPerformanceSummary } from '../lib/performance';
import {
  createEventSchema,
  updateEventSchema,
  agendaItemSchema,
  locationSchema,
  messageSchema,
} from '@memorialconnect/event-shared';

const router = Router();
router.use(authenticateEvents);

function eventId(req: { params: { id?: string } }): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : (id as string);
}

async function requireOwnedEvent(organiserId: string, id: string) {
  return prisma.event.findFirst({ where: { id, organiserId } });
}

const fullInclude = {
  photos: { orderBy: { order: 'asc' as const } },
  messages: { orderBy: { createdAt: 'desc' as const } },
  locations: { orderBy: { order: 'asc' as const } },
  agenda: { orderBy: { order: 'asc' as const } },
};

// ── Event CRUD ───────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const events = await prisma.event.findMany({
    where: { organiserId: req.eventsUser!.organiserId },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { photos: true, messages: true } } },
  });
  res.json({ success: true, data: events });
});

router.post('/', async (req, res) => {
  try {
    const body = createEventSchema.parse(req.body);
    let slug = createEventSlug(body.title);
    while (await prisma.event.findUnique({ where: { slug } })) slug = createEventSlug(body.title);
    const event = await prisma.event.create({
      data: {
        slug,
        organiserId: req.eventsUser!.organiserId,
        eventType: body.eventType,
        title: body.title,
        description: body.description ?? null,
        hostName: body.hostName ?? null,
        startDateTime: body.startDateTime ? new Date(body.startDateTime) : null,
        endDateTime: body.endDateTime ? new Date(body.endDateTime) : null,
        timezone: body.timezone ?? 'Africa/Johannesburg',
        visibility: body.visibility ?? 'PUBLIC',
        coverImage: body.coverImage ?? null,
        theme: body.theme ?? 'CELEBRATION',
      },
      include: fullInclude,
    });
    res.status(201).json({ success: true, data: event });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'errors' in err) {
      const zerr = err as { errors: Array<{ message: string }> };
      return res.status(400).json({ success: false, error: zerr.errors[0]?.message ?? 'Invalid input' });
    }
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to create event' });
  }
});

router.get('/:id', async (req, res) => {
  const event = await prisma.event.findFirst({
    where: { id: eventId(req), organiserId: req.eventsUser!.organiserId },
    include: fullInclude,
  });
  if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
  res.json({ success: true, data: event });
});

router.patch('/:id', async (req, res) => {
  try {
    const body = updateEventSchema.parse(req.body);
    const existing = await requireOwnedEvent(req.eventsUser!.organiserId, eventId(req));
    if (!existing) return res.status(404).json({ success: false, error: 'Event not found' });
    const event = await prisma.event.update({
      where: { id: existing.id },
      data: {
        ...(body.eventType !== undefined ? { eventType: body.eventType } : {}),
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.hostName !== undefined ? { hostName: body.hostName } : {}),
        ...(body.startDateTime !== undefined
          ? { startDateTime: body.startDateTime ? new Date(body.startDateTime) : null }
          : {}),
        ...(body.endDateTime !== undefined
          ? { endDateTime: body.endDateTime ? new Date(body.endDateTime) : null }
          : {}),
        ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
        ...(body.visibility !== undefined ? { visibility: body.visibility } : {}),
        ...(body.coverImage !== undefined ? { coverImage: body.coverImage } : {}),
        ...(body.theme !== undefined ? { theme: body.theme } : {}),
      },
      include: fullInclude,
    });
    res.json({ success: true, data: event });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'errors' in err) {
      const zerr = err as { errors: Array<{ message: string }> };
      return res.status(400).json({ success: false, error: zerr.errors[0]?.message ?? 'Invalid input' });
    }
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to update event' });
  }
});

router.delete('/:id', async (req, res) => {
  const existing = await requireOwnedEvent(req.eventsUser!.organiserId, eventId(req));
  if (!existing) return res.status(404).json({ success: false, error: 'Event not found' });
  const pendingPayment = await prisma.eventPayment.findFirst({ where: { eventId: existing.id, purpose: EVENT_PUBLISH_PURPOSE, status: 'PENDING' } });
  if (pendingPayment) return res.status(409).json({ success: false, code: 'PAYMENT_PENDING', error: 'This event has a payment in progress. Confirm or cancel the checkout before archiving it.' });
  await prisma.event.update({ where: { id: existing.id }, data: { status: 'ARCHIVED' } });
  res.json({ success: true, data: { archived: true } });
});

// ── Publish (one-time R299.99 Events payment) ────────────────────────────────
// Lifecycle: DRAFT --verified payment--> PUBLISHED --expiry--> EXPIRED,
// --archive--> ARCHIVED. Each event is charged once; a paid event may be
// unpublished and republished without paying again.
const publishSchema = z.object({
  expiresAt: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid expiry date')
    .optional(),
});

router.post('/:id/publish', async (req, res) => {
  const existing = await requireOwnedEvent(req.eventsUser!.organiserId, eventId(req));
  if (!existing) return res.status(404).json({ success: false, error: 'Event not found' });
  if (existing.status === 'ARCHIVED') return res.status(409).json({ success: false, code: 'EVENT_ARCHIVED', error: 'Archived events cannot be published.' });
  const parsed = publishSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' });
  }
  const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
  if (expiresAt && expiresAt <= new Date()) {
    return res.status(400).json({ success: false, error: 'Expiry must be in the future' });
  }
  if (existing.status === 'PUBLISHED') {
    const event = await prisma.event.update({ where: { id: existing.id }, data: { expiresAt }, include: fullInclude });
    return res.json({ success: true, data: { event, alreadyPublished: true } });
  }

  const paid = await prisma.eventPayment.findFirst({ where: { eventId: existing.id, purpose: EVENT_PUBLISH_PURPOSE, status: 'SUCCESS' } });
  if (paid) {
    const event = await prisma.event.update({ where: { id: existing.id }, data: { status: 'PUBLISHED', publishedAt: new Date(), expiresAt }, include: fullInclude });
    return res.json({ success: true, data: { event, alreadyPaid: true } });
  }

  await prisma.event.update({ where: { id: existing.id }, data: { expiresAt } });

  if (!env.EVENTS_PAYSTACK_SECRET_KEY) {
    return res.status(503).json({ success: false, code: 'EVENTS_PAYMENTS_NOT_CONFIGURED', error: 'Events payments are not configured yet. Please contact support.' });
  }

  const pending = await prisma.eventPayment.findFirst({ where: { eventId: existing.id, purpose: EVENT_PUBLISH_PURPOSE, status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
  let previousPaymentFailed = false;
  if (pending?.providerRef) {
    try {
      const transaction = await verifyEventsPayment(pending.providerRef);
      if (transaction.status === 'success') {
        await completeEventPublishPayment(pending.providerRef, transaction);
        const event = await prisma.event.findUnique({ where: { id: existing.id }, include: fullInclude });
        return res.json({ success: true, data: { event, alreadyPaid: true } });
      }
      if (transaction.status === 'failed') {
        await prisma.eventPayment.update({ where: { id: pending.id }, data: { status: 'FAILED', checkoutKey: null } });
        previousPaymentFailed = true;
      }
    } catch {
      // The existing checkout remains valid. Return it instead of creating
      // another charge while its payment status is still unresolved.
      if (pending.authorizationUrl) return res.json({ success: true, data: { authorizationUrl: pending.authorizationUrl, reference: pending.providerRef, amountCents: pending.amountCents, currency: pending.currency, resumed: true } });
      return res.status(409).json({ success: false, code: 'PAYMENT_PENDING', error: 'A publishing payment is already being prepared. Please try again shortly.' });
    }
    if (pending.authorizationUrl && !previousPaymentFailed) return res.json({ success: true, data: { authorizationUrl: pending.authorizationUrl, reference: pending.providerRef, amountCents: pending.amountCents, currency: pending.currency, resumed: true } });
  }
  if (pending && !previousPaymentFailed) await prisma.eventPayment.update({ where: { id: pending.id }, data: { status: 'ABANDONED', checkoutKey: null } });

  const reference = createEventPublishReference(existing.id);
  let payment: Awaited<ReturnType<typeof prisma.eventPayment.create>>;
  try {
    payment = await prisma.eventPayment.create({
      data: { eventId: existing.id, purpose: EVENT_PUBLISH_PURPOSE, status: 'PENDING', amountCents: EVENT_PUBLISH_PRICE_CENTS, currency: EVENT_PUBLISH_CURRENCY, providerRef: reference, checkoutKey: existing.id },
    });
  } catch (error) {
    if ((error as { code?: string })?.code !== 'P2002') throw error;
    const current = await prisma.eventPayment.findFirst({ where: { eventId: existing.id, purpose: EVENT_PUBLISH_PURPOSE, status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
    if (current?.authorizationUrl && current.providerRef) {
      return res.json({ success: true, data: { authorizationUrl: current.authorizationUrl, reference: current.providerRef, amountCents: current.amountCents, currency: current.currency, resumed: true } });
    }
    return res.status(409).json({ success: false, code: 'PAYMENT_PENDING', error: 'A publishing payment is already being prepared. Please try again shortly.' });
  }
  try {
    const publicUrl = env.EVENTS_PUBLIC_URL.replace(/\/$/, '');
    const checkout = await initializeEventsPayment({
      email: req.eventsUser!.email!,
      amountCents: EVENT_PUBLISH_PRICE_CENTS,
      reference,
      callbackUrl: `${publicUrl}/events/${existing.id}?reference=${encodeURIComponent(reference)}`,
      metadata: { purpose: EVENT_PUBLISH_PURPOSE, eventId: existing.id, organiserId: existing.organiserId },
    });
    await prisma.eventPayment.update({ where: { id: payment.id }, data: { authorizationUrl: checkout.authorization_url } });
    res.json({ success: true, data: { authorizationUrl: checkout.authorization_url, reference, amountCents: EVENT_PUBLISH_PRICE_CENTS, currency: EVENT_PUBLISH_CURRENCY } });
  } catch (error) {
    await prisma.eventPayment.update({ where: { id: payment.id }, data: { status: 'FAILED', checkoutKey: null } });
    console.error('Initialize event publishing payment error:', error);
    res.status(502).json({ success: false, code: 'PAYMENT_INITIALIZATION_FAILED', error: 'Paystack could not start the publishing payment. No charge was completed.' });
  }
});

router.get('/:id/verify-publish-payment/:reference', async (req, res) => {
  const existing = await requireOwnedEvent(req.eventsUser!.organiserId, eventId(req));
  if (!existing) return res.status(404).json({ success: false, error: 'Event not found' });
  const reference = Array.isArray(req.params.reference) ? req.params.reference[0] : req.params.reference;
  const payment = await prisma.eventPayment.findFirst({ where: { eventId: existing.id, purpose: EVENT_PUBLISH_PURPOSE, providerRef: reference } });
  if (!payment) return res.status(404).json({ success: false, error: 'Publishing payment not found' });
  try {
    const transaction = await verifyEventsPayment(reference);
    await completeEventPublishPayment(reference, transaction);
    const event = await prisma.event.findUnique({ where: { id: existing.id }, include: fullInclude });
    res.json({ success: true, data: event });
  } catch (error) {
    res.status(402).json({ success: false, code: 'PAYMENT_NOT_CONFIRMED', error: error instanceof Error ? error.message : 'Payment could not be verified' });
  }
});

router.post('/:id/unpublish', async (req, res) => {
  const existing = await requireOwnedEvent(req.eventsUser!.organiserId, eventId(req));
  if (!existing) return res.status(404).json({ success: false, error: 'Event not found' });
  const event = await prisma.event.update({
    where: { id: existing.id },
    data: { status: 'DRAFT' },
    include: fullInclude,
  });
  res.json({ success: true, data: event });
});

// ── Agenda (generic items, no funeral enums) ─────────────────────────────────

router.post('/:id/agenda', async (req, res) => {
  try {
    const body = agendaItemSchema.parse(req.body);
    const existing = await requireOwnedEvent(req.eventsUser!.organiserId, eventId(req));
    if (!existing) return res.status(404).json({ success: false, error: 'Event not found' });
    const count = await prisma.eventAgendaItem.count({ where: { eventId: existing.id } });
    const item = await prisma.eventAgendaItem.create({
      data: {
        eventId: existing.id,
        title: body.title,
        description: body.description ?? null,
        startTime: body.startTime ?? null,
        endTime: body.endTime ?? null,
        location: body.location ?? null,
        order: body.order ?? count,
      },
    });
    res.status(201).json({ success: true, data: item });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'errors' in err) {
      const zerr = err as { errors: Array<{ message: string }> };
      return res.status(400).json({ success: false, error: zerr.errors[0]?.message ?? 'Invalid input' });
    }
    res.status(500).json({ success: false, error: 'Failed to add agenda item' });
  }
});

router.delete('/:id/agenda/:itemId', async (req, res) => {
  const existing = await requireOwnedEvent(req.eventsUser!.organiserId, eventId(req));
  if (!existing) return res.status(404).json({ success: false, error: 'Event not found' });
  const itemId = Array.isArray(req.params.itemId) ? req.params.itemId[0] : req.params.itemId;
  await prisma.eventAgendaItem.deleteMany({ where: { id: itemId, eventId: existing.id } });
  res.json({ success: true, data: { deleted: true } });
});

// ── Locations ────────────────────────────────────────────────────────────────

router.post('/:id/locations', async (req, res) => {
  try {
    const body = locationSchema.parse(req.body);
    const existing = await requireOwnedEvent(req.eventsUser!.organiserId, eventId(req));
    if (!existing) return res.status(404).json({ success: false, error: 'Event not found' });
    const count = await prisma.eventLocation.count({ where: { eventId: existing.id } });
    const location = await prisma.eventLocation.create({
      data: {
        eventId: existing.id,
        name: body.name,
        address: body.address ?? null,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        notes: body.notes ?? null,
        order: body.order ?? count,
      },
    });
    res.status(201).json({ success: true, data: location });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'errors' in err) {
      const zerr = err as { errors: Array<{ message: string }> };
      return res.status(400).json({ success: false, error: zerr.errors[0]?.message ?? 'Invalid input' });
    }
    res.status(500).json({ success: false, error: 'Failed to add location' });
  }
});

router.delete('/:id/locations/:locationId', async (req, res) => {
  const existing = await requireOwnedEvent(req.eventsUser!.organiserId, eventId(req));
  if (!existing) return res.status(404).json({ success: false, error: 'Event not found' });
  const locationId = Array.isArray(req.params.locationId) ? req.params.locationId[0] : req.params.locationId;
  await prisma.eventLocation.deleteMany({ where: { id: locationId, eventId: existing.id } });
  res.json({ success: true, data: { deleted: true } });
});

// ── Guest messages moderation ────────────────────────────────────────────────

const moderateSchema = z.object({ approved: z.boolean() });

router.patch('/:id/messages/:messageId', async (req, res) => {
  const body = moderateSchema.parse(req.body);
  const existing = await requireOwnedEvent(req.eventsUser!.organiserId, eventId(req));
  if (!existing) return res.status(404).json({ success: false, error: 'Event not found' });
  const messageId = Array.isArray(req.params.messageId) ? req.params.messageId[0] : req.params.messageId;
  const updated = await prisma.eventMessage.updateMany({
    where: { id: messageId, eventId: existing.id },
    data: { approved: body.approved },
  });
  if (updated.count === 0) return res.status(404).json({ success: false, error: 'Message not found' });
  res.json({ success: true, data: { approved: body.approved } });
});

router.delete('/:id/messages/:messageId', async (req, res) => {
  const existing = await requireOwnedEvent(req.eventsUser!.organiserId, eventId(req));
  if (!existing) return res.status(404).json({ success: false, error: 'Event not found' });
  const messageId = Array.isArray(req.params.messageId) ? req.params.messageId[0] : req.params.messageId;
  await prisma.eventMessage.deleteMany({ where: { id: messageId, eventId: existing.id } });
  res.json({ success: true, data: { deleted: true } });
});

router.get('/:id/analytics', async (req, res) => {
  const existing = await requireOwnedEvent(req.eventsUser!.organiserId, eventId(req));
  if (!existing) return res.status(404).json({ success: false, error: 'Event not found' });
  const [views, byType] = await Promise.all([
    prisma.eventView.count({ where: { eventId: existing.id } }),
    prisma.analyticsEvent.groupBy({ by: ['type'], where: { eventId: existing.id }, _count: { type: true } }),
  ]);
  const counts: Record<string, number> = { views };
  for (const row of byType) counts[row.type] = row._count.type;
  res.json({
    success: true,
    data: { viewCount: existing.viewCount, uniqueVisitors: views, events: counts },
  });
});

// 72-hour performance analytics (mirrors MemorialConnect's :id/analytics/performance)
router.get('/:id/analytics/performance', async (req, res) => {
  const existing = await requireOwnedEvent(req.eventsUser!.organiserId, eventId(req));
  if (!existing) return res.status(404).json({ success: false, error: 'Event not found' });
  if (!existing.publishedAt) {
    return res.json({ success: true, data: { publishedAt: null, days: [], totals: {}, monitoringActive: false, finalized: false, milestones: [], trend: [], snapshots: [] } });
  }
  const payload = await buildPerformancePayload({ id: existing.id, publishedAt: existing.publishedAt });
  res.json({ success: true, data: payload });
});

// Platform-owner 72-hour performance summary: trending events across the organiser's account
router.get('/:id/analytics/performance-summary', async (req, res) => {
  const existing = await requireOwnedEvent(req.eventsUser!.organiserId, eventId(req));
  if (!existing) return res.status(404).json({ success: false, error: 'Event not found' });
  const summary = await buildEventPerformanceSummary(req.eventsUser!.organiserId);
  res.json({ success: true, data: summary });
});

export { messageSchema };
export default router;
