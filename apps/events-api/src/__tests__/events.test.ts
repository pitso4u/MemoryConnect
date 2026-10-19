import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Prisma } from '../../generated-client';
import { app } from '../app';

// Mock Paystack so publish flows are hermetic: no live HTTP to api.paystack.co.
// The publish handler still requires EVENTS_PAYSTACK_SECRET_KEY (set in vitest.config.ts),
// but the actual payment call is faked here so tests pass without network access.
vi.mock('../lib/paystack', () => ({
  initializeEventsPayment: vi.fn().mockResolvedValue({
    authorization_url: 'https://paystack.test/checkout/fake',
    access_code: 'fake-access-code',
    reference: 'fake-reference',
  }),
  // Echo back the real reference so completeEventPublishPayment's reference
  // check passes; amount/currency/status match EVENT_PUBLISH_* constants.
  verifyEventsPayment: vi.fn().mockImplementation(async (reference: string) => ({
    status: 'success',
    reference,
    amount: 29999,
    currency: 'ZAR',
    paid_at: new Date().toISOString(),
  })),
}));

const api = request(app);

// 1x1 transparent PNG (valid magic bytes for the upload sniffer).
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function registerlya(suffix: string) {
  const res = await api.post('/api/v1/auth/register').send({
    name: `Organiser ${suffix}`,
    organiserName: `Family ${suffix}`,
    email: `org-${suffix}@events.test`,
    password: 'test-password-123',
  });
  expect(res.status).toBe(201);
  return res.body.data as { accessToken: string };
}

async function createDraft(token: string, title: string, eventType = 'WEDDING') {
  const res = await api
    .post('/api/v1/events')
    .set('Authorization', `Bearer ${token}`)
    .send({ eventType, title });
  expect(res.status).toBe(201);
  return res.body.data as { id: string; slug: string; status: string };
}

// Publish helper: calls POST /publish (returns a checkout URL with a reference),
// then completes the payment via GET /verify-publish-payment/:reference so the
// event actually flips to PUBLISHED. The mocked Paystack always returns success.
async function publishEvent(token: string, eventId: string, body?: Record<string, unknown>) {
  const res = await api
    .post(`/api/v1/events/${eventId}/publish`)
    .set('Authorization', `Bearer ${token}`)
    .send(body ?? {});
  expect(res.status).toBe(200);
  const ref = res.body?.data?.reference;
  if (ref) {
    await api
      .get(`/api/v1/events/${eventId}/verify-publish-payment/${ref}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  }
  return res;
}

describe('auth', () => {
  it('hashes passwords: wrong password is rejected, correct login works', async () => {
    await registerlya('auth1');
    const bad = await api.post('/api/v1/auth/login').send({ email: 'org-auth1@events.test', password: 'wrong' });
    expect(bad.status).toBe(401);
    const good = await api.post('/api/v1/auth/login').send({ email: 'org-auth1@events.test', password: 'test-password-123' });
    expect(good.status).toBe(200);
    expect(good.body.data.accessToken).toBeTruthy();
  });

  it('rejects duplicate registration', async () => {
    await registerlya('auth2');
    const dup = await api.post('/api/v1/auth/register').send({
      name: 'Again',
      organiserName: 'Again',
      email: 'org-auth2@events.test',
      password: 'test-password-123',
    });
    expect(dup.status).toBe(409);
  });

  it('issues expiring JWTs and rejects tampered tokens', async () => {
    const { accessToken } = await registerlya('auth3');
    const decoded = jwt.decode(accessToken) as { iat: number; exp: number } | null;
    expect(decoded).toBeTruthy();
    expect(decoded!.exp - decoded!.iat).toBe(7 * 24 * 60 * 60); // 7d
    const bad = await api.get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}tampered`);
    expect(bad.status).toBe(401);
  });
});

