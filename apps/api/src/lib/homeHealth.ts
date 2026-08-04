export const HOME_SEGMENTS = [
  'healthy',
  'needsAttention',
  'trialEnding',
  'paymentFailed',
  'inactive',
  'atRisk',
  'cancelled',
] as const;

export type HomeSegment = (typeof HOME_SEGMENTS)[number];

const SEGMENT_LABELS: Record<HomeSegment, string> = {
  healthy: 'Healthy',
  needsAttention: 'Needs Attention',
  trialEnding: 'Trial Ending',
  paymentFailed: 'Payment Failed',
  inactive: 'Inactive',
  atRisk: 'At Risk',
  cancelled: 'Cancelled',
};

export function segmentLabel(segment: HomeSegment): string {
  return SEGMENT_LABELS[segment];
}

const DAY = 86400000;

export interface HomeHealthInput {
  status?: string | null;
  createdAt?: Date | string | null;
  trialStartsAt?: Date | string | null;
  trialEndsAt?: Date | string | null;
  lastLoginAt?: Date | string | null;
  lastMemorialCreatedAt?: Date | string | null;
  totalMemorials: number;
  publishedMemorials: number;
  storageBytes: number;
  hasSuccessfulPayment: boolean;
  hasCreditPurchase: boolean;
  hasFailedPaymentRecently: boolean;
  hasPendingPaymentOverdue: boolean;
}

export interface HomeHealth {
  segment: HomeSegment;
  label: string;
  color: 'emerald' | 'amber' | 'red' | 'slate';
  reasons: string[];
}

function toDate(value?: Date | string | null): Date | null {
  return value ? new Date(value) : null;
}
const unix = (value: Date | null) => (value ? value.getTime() : null);

export function computeHomeHealth(input: HomeHealthInput): HomeHealth {
  const now = Date.now();
  const reasons: string[] = [];

  const status = (input.status || '').toUpperCase();
  if (['SUSPENDED', 'CANCELLED', 'TERMINATED'].includes(status)) {
    return { segment: 'cancelled', label: SEGMENT_LABELS.cancelled, color: 'slate', reasons: ['Account suspended'] };
  }

  const trialEnds = unix(toDate(input.trialEndsAt));
  const trialStarts = unix(toDate(input.trialStartsAt));
  const lastName = unix(toDate(input.lastLoginAt));
  const lastMemorial = unix(toDate(input.lastMemorialCreatedAt));
  const created = unix(toDate(input.createdAt));

  // Trial ending within 7 days
  if (trialEnds && trialEnds > now && trialEnds - now <= 7 * DAY) {
    const daysLeft = Math.max(1, Math.ceil((trialEnds - now) / DAY));
    reasons.push(`Trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`);
    return { segment: 'trialEnding', label: SEGMENT_LABELS.trialEnding, color: 'amber', reasons };
  }

  const loggedInRecently = lastName ? now - lastName <= 30 * DAY : false;
  const noLogin30 = lastName ? now - lastName > 30 * DAY : Boolean(created && now - created > 30 * DAY);
  if (noLogin30) reasons.push('No login in the last 30 days');

  const noMemorial60 = Boolean(
    (created && now - created > 60 * DAY && input.totalMemorials === 0) ||
    (lastMemorial && now - lastMemorial > 60 * DAY),
  );
  if (noMemorial60) reasons.push('No memorial activity in the last 60 days');

  const trialExpiredUnpaid = Boolean(
    trialStarts &&
    (!trialEnds || trialEnds <= now) &&
    !input.hasSuccessfulPayment &&
    !input.hasCreditPurchase,
  );
  if (trialExpiredUnpaid) reasons.push('Free trial ended without payment');

  if (input.hasPendingPaymentOverdue) reasons.push('An open payment is overdue');

  if (input.hasFailedPaymentRecently) {
    if (!reasons.includes('A recent payment failed')) reasons.push('A recent payment failed');
    return { segment: 'paymentFailed', label: SEGMENT_LABELS.paymentFailed, color: 'red', reasons };
  }

  if (trialExpiredUnpaid) {
    return { segment: 'atRisk', label: SEGMENT_LABELS.atRisk, color: 'red', reasons };
  }

  if (input.hasPendingPaymentOverdue) {
    return { segment: 'atRisk', label: SEGMENT_LABELS.atRisk, color: 'red', reasons };
  }

  if (noLogin30 || noMemorial60) {
    return { segment: 'inactive', label: SEGMENT_LABELS.inactive, color: 'amber', reasons };
  }

  if (input.storageBytes >= 2_000_000_000) {
    reasons.push('Storage usage is high');
    return { segment: 'needsAttention', label: SEGMENT_LABELS.needsAttention, color: 'amber', reasons };
  }

  if (!loggedInEver(input) && input.totalMemorials === 0) {
    reasons.push('Account has not been activated');
    return { segment: 'inactive', label: SEGMENT_LABELS.inactive, color: 'amber', reasons };
  }

  return {
    segment: 'healthy',
    label: SEGMENT_LABELS.healthy,
    color: 'emerald',
    reasons: loggedInEver(input) ? ['Account is in good standing'] : ['Account is active'],
  };
}

function loggedInEver(input: HomeHealthInput): boolean {
  return Boolean(input.lastLoginAt);
}