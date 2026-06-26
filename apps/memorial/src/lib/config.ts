const API_PORT = import.meta.env.VITE_API_PORT || '4000';

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
