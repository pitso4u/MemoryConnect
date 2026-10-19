import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../context/AuthContext';

const BROCHURE = {
  key: 'BROCHURES',
  name: 'Digital Brochures',
  enabled: true,
  visibility: 'ENABLED',
  reason: 'Enabled for this funeral home',
} as const;

function Probe() {
  const { resolvedFeatures, hasFeature, refreshFeatures } = useAuth();
  return (
    <div>
      <span data-testid="count">{String(resolvedFeatures.length)}</span>
      <span data-testid="has-brochures">{String(hasFeature('BROCHURES'))}</span>
      <button type="button" onClick={() => void refreshFeatures()}>Refresh</button>
    </div>
  );
}

function okResponse(features: unknown[], version: number) {
  return {
    status: 200,
    ok: true,
    json: async () => ({ success: true, data: { featureVersion: version, features } }),
  } as Response;
}

const notModified = { status: 304, ok: false } as Response;

function setSignedInUser() {
  localStorage.setItem('mc_token', 'token-123');
  localStorage.setItem('mc_user', JSON.stringify({ id: 'u1', name: 'Test', email: 't@example.com', role: 'FUNERAL_HOME_ADMIN', funeralHomeId: 'fh1' }));
}

describe('AuthContext feature refresh — 304 Not Modified handling', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refetches unconditionally when a fresh page load receives 304 (version retained, payload lost)', async () => {
    setSignedInUser();
    localStorage.setItem('mc_feature_version', '41');

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = (init?.headers as Record<string, string> | undefined) ?? {};
      if (headers['If-None-Match']) return notModified;
      return okResponse([BROCHURE], 42);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    // A 304 must not leave the freshly-loaded page with an empty feature set.
    await waitFor(() => expect(screen.getByTestId('has-brochures')).toHaveTextContent('true'));
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    // Exactly one conditional fetch followed by one unconditional retry.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // The stored version is replaced by the fresh payload's version.
    expect(localStorage.getItem('mc_feature_version')).toBe('42');
  });

  it('keeps the in-memory feature set when an already-loaded session receives 304 (ETag optimization preserved)', async () => {
    setSignedInUser();

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = (init?.headers as Record<string, string> | undefined) ?? {};
      if (headers['If-None-Match']) return notModified;
      return okResponse([BROCHURE], 41);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('has-brochures')).toHaveTextContent('true'));
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(localStorage.getItem('mc_feature_version')).toBe('41');

    // A later poll/navigation/focus refresh returns 304; the loaded set must survive.
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId('has-brochures')).toHaveTextContent('true'));
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });
});
