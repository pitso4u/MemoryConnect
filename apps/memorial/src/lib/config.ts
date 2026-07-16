const API_PORT = import.meta.env.VITE_API_PORT || '4000';
const ADMIN_PORT = import.meta.env.VITE_ADMIN_PORT || '5173';

function withoutTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

/** Resolve API origin (no trailing slash, no /api suffix). */
export function getApiUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  if (fromEnv) {
    return fromEnv.replace(/\/api\/?$/, '').replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname.includes('memoryconnect.co.za')) {
      return `${window.location.protocol}//api.memoryconnect.co.za`;
    }
    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;
  }
  return `http://localhost:${API_PORT}`;
}

/** Resolve the funeral-home admin portal without deriving it from the public hostname in production. */
export function getAdminUrl(path = ''): string {
  const fromEnv = import.meta.env.VITE_ADMIN_URL;
  if (fromEnv) return `${withoutTrailingSlash(fromEnv)}${path}`;
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname.includes('memoryconnect.co.za')) {
      return `${window.location.protocol}//admin.memoryconnect.co.za${path}`;
    }
  }
  if (import.meta.env.PROD) return `https://admin.memoryconnect.co.za${path}`;
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:${ADMIN_PORT}${path}`;
  }
  return `http://localhost:${ADMIN_PORT}${path}`;
}

/** Public memorial origin, primarily for links that must stay on the guest-facing site. */
export function getPublicUrl(path = ''): string {
  const fromEnv = import.meta.env.VITE_PUBLIC_URL;
  if (fromEnv) return `${withoutTrailingSlash(fromEnv)}${path}`;
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname.includes('memoryconnect.co.za')) {
      return `${window.location.protocol}//memoryconnect.co.za${path}`;
    }
  }
  if (import.meta.env.PROD) return `https://memoryconnect.co.za${path}`;
  if (typeof window !== 'undefined') return `${window.location.origin}${path}`;
  return `http://localhost:5174${path}`;
}
