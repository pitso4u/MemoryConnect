import { createHmac, timingSafeEqual } from 'crypto';
import { Router, Request } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { env } from '../lib/env';
import { authenticate } from '../middleware/auth';
import {
  BILLING_PLANS,
  PAYMENT_KIND,
  PLAN_CODES,
  PlanCode,
  activatePaymentByReference,
  createPaymentReference,
  ensureBillingPlan,
  ensureBillingPlans,
  getActiveSubscription,
  getUsage,
  isPlanCode,
  markPaymentFailed,
  recordRecurringCharge,
} from '../lib/billing';
import { initializePaystackTransaction, verifyPaystackTransaction } from '../lib/paystack';

const router = Router();

const initializeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal(PAYMENT_KIND.SUBSCRIPTION).default(PAYMENT_KIND.SUBSCRIPTION),
    planCode: z.enum(PLAN_CODES).default('starter'),
  }),
  z.object({
    kind: z.literal(PAYMENT_KIND.EXTRA),
  }),
]).default({ kind: PAYMENT_KIND.SUBSCRIPTION, planCode: 'starter' });

function paystackPlanCode(planCode: PlanCode) {
  return {
    starter: env.PAYSTACK_STARTER_PLAN_CODE,
    professional: env.PAYSTACK_PROFESSIONAL_PLAN_CODE,
    unlimited: env.PAYSTACK_UNLIMITED_PLAN_CODE,
  }[planCode];
}

function serializePlan(plan: {
  code: string;
  name: string;
  amount: number;
  currency: string;
  interval: string;
  memorialLimit: number;
  extraMemorialAmount: number;
  fairUseUnlimited: boolean;
}) {
  return {
    code: plan.code,
    name: plan.name,
    amount: plan.amount,
    currency: plan.currency,
    interval: plan.interval,
    memorialLimit: plan.memorialLimit,
    extraMemorialAmount: plan.extraMemorialAmount,
    fairUseUnlimited: plan.fairUseUnlimited,
    checkoutAvailable: Boolean(env.PAYSTACK_SECRET_KEY && isPlanCode(plan.code) && paystackPlanCode(plan.code)),
  };
}

async function buildBillingStatus(funeralHomeId: string) {
  const [plans, storedSubscription, payments] = await Promise.all([
    ensureBillingPlans(),
    prisma.subscription.findUnique({
      where: { funeralHomeId },
      include: { plan: true },
    }),
    prisma.payment.findMany({
      where: { funeralHomeId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        kind: true,
        status: true,
        amount: true,
        currency: true,
        paystackReference: true,
        paidAt: true,
        createdAt: true,
      },
    }),
  ]);
  const activeSubscription = await getActiveSubscription(funeralHomeId);
  const activeOrDefaultPlan = activeSubscription?.plan || storedSubscription?.plan || plans[0];
  const usage = activeSubscription
    ? await getUsage(funeralHomeId, activeSubscription)
    : {
      memorialsUsed: 0,
      memorialLimit: activeOrDefaultPlan.memorialLimit,
      extraCredits: 0,
      unlimited: activeOrDefaultPlan.fairUseUnlimited,
      remaining: 0,
    };

  return {
    checkoutAvailable: Boolean(env.PAYSTACK_SECRET_KEY),
    plans: plans.map(serializePlan),
    plan: serializePlan(activeOrDefaultPlan),
    subscription: storedSubscription ? {
      status: !activeSubscription && storedSubscription.status === 'active' ? 'expired' : storedSubscription.status,
      planCode: storedSubscription.plan.code,
      currentPeriodStart: storedSubscription.currentPeriodStart,
      currentPeriodEnd: storedSubscription.currentPeriodEnd,
      cancelAtPeriodEnd: storedSubscription.cancelAtPeriodEnd,
    } : null,
    usage,
    payments,
  };
}

router.get('/status', authenticate, async (req, res) => {
  try {
    res.json({ success: true, data: await buildBillingStatus(req.user!.funeralHomeId) });
  } catch (error) {
    console.error('Billing status error:', error);
    res.status(500).json({ success: false, error: 'Failed to load billing status' });
  }
});

