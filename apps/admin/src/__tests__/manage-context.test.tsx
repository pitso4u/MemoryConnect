import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { BrandProvider } from '../context/BrandContext';
import DashboardLayout from '../components/DashboardLayout';

// Keep the real api implementation (so header injection is exercised) but mock
// the brand fetch so the managing SUPER_ADMIN resolves a managed home's brand.
vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getFuneralHomeProfile: vi.fn().mockResolvedValue({
        id: 'h1',
        name: 'CoVision Funeral Home',
        email: 'covision@example.com',
        tradingName: 'CoVision Managed',
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
  };
});

import { api } from '../lib/api';

const SUPER_ADMIN = JSON.stringify({ id: 'sa1', name: 'Platform Owner', email: 'owner@memoryconnect.co.za', role: 'SUPER_ADMIN' });

function mockFetchFeatures() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ data: { featureVersion: 1, features: [] } }),
  }) as unknown as typeof fetch;
}

function ManageHarness() {
  const { user, managingHome, startManagingHome, stopManagingHome } = useAuth();
  return (
    <div>
      <span data-testid="role">{user?.role}</span>
      <span data-testid="managing">{managingHome ? managingHome.name : 'none'}</span>
      <button type="button" onClick={() => startManagingHome({ id: 'h1', name: 'CoVision Funeral Home' })}>start</button>
      <button type="button" onClick={() => stopManagingHome()}>stop</button>
    </div>
  );
}

describe('manage funeral home context', () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetchFeatures();
  });

  it('sends the X-Managing-Funeral-Home header on API calls while managing', async () => {
    localStorage.setItem('mc_token', 'token-1');
    localStorage.setItem('mc_managing_home', JSON.stringify({ id: 'h1', name: 'CoVision Funeral Home' }));
    await api.getMemorials();
    const init = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['X-Managing-Funeral-Home']).toBe('h1');
  });

  it('omits the header when no management target is set', async () => {
    localStorage.setItem('mc_token', 'token-1');
    await api.getMemorials();
    const init = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(init.headers as Record<string, string>).not.toHaveProperty('X-Managing-Funeral-Home');
  });

  it('starts and stops a management session from the auth context', async () => {
    localStorage.setItem('mc_token', 'token-1');
    localStorage.setItem('mc_user', SUPER_ADMIN);
    render(
      <MemoryRouter>
        <AuthProvider>
          <ManageHarness />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('role')).toHaveTextContent('SUPER_ADMIN');
    expect(screen.getByTestId('managing')).toHaveTextContent('none');

    fireEvent.click(screen.getByRole('button', { name: 'start' }));
    await waitFor(() => expect(screen.getByTestId('managing')).toHaveTextContent('CoVision Funeral Home'));
    expect(localStorage.getItem('mc_managing_home')).toContain('h1');

    fireEvent.click(screen.getByRole('button', { name: 'stop' }));
    await waitFor(() => expect(screen.getByTestId('managing')).toHaveTextContent('none'));
    expect(localStorage.getItem('mc_managing_home')).toBeNull();
  });

  it('drops a stale management target for a non-SUPER_ADMIN session', async () => {
    localStorage.setItem('mc_token', 'token-1');
    localStorage.setItem('mc_managing_home', JSON.stringify({ id: 'h1', name: 'CoVision Funeral Home' }));
    localStorage.setItem('mc_user', JSON.stringify({ id: 'u1', name: 'Home Admin', email: 'a@example.com', role: 'FUNERAL_HOME_ADMIN' }));
    render(
      <MemoryRouter>
        <AuthProvider>
          <ManageHarness />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('managing')).toHaveTextContent('none'));
    expect(localStorage.getItem('mc_managing_home')).toBeNull();
  });

  it('shows the manage-mode banner and exits back to the platform area', async () => {
    localStorage.setItem('mc_token', 'token-1');
    localStorage.setItem('mc_user', SUPER_ADMIN);
    localStorage.setItem('mc_managing_home', JSON.stringify({ id: 'h1', name: 'CoVision Funeral Home' }));
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <BrandProvider>
            <Routes>
              <Route path="/dashboard" element={<DashboardLayout />} />
              <Route path="/admin-owner/funeral-homes" element={<div>platform list</div>} />
            </Routes>
          </BrandProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('is managing')).toBeInTheDocument();
    expect(screen.getByText('CoVision Funeral Home')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Exit manage mode' }));

    await waitFor(() => expect(localStorage.getItem('mc_managing_home')).toBeNull());
    expect(screen.queryByText('is managing')).not.toBeInTheDocument();
  });
});