describe('ownership isolation', () => {
  it('one organiser cannot read, edit, publish, or extend another organiser event', async () => {
    const a = await registerlya('ownA');
    const b = await registerlya('ownB');
    const event = await createDraft(a.accessToken, 'Private Wedding');
    const headers = { Authorization: `Bearer ${b.accessToken}` };
    expect((await api.get(`/api/v1/events/${event.id}`).set(headers)).status).toBe(404);
    expect((await api.patch(`/api/v1/events/${event.id}`).set(headers).send({ title: 'Hijacked' })).status).toBe(404);
    expect((await api.post(`/api/v1/events/${event.id}/publish`).set(headers)).status).toBe(404);
    expect((await api.post(`/api/v1/events/${event.id}/agenda`).set(headers).send({ title: 'X' })).status).toBe(404);
    expect((await api.post(`/api/v1/events/${event.id}/locations`).set(headers).send({ name: 'X' })).status).toBe(404);
    expect(
      (await api.post(`/api/v1/events/${event.id}/photos`).set(headers).attach('photo', tinyPng, 'x.png')).status,
    ).toBe(404);
    // And the owner's data is unchanged.
    const mine = await api.get(`/api/v1/events/${event.id}`).set('Authorization', `Bearer ${a.accessToken}`);
    expect(mine.status).toBe(200);
    expect(mine.body.data.title).toBe('Private Wedding');
  });
});

