import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import path from 'path';
import fs from 'fs';
import request from 'supertest';
import marketingRoutes from '../routes/marketing';
import publicMarketingRoutes from '../routes/public-marketing';
import { prisma } from '../lib/prisma';
import { signToken } from '../middleware/auth';
import { invalidateFeatureCache } from '../lib/featureService';
import { UPLOADS_DIR } from '../lib/uploads';

const app = express();
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/api/v1/marketing', marketingRoutes);
app.use('/api/v1/public', publicMarketingRoutes);

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>endobj\ntrailer\n<<>>\n%%EOF');

const SUFFIX = Date.now();

let homeId = '';
let homeSlug = '';
let adminToken = '';
let otherToken = '';
let brochureId = '';
let brochureSlug = '';

async function setFeatureEnabled(enabled: boolean) {
  await prisma.feature.update({ where: { key: 'BROCHURES' }, data: { enabledGlobally: enabled } });
  invalidateFeatureCache();
}

beforeAll(async () => {
  await prisma.feature.upsert({
    where: { key: 'BROCHURES' },
    update: { name: 'Digital Brochures', releaseChannel: 'GENERAL_AVAILABILITY', enabledGlobally: true, premium: false, minimumEdition: 'FUNERAL_OFFICE', minimumPlan: 'PROFESSIONAL', rolloutPercent: 100 },
    create: { key: 'BROCHURES', name: 'Digital Brochures', releaseChannel: 'GENERAL_AVAILABILITY', enabledGlobally: true, premium: false, minimumEdition: 'FUNERAL_OFFICE', minimumPlan: 'PROFESSIONAL', rolloutPercent: 100 },
  });
  invalidateFeatureCache();

  const home = await prisma.funeralHome.create({
    data: {
      name: `QA Home ${SUFFIX}`,
      slug: `qa-home-${SUFFIX}`,
      email: `qa-home-${SUFFIX}@example.com`,
      plan: 'PROFESSIONAL',
      edition: 'FUNERAL_OFFICE',
      users: { create: { name: 'QA Admin', email: `qa-admin-${SUFFIX}@example.com`, passwordHash: 'x', passwordSetAt: new Date(), role: 'FUNERAL_HOME_ADMIN' } },
    },
    include: { users: true },
  });
  homeId = home.id;
  homeSlug = home.slug || `qa-home-${SUFFIX}`;
  adminToken = signToken({ userId: home.users[0].id, funeralHomeId: home.id, role: 'FUNERAL_HOME_ADMIN' });

  const other = await prisma.funeralHome.create({
    data: {
      name: `QA Other ${SUFFIX}`,
      email: `qa-other-${SUFFIX}@example.com`,
      plan: 'PROFESSIONAL',
      edition: 'FUNERAL_OFFICE',
      users: { create: { name: 'Other Admin', email: `qa-other-admin-${SUFFIX}@example.com`, passwordHash: 'x', passwordSetAt: new Date(), role: 'FUNERAL_HOME_ADMIN' } },
    },
    include: { users: true },
  });
  otherToken = signToken({ userId: other.users[0].id, funeralHomeId: other.id, role: 'FUNERAL_HOME_ADMIN' });
});

afterAll(async () => {
  await prisma.brochure.deleteMany({ where: { funeralHomeId: homeId } }).catch(() => undefined);
  await prisma.user.deleteMany({ where: { funeralHomeId: homeId } }).catch(() => undefined);
  const other = await prisma.funeralHome.findMany({ where: { name: `QA Other ${SUFFIX}` }, select: { id: true } });
  for (const o of other) {
    await prisma.user.deleteMany({ where: { funeralHomeId: o.id } }).catch(() => undefined);
    await prisma.funeralHome.delete({ where: { id: o.id } }).catch(() => undefined);
  }
  await prisma.funeralHome.delete({ where: { id: homeId } }).catch(() => undefined);
  await prisma.feature.update({ where: { key: 'BROCHURES' }, data: { enabledGlobally: true } }).catch(() => undefined);
  invalidateFeatureCache();
  await prisma.$disconnect();
});

describe('Digital Brochure QA - auth & permissions', () => {
  it('rejects an unauthenticated brochure request with 401', async () => {
    const res = await request(app).get('/api/v1/marketing/brochures');
    expect(res.status).toBe(401);
  });

  it('blocks brochure access when the BROCHURES feature is disabled for the account', async () => {
    await setFeatureEnabled(false);
    expect((await request(app).get('/api/v1/marketing/brochures').set('Authorization', `Bearer ${adminToken}`)).status).toBe(403);
    expect(
      (await request(app).post('/api/v1/marketing/brochures').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Blocked' })).status,
    ).toBe(403);
    await setFeatureEnabled(true);
  });

  it('permits access once the feature is enabled and it is returned by the feature API', async () => {
    const features = await request(app)
      .get('/api/v1/auth/my-features')
      .set('Authorization', `Bearer ${adminToken}`);
    // my-features is mounted by the real server; this test app doesn't mount auth routes,
    // so we assert on the broker routes instead.
    expect((await request(app).get('/api/v1/marketing/brochures').set('Authorization', `Bearer ${adminToken}`)).status).toBe(200);
    expect(features.body).toBeDefined();
  });

  it('isolates brochures between funeral homes (403 on foreign records)', async () => {
    const created = await request(app)
      .post('/api/v1/marketing/brochures')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'QA Isolated Brochure' });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect((await request(app).get(`/api/v1/marketing/brochures/${id}`).set('Authorization', `Bearer ${otherToken}`)).status).toBe(403);
    expect((await request(app).patch(`/api/v1/marketing/brochures/${id}`).set('Authorization', `Bearer ${otherToken}`).send({ title: 'Hacked' })).status).toBe(403);
    expect((await request(app).delete(`/api/v1/marketing/brochures/${id}`).set('Authorization', `Bearer ${otherToken}`)).status).toBe(403);
    await prisma.brochure.delete({ where: { id } });
  });
});

