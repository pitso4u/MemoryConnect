import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../context/AuthContext';

function SessionProbe() {
  const { user, token, refreshFeatures } = useAuth();
  return (
    <div>
      <span data-testid="user">{user ? user.email : 'none'}</span>
      <span data-testid="token">{token ?? 'none'}</span>
      <button type="button" onClick={() => void refreshFeatures()}>Refresh</button>
    </div>
  );
}

function setSignedInUser() {
  localStorage.setItem('mc_token', 'expired-token-123');
  localStorage.setItem('mc_feature_version', '41');
  localStorage.setItem('mc_user', JSON.stringify({ id: 'u1', name: 'Test', email: 't@example.com', role: 'FUNERAL_HOME_ADMIN', funeralHomeId: 'fh1' }));
}

const unauthorized = { status: 401, ok: false } as Response;

describe('AuthContext feature refresh — 401 session handling', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('logs out and stops polling when /auth/my-features returns 401', async () => {
    setSignedInUser();

    const fetchMock = vi.fn(async () => unauthorized);
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider>
        <SessionProbe />
      </AuthProvider>,
    );

    // The dead session must be torn down instead of silently kept alive.
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('none'));
    expect(screen.getByTestId('token')).toHaveTextContent('none');
    expect(localStorage.getItem('mc_token')).toBeNull();
    expect(localStorage.getItem('mc_feature_version')).toBeNull();

    // A later refresh must short-circuit before any network call, so the dead
    // token can no longer feed 401s into the auth rate limiter.
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });
});
