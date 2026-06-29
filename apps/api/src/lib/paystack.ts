import { env } from './env';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export interface PaystackTransactionData {
  id: number | string;
  status: string;
  reference: string;
  amount: number;
  currency: string;
  paid_at?: string | null;
  customer?: {
    email?: string;
    customer_code?: string;
  };
  metadata?: Record<string, unknown> | string | null;
  plan?: string | { plan_code?: string } | null;
  subscription_code?: string | null;
}

interface PaystackResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

async function paystackRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (!env.PAYSTACK_SECRET_KEY) {
    throw new Error('Paystack is not configured');
  }

  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const payload = await response.json() as PaystackResponse<T>;

  if (!response.ok || !payload.status) {
    throw new Error(payload.message || 'Paystack request failed');
  }

  return payload.data;
}

export function initializePaystackTransaction(input: {
  email: string;
  amount: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
  planCode?: string;
}) {
  return paystackRequest<{ authorization_url: string; access_code: string; reference: string }>(
    '/transaction/initialize',
    {
      method: 'POST',
      body: JSON.stringify({
        email: input.email,
        amount: String(input.amount),
        currency: input.currency,
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: input.metadata,
        ...(input.planCode ? { plan: input.planCode, channels: ['card'] } : {}),
      }),
    },
  );
}

export function verifyPaystackTransaction(reference: string) {
  return paystackRequest<PaystackTransactionData>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    { method: 'GET' },
  );
}
