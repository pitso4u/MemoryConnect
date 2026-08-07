import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import marketingRoutes from '../routes/marketing';
import publicMarketingRoutes from '../routes/public-marketing';
import { prisma } from '../lib/prisma';
import { signToken } from '../middleware/auth';
import { invalidateFeatureCache } from '../lib/featureService';

const app = express();
app.use(express.json());
app.use('/api/v1/marketing', marketingRoutes);
app.use('/api/v1/public', publicMarketingRoutes);

let homeA: { id: string; slug: string };
let homeB: { id: string; slug: string };
let tokenA = '';
let tokenB = '';
let brochureIdA = '';
let brochureIdB = '';

async function createHome(name: string, email: string, slug: string) {
  const home = await prisma.funeralHome.create({
    data: {
      name,
      email,
      slug,
      plan: 'PROFESSIONAL',
      edition: 'FUNERAL_OFFICE',
      users: {
        create: { name: `${name} Admin`, email: `${email}-admin`, passwordHash: 'x', passwordSetAt: new Date(), role: 'FUNERAL_HOME_ADMIN' },
      },
    },
    include: { users: true },
  });
  return { id: home.id, slug: home.slug as string, userId: home.users[0].id };
}

async function createBrochure(token: string, title: string, slug: string, published: boolean) {
  const res = await request(app)
    .post('/api/v1/marketing/brochures')
    .set('Authorization', `Bearer ${token}`)
    .send({ title, slug, published });
  expect(res.status).toBe(201);
  return res.body.data as { id: string; slug: string };
}

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

  const a = await createHome(`Tenant Home A ${suffix}`, `tenant-a-${suffix}@example.com`, `home-a-${suffix}`);
  const b = await createHome(`Tenant Home B ${suffix}`, `tenant-b-${suffix}@example.com`, `home-b-${suffix}`);
  homeA = a;
  homeB = b;
  tokenA = signToken({ userId: a.userId, funeralHomeId: a.id, role: 'FUNERAL_HOME_ADMIN' });
  tokenB = signToken({ userId: b.userId, funeralHomeId: b.id, role: 'FUNERAL_HOME_ADMIN' });

  // C. The SAME slug is allowed in two different funeral homes.
  const pkgA = await createBrochure(tokenA, 'Basic Funeral Package A', 'basic-funeral-package', true);
  const pkgB = await createBrochure(tokenB, 'Basic Funeral Package B', 'basic-funeral-package', true);
  expect(pkgA.slug).toBe('basic-funeral-package');
  expect(pkgB.slug).toBe('basic-funeral-package');
  brochureIdA = pkgA.id;
  brochureIdB = pkgB.id;

  // Unique-slug brochures for the legacy redirect tests.
  await createBrochure(tokenA, 'Classic Package', 'classic-package', true);
  await createBrochure(tokenA, 'Draft Package', 'draft-package', false);
});

afterAll(async () => {
  const ids = [homeA.id, homeB.id].filter(Boolean);
  await prisma.enquiry.deleteMany({ where: { funeralHomeId: { in: ids } } }).catch(() => undefined);
  await prisma.qRCode.deleteMany({ where: { funeralHomeId: { in: ids } } }).catch(() => undefined);
  await prisma.brochureGallery.deleteMany({ where: { brochure: { funeralHomeId: { in: ids } } } }).catch(() => undefined);
  await prisma.brochure.deleteMany({ where: { funeralHomeId: { in: ids } } }).catch(() => undefined);
  await prisma.user.deleteMany({ where: { funeralHomeId: { in: ids } } }).catch(() => undefined);
  await prisma.funeralHome.deleteMany({ where: { id: { in: ids } } }).catch(() => undefined);
  await prisma.$disconnect();
});

