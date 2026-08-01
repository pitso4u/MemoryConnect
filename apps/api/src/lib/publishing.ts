import crypto from 'crypto';
import { prisma } from './prisma';
import { env } from './env';
import { autoGenerateQrPoster } from './qrPoster';
import { consumeFreePublish } from './entitlement';
import type { PaystackTransactionData } from './paystack';

export const PUBLISH_PRICE_CENTS = 29_999;
export const PUBLISH_CURRENCY = 'ZAR';
export const PAYMENT_PURPOSE = 'FUNERAL_PUBLISH';
export const CREDIT_PURCHASE_PURPOSE = 'MEMORIAL_CREDITS';
export const PUBLIC_DAYS = 30;
export const RETENTION_DAYS = 90;

export const MEMORIAL_STATUS = {
  DRAFT: 'DRAFT',
  PAID_PENDING: 'PAID_PENDING',
  PUBLISHED: 'PUBLISHED',
  LOCKED: 'LOCKED',
  EXPIRED: 'EXPIRED',
  DELETED: 'DELETED',
} as const;

export const PAYMENT_STATUS = {
  UNPAID: 'UNPAID',
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  ABANDONED: 'ABANDONED',
  GRATIS: 'GRATIS',
} as const;

export function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function createPublishReference(memorialId: string) {
  return `mc-funeral-${memorialId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

export function createCreditPurchaseReference(funeralHomeId: string) {
  return `mc-credits-${funeralHomeId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

export function isEditLocked(memorial: { status: string; editLocksAt: Date | null }, now = new Date()) {
  return memorial.status === MEMORIAL_STATUS.LOCKED
    || Boolean(memorial.editLocksAt && memorial.editLocksAt <= now);
}

export function isPubliclyViewable(memorial: {
  status: string;
  publicExpiresAt: Date | null;
  deletedAt: Date | null;
  isDemo?: boolean | null;
}, now = new Date()) {
  if (memorial.isDemo) {
    return [MEMORIAL_STATUS.PUBLISHED, MEMORIAL_STATUS.LOCKED].includes(memorial.status as 'PUBLISHED' | 'LOCKED')
      && !memorial.deletedAt;
  }
  return [MEMORIAL_STATUS.PUBLISHED, MEMORIAL_STATUS.LOCKED].includes(memorial.status as 'PUBLISHED' | 'LOCKED')
    && !memorial.deletedAt
    && Boolean(memorial.publicExpiresAt && memorial.publicExpiresAt > now);
}

export function verifyPaystackSignature(rawBody: Buffer, signature?: string) {
  if (!env.PAYSTACK_SECRET_KEY || !signature) return false;
  const expected = crypto.createHmac('sha512', env.PAYSTACK_SECRET_KEY).update(rawBody).digest('hex');
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function completePublishPayment(reference: string, transaction: PaystackTransactionData) {
  const payment = await prisma.payment.findUnique({ where: { paystackReference: reference } });
  if (!payment) throw new Error('Payment not found');
  if (payment.status === PAYMENT_STATUS.SUCCESS) {
    return prisma.memorial.findUniqueOrThrow({ where: { id: payment.memorialId } });
  }
  if (transaction.reference !== payment.paystackReference) throw new Error('Payment reference mismatch');
  if (transaction.status !== 'success') throw new Error('Payment has not succeeded');
  if (transaction.amount !== PUBLISH_PRICE_CENTS || payment.amountCents !== PUBLISH_PRICE_CENTS) throw new Error('Payment amount mismatch');
  if (transaction.currency.toUpperCase() !== PUBLISH_CURRENCY) throw new Error('Payment currency mismatch');

  const paidAt = transaction.paid_at ? new Date(transaction.paid_at) : new Date();
  const publishedAt = new Date();
  const published = await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: PAYMENT_STATUS.SUCCESS, paidAt },
    });
    return tx.memorial.update({
      where: { id: payment.memorialId },
      data: {
        status: MEMORIAL_STATUS.PUBLISHED,
        paymentStatus: PAYMENT_STATUS.SUCCESS,
        paymentId: payment.id,
        publishedAt,
        editLocksAt: addHours(publishedAt, env.MEMORIAL_EDIT_LOCK_HOURS),
        publicExpiresAt: addDays(publishedAt, PUBLIC_DAYS),
        deleteAfter: addDays(publishedAt, RETENTION_DAYS),
        deletedAt: null,
      },
    });
  });

  // Generate the printable A4 QR poster (best-effort, never blocks publishing).
  void autoGenerateQrPoster(published.id).then((qrPosterUrl) => {
    if (!qrPosterUrl) return;
    return prisma.memorial.update({ where: { id: published.id }, data: { qrPosterUrl } }).catch(() => undefined);
  });

  return published;
}

