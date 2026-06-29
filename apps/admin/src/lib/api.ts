import { getApiUrl } from './config';
import type {
  Memorial,
  ProgrammeItem,
  MemorialSettings,
  Photo,
  Tribute,
  MemorialLocation,
  CreateMemorialLocationInput,
  UpdateMemorialLocationInput,
  BillingStatus,
  PaymentKind,
  PlanCode,
} from '@memorialconnect/shared';

const API_URL = getApiUrl();

function getToken(): string | null {
  return localStorage.getItem('mc_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const contentType = res.headers.get('content-type');
    const json = contentType?.includes('application/json') ? await res.json() : null;

    if (!res.ok) {
      const message = json?.message || json?.error || `Request failed with status ${res.status}`;
      throw new Error(message);
    }

    return json.data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please try again');
      }
      throw error;
    }
    throw new Error('An unexpected error occurred');
  }
}

export const api = {
  login: (email: string, password: string) =>
    request<{ accessToken: string; user: { id: string; name: string; email: string } }>(
      '/api/v1/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    ),

  register: (data: { funeralHomeName: string; name: string; email: string; password: string }) =>
    request<{ accessToken: string; user: { id: string; name: string; email: string } }>(
      '/api/v1/auth/register',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  getMemorials: () => request<Memorial[]>('/api/v1/memorials'),

  createMemorial: (data: { deceasedName: string; serviceDate?: string; serviceVenue?: string }) =>
    request<Memorial>('/api/v1/memorials', { method: 'POST', body: JSON.stringify(data) }),

  getMemorial: (id: string) => request<MemorialDetail>(`/api/v1/memorials/${id}`),

  updateMemorial: (id: string, data: Partial<Memorial>) =>
    request<Memorial>(`/api/v1/memorials/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  programmeNext: (id: string) =>
    request<MemorialDetail>(`/api/v1/memorials/${id}/programme/next`, { method: 'POST' }),

  programmePrevious: (id: string) =>
    request<MemorialDetail>(`/api/v1/memorials/${id}/programme/previous`, { method: 'POST' }),

  uploadPhotos: async (memorialId: string, files: FileList, category: string, caption?: string) => {
    const token = getToken();
    const form = new FormData();
    Array.from(files).forEach((file) => form.append('photos', file));
    form.append('category', category);
    if (caption) form.append('caption', caption);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for uploads

    try {
      const res = await fetch(`${API_URL}/api/v1/memorials/${memorialId}/photos`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || 'Upload failed');
      return json.data as MemorialPhoto[];
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Upload timeout - please try again with smaller files');
        }
        throw error;
      }
      throw new Error('Upload failed');
    }
  },

  deletePhoto: (memorialId: string, photoId: string) =>
    request<void>(`/api/v1/memorials/${memorialId}/photos/${photoId}`, { method: 'DELETE' }),

  getLocations: (memorialId: string) =>
    request<MemorialLocation[]>(`/api/v1/memorials/${memorialId}/locations`),

  createLocation: (memorialId: string, data: CreateMemorialLocationInput) =>
    request<MemorialLocation>(`/api/v1/memorials/${memorialId}/locations`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateLocation: (memorialId: string, locationId: string, data: UpdateMemorialLocationInput) =>
    request<MemorialLocation>(`/api/v1/memorials/${memorialId}/locations/${locationId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteLocation: (memorialId: string, locationId: string) =>
    request<null>(`/api/v1/memorials/${memorialId}/locations/${locationId}`, { method: 'DELETE' }),

  getBillingStatus: () => request<BillingStatus>('/api/v1/billing/status'),

  initializePayment: (kind: PaymentKind, planCode?: PlanCode) =>
    request<{ authorization_url: string; access_code: string; reference: string }>('/api/v1/billing/initialize', {
      method: 'POST',
      body: JSON.stringify({ kind, planCode }),
    }),

  verifyPayment: (reference: string) =>
    request<BillingStatus>(`/api/v1/billing/verify/${encodeURIComponent(reference)}`),
};

interface MemorialDetail extends Memorial {
  obituary?: string;
  photos: Photo[];
  tributes: Tribute[];
  locations: MemorialLocation[];
}

interface MemorialPhoto {
  id: string;
  url: string;
  caption?: string;
  category: string;
  order: number;
}

export function photoUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${API_URL}${path}`;
}

export type {
  Memorial,
  MemorialDetail,
  ProgrammeItem,
  MemorialPhoto,
  MemorialSettings,
  Photo,
  Tribute,
  MemorialLocation,
  CreateMemorialLocationInput,
  UpdateMemorialLocationInput,
  BillingStatus,
  PaymentKind,
  PlanCode,
};
