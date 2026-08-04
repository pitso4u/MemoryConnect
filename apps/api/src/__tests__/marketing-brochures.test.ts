import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import marketingRoutes from '../routes/marketing';
import { prisma } from '../lib/prisma';
import { signToken } from '../middleware/auth';
import { invalidateFeatureCache } from '../lib/featureService';
import { UPLOADS_DIR } from '../lib/uploads';

const app = express();
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/api/v1/marketing', marketingRoutes);

let homeId = '';
let adminToken = '';
let brochureId = '';
let gGalleryUrl = '';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>endobj\ntrailer\n<<>>\n%%EOF');

beforeAll(async () => {
  const suffix = Date.now();

  await prisma.feature.upsert({
    where: { key: 'BROCHURES' },
    update: {
      name: 'Digital Brochures',
      description: 'Test BROCHURES',
      category: 'MARKETING',
      releaseChannel: 'GENERAL_AVAILABILITY',
      enabledGlobally: true,
      premium: false,
      minimumEdition: 'FUNERAL_OFFICE',
      minimumPlan: 'PROFESSIONAL',
      rolloutPercent: 100,
    },
    create: {
      key: 'BROCHURES',
      name: 'Digital Brochures',
      description: 'Test BROCHURES',
      category: 'MARKETING',
      releaseChannel: 'GENERAL_AVAILABILITY',
      enabledGlobally: true,
      premium: false,
      minimumEdition: 'FUNERAL_OFFICE',
      minimumPlan: 'PROFESSIONAL',
      rolloutPercent: 100,
    },
  });
  invalidateFeatureCache();

  const home = await prisma.funeralHome.create({
    data: {
      name: `Marketing Home ${suffix}`,
      email: `marketing-home-${suffix}@example.com`,
      plan: 'PROFESSIONAL',
      edition: 'FUNERAL_OFFICE',
      users: {
        create: { name: 'Marketing Admin', email: `marketing-${suffix}@example.com`, passwordHash: 'x', passwordSetAt: new Date(), role: 'FUNERAL_HOME_ADMIN' },
      },
    },
    include: { users: true },
  });
  homeId = home.id;
  adminToken = signToken({ userId: home.users[0].id, funeralHomeId: home.id, role: 'FUNERAL_HOME_ADMIN' });
});

afterAll(async () => {
  await prisma.brochureGallery.deleteMany({ where: { brochure: { funeralHomeId: homeId } } }).catch(() => undefined);
  await prisma.brochure.deleteMany({ where: { funeralHomeId: homeId } }).catch(() => undefined);
  await prisma.user.deleteMany({ where: { funeralHomeId: homeId } });
  await prisma.funeralHome.delete({ where: { id: homeId } }).catch(() => undefined);
  await prisma.$disconnect();
});

describe('Digital Brochure upload flow', () => {
  it('creates a brochure', async () => {
    const res = await request(app)
      .post('/api/v1/marketing/brochures')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Test Brochure' });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeTruthy();
    brochureId = res.body.data.id;
  });

  it('persists structured package fields (included items, pricing, contact, CTA)', async () => {
    const res = await request(app)
      .patch(`/api/v1/marketing/brochures/${brochureId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        includedItems: ['Coffin', 'Hearse', 'Flowers'],
        price: 'R 10,000',
        depositRequired: true,
        monthlyPaymentAvailable: true,
        financeAvailable: false,
        contactPerson: 'Thandi',
        branchName: 'Pretoria Branch',
        websiteUrl: 'https://example.co.za',
        ctaEnabled: true,
        ctaType: 'whatsapp',
        ctaText: 'WhatsApp Us',
        ctaUrl: 'https://wa.me/27820000000',
      });
    expect(res.status).toBe(200);
    expect(res.body.data.includedItems).toEqual(['Coffin', 'Hearse', 'Flowers']);
    expect(res.body.data.price).toBe('R 10,000');
    expect(res.body.data.depositRequired).toBe(true);
    expect(res.body.data.monthlyPaymentAvailable).toBe(true);
    expect(res.body.data.financeAvailable).toBe(false);
    expect(res.body.data.contactPerson).toBe('Thandi');
    expect(res.body.data.branchName).toBe('Pretoria Branch');
    expect(res.body.data.websiteUrl).toBe('https://example.co.za');
    expect(res.body.data.ctaType).toBe('whatsapp');
    expect(res.body.data.ctaText).toBe('WhatsApp Us');
  });

  it('uploads a cover image', async () => {
    const res = await request(app)
      .post(`/api/v1/marketing/brochures/${brochureId}/cover`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('cover', png, 'cover.png');
    expect(res.status).toBe(200);
    expect(res.body.data.coverImageUrl).toMatch(/^\/uploads\/marketing\/images\//);
    const served = await request(app).get(res.body.data.coverImageUrl);
    expect(served.status).toBe(200);
  });

  it('uploads gallery images', async () => {
    const res = await request(app)
      .post(`/api/v1/marketing/brochures/${brochureId}/gallery`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('gallery', png, 'g1.png')
      .attach('gallery', png, 'g2.png');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    gGalleryUrl = res.body.data[0].url;
    const served = await request(app).get(gGalleryUrl);
    expect(served.status).toBe(200);
  });

  it('deletes a gallery image', async () => {
    const listing = await request(app).get(`/api/v1/marketing/brochures/${brochureId}`).set('Authorization', `Bearer ${adminToken}`);
    const gallery = listing.body.data.gallery;
    expect(gallery.length).toBeGreaterThan(0);
    const target = gallery[0].id;
    const del = await request(app)
      .delete(`/api/v1/marketing/brochures/${brochureId}/gallery/${target}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(200);
  });

  it('uploads a PDF brochure', async () => {
    const res = await request(app)
      .post(`/api/v1/marketing/brochures/${brochureId}/pdf`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('pdf', pdf, 'brochure.pdf');
    expect(res.status).toBe(200);
    expect(res.body.data.pdfUrl).toMatch(/^\/uploads\/marketing\/pdfs\//);
    const served = await request(app).get(res.body.data.pdfUrl);
    expect(served.status).toBe(200);
  });

  it('returns the brochure with persisted cover, gallery and pdf paths', async () => {
    const res = await request(app).get(`/api/v1/marketing/brochures/${brochureId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.coverImageUrl).toMatch(/^\/uploads\/marketing\/images\//);
    expect(res.body.data.pdfUrl).toMatch(/^\/uploads\/marketing\/pdfs\//);
    const served = await request(app).get(res.body.data.coverImageUrl);
    expect(served.status).toBe(200);
  });

  it('generates a QR code from a brochure-specific public URL', async () => {
    const res = await request(app)
      .get(`/api/v1/marketing/brochures/${brochureId}/qr-code`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.publicUrl).toMatch(/^http:\/\/localhost:5174\/services\//);
    expect(res.body.data.publicUrl).toContain('/services/');
    expect(res.body.data.qrCodeUrl).toMatch(/^\/uploads\/marketing\/qr\//);
  });
});