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
  MemorialAnalytics,
  PublishPayment,
  BrandProfile,
  FuneralHome,
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
    request<{ accessToken: string; user: AuthUser }>(
      '/api/v1/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    ),

  register: (data: { funeralHomeName: string; name: string; email: string; password: string }) =>
    request<{ accessToken: string; user: AuthUser }>(
      '/api/v1/auth/register',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  getFuneralHomeProfile: () => request<FuneralHomeProfile>('/api/v1/auth/funeral-home-profile'),

  updateFuneralHomeProfile: (data: Partial<FuneralHomeProfile>) =>
    request<FuneralHomeProfile>('/api/v1/auth/funeral-home-profile', { method: 'PATCH', body: JSON.stringify(data) }),

  getMemorials: () => request<Memorial[]>('/api/v1/memorials'),

  createMemorial: (data: { deceasedName: string; serviceDate?: string; serviceVenue?: string }) =>
    request<Memorial>('/api/v1/memorials', { method: 'POST', body: JSON.stringify(data) }),

  getMemorial: (id: string) => request<MemorialDetail>(`/api/v1/memorials/${id}`),

  getMemorialPreviewToken: (id: string) =>
    request<{ token: string; expiresInSeconds: number }>(`/api/v1/memorials/${id}/preview-token`),

  updateMemorial: (id: string, data: Partial<Memorial>) =>
    request<Memorial>(`/api/v1/memorials/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  initializePublishPayment: (id: string) =>
    request<{ authorizationUrl: string; accessCode: string; reference: string }>(`/api/v1/memorials/${id}/initialize-publish-payment`, { method: 'POST' }),

  verifyPublishPayment: (id: string, reference: string) =>
    request<Memorial>(`/api/v1/memorials/${id}/verify-publish-payment/${encodeURIComponent(reference)}`),

  deleteMemorial: (id: string) =>
    request<{ filesDeleted: number; bytesDeleted: number }>(`/api/v1/memorials/${id}`, { method: 'DELETE' }),

  createFamilyInvitation: (memorialId: string, data: { name: string; email?: string; phone?: string; role: 'FAMILY_MANAGER' | 'FAMILY_CONTRIBUTOR' }) =>
    request<FamilyInvitation>(`/api/v1/family/memorials/${memorialId}/invitations`, { method: 'POST', body: JSON.stringify(data) }),

  getFamilyAccess: (memorialId: string) =>
    request<FamilyAccess[]>(`/api/v1/family/memorials/${memorialId}/access`),

  revokeFamilyAccess: (memorialId: string, accessId: string) =>
    request<null>(`/api/v1/family/memorials/${memorialId}/access/${accessId}`, { method: 'DELETE' }),

  getFamilyInvite: (token: string) =>
    request<FamilyInvitePreview>(`/api/v1/family/invite/${encodeURIComponent(token)}`),

  acceptFamilyInvite: (token: string, data: { name?: string; email?: string; password?: string }) =>
    request<{ accessToken: string; user: AuthUser }>(`/api/v1/family/invite/${encodeURIComponent(token)}/accept`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMemorialAnalytics: (id: string) =>
    request<MemorialAnalytics>(`/api/v1/memorials/${id}/analytics`),

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

  getPayments: () => request<Array<PublishPayment & { memorial: { deceasedName: string } }>>('/api/v1/payments'),
};

interface MemorialDetail extends Memorial {
  obituary?: string;
  photos: Photo[];
  tributes: Tribute[];
  locations: MemorialLocation[];
  funeralHome?: FuneralHome & { brand?: BrandProfile };
}

interface MemorialPhoto {
  id: string;
  url: string;
  caption?: string;
  category: string;
  order: number;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  funeralHomeId?: string | null;
}

export interface FamilyInvitation {
  id: string;
  memorialId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: 'FAMILY_MANAGER' | 'FAMILY_CONTRIBUTOR';
  expiresAt: string;
  acceptedAt?: string | null;
  inviteUrl: string;
}

export interface FamilyAccess {
  id: string;
  memorialId: string;
  userId: string;
  role: 'FAMILY_MANAGER' | 'FAMILY_CONTRIBUTOR';
  createdAt: string;
  user: { id: string; name: string; email: string };
}

export interface FamilyInvitePreview {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: 'FAMILY_MANAGER' | 'FAMILY_CONTRIBUTOR';
  expiresAt: string;
  memorial: { id: string; deceasedName: string; serviceDate?: string | null };
  funeralHome: { name: string };
}

export interface FuneralHomeProfile {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  iconUrl?: string | null;
  tradingName?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  backgroundColor?: string | null;
  textColor?: string | null;
  fontFamily?: string | null;
  buttonStyle?: string | null;
  cardStyle?: string | null;
  borderRadius?: string | null;
  whatsapp?: string | null;
  websiteUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  footerText?: string | null;
  copyrightText?: string | null;
  whiteLabelEnabled: boolean;
  themeTemplate: string;
  homeBackgroundUrl?: string | null;
  loginBackgroundUrl?: string | null;
  memorialHeroUrl?: string | null;
  projectorBackgroundUrl?: string | null;
  pdfWatermarkUrl?: string | null;
  splashScreenUrl?: string | null;
  memorialStyle: string;
  animationLevel: string;
  galleryLayout: string;
  timelineStyle: string;
  programmeStyle: string;
  brand: BrandProfile;
  analyticsAccessEnabled: boolean;
  apiAccessEnabled: boolean;
  dedicatedSupportEnabled: boolean;
  branches: Array<{ id: string; name: string; address?: string | null }>;
  users: Array<{ id: string; name: string; email: string; role: string }>;
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
  MemorialAnalytics,
  PublishPayment,
  BrandProfile,
  FuneralHome,
};