describe('Tenant-scoped public brochure URLs', () => {
  it('A. /services/home-a/basic-funeral-package returns Home A brochure', async () => {
    const res = await request(app).get(`/api/v1/public/brochures/${homeA.slug}/basic-funeral-package`);
    expect(res.status).toBe(200);
    expect(res.body.data.brochure.title).toBe('Basic Funeral Package A');
    expect(res.body.data.brochure.funeralHomeId).toBe(homeA.id);
    expect(res.body.data.funeralHome.slug).toBe(homeA.slug);
  });

  it('B. /services/home-b/basic-funeral-package returns Home B brochure', async () => {
    const res = await request(app).get(`/api/v1/public/brochures/${homeB.slug}/basic-funeral-package`);
    expect(res.status).toBe(200);
    expect(res.body.data.brochure.title).toBe('Basic Funeral Package B');
    expect(res.body.data.brochure.funeralHomeId).toBe(homeB.id);
    expect(res.body.data.funeralHome.slug).toBe(homeB.slug);
  });

  it('D. Home A URL can never return Home B brochure', async () => {
    const a = await request(app).get(`/api/v1/public/brochures/${homeA.slug}/basic-funeral-package`);
    expect(a.body.data.brochure.funeralHomeId).toBe(homeA.id);
    expect(a.body.data.brochure.title).not.toBe('Basic Funeral Package B');
    const b = await request(app).get(`/api/v1/public/brochures/${homeB.slug}/basic-funeral-package`);
    expect(b.body.data.brochure.funeralHomeId).toBe(homeB.id);
    expect(b.body.data.brochure.title).not.toBe('Basic Funeral Package A');
  });

  it('E. Non-existent funeral home slug returns 404', async () => {
    const res = await request(app).get('/api/v1/public/brochures/no-such-home/basic-funeral-package');
    expect(res.status).toBe(404);
  });

  it('F. Non-existent brochure slug under an existing funeral home returns 404', async () => {
    const res = await request(app).get(`/api/v1/public/brochures/${homeA.slug}/no-such-package`);
    expect(res.status).toBe(404);
  });

  it('G. Unpublished brochure is not publicly accessible', async () => {
    const res = await request(app).get(`/api/v1/public/brochures/${homeA.slug}/draft-package`);
    expect(res.status).toBe(404);
  });

  it('H. Legacy /services/{slug} resolves to the canonical path when unambiguous', async () => {
    const res = await request(app).get('/api/v1/public/brochures/classic-package');
    expect(res.status).toBe(200);
    expect(res.body.data.canonicalPath).toBe(`/services/${homeA.slug}/classic-package`);
  });

  it('H2. Ambiguous legacy slug is not auto-resolved', async () => {
    const res = await request(app).get('/api/v1/public/brochures/basic-funeral-package');
    expect(res.status).toBe(409);
  });

  it('H3. Unknown legacy slug returns 404', async () => {
    const res = await request(app).get('/api/v1/public/brochures/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('J. Newly generated QR codes use only the canonical URL', async () => {
    const res = await request(app)
      .get(`/api/v1/marketing/brochures/${brochureIdA}/qr-code`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.data.publicUrl).toBe(`http://localhost:5174/services/${homeA.slug}/basic-funeral-package`);
    const resB = await request(app)
      .get(`/api/v1/marketing/brochures/${brochureIdB}/qr-code`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(resB.status).toBe(200);
    expect(resB.body.data.publicUrl).toBe(`http://localhost:5174/services/${homeB.slug}/basic-funeral-package`);
  });
});

describe('Tenant-scoped brochure enquiries', () => {
  it('scopes an enquiry to the funeral home on the canonical path', async () => {
    const res = await request(app)
      .post(`/api/v1/public/brochures/${homeA.slug}/basic-funeral-package/enquiry`)
      .send({ fullName: 'Thandi', phoneNumber: '0720000000' });
    expect(res.status).toBe(201);
    const enquiry = await prisma.enquiry.findUnique({ where: { id: res.body.data.id } });
    expect(enquiry?.funeralHomeId).toBe(homeA.id);

    const resB = await request(app)
      .post(`/api/v1/public/brochures/${homeB.slug}/basic-funeral-package/enquiry`)
      .send({ fullName: 'Sipho', emailAddress: 'sipho@example.com' });
    expect(resB.status).toBe(201);
    const enquiryB = await prisma.enquiry.findUnique({ where: { id: resB.body.data.id } });
    expect(enquiryB?.funeralHomeId).toBe(homeB.id);
  });

  it('legacy unambiguous slug still accepts enquiries', async () => {
    const res = await request(app)
      .post('/api/v1/public/brochures/classic-package/enquiry')
      .send({ fullName: 'Zanele' });
    expect(res.status).toBe(201);
  });

  it('does not accept enquiries for unpublished brochures', async () => {
    const res = await request(app)
      .post(`/api/v1/public/brochures/${homeA.slug}/draft-package/enquiry`)
      .send({ fullName: 'Thabo' });
    expect(res.status).toBe(404);
  });
});