/**
 * Publishes a memorial without a Paystack charge by consuming trial allowance
 * or a prepaid credit. The entitlement consumption and the status transition
 * happen in a single transaction so a credit can never be spent without the
 * memorial becoming public.
 */
export async function publishMemorialWithEntitlement(
  memorialId: string,
  funeralHomeId: string,
  mode: 'TRIAL' | 'CREDITS',
) {
  const publishedAt = new Date();
  const published = await prisma.$transaction(async (tx) => {
    await consumeFreePublish(tx, funeralHomeId, mode);
    return tx.memorial.update({
      where: { id: memorialId },
      data: {
        status: MEMORIAL_STATUS.PUBLISHED,
        paymentStatus: PAYMENT_STATUS.GRATIS,
        publishedAt,
        editLocksAt: addHours(publishedAt, env.MEMORIAL_EDIT_LOCK_HOURS),
        publicExpiresAt: addDays(publishedAt, PUBLIC_DAYS),
        deleteAfter: addDays(publishedAt, RETENTION_DAYS),
        deletedAt: null,
      },
    });
  });

  void autoGenerateQrPoster(published.id).then((qrPosterUrl) => {
    if (!qrPosterUrl) return;
    return prisma.memorial.update({ where: { id: published.id }, data: { qrPosterUrl } }).catch(() => undefined);
  });

  return published;
}

/**
 * Applies a successful prepaid credit purchase: marks the CreditPurchase
 * record SUCCESS and credits the funeral home wallet atomically and
 * idempotently (a replayed webhook is a no-op).
 */
export async function completeCreditPurchase(reference: string, transaction: PaystackTransactionData) {
  const purchase = await prisma.creditPurchase.findUnique({ where: { paystackReference: reference } });
  if (!purchase) throw new Error('Credit purchase not found');
  if (purchase.status === PAYMENT_STATUS.SUCCESS) {
    return prisma.funeralHome.findUniqueOrThrow({ where: { id: purchase.funeralHomeId } });
  }
  if (transaction.reference !== purchase.paystackReference) throw new Error('Credit purchase reference mismatch');
  if (transaction.status !== 'success') throw new Error('Credit purchase has not succeeded');
  if (transaction.amount !== purchase.amountCents) throw new Error('Credit purchase amount mismatch');
  if (transaction.currency.toUpperCase() !== purchase.currency) throw new Error('Credit purchase currency mismatch');

  const paidAt = transaction.paid_at ? new Date(transaction.paid_at) : new Date();
  return prisma.$transaction(async (tx) => {
    await tx.creditPurchase.update({
      where: { id: purchase.id },
      data: { status: PAYMENT_STATUS.SUCCESS, paidAt },
    });
    return tx.funeralHome.update({
      where: { id: purchase.funeralHomeId },
      data: {
        memorialCreditsPurchased: { increment: purchase.credits },
        memorialCreditsRemaining: { increment: purchase.credits },
        lastCreditPurchaseAt: paidAt,
      },
    });
  });
}