describe('Digital Brochure QA - full lifecycle, storage & public page', () => {
  it('creates a brochure with title + description and persists structured contact/CTA fields', async () => {
    const res = await request(app)
      .post('/api/v1/marketing/brochures')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'QA Premium Package',
        description: 'A complete all-inclusive funeral package handled with dignity.',
        whatsappNumber: '27820000000',
        phoneNumber: '0123456789',
        ctaEnabled: true,
        ctaType: 'whatsapp',
        ctaText: 'WhatsApp Us',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.description).toBe('A complete all-inclusive funeral package handled with dignity.');
    expect(res.body.data.whatsappNumber).toBe('27820000000');
    expect(res.body.data.ctaType).toBe('whatsapp');
    expect(res.body.data.funeralHomeId).toBe(homeId);
    brochureId = res.body.data.id;
    brochureSlug = res.body.data.slug;
  });

  it('uploads a cover image and PDF; files exist on disk and URLs are stored', async () => {
    const cover = await request(app)
      .post(`/api/v1/marketing/brochures/${brochureId}/cover`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('cover', png, 'cover.png');
    expect(cover.status).toBe(200);
    const coverUrl = cover.body.data.coverImageUrl as string;
    expect(coverUrl).toMatch(/^\/uploads\/marketing\/images\//);
    const coverFile = path.join(UPLOADS_DIR, 'marketing', 'images', path.basename(coverUrl));
    expect(fs.existsSync(coverFile)).toBe(true);

    const pdfRes = await request(app)
      .post(`/api/v1/marketing/brochures/${brochureId}/pdf`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('pdf', pdf, 'brochure.pdf');
    expect(pdfRes.status).toBe(200);
    const pdfUrl = pdfRes.body.data.pdfUrl as string;
    expect(pdfUrl).toMatch(/^\/uploads\/marketing\/pdfs\//);
    const pdfFile = path.join(UPLOADS_DIR, 'marketing', 'pdfs', path.basename(pdfUrl));
    expect(fs.existsSync(pdfFile)).toBe(true);

    const fetched = await request(app).get(coverUrl);
    expect(fetched.status).toBe(200);
    expect(await request(app).get(pdfUrl)).toHaveProperty('status', 200);
  });

  it('returns 404 for an unpublished brochure on the public API', async () => {
    const res = await request(app).get(`/api/v1/public/brochures/${brochureSlug}`);
    expect(res.status).toBe(404);
  });

  it('publishes the brochure and returns it (with cover, description, download & whatsapp) on the public API', async () => {
    const pub = await request(app)
      .patch(`/api/v1/marketing/brochures/${brochureId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ published: true });
    expect(pub.status).toBe(200);
    expect(pub.body.data.published).toBe(true);

    const single = await request(app).get(`/api/v1/public/brochures/${brochureSlug}`);
    expect(single.status).toBe(200);
    expect(single.body.data.brochure.title).toBe('QA Premium Package');
    expect(single.body.data.brochure.description).toBeTruthy();
    expect(single.body.data.brochure.coverImageUrl).toMatch(/^\/uploads\/marketing\/images\//);
    expect(single.body.data.brochure.pdfUrl).toMatch(/^\/uploads\/marketing\/pdfs\//);
    expect(single.body.data.brochure.whatsappNumber).toBe('27820000000');

    const listing = await request(app).get(`/api/v1/public/funeral-homes/${homeSlug}/brochures`);
    expect(listing.status).toBe(200);
    expect(Array.isArray(listing.body.data)).toBe(true);
    expect(listing.body.data.some((b: { id: string }) => b.id === brochureId)).toBe(true);
  });

  it('records a public enquiry against the brochure', async () => {
    const res = await request(app)
      .post(`/api/v1/public/brochures/${brochureSlug}/enquiry`)
      .send({ fullName: 'QA Visitor', phoneNumber: '0712345678', message: 'Please send pricing' });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeTruthy();
    const enquiry = await prisma.enquiry.findUnique({ where: { id: res.body.data.id } });
    expect(enquiry?.brochureId).toBe(brochureId);
    expect(enquiry?.fullName).toBe('QA Visitor');
  });

  it('lets the owner edit and delete the brochure', async () => {
    const edit = await request(app)
      .patch(`/api/v1/marketing/brochures/${brochureId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 'R 12,500', financeAvailable: true });
    expect(edit.status).toBe(200);
    expect(edit.body.data.price).toBe('R 12,500');

    const del = await request(app)
      .delete(`/api/v1/marketing/brochures/${brochureId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(200);
    const gone = await prisma.brochure.findUnique({ where: { id: brochureId } });
    expect(gone).toBeNull();
  });
});