import crypto from 'crypto';
import { prisma } from './prisma';
import { env } from './env';
import type { PaystackTransactionData } from './paystack';

export const PUBLISH_PRICE_CENTS = 29_999;
export const PUBLISH_CURRENCY = 'ZAR';
export const PAYMENT_PURPOSE = 'FUNERAL_PUBLISH';
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

export function isEditLocked(memorial: { status: string; editLocksAt: Date | null }, now = new Date()) {
  return memorial.status === MEMORIAL_STATUS.LOCKED
    || Boolean(memorial.editLocksAt && memorial.editLocksAt <= now);
}

export function isPubliclyViewable(memorial: {
  status: string;
  publicExpiresAt: Date | null;
  deletedAt: Date | null;
}, now = new Date()) {
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
  return prisma.$transaction(async (tx) => {
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
}
