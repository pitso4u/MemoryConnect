import { Prisma } from '@prisma/client';
import { customAlphabet } from 'nanoid';
import { prisma } from './prisma';

export const PLAN_CODES = ['starter', 'professional', 'unlimited'] as const;
export type PlanCode = typeof PLAN_CODES[number];

export const BILLING_PLANS = {
  starter: {
    code: 'starter',
    name: 'Memory Connect Starter',
    amount: 49_999,
    currency: 'ZAR',
    interval: 'monthly',
    memorialLimit: 5,
    extraMemorialAmount: 14_999,
    fairUseUnlimited: false,
  },
  professional: {
    code: 'professional',
    name: 'Memory Connect Professional',
    amount: 99_999,
    currency: 'ZAR',
    interval: 'monthly',
    memorialLimit: 15,
    extraMemorialAmount: 14_999,
    fairUseUnlimited: false,
  },
  unlimited: {
    code: 'unlimited',
    name: 'Memory Connect Unlimited',
    amount: 199_999,
    currency: 'ZAR',
    interval: 'monthly',
    memorialLimit: 0,
    extraMemorialAmount: 0,
    fairUseUnlimited: true,
  },
} as const;

export const PAYMENT_KIND = {
  SUBSCRIPTION: 'subscription',
  EXTRA: 'extra_memorial',
} as const;

const generateReference = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 14);

export function isPlanCode(value: string): value is PlanCode {
  return PLAN_CODES.includes(value as PlanCode);
}

export function createPaymentReference(kind: string, planCode?: string) {
  const prefix = kind === PAYMENT_KIND.EXTRA ? 'mc-extra' : `mc-${planCode || 'plan'}`;
  return `${prefix}-${generateReference()}`;
}

export function addOneMonth(date: Date) {
  const result = new Date(date);
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDay));
  return result;
}

export async function ensureBillingPlans() {
  const plans = await Promise.all(
    Object.values(BILLING_PLANS).map((plan) => prisma.plan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        amount: plan.amount,
        currency: plan.currency,
        interval: plan.interval,
        memorialLimit: plan.memorialLimit,
        extraMemorialAmount: plan.extraMemorialAmount,
        fairUseUnlimited: plan.fairUseUnlimited,
        active: true,
      },
      create: { ...plan },
    })),
  );
  return PLAN_CODES.map((code) => plans.find((plan) => plan.code === code)!);
}

export async function ensureBillingPlan(code: PlanCode) {
  await ensureBillingPlans();
  return prisma.plan.findUniqueOrThrow({ where: { code } });
}

export function isSubscriptionActive(subscription: {
  status: string;
  currentPeriodEnd: Date | null;
} | null, now = new Date()) {
  return Boolean(
    subscription
    && ['active', 'non-renewing'].includes(subscription.status)
    && subscription.currentPeriodEnd
    && subscription.currentPeriodEnd > now,
  );
}

export async function getActiveSubscription(funeralHomeId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { funeralHomeId },
    include: { plan: true },
  });
  return isSubscriptionActive(subscription) ? subscription : null;
}

export async function getUsage(funeralHomeId: string, subscription: NonNullable<Awaited<ReturnType<typeof getActiveSubscription>>>) {
  const periodStart = subscription.currentPeriodStart!;
  const periodEnd = subscription.currentPeriodEnd!;
  const [memorialsUsed, extraCredits] = await Promise.all([
    prisma.usageLedger.aggregate({
      where: { funeralHomeId, createdAt: { gte: periodStart, lt: periodEnd } },
      _sum: { quantity: true },
    }),
    prisma.payment.count({
      where: {
        funeralHomeId,
        kind: PAYMENT_KIND.EXTRA,
        status: 'success',
        paidAt: { gte: periodStart, lt: periodEnd },
      },
    }),
  ]);

  const used = memorialsUsed._sum.quantity || 0;
  const unlimited = subscription.plan.fairUseUnlimited;
  const total = unlimited ? null : subscription.plan.memorialLimit + extraCredits;
  return {
    memorialsUsed: used,
    memorialLimit: subscription.plan.memorialLimit,
    extraCredits,
    unlimited,
    remaining: unlimited ? null : Math.max(0, total! - used),
  };
}

export function canPublishAnotherMemorial(usage: Awaited<ReturnType<typeof getUsage>>) {
  return usage.unlimited || (usage.remaining ?? 0) > 0;
}

export async function activateSubscriptionPayment(paymentId: string, transaction: {
  id: number | string;
  reference: string;
  amount: number;
  currency: string;
  paid_at?: string | null;
  customer?: { customer_code?: string };
  subscription_code?: string | null;
}) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error('Payment record not found');
  if (payment.status === 'success') return payment;
  if (transaction.reference !== payment.paystackReference) throw new Error('Payment reference mismatch');
  if (transaction.amount !== payment.amount || transaction.currency !== payment.currency) {
    throw new Error('Payment amount or currency mismatch');
  }

  const paidAt = transaction.paid_at ? new Date(transaction.paid_at) : new Date();

  return prisma.$transaction(async (tx) => {
    let subscriptionId = payment.subscriptionId;
    if (payment.kind === PAYMENT_KIND.SUBSCRIPTION) {
      const plan = await tx.plan.findUniqueOrThrow({ where: { id: payment.planId! } });
      const subscription = await tx.subscription.upsert({
        where: { funeralHomeId: payment.funeralHomeId },
        update: {
          planId: plan.id,
          status: 'active',
          paystackCustomerCode: transaction.customer?.customer_code,
          paystackSubscriptionCode: transaction.subscription_code || undefined,
          currentPeriodStart: paidAt,
          currentPeriodEnd: addOneMonth(paidAt),
          cancelAtPeriodEnd: false,
        },
        create: {
          funeralHomeId: payment.funeralHomeId,
          planId: plan.id,
          status: 'active',
          paystackCustomerCode: transaction.customer?.customer_code,
          paystackSubscriptionCode: transaction.subscription_code || undefined,
          currentPeriodStart: paidAt,
          currentPeriodEnd: addOneMonth(paidAt),
        },
      });
      subscriptionId = subscription.id;
      await tx.funeralHome.update({
        where: { id: payment.funeralHomeId },
        data: { plan: plan.code },
      });
    }

    return tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'success',
        subscriptionId,
        paystackTransactionId: String(transaction.id),
        paidAt,
        failureMessage: null,
      },
    });
  });
}

export async function activatePaymentByReference(reference: string, transaction: Parameters<typeof activateSubscriptionPayment>[1]) {
  const payment = await prisma.payment.findUnique({ where: { paystackReference: reference } });
  if (!payment) return null;
  return activateSubscriptionPayment(payment.id, transaction);
}

export async function markPaymentFailed(reference: string, message: string) {
  return prisma.payment.updateMany({
    where: { paystackReference: reference, status: 'pending' },
    data: { status: 'failed', failureMessage: message },
  });
}

export async function recordRecurringCharge(data: {
  id: number | string;
  reference: string;
  amount: number;
  currency: string;
  paid_at?: string | null;
  customer?: { customer_code?: string };
}) {
  const customerCode = data.customer?.customer_code;
  if (!customerCode) return null;
  const subscription = await prisma.subscription.findFirst({
    where: { paystackCustomerCode: customerCode },
    include: { plan: true },
  });
  if (!subscription || data.amount !== subscription.plan.amount || data.currency !== subscription.plan.currency) return null;

  const paidAt = data.paid_at ? new Date(data.paid_at) : new Date();
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.upsert({
      where: { paystackReference: data.reference },
      update: { status: 'success', paidAt, paystackTransactionId: String(data.id) },
      create: {
        funeralHomeId: subscription.funeralHomeId,
        subscriptionId: subscription.id,
        planId: subscription.planId,
        kind: PAYMENT_KIND.SUBSCRIPTION,
        status: 'success',
        amount: data.amount,
        currency: data.currency,
        paystackReference: data.reference,
        paystackTransactionId: String(data.id),
        paidAt,
        metadata: { source: 'recurring_webhook' } as Prisma.InputJsonValue,
      },
    });
    await tx.subscription.update({
      where: { id: subscription.id },
      data: { status: 'active', currentPeriodStart: paidAt, currentPeriodEnd: addOneMonth(paidAt) },
    });
    return payment;
  });
}
