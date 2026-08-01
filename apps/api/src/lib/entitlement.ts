import { prisma } from './prisma';
import { getPlatformSettings, type PlatformSettings } from './platformSettings';
import type { Prisma } from '../generated/prisma';

export type PublishMode = 'TRIAL' | 'CREDITS' | 'PAY_AS_YOU_GO';

export interface TrialStatus {
  active: boolean;
  startedAt: string | null;
  endsAt: string | null;
  daysRemaining: number | null;
  freeMemorialsUsed: number;
  freeMemorialLimit: number;
}

export interface EntitlementStatus {
  mode: PublishMode;
  trial: TrialStatus;
  creditsRemaining: number;
  creditsPurchased: number;
  lastCreditPurchaseAt: string | null;
  singleMemorialPriceCents: number;
  currency: string;
}

export interface EntitlementHome {
  trialStartsAt: Date | null;
  trialEndsAt: Date | null;
  trialMemorialsUsed: number;
  memorialCreditsPurchased: number;
  memorialCreditsRemaining: number;
  lastCreditPurchaseAt: Date | null;
}

export const ENTITLEMENT_HOME_FIELDS = {
  trialStartsAt: true,
  trialEndsAt: true,
  trialMemorialsUsed: true,
  memorialCreditsPurchased: true,
  memorialCreditsRemaining: true,
  lastCreditPurchaseAt: true,
} as const;

export function computeEntitlement(home: EntitlementHome, settings: PlatformSettings, now = new Date()): EntitlementStatus {
  const trialEnabled = settings.trialEnabled && home.trialStartsAt !== null;
  const trialActive = trialEnabled && home.trialEndsAt !== null && home.trialEndsAt > now;
  const daysRemaining = home.trialEndsAt
    ? Math.max(0, Math.ceil((home.trialEndsAt.getTime() - now.getTime()) / 86_400_000))
    : null;

  let mode: PublishMode = 'PAY_AS_YOU_GO';
  if (trialActive && home.trialMemorialsUsed < settings.freeMemorialLimit) {
    mode = 'TRIAL';
  } else if (home.memorialCreditsRemaining > 0) {
    mode = 'CREDITS';
  }

  return {
    mode,
    trial: {
      active: trialActive,
      startedAt: home.trialStartsAt ? home.trialStartsAt.toISOString() : null,
      endsAt: home.trialEndsAt ? home.trialEndsAt.toISOString() : null,
      daysRemaining,
      freeMemorialsUsed: home.trialMemorialsUsed,
      freeMemorialLimit: settings.freeMemorialLimit,
    },
    creditsRemaining: home.memorialCreditsRemaining,
    creditsPurchased: home.memorialCreditsPurchased,
    lastCreditPurchaseAt: home.lastCreditPurchaseAt ? home.lastCreditPurchaseAt.toISOString() : null,
    singleMemorialPriceCents: settings.singleMemorialPriceCents,
    currency: settings.currency,
  };
}

export function canPublishFree(status: EntitlementStatus): status is EntitlementStatus & { mode: 'TRIAL' | 'CREDITS' } {
  return status.mode !== 'PAY_AS_YOU_GO';
}

export async function getEntitlementForFuneralHome(funeralHomeId: string, settings?: PlatformSettings) {
  const [home, resolvedSettings] = await Promise.all([
    prisma.funeralHome.findUnique({
      where: { id: funeralHomeId },
      select: ENTITLEMENT_HOME_FIELDS,
    }),
    settings ? Promise.resolve(settings) : getPlatformSettings(),
  ]);
  if (!home) return null;
  return computeEntitlement(home, resolvedSettings);
}

export function consumeFreePublish(
  tx: Prisma.TransactionClient,
  funeralHomeId: string,
  mode: 'TRIAL' | 'CREDITS',
) {
  if (mode === 'TRIAL') {
    return tx.funeralHome.update({
      where: { id: funeralHomeId },
      data: { trialMemorialsUsed: { increment: 1 } },
    });
  }
  return tx.funeralHome.update({
    where: { id: funeralHomeId },
    data: { memorialCreditsRemaining: { decrement: 1 } },
  });
}
