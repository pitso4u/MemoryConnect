import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChangePasswordPage from '../pages/ChangePasswordPage';
import { AuthProvider } from '../context/AuthContext';
import { BrandProvider } from '../context/BrandContext';

vi.mock('../lib/api', () => ({
  api: {
    changePassword: vi.fn(),
    getFuneralHomeProfile: vi.fn().mockResolvedValue({
      id: 'h1',
      name: 'Test Funeral Home',
      email: 'admin@example.com',
      whiteLabelEnabled: false,
      themeTemplate: 'classic',
      memorialStyle: 'rounded',
      animationLevel: 'subtle',
      galleryLayout: 'grid',
      timelineStyle: 'classic',
      programmeStyle: 'formal',
      analyticsAccessEnabled: true,
      apiAccessEnabled: false,
      dedicatedSupportEnabled: false,
      brand: {},
      branches: [],
      users: [],
    }),
  },
}));

import { api } from '../lib/api';

const mockChangePassword = api.changePassword as ReturnType<typeof vi.fn>;

function seedPendingSession() {
  localStorage.setItem('mc_token', 'temp-scoped-token');
  localStorage.setItem('mc_user', JSON.stringify({ id: 'u1', name: 'Test Admin', email: 'admin@example.com', role: 'FUNERAL_HOME_ADMIN' }));
  localStorage.setItem('mc_pending_change', '1');
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <BrandProvider>
          <ChangePasswordPage />
        </BrandProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('ChangePasswordPage', () => {
  beforeEach(() => {
    localStorage.clear();
    mockChangePassword.mockReset();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { featureVersion: 1, features: [] } }),
    }) as unknown as typeof fetch;
  });

  it('renders the forced password change form', async () => {
    seedPendingSession();
    renderPage();
    expect(await screen.findByText('Password change required')).toBeInTheDocument();
    expect(screen.getByLabelText('Temporary password')).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument();
  });

  it('redirects to login when there is no session', () => {
    renderPage();
    expect(screen.queryByText('Password change required')).not.toBeInTheDocument();
  });

  it('submits the temporary and new passwords and completes the change', async () => {
    seedPendingSession();
    mockChangePassword.mockResolvedValue({
      accessToken: 'fresh-full-token',
      user: { id: 'u1', name: 'Test Admin', email: 'admin@example.com', role: 'FUNERAL_HOME_ADMIN', funeralHomeId: 'h1' },
    });

    renderPage();
    fireEvent.change(await screen.findByLabelText('Temporary password'), { target: { value: 'temp-pass-123' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-permanent-456' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'new-permanent-456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set new password' }));

    await waitFor(() => expect(mockChangePassword).toHaveBeenCalledWith('temp-pass-123', 'new-permanent-456'));
    await waitFor(() => expect(localStorage.getItem('mc_token')).toBe('fresh-full-token'));
    expect(localStorage.getItem('mc_pending_change')).toBeNull();
  });

  it('rejects mismatched confirmation without calling the API', async () => {
    seedPendingSession();
    renderPage();
    fireEvent.change(await screen.findByLabelText('Temporary password'), { target: { value: 'temp-pass-123' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-permanent-456' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'different-789' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set new password' }));

    expect(await screen.findByText('New passwords do not match')).toBeInTheDocument();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });
});
