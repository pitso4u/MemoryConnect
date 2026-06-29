import { afterAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import billingRoutes from '../routes/billing';
import memorialRoutes from '../routes/memorials';
import { signToken } from '../middleware/auth';
import { BILLING_PLANS, canPublishAnotherMemorial, addOneMonth, ensureBillingPlan, isSubscriptionActive } from '../lib/billing';
import { prisma } from '../lib/prisma';

afterAll(async () => {
  await prisma.$disconnect();
});

const app = express();
app.use(express.json());
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/memorials', memorialRoutes);

async function createFuneralHome(label: string) {
  const funeralHome = await prisma.funeralHome.create({
    data: {
      name: `Billing Test ${label}`,
      email: `billing-${label}-${Date.now()}@example.com`,
    },
  });
  const token = signToken({ userId: `user-${label}`, funeralHomeId: funeralHome.id, role: 'admin' });
  return { funeralHome, token };
}

describe('billing period helpers', () => {
  it('defines the v1.2.0 commercial plans', () => {
    expect(BILLING_PLANS.starter).toMatchObject({
      amount: 49999,
      memorialLimit: 5,
      extraMemorialAmount: 14999,
      fairUseUnlimited: false,
    });
    expect(BILLING_PLANS.professional).toMatchObject({
      amount: 99999,
      memorialLimit: 15,
      extraMemorialAmount: 14999,
      fairUseUnlimited: false,
    });
    expect(BILLING_PLANS.unlimited).toMatchObject({
      amount: 199999,
      fairUseUnlimited: true,
    });
  });

  it('handles month-end renewals without overflowing', () => {
    expect(addOneMonth(new Date('2026-01-31T10:00:00.000Z')).toISOString())
      .toBe('2026-02-28T10:00:00.000Z');
  });

  it('only treats unexpired active subscriptions as entitled', () => {
    const now = new Date('2026-06-29T10:00:00.000Z');
    expect(isSubscriptionActive({ status: 'active', currentPeriodEnd: new Date('2026-07-29T10:00:00.000Z') }, now)).toBe(true);
    expect(isSubscriptionActive({ status: 'attention', currentPeriodEnd: new Date('2026-07-29T10:00:00.000Z') }, now)).toBe(false);
    expect(isSubscriptionActive({ status: 'active', currentPeriodEnd: new Date('2026-06-20T10:00:00.000Z') }, now)).toBe(false);
  });

  it('enforces limited plans while allowing fair-use unlimited publishing', () => {
    expect(canPublishAnotherMemorial({
      memorialsUsed: 5,
      memorialLimit: 5,
      extraCredits: 0,
      unlimited: false,
      remaining: 0,
    })).toBe(false);

    expect(canPublishAnotherMemorial({
      memorialsUsed: 500,
      memorialLimit: 0,
      extraCredits: 0,
      unlimited: true,
      remaining: null,
    })).toBe(true);
  });
});

describe('billing routes and plan enforcement', () => {
  it('returns all commercial plans from billing status', async () => {
    const { funeralHome, token } = await createFuneralHome('status');
    try {
      const response = await request(app)
        .get('/api/v1/billing/status')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.plans).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'starter', amount: 49999, memorialLimit: 5 }),
        expect.objectContaining({ code: 'professional', amount: 99999, memorialLimit: 15 }),
        expect.objectContaining({ code: 'unlimited', amount: 199999, fairUseUnlimited: true }),
      ]));
    } finally {
      await prisma.funeralHome.delete({ where: { id: funeralHome.id } }).catch(() => undefined);
    }
  });

  it('blocks publishing when Professional monthly memorials are exhausted', async () => {
    const { funeralHome, token } = await createFuneralHome('professional-limit');
    try {
      const plan = await ensureBillingPlan('professional');
      const subscription = await prisma.subscription.create({
        data: {
          funeralHomeId: funeralHome.id,
          planId: plan.id,
          status: 'active',
          currentPeriodStart: new Date('2026-06-01T00:00:00.000Z'),
          currentPeriodEnd: new Date('2026-07-01T00:00:00.000Z'),
        },
      });
      for (let index = 0; index < 15; index += 1) {
        const used = await prisma.memorial.create({
          data: {
            slug: `used-${funeralHome.id}-${index}`,
            deceasedName: `Used Memorial ${index}`,
            funeralHomeId: funeralHome.id,
            programme: [],
            announcements: [],
            settings: {},
            status: 'published',
          },
        });
        await prisma.usageLedger.create({
          data: {
            funeralHomeId: funeralHome.id,
            subscriptionId: subscription.id,
            memorialId: used.id,
            periodStart: subscription.currentPeriodStart!,
            periodEnd: subscription.currentPeriodEnd!,
          },
        });
      }
      const draft = await prisma.memorial.create({
        data: {
          slug: `draft-${funeralHome.id}`,
          deceasedName: 'Draft Memorial',
          funeralHomeId: funeralHome.id,
          programme: [],
          announcements: [],
          settings: {},
        },
      });

      const response = await request(app)
        .patch(`/api/v1/memorials/${draft.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'published' });

      expect(response.status).toBe(402);
      expect(response.body.code).toBe('MEMORIAL_LIMIT_REACHED');
      expect(response.body.error).toContain('R149.99');
    } finally {
      await prisma.funeralHome.delete({ where: { id: funeralHome.id } }).catch(() => undefined);
    }
  });

  it('allows Unlimited publishing without a hard memorial cap', async () => {
    const { funeralHome, token } = await createFuneralHome('unlimited');
    try {
      const plan = await ensureBillingPlan('unlimited');
      await prisma.subscription.create({
        data: {
          funeralHomeId: funeralHome.id,
          planId: plan.id,
          status: 'active',
          currentPeriodStart: new Date('2026-06-01T00:00:00.000Z'),
          currentPeriodEnd: new Date('2026-07-01T00:00:00.000Z'),
        },
      });
      const draft = await prisma.memorial.create({
        data: {
          slug: `unlimited-draft-${funeralHome.id}`,
          deceasedName: 'Unlimited Draft',
          funeralHomeId: funeralHome.id,
          programme: [],
          announcements: [],
          settings: {},
        },
      });

      const response = await request(app)
        .patch(`/api/v1/memorials/${draft.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'published' });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('published');
    } finally {
      await prisma.funeralHome.delete({ where: { id: funeralHome.id } }).catch(() => undefined);
    }
  });
});