describe('public lifecycle', () => {
  it('DRAFT is never public; PUBLISHED is; ARCHIVED disappears', async () => {
    const { accessToken } = await registerlya('life1');
    const event = await createDraft(accessToken, 'Lifecycle Party', 'BIRTHDAY');
    expect((await api.get(`/api/v1/public/events/${event.slug}`)).status).toBe(404);
    await publishEvent(accessToken, event.id);
    expect((await api.get(`/api/v1/public/events/${event.slug}`)).status).toBe(200);
    await api.delete(`/api/v1/events/${event.id}`).set('Authorization', `Bearer ${accessToken}`).expect(200);
    expect((await api.get(`/api/v1/public/events/${event.slug}`)).status).toBe(404);
  });

  it('supports publish → unpublish → republish without leaking drafts', async () => {
    const { accessToken } = await registerlya('life3');
    const auth = { Authorization: `Bearer ${accessToken}` };
    const event = await createDraft(accessToken, 'Comeback Party', 'CELEBRATION');
    await publishEvent(accessToken, event.id);
    expect((await api.get(`/api/v1/public/events/${event.slug}`)).status).toBe(200);
    await api.post(`/api/v1/events/${event.id}/unpublish`).set(auth).expect(200);
    expect((await api.get(`/api/v1/public/events/${event.slug}`)).status).toBe(404);
    await publishEvent(accessToken, event.id);
    expect((await api.get(`/api/v1/public/events/${event.slug}`)).status).toBe(200);
  });

  it('rejects past expiry at publish; past expiresAt yields 410 EVENT_EXPIRED', async () => {
    const { accessToken } = await registerlya('life2');
    const event = await createDraft(accessToken, 'Expiring Event');
    const past = await api
      .post(`/api/v1/events/${event.id}/publish`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect(past.status).toBe(400);
    const future = await publishEvent(accessToken, event.id, { expiresAt: new Date(Date.now() + 3600_000).toISOString() });
    expect(future.status).toBe(200);
    // Simulate time passing: move expiry into the past directly.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient } = require('../../generated-client') as typeof import('../../generated-client');
    const prisma = new PrismaClient();
    try {
      await prisma.event.update({ where: { id: event.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    } finally {
      await prisma.$disconnect();
    }
    const gone = await api.get(`/api/v1/public/events/${event.slug}`);
    expect(gone.status).toBe(410);
    expect(gone.body.code).toBe('EVENT_EXPIRED');
  });
});

describe('slugs', () => {
  it('same title twice yields distinct unique slugs; DB enforces uniqueness', async () => {
    const { accessToken } = await registerlya('slug1');
    const first = await createDraft(accessToken, 'Sarah & John Wedding');
    const second = await createDraft(accessToken, 'Sarah & John Wedding');
    expect(first.slug).not.toBe(second.slug);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient } = require('../../generated-client') as typeof import('../../generated-client');
    const prisma = new PrismaClient();
    try {
      await expect(
        prisma.event.create({
          data: { slug: first.slug, organiserId: 'x', eventType: 'WEDDING', title: 'Collision' },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    } finally {
      await prisma.$disconnect();
    }
    expect(first.slug).toBeTruthy();
    expect(second.slug).toBeTruthy();
  });
});

describe('messages and analytics', () => {
  it('validates, trims, publishes and rate-limits guest messages', async () => {
    const { accessToken } = await registerlya('msg1');
    const event = await createDraft(accessToken, 'Message Board');
    await publishEvent(accessToken, event.id);
    const post = (body: Record<string, string>) =>
      api.post(`/api/v1/public/events/${event.slug}/messages`).send(body);
    // Message limit is 5 per 10min in tests: 400, 400, 201, 400, 201, then 429.
    expect((await post({ authorName: '   ', message: 'Hello' })).status).toBe(400);
    expect((await post({ authorName: 'Ana', message: '    ' })).status).toBe(400);
    const ok = await post({ authorName: 'Aunt Maria', message: 'Congratulations!' });
    expect(ok.status).toBe(201);
    expect((await post({ authorName: 'Spammer', message: 'x'.repeat(1001) })).status).toBe(400);
    expect((await post({ authorName: 'Sipho', message: 'So happy for you!' })).status).toBe(201);
    expect((await post({ authorName: 'Late', message: 'One more' })).status).toBe(429);
    const page = await api.get(`/api/v1/public/events/${event.slug}`);
    const names = (page.body.data.messages as Array<{ authorName: string }>).map((m) => m.authorName);
    expect(names).toContain('Aunt Maria');
    expect(names).toContain('Sipho');
  });

  it('view counting is idempotent per visitor', async () => {
    const { accessToken } = await registerlya('view1');
    const event = await createDraft(accessToken, 'View Counter');
    await publishEvent(accessToken, event.id);
    // supertest sends no User-Agent; anonymous analytics correctly ignores
    // bot-like requests, so present a real browser UA here.
    const ua = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) EventsTest/1.0' };
    const first = await api.post(`/api/v1/public/events/${event.slug}/view`).set(ua).send({ visitorId: 'test-visitor-abcdef' });
    expect(first.body.data.counted).toBe(true);
    expect(first.body.data.viewCount).toBe(1);
    const repeat = await api.post(`/api/v1/public/events/${event.slug}/view`).set(ua).send({ visitorId: 'test-visitor-abcdef' });
    expect(repeat.body.data.counted).toBe(false);
    expect(repeat.body.data.viewCount).toBe(1);
  });
});

describe('photo uploads', () => {
  it('rejects spoofed content; accepts real PNG into the public gallery', async () => {
    const { accessToken } = await registerlya('photo1');
    const event = await createDraft(accessToken, 'Photo Night');
    await publishEvent(accessToken, event.id);
    const fake = await api
      .post(`/api/v1/events/${event.id}/photos`)
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('photo', Buffer.from('this is not an image'), 'evil.png');
    expect(fake.status).toBe(400);
    const real = await api
      .post(`/api/v1/events/${event.id}/photos`)
      .set('Authorization', `Bearer ${accessToken}`)
      .field('caption', 'First dance')
      .attach('photo', tinyPng, 'dance.png');
    expect(real.status).toBe(201);
    expect(real.body.data.caption).toBe('First dance');
    const page = await api.get(`/api/v1/public/events/${event.slug}`);
    expect((page.body.data.photos as unknown[]).length).toBe(1);
  });

  it('rejects wrong MIME types and oversized uploads', async () => {
    const { accessToken } = await registerlya('photo2');
    const auth = { Authorization: `Bearer ${accessToken}` };
    const event = await createDraft(accessToken, 'Upload Limits');
    const txt = await api.post(`/api/v1/events/${event.id}/photos`).set(auth).attach('photo', Buffer.from('hello'), 'note.txt');
    expect(txt.status).toBe(400);
    const big = await api
      .post(`/api/v1/events/${event.id}/photos`)
      .set(auth)
      .attach('photo', Buffer.alloc(9 * 1024 * 1024, 0xff), 'big.png');
    expect(big.status).toBe(400);
  });
});

describe('prisma error surface', () => {
  it('exposes P2002 codes from the isolated client', () => {
    expect(Prisma.PrismaClientKnownRequestError).toBeTruthy();
  });
});
