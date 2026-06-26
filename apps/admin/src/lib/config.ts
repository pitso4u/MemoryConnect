const API_PORT = import.meta.env.VITE_API_PORT || '4000';
const MEMORIAL_PORT = import.meta.env.VITE_MEMORIAL_PORT || '5174';

/** Resolve API origin (no trailing slash, no /api suffix). */
export function getApiUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  if (fromEnv) {
    return fromEnv.replace(/\/api\/?$/, '').replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;
  }
  return `http://localhost:${API_PORT}`;
}

/** Memorial guest portal base URL for previews and QR codes. */
export function getMemorialBaseUrl(demoNetworkUrl?: string): string {
  const demo = demoNetworkUrl?.trim();
  if (demo) return demo.replace(/\/$/, '');

  const fromEnv = import.meta.env.VITE_MEMORIAL_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:${MEMORIAL_PORT}`;
  }
  return `http://localhost:${MEMORIAL_PORT}`;
}

export function memorialPageUrl(slug: string, demoNetworkUrl?: string): string {
  return `${getMemorialBaseUrl(demoNetworkUrl)}/${slug}`;
}
