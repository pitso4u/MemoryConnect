import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, canManageFuneralHome, isFuneralHomeRole } from '../middleware/auth';
import { getPlatformSettings, type PlatformSettings } from '../lib/platformSettings';
import { getEntitlementForFuneralHome, type EntitlementStatus } from '../lib/entitlement';
import {
  completeCreditPurchase,
  createCreditPurchaseReference,
  CREDIT_PURCHASE_PURPOSE,
  PAYMENT_STATUS,
} from '../lib/publishing';
import { initializePaystackTransaction, verifyPaystackTransaction } from '../lib/paystack';
import { env } from '../lib/env';
import { isZodError } from '../lib/validation';

const router = Router();

const purchaseSchema = z.object({
  bundleCredits: z.number().int().positive(),
});

function snapshot(entitlement: EntitlementStatus, settings: PlatformSettings) {
  return {
    ...entitlement,
    bundles: settings.creditBundles,
    subscriptionsEnabled: settings.subscriptionsEnabled,
  };
}

async function statusFor(funeralHomeId: string, settings: PlatformSettings) {
  const entitlement = await getEntitlementForFuneralHome(funeralHomeId, settings);
  if (!entitlement) return null;
  return snapshot(entitlement, settings);
}

router.get('/status', authenticate, async (req, res) => {
  if (!req.user!.funeralHomeId || !isFuneralHomeRole(req.user!.role)) {
    return res.status(403).json({ success: false, error: 'Entitlement is only available to funeral home users' });
  }
  const settings = await getPlatformSettings();
  const data = await statusFor(req.user!.funeralHomeId, settings);
  if (!data) return res.status(404).json({ success: false, error: 'Funeral home not found' });
  res.json({ success: true, data });
});

router.post('/credits/purchase', authenticate, async (req, res) => {
  if (!canManageFuneralHome(req.user!.role) || !req.user!.funeralHomeId) {
    return res.status(403).json({ success: false, error: 'Only funeral home admins can purchase credits' });
  }
  if (!env.PAYSTACK_SECRET_KEY) {
    return res.status(503).json({
      success: false,
      code: 'PAYSTACK_NOT_CONFIGURED',
      error: 'Paystack is not configured. Add PAYSTACK_SECRET_KEY to apps/api/.env and restart the API.',
    });
  }
  try {
    const body = purchaseSchema.parse(req.body);
    const settings = await getPlatformSettings();
    const bundle = settings.creditBundles.find((item) => item.credits === body.bundleCredits);
    if (!bundle) {
      return res.status(400).json({ success: false, error: 'That credit bundle is not available for purchase' });
    }

    const funeralHome = await prisma.funeralHome.findUnique({
      where: { id: req.user!.funeralHomeId },
      select: { email: true },
    });
    if (!funeralHome) return res.status(404).json({ success: false, error: 'Funeral home not found' });

    const reference = createCreditPurchaseReference(req.user!.funeralHomeId);
    const purchase = await prisma.creditPurchase.create({
      data: {
        funeralHomeId: req.user!.funeralHomeId,
        credits: bundle.credits,
        amountCents: bundle.priceCents,
        currency: settings.currency,
        status: PAYMENT_STATUS.PENDING,
        paystackReference: reference,
      },
    });

    try {
      const callbackBase = (env.ADMIN_URL || 'http://localhost:5173').replace(/\/$/, '');
      const checkout = await initializePaystackTransaction({
        email: funeralHome.email,
        amount: bundle.priceCents,
        currency: settings.currency,
        reference,
        callbackUrl: `${callbackBase}/billing?reference=${encodeURIComponent(reference)}`,
        metadata: { purpose: CREDIT_PURCHASE_PURPOSE, funeralHomeId: req.user!.funeralHomeId, credits: bundle.credits },
      });
      await prisma.creditPurchase.update({
        where: { id: purchase.id },
        data: { paystackAccessCode: checkout.access_code, authorizationUrl: checkout.authorization_url },
      });
      res.json({
        success: true,
        data: { authorizationUrl: checkout.authorization_url, accessCode: checkout.access_code, reference, credits: bundle.credits },
      });
    } catch (error) {
      await prisma.creditPurchase.update({ where: { id: purchase.id }, data: { status: PAYMENT_STATUS.FAILED } });
      console.error('Initialize credit purchase error:', error);
      res.status(502).json({ success: false, error: 'Paystack could not start the credit purchase' });
    }
  } catch (error) {
    if (isZodError(error)) return res.status(400).json({ success: false, error: error.errors[0].message });
    console.error('Credit purchase error:', error);
    res.status(500).json({ success: false, error: 'Failed to start the credit purchase' });
  }
});

router.get('/credits/verify/:reference', authenticate, async (req, res) => {
  if (!canManageFuneralHome(req.user!.role) || !req.user!.funeralHomeId) {
    return res.status(403).json({ success: false, error: 'Only funeral home admins can verify credit purchases' });
  }
  const reference = Array.isArray(req.params.reference) ? req.params.reference[0] : req.params.reference;
  const purchase = await prisma.creditPurchase.findFirst({
    where: { funeralHomeId: req.user!.funeralHomeId, paystackReference: reference },
  });
  if (!purchase) return res.status(404).json({ success: false, error: 'Credit purchase not found' });
  try {
    const transaction = await verifyPaystackTransaction(purchase.paystackReference);
    await completeCreditPurchase(purchase.paystackReference, transaction);
    const settings = await getPlatformSettings();
    const data = await statusFor(req.user!.funeralHomeId, settings);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Verify credit purchase error:', error);
    res.status(402).json({ success: false, error: error instanceof Error ? error.message : 'Credit purchase could not be verified' });
  }
});

export default router;
