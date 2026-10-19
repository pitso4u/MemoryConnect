import { randomBytes } from 'node:crypto';
import { prisma } from './prisma';
import type { PaystackTransaction } from './paystack';

export const EVENT_PUBLISH_PRICE_CENTS = 29_999;
export const EVENT_PUBLISH_CURRENCY = 'ZAR';
export const EVENT_PUBLISH_PURPOSE = 'EVENT_PUBLISH';

export function createEventPublishReference(eventId: string) {
  return `mc-event-${eventId}-${Date.now()}-${randomBytes(5).toString('hex')}`;
}

export async function completeEventPublishPayment(reference: string, transaction: PaystackTransaction) {
  const payment = await prisma.eventPayment.findUnique({ where: { providerRef: reference } });
  if (!payment) throw new Error('Payment not found');
  if (payment.status === 'SUCCESS') {
    return prisma.event.findUniqueOrThrow({ where: { id: payment.eventId } });
  }
  if (payment.purpose !== EVENT_PUBLISH_PURPOSE) throw new Error('Payment purpose mismatch');
  if (transaction.reference !== payment.providerRef) throw new Error('Payment reference mismatch');
  if (transaction.status !== 'success') throw new Error('Payment has not succeeded');
  if (payment.amountCents !== EVENT_PUBLISH_PRICE_CENTS || transaction.amount !== EVENT_PUBLISH_PRICE_CENTS) {
    throw new Error('Payment amount mismatch');
  }
  if (payment.currency.toUpperCase() !== EVENT_PUBLISH_CURRENCY || transaction.currency.toUpperCase() !== EVENT_PUBLISH_CURRENCY) {
    throw new Error('Payment currency mismatch');
  }

  const event = await prisma.event.findUnique({ where: { id: payment.eventId } });
  if (!event) throw new Error('Event not found');
  if (event.status === 'ARCHIVED') throw new Error('This event is archived and cannot be published');
  const paidAt = transaction.paid_at ? new Date(transaction.paid_at) : new Date();
  const publishedAt = new Date();
  return prisma.$transaction(async (tx) => {
    await tx.eventPayment.update({ where: { id: payment.id }, data: { status: 'SUCCESS', paidAt, checkoutKey: null } });
    return tx.event.update({
      where: { id: event.id },
      data: { status: 'PUBLISHED', publishedAt },
    });
  });
}
