import { afterAll, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';
import express from 'express';
import request from 'supertest';
import memorialRoutes from '../routes/memorials';
import publicRoutes from '../routes/public';
import { signToken } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import {
  addHours,
  completePublishPayment,
  MEMORIAL_STATUS,
  PAYMENT_PURPOSE,
  PUBLISH_PRICE_CENTS,
  verifyPaystackSignature,
} from '../lib/publishing';

const app = express();
app.use(express.json());
app.use('/api/v1/memorials', memorialRoutes);
app.use('/api/v1/public', publicRoutes);

async function home(label: string) {
  const funeralHome = await prisma.funeralHome.create({ data: { name: label, email: `${label}-${Date.now()}@example.com` } });
  const token = signToken({ userId: `user-${label}`, funeralHomeId: funeralHome.id, role: 'admin' });
  return { funeralHome, token };
}

async function draft(funeralHomeId: string, label: string) {
  return prisma.memorial.create({
    data: {
      slug: `${label}-${Date.now()}`,
      deceasedName: label,
      serviceDate: new Date('2026-07-04T10:00:00Z'),
      serviceVenue: 'Community Hall',
      funeralHomeId,
      programme: [],
      announcements: [],
      settings: { showTributeWall: true },
    },
  });
}

describe('pay-per-funeral lifecycle', () => {
  it('verifies Paystack webhook signatures', () => {
    const body = Buffer.from('{"event":"charge.success"}');
    const signature = crypto.createHmac('sha512', 'sk_test_memory_connect').update(body).digest('hex');
    expect(verifyPaystackSignature(body, signature)).toBe(true);
    expect(verifyPaystackSignature(body, '0'.repeat(128))).toBe(false);
  });

  it('serves a permanent sample memorial and projector', async () => {
    const memorial = await request(app).get('/api/v1/public/memorials/demo');
    expect(memorial.status).toBe(200);
    expect(memorial.body.data).toMatchObject({ slug: 'demo', deceasedName: 'Nomvula Dlamini' });

    const projector = await request(app).get('/api/v1/public/memorials/demo/projector');
    expect(projector.status).toBe(200);
    expect(projector.body.data.totalItems).toBeGreaterThan(0);
  });

  it('allows a signed private preview without publishing or counting a public view', async () => {
    const { funeralHome, token } = await home('private-preview');
    const memorial = await draft(funeralHome.id, 'Preview Test');
    const publicAttempt = await request(app).get(`/api/v1/public/memorials/${memorial.slug}`);
    expect(publicAttempt.status).toBe(410);

    const previewToken = await request(app)
      .get(`/api/v1/memorials/${memorial.id}/preview-token`)
      .set('Authorization', `Bearer ${token}`);
    expect(previewToken.status).toBe(200);

    const preview = await request(app)
      .get(`/api/v1/public/memorials/${memorial.slug}`)
      .query({ preview: previewToken.body.data.token });
    expect(preview.status).toBe(200);
    expect(preview.body.data.isPreview).toBe(true);
    expect((await prisma.memorial.findUniqueOrThrow({ where: { id: memorial.id } })).viewCount).toBe(0);

    const projector = await request(app)
      .get(`/api/v1/public/memorials/${memorial.slug}/projector`)
      .query({ preview: previewToken.body.data.token });
    expect(projector.status).toBe(200);
    await prisma.funeralHome.delete({ where: { id: funeralHome.id } });
  });

  it('creates, edits, and permanently deletes free drafts', async () => {
    const { funeralHome, token } = await home('draft-flow');
    const created = await request(app).post('/api/v1/memorials').set('Authorization', `Bearer ${token}`).send({ deceasedName: 'Nomsa Dlamini' });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe(MEMORIAL_STATUS.DRAFT);
    const edited = await request(app).patch(`/api/v1/memorials/${created.body.data.id}`).set('Authorization', `Bearer ${token}`).send({ obituary: 'A life well lived.' });
    expect(edited.status).toBe(200);
    const removed = await request(app).delete(`/api/v1/memorials/${created.body.data.id}`).set('Authorization', `Bearer ${token}`);
    expect(removed.status).toBe(200);
    expect(await prisma.memorial.findUnique({ where: { id: created.body.data.id } })).toBeNull();
    await prisma.funeralHome.delete({ where: { id: funeralHome.id } });
  });

  it('initializes exactly R299.99 with Paystack and does not publish on redirect initialization', async () => {
    const { funeralHome, token } = await home('initialize');
    const memorial = await draft(funeralHome.id, 'Payment Test');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      status: true,
      message: 'Authorization URL created',
      data: { authorization_url: 'https://checkout.paystack.com/test', access_code: 'access', reference: 'ignored' },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const response = await request(app).post(`/api/v1/memorials/${memorial.id}/initialize-publish-payment`).set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.amount).toBe(String(PUBLISH_PRICE_CENTS));
    expect(body.currency).toBe('ZAR');
    const pending = await prisma.memorial.findUniqueOrThrow({ where: { id: memorial.id } });
    expect(pending.status).toBe(MEMORIAL_STATUS.PAID_PENDING);
    expect(pending.publishedAt).toBeNull();
    fetchMock.mockRestore();
    await prisma.funeralHome.delete({ where: { id: funeralHome.id } });
  });

  it('publishes only after verified success and sets 72-hour, 30-day, and 90-day dates', async () => {
    const { funeralHome } = await home('success');
    const memorial = await draft(funeralHome.id, 'Published Test');
    const payment = await prisma.payment.create({ data: { funeralHomeId: funeralHome.id, memorialId: memorial.id, purpose: PAYMENT_PURPOSE, paystackReference: `ref-${Date.now()}` } });
    const published = await completePublishPayment(payment.paystackReference, {
      id: 1, status: 'success', reference: payment.paystackReference, amount: 29999, currency: 'ZAR', paid_at: new Date().toISOString(),
    });
    expect(published.status).toBe(MEMORIAL_STATUS.PUBLISHED);
    expect(published.publicExpiresAt!.getTime() - published.publishedAt!.getTime()).toBe(30 * 86400000);
    expect(published.deleteAfter!.getTime() - published.publishedAt!.getTime()).toBe(90 * 86400000);
    expect(published.editLocksAt!.getTime() - published.publishedAt!.getTime()).toBe(72 * 3600000);
    await prisma.funeralHome.delete({ where: { id: funeralHome.id } });
  });

  it('allows edits before the lock and blocks edits and deletion after it', async () => {
    const { funeralHome, token } = await home('lock');
    const memorial = await draft(funeralHome.id, 'Lock Test');
    await prisma.memorial.update({ where: { id: memorial.id }, data: { status: MEMORIAL_STATUS.PUBLISHED, editLocksAt: addHours(new Date(), 1), publicExpiresAt: addHours(new Date(), 24) } });
    expect((await request(app).patch(`/api/v1/memorials/${memorial.id}`).set('Authorization', `Bearer ${token}`).send({ obituary: 'Correction' })).status).toBe(200);
    await prisma.memorial.update({ where: { id: memorial.id }, data: { editLocksAt: addHours(new Date(), -1) } });
    expect((await request(app).patch(`/api/v1/memorials/${memorial.id}`).set('Authorization', `Bearer ${token}`).send({ obituary: 'Too late' })).status).toBe(423);
    expect((await request(app).delete(`/api/v1/memorials/${memorial.id}`).set('Authorization', `Bearer ${token}`)).status).toBe(423);
    await prisma.funeralHome.delete({ where: { id: funeralHome.id } });
  });

  it('shows the deceased photo publicly, increments analytics, and blocks expired viewing', async () => {
    const { funeralHome, token } = await home('views');
    const memorial = await draft(funeralHome.id, 'View Test');
    await prisma.memorial.update({ where: { id: memorial.id }, data: { status: MEMORIAL_STATUS.PUBLISHED, deceasedPhotoUrl: '/uploads/photo.jpg', publicExpiresAt: addHours(new Date(), 24) } });
    const publicView = await request(app).get(`/api/v1/public/memorials/${memorial.slug}`);
    expect(publicView.status).toBe(200);
    expect(publicView.body.data.deceasedPhotoUrl).toBe('/uploads/photo.jpg');
    expect((await prisma.memorial.findUniqueOrThrow({ where: { id: memorial.id } })).viewCount).toBe(1);
    const analytics = await request(app).get(`/api/v1/memorials/${memorial.id}/analytics`).set('Authorization', `Bearer ${token}`);
    expect(analytics.body.data.totalViews).toBe(1);
    await prisma.memorial.update({ where: { id: memorial.id }, data: { status: MEMORIAL_STATUS.EXPIRED, publicExpiresAt: addHours(new Date(), -1) } });
    const expired = await request(app).get(`/api/v1/public/memorials/${memorial.slug}`);
    expect(expired.status).toBe(410);
    expect(expired.body.message).toBe('This memorial viewing period has ended.');
    await prisma.funeralHome.delete({ where: { id: funeralHome.id } });
  });
});

afterAll(async () => prisma.$disconnect());