router.post('/initialize', authenticate, async (req, res) => {
  try {
    const parsed = initializeSchema.parse(req.body || {});
    if (!env.PAYSTACK_SECRET_KEY) {
      return res.status(503).json({ success: false, error: 'Paystack checkout is not configured yet' });
    }

    const [funeralHome, activeSubscription] = await Promise.all([
      prisma.funeralHome.findUnique({ where: { id: req.user!.funeralHomeId } }),
      getActiveSubscription(req.user!.funeralHomeId),
    ]);
    if (!funeralHome) return res.status(404).json({ success: false, error: 'Funeral home not found' });

    const planCode = parsed.kind === PAYMENT_KIND.SUBSCRIPTION
      ? parsed.planCode
      : activeSubscription?.plan.code;
    if (!planCode || !isPlanCode(planCode)) {
      return res.status(402).json({ success: false, error: 'Choose a Memory Connect plan before buying extra funeral memorials' });
    }

    const plan = await ensureBillingPlan(planCode);
    if (parsed.kind === PAYMENT_KIND.SUBSCRIPTION && !paystackPlanCode(planCode)) {
      return res.status(503).json({ success: false, error: `${plan.name} checkout is awaiting its Paystack plan code` });
    }
    if (parsed.kind === PAYMENT_KIND.SUBSCRIPTION && activeSubscription?.plan.code === planCode) {
      return res.status(409).json({ success: false, error: `Your ${plan.name} subscription is already active` });
    }
    if (parsed.kind === PAYMENT_KIND.EXTRA && !activeSubscription) {
      return res.status(402).json({ success: false, error: 'Activate a Memory Connect plan before buying extra funeral memorials' });
    }
    if (parsed.kind === PAYMENT_KIND.EXTRA && activeSubscription?.plan.fairUseUnlimited) {
      return res.status(409).json({ success: false, error: 'Unlimited already includes unlimited funeral memorial publishing' });
    }

    const subscription = parsed.kind === PAYMENT_KIND.SUBSCRIPTION
      ? await prisma.subscription.upsert({
        where: { funeralHomeId: funeralHome.id },
        update: { planId: plan.id, status: 'pending' },
        create: { funeralHomeId: funeralHome.id, planId: plan.id, status: 'pending' },
      })
      : activeSubscription;

    const amount = parsed.kind === PAYMENT_KIND.EXTRA ? plan.extraMemorialAmount : plan.amount;
    const reference = createPaymentReference(parsed.kind, planCode);
    const payment = await prisma.payment.create({
      data: {
        funeralHomeId: funeralHome.id,
        subscriptionId: subscription?.id,
        planId: plan.id,
        kind: parsed.kind,
        amount,
        currency: plan.currency,
        paystackReference: reference,
        metadata: { funeralHomeId: funeralHome.id, planCode: plan.code, kind: parsed.kind } as Prisma.InputJsonValue,
      },
    });

    try {
      const checkout = await initializePaystackTransaction({
        email: funeralHome.email,
        amount,
        currency: plan.currency,
        reference,
        callbackUrl: `${env.ADMIN_URL || 'http://localhost:5173'}/billing?payment=callback`,
        metadata: {
          funeralHomeId: funeralHome.id,
          paymentId: payment.id,
          paymentKind: parsed.kind,
          planCode: plan.code,
        },
        planCode: parsed.kind === PAYMENT_KIND.SUBSCRIPTION ? paystackPlanCode(planCode) : undefined,
      });
      res.status(201).json({ success: true, data: checkout });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not start Paystack checkout';
      await markPaymentFailed(reference, message);
      res.status(502).json({ success: false, error: message });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    console.error('Billing initialization error:', error);
    res.status(500).json({ success: false, error: 'Failed to initialize payment' });
  }
});

router.get('/verify/:reference', authenticate, async (req, res) => {
  try {
    const reference = String(req.params.reference);
    const payment = await prisma.payment.findFirst({
      where: { paystackReference: reference, funeralHomeId: req.user!.funeralHomeId },
    });
    if (!payment) return res.status(404).json({ success: false, error: 'Payment not found' });

    const transaction = await verifyPaystackTransaction(reference);
    if (transaction.status !== 'success') {
      await markPaymentFailed(reference, `Paystack status: ${transaction.status}`);
      return res.status(402).json({ success: false, error: 'Payment has not completed successfully' });
    }
    await activatePaymentByReference(reference, transaction);
    res.json({ success: true, data: await buildBillingStatus(req.user!.funeralHomeId) });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(502).json({ success: false, error: error instanceof Error ? error.message : 'Payment verification failed' });
  }
});

function hasValidPaystackSignature(req: Request) {
  if (!env.PAYSTACK_SECRET_KEY) return false;
  const signature = req.header('x-paystack-signature');
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!signature || !rawBody) return false;
  const expected = createHmac('sha512', env.PAYSTACK_SECRET_KEY).update(rawBody).digest('hex');
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

router.post('/webhook', async (req, res) => {
  if (!hasValidPaystackSignature(req)) {
    return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
  }

  res.status(200).json({ success: true });
  const event = req.body as { event?: string; data?: any };
  const data = event.data || {};

  try {
    if (event.event === 'charge.success') {
      const matched = await activatePaymentByReference(data.reference, data);
      if (!matched) await recordRecurringCharge(data);
      return;
    }

    const subscriptionCode = data.subscription_code || data.subscription?.subscription_code;
    const customerCode = data.customer?.customer_code;
    const customerEmail = data.customer?.email;
    let subscription = (subscriptionCode || customerCode) ? await prisma.subscription.findFirst({
      where: { OR: [
        ...(subscriptionCode ? [{ paystackSubscriptionCode: subscriptionCode }] : []),
        ...(customerCode ? [{ paystackCustomerCode: customerCode }] : []),
      ] },
    }) : null;
    if (!subscription && customerEmail) {
      const funeralHome = await prisma.funeralHome.findUnique({ where: { email: customerEmail } });
      if (funeralHome) {
        subscription = await prisma.subscription.findUnique({ where: { funeralHomeId: funeralHome.id } });
      }
    }
    if (!subscription) return;

    if (event.event === 'subscription.create') {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'active',
          paystackSubscriptionCode: subscriptionCode || undefined,
          paystackEmailToken: data.email_token || undefined,
          paystackCustomerCode: customerCode || undefined,
        },
      });
    } else if (event.event === 'invoice.payment_failed') {
      await prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'attention' } });
    } else if (event.event === 'subscription.not_renew') {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'non-renewing', cancelAtPeriodEnd: true },
      });
    } else if (event.event === 'subscription.disable') {
      await prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'cancelled' } });
    }
  } catch (error) {
    console.error('Paystack webhook processing error:', error);
  }
});

export default router;
