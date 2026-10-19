import { env } from './env';

const PAYSTACK_API = 'https://api.paystack.co';

export interface PaystackTransaction {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  paid_at?: string | null;
}

interface PaystackEnvelope<T> { status: boolean; message: string; data: T }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!env.EVENTS_PAYSTACK_SECRET_KEY) throw new Error('Events payments are not configured');
  const response = await fetch(`${PAYSTACK_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.EVENTS_PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const payload = await response.json() as PaystackEnvelope<T>;
  if (!response.ok || !payload.status) throw new Error(payload.message || 'Paystack request failed');
  return payload.data;
}

export function initializeEventsPayment(input: {
  email: string;
  amountCents: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, string>;
}) {
  return request<{ authorization_url: string; access_code: string; reference: string }>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      amount: input.amountCents,
      currency: 'ZAR',
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  });
}

export function verifyEventsPayment(reference: string) {
  return request<PaystackTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`);
}
