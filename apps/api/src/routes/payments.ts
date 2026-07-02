import { Router } from 'express';
import { completePublishPayment, MEMORIAL_STATUS, PAYMENT_PURPOSE, PAYMENT_STATUS, verifyPaystackSignature } from '../lib/publishing';
import { authenticate } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  const payments = await prisma.payment.findMany({
    where: { funeralHomeId: req.user!.funeralHomeId },
    include: { memorial: { select: { deceasedName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ success: true, data: payments });
});

router.post('/webhook', async (req, res) => {
  const signature = req.header('x-paystack-signature');
  const rawBody = (req as typeof req & { rawBody?: Buffer }).rawBody;
  if (!rawBody || !verifyPaystackSignature(rawBody, signature)) {
    return res.status(401).json({ success: false, error: 'Invalid Paystack signature' });
  }

  try {
    const event = req.body as { event?: string; data?: any };
    if (event.data?.metadata?.purpose === PAYMENT_PURPOSE) {
      if (event.event === 'charge.success') {
        await completePublishPayment(event.data.reference, event.data);
      } else if (event.event === 'charge.failed') {
        const payment = await prisma.payment.findUnique({ where: { paystackReference: event.data.reference } });
        if (payment && payment.status === PAYMENT_STATUS.PENDING) {
          await prisma.$transaction([
            prisma.payment.update({ where: { id: payment.id }, data: { status: PAYMENT_STATUS.FAILED } }),
            prisma.memorial.update({ where: { id: payment.memorialId }, data: { status: MEMORIAL_STATUS.DRAFT, paymentStatus: PAYMENT_STATUS.FAILED } }),
          ]);
        }
      }
    }
    res.sendStatus(200);
  } catch (error) {
    console.error('Paystack webhook error:', error);
    res.status(400).json({ success: false, error: 'Webhook could not be processed' });
  }
});

export default router;
