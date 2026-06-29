import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BillingPage from '../pages/BillingPage';
import { api } from '../lib/api';

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      getBillingStatus: vi.fn(),
      verifyPayment: vi.fn(),
      initializePayment: vi.fn(),
    },
  };
});

describe('BillingPage', () => {
  it('shows funeral-count plans, usage and extra funeral price', async () => {
    vi.mocked(api.getBillingStatus).mockResolvedValue({
      checkoutAvailable: true,
      plans: [{
        code: 'starter',
        name: 'Memory Connect Starter',
        amount: 49999,
        currency: 'ZAR',
        interval: 'monthly',
        memorialLimit: 5,
        extraMemorialAmount: 14999,
        fairUseUnlimited: false,
        checkoutAvailable: true,
      }, {
        code: 'professional',
        name: 'Memory Connect Professional',
        amount: 99999,
        currency: 'ZAR',
        interval: 'monthly',
        memorialLimit: 15,
        extraMemorialAmount: 14999,
        fairUseUnlimited: false,
        checkoutAvailable: true,
      }, {
        code: 'unlimited',
        name: 'Memory Connect Unlimited',
        amount: 199999,
        currency: 'ZAR',
        interval: 'monthly',
        memorialLimit: 0,
        extraMemorialAmount: 0,
        fairUseUnlimited: true,
        checkoutAvailable: true,
      }],
      plan: {
        code: 'starter',
        name: 'Memory Connect Starter',
        amount: 49999,
        currency: 'ZAR',
        interval: 'monthly',
        memorialLimit: 5,
        extraMemorialAmount: 14999,
        fairUseUnlimited: false,
        checkoutAvailable: true,
      },
      subscription: {
        status: 'active',
        planCode: 'starter',
        currentPeriodStart: '2026-06-01T00:00:00.000Z',
        currentPeriodEnd: '2026-07-01T00:00:00.000Z',
        cancelAtPeriodEnd: false,
      },
      usage: { memorialsUsed: 2, memorialLimit: 5, extraCredits: 0, unlimited: false, remaining: 3 },
      payments: [],
    });

    render(<MemoryRouter initialEntries={['/billing']}><BillingPage /></MemoryRouter>);

    expect(await screen.findByText(/R\s?499\.99/)).toBeInTheDocument();
    expect(screen.getByText(/R\s?999\.99/)).toBeInTheDocument();
    expect(screen.getByText('R1999.99')).toBeInTheDocument();
    expect(screen.getByText('3 funerals left')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pay for one extra funeral/i })).toHaveTextContent(/R\s?149\.99/);
  });
});
