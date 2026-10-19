import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PaymentsPage from '../pages/PaymentsPage';
import { api } from '../lib/api';

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return { ...actual, api: { ...actual.api, getPayments: vi.fn() } };
});

describe('PaymentsPage', () => {
  it('shows only the pay-per-funeral publishing price', async () => {
    vi.mocked(api.getPayments).mockResolvedValue([]);
    render(<PaymentsPage />);
    expect(screen.getByText('Publish each funeral for R299.99')).toBeInTheDocument();
    expect(screen.getByText('R299.99')).toBeInTheDocument();
    expect(screen.getByText('Unlimited free drafts')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How to explain the process' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy wording' })).toBeInTheDocument();
    expect(screen.queryByText(/per month/i)).not.toBeInTheDocument();
  });
});
