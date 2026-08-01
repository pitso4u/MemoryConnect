import { prisma } from './prisma';

export interface CreditBundle {
  credits: number;
  priceCents: number;
}

export interface PlatformSettings {
  trialEnabled: boolean;
  trialDays: number;
  freeMemorialLimit: number;
  singleMemorialPriceCents: number;
  currency: string;
  subscriptionsEnabled: boolean;
  creditBundles: CreditBundle[];
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  trialEnabled: true,
  trialDays: 21,
  freeMemorialLimit: 3,
  singleMemorialPriceCents: 29_999,
  currency: 'ZAR',
  subscriptionsEnabled: false,
  creditBundles: [
    { credits: 10, priceCents: 10 * 29_999 },
    { credits: 25, priceCents: 25 * 29_999 },
    { credits: 30, priceCents: 30 * 29_999 },
    { credits: 50, priceCents: 50 * 29_999 },
    { credits: 100, priceCents: 100 * 29_999 },
  ],
};

const asBool = (value: string | undefined, fallback: boolean) => value === undefined ? fallback : value === 'true';
const asInt = (value: string | undefined, fallback: number) => {
  const parsed = value === undefined ? NaN : Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const asBundles = (value: string | undefined, fallback: CreditBundle[]): CreditBundle[] => {
  if (value === undefined) return fallback;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return fallback;
    const bundles = parsed.filter(
      (item): item is CreditBundle => Boolean(item)
        && Number.isFinite((item as CreditBundle).credits)
        && Number.isInteger((item as CreditBundle).credits)
        && (item as CreditBundle).credits > 0
        && Number.isFinite((item as CreditBundle).priceCents)
        && (item as CreditBundle).priceCents > 0,
    );
    return bundles.length > 0 ? bundles : fallback;
  } catch {
    return fallback;
  }
};

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const rows = await prisma.platformSetting.findMany({ where: { category: 'commercial' } });
  const raw = new Map(rows.map((row) => [row.key, row.value]));
  return {
    trialEnabled: asBool(raw.get('trialEnabled'), DEFAULT_PLATFORM_SETTINGS.trialEnabled),
    trialDays: asInt(raw.get('trialDays'), DEFAULT_PLATFORM_SETTINGS.trialDays),
    freeMemorialLimit: asInt(raw.get('freeMemorialLimit'), DEFAULT_PLATFORM_SETTINGS.freeMemorialLimit),
    singleMemorialPriceCents: asInt(raw.get('singleMemorialPriceCents'), DEFAULT_PLATFORM_SETTINGS.singleMemorialPriceCents),
    currency: raw.get('currency') || DEFAULT_PLATFORM_SETTINGS.currency,
    subscriptionsEnabled: asBool(raw.get('subscriptionsEnabled'), DEFAULT_PLATFORM_SETTINGS.subscriptionsEnabled),
    creditBundles: asBundles(raw.get('creditBundles'), DEFAULT_PLATFORM_SETTINGS.creditBundles),
  };
}

export async function updatePlatformSettings(partial: Partial<PlatformSettings>): Promise<PlatformSettings> {
  const current = await getPlatformSettings();
  const next: PlatformSettings = { ...current, ...partial };

  const entries: Array<[string, string]> = [
    ['trialEnabled', String(next.trialEnabled)],
    ['trialDays', String(next.trialDays)],
    ['freeMemorialLimit', String(next.freeMemorialLimit)],
    ['singleMemorialPriceCents', String(next.singleMemorialPriceCents)],
    ['currency', next.currency],
    ['subscriptionsEnabled', String(next.subscriptionsEnabled)],
    ['creditBundles', JSON.stringify(next.creditBundles)],
  ];

  for (const [key, value] of entries) {
    await prisma.platformSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value, category: 'commercial' },
    });
  }
  return next;
}

export async function ensurePlatformSettings(): Promise<PlatformSettings> {
  const existing = await prisma.platformSetting.count({ where: { category: 'commercial' } });
  if (existing > 0) return getPlatformSettings();
  return updatePlatformSettings({});
}
