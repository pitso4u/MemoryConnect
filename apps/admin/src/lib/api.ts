import { getApiUrl } from './config';
import { getManageTargetId } from './manageContext';
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
  FuneralFeedback,
  FuneralFeedbackSummary,
  FuneralContactEnquiry,
  Feature,
  FeatureWithOverrides,
  ResolvedFeature,
  FeatureAuditLogEntry,
  FeatureDependency,
  FuneralHomeFeatureInput,
  UserFeatureInput,
  EntitlementSnapshot,
  PlatformCommercialSettings,
  MemorialCreditPurchase,
  MemorialPerformanceSummary,
} from '@memorialconnect/shared';

const API_URL = getApiUrl();

function getToken(): string | null {
  return localStorage.getItem('mc_token');
}

/**
 * Headers that accompany the current management context. When a SUPER_ADMIN is
 * managing a funeral home, every API call is scoped to that home server-side;
 * without a target (or for any other role) nothing is added.
 */
function managementHeaders(): Record<string, string> {
  const managingId = getManageTargetId();
  return managingId ? { 'X-Managing-Funeral-Home': managingId } : {};
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...managementHeaders(), ...extra };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeaders(),
    ...(options.headers as Record<string, string>),
  };

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
    request<{ accessToken: string; user: AuthUser; requiresPasswordChange?: boolean }>(
      '/api/v1/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    ),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ accessToken: string; user: AuthUser }>(
      '/api/v1/auth/change-password',
      { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }
    ),

  register: (data: { funeralHomeName: string; name: string; email: string; password: string }) =>
    request<{ accessToken: string; user: AuthUser }>(
      '/api/v1/auth/register',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  getFuneralHomeProfile: () => request<FuneralHomeProfile>('/api/v1/auth/funeral-home-profile'),

  updateFuneralHomeProfile: (data: Partial<FuneralHomeProfile>) =>
    request<FuneralHomeProfile>('/api/v1/auth/funeral-home-profile', { method: 'PATCH', body: JSON.stringify(data) }),

  uploadFuneralHomeLogo: async (file: File) => {
    const form = new FormData();
    form.append('logo', file);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/funeral-home-logo`, {
        method: 'POST',
        headers: authHeaders(),
        body: form,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || 'Logo upload failed');
      return json.data as { logoUrl: string; brand: BrandProfile };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        if (error.name === 'AbortError') throw new Error('Logo upload timed out');
        throw error;
      }
      throw new Error('Logo upload failed');
    }
  },

  getMemorials: () => request<Memorial[]>('/api/v1/memorials'),

  createMemorial: (data: { deceasedName: string; serviceDate?: string; serviceVenue?: string; timezone?: string }) =>
    request<Memorial>('/api/v1/memorials', { method: 'POST', body: JSON.stringify(data) }),

  getMemorial: (id: string) => request<MemorialDetail>(`/api/v1/memorials/${id}`),

  getMemorialPreviewToken: (id: string) =>
    request<{ token: string; expiresInSeconds: number }>(`/api/v1/memorials/${id}/preview-token`),

  updateMemorial: (id: string, data: Partial<Memorial>) =>
    request<Memorial>(`/api/v1/memorials/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  initializePublishPayment: (id: string) =>
    request<{ free?: boolean; mode?: 'TRIAL' | 'CREDITS'; memorial?: MemorialDetail; authorizationUrl?: string; accessCode?: string; reference?: string }>(`/api/v1/memorials/${id}/initialize-publish-payment`, { method: 'POST' }),

  verifyPublishPayment: (id: string, reference: string) =>
    request<Memorial>(`/api/v1/memorials/${id}/verify-publish-payment/${encodeURIComponent(reference)}`),

  deleteMemorial: (id: string) =>
    request<{ filesDeleted: number; bytesDeleted: number }>(`/api/v1/memorials/${id}`, { method: 'DELETE' }),

  uploadLogo: async (memorialId: string, file: File) => {
    const form = new FormData();
    form.append('logo', file);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${API_URL}/api/v1/memorials/${memorialId}/logo`, {
        method: 'POST',
        headers: authHeaders(),
        body: form,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || 'Logo upload failed');
      return json.data as { logoUrl: string };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        if (error.name === 'AbortError') throw new Error('Logo upload timed out');
        throw error;
      }
      throw new Error('Logo upload failed');
    }
  },

  createFamilyInvitation: (memorialId: string, data: { name: string; email?: string; phone?: string; role: 'FAMILY_MANAGER' | 'FAMILY_CONTRIBUTOR' }) =>
    request<FamilyInvitation>(`/api/v1/family/memorials/${memorialId}/invitations`, { method: 'POST', body: JSON.stringify(data) }),

  getFamilyInvitations: (memorialId: string) =>
    request<FamilyInvitation[]>(`/api/v1/family/memorials/${memorialId}/invitations`),

  resendFamilyInvitation: (memorialId: string, invitationId: string) =>
    request<FamilyInvitation>(`/api/v1/family/memorials/${memorialId}/invitations/${invitationId}/resend`, { method: 'POST' }),

  revokeFamilyInvitation: (memorialId: string, invitationId: string) =>
    request<null>(`/api/v1/family/memorials/${memorialId}/invitations/${invitationId}`, { method: 'DELETE' }),

  getFamilyAccess: (memorialId: string) =>
    request<FamilyAccess[]>(`/api/v1/family/memorials/${memorialId}/access`),

  revokeFamilyAccess: (memorialId: string, accessId: string) =>
    request<null>(`/api/v1/family/memorials/${memorialId}/access/${accessId}`, { method: 'DELETE' }),

  sendFamilyPasswordReset: (memorialId: string, accessId: string) =>
    request<{ resetUrl: string; sentByEmail: boolean; expiresAt: string }>(`/api/v1/family/memorials/${memorialId}/access/${accessId}/password-reset`, { method: 'POST' }),

  getFamilyInvite: (token: string) =>
    request<FamilyInvitePreview>(`/api/v1/family/invite/${encodeURIComponent(token)}`),

  acceptFamilyInvite: (token: string, data: { name?: string; email?: string; password?: string }) =>
    request<{ accessToken: string; user: AuthUser }>(`/api/v1/family/invite/${encodeURIComponent(token)}/accept`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMemorialAnalytics: (id: string) =>
    request<MemorialAnalytics>(`/api/v1/memorials/${id}/analytics`),

  getMemorialPerformanceSummary: () =>
    request<MemorialPerformanceSummary>('/api/v1/memorials/performance/summary'),

  programmeNext: (id: string) =>
    request<MemorialDetail>(`/api/v1/memorials/${id}/programme/next`, { method: 'POST' }),

  programmePrevious: (id: string) =>
    request<MemorialDetail>(`/api/v1/memorials/${id}/programme/previous`, { method: 'POST' }),

  uploadPhotos: async (memorialId: string, files: FileList, category: string, caption?: string) => {
    const form = new FormData();
    Array.from(files).forEach((file) => form.append('photos', file));
    form.append('category', category);
    if (caption) form.append('caption', caption);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for uploads

    try {
      const res = await fetch(`${API_URL}/api/v1/memorials/${memorialId}/photos`, {
        method: 'POST',
        headers: authHeaders(),
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

  getEntitlementStatus: () => request<EntitlementSnapshot>('/api/v1/entitlement/status'),

  purchaseCredits: (bundleCredits: number) =>
    request<{ authorizationUrl: string; accessCode: string; reference: string; credits: number }>('/api/v1/entitlement/credits/purchase', {
      method: 'POST',
      body: JSON.stringify({ bundleCredits }),
    }),

  verifyCreditPurchase: (reference: string) =>
    request<EntitlementSnapshot>(`/api/v1/entitlement/credits/verify/${encodeURIComponent(reference)}`),

  getPlatformSummary: () => request<PlatformSummary>('/api/v1/platform/summary'),
  getPlatformFuneralHomes: () => request<PlatformFuneralHome[]>('/api/v1/platform/funeral-homes'),
  getPlatformFuneralHome: (id: string) => request<PlatformFuneralHomeDetail>(`/api/v1/platform/funeral-homes/${id}`),
  getPlatformPayments: () => request<PlatformPayment[]>('/api/v1/platform/payments'),
  getPlatformUsers: () => request<PlatformUser[]>('/api/v1/platform/users'),
  getPlatformSupport: () => request<PlatformSupport>('/api/v1/platform/support'),
  getPlatformAnalytics: () => request<PlatformAnalytics>('/api/v1/platform/analytics'),
  getPlatformRevenue: () => request<PlatformRevenue>('/api/v1/platform/revenue'),
  getPlatformAuditLogs: () => request<PlatformAuditLog[]>('/api/v1/platform/audit-logs'),
  getPlatformDashboard: () => request<PlatformDashboard>('/api/v1/platform/dashboard'),
  searchPlatform: (query: string) => request<PlatformSearchResults>(`/api/v1/platform/search?q=${encodeURIComponent(query)}`),
  getPlatformNotifications: () => request<PlatformNotification[]>('/api/v1/platform/notifications'),
  suspendPlatformFuneralHome: (id: string) => request(`/api/v1/platform/funeral-homes/${id}/suspend`, { method: 'POST' }),
  reactivatePlatformFuneralHome: (id: string) => request(`/api/v1/platform/funeral-homes/${id}/reactivate`, { method: 'POST' }),
  sendPlatformPasswordReset: (id: string) =>
    request<{ resetUrl: string; email: string; expiresAt: string }>(`/api/v1/platform/users/${id}/send-password-reset`, { method: 'POST' }),
  generatePlatformTempPassword: (id: string) =>
    request<{ tempPassword: string; email: string; expiresAt: string }>(`/api/v1/platform/users/${id}/generate-temp-password`, { method: 'POST' }),
  resendPlatformInvite: (id: string) =>
    request<FamilyInvitation>(`/api/v1/platform/invites/${id}/resend`, { method: 'POST' }),
  verifyPlatformPayment: (id: string) =>
    request<PlatformPayment>(`/api/v1/platform/payments/${id}/verify`, { method: 'POST', body: JSON.stringify({ confirmed: true }) }),
  deletePlatformMemorial: (id: string) =>
    request<null>(`/api/v1/platform/memorials/${id}`, { method: 'DELETE', body: JSON.stringify({ confirmed: true }) }),

  getPlatformCommercialSettings: () => request<PlatformCommercialSettings>('/api/v1/platform/commercial-settings'),

  updatePlatformCommercialSettings: (data: Partial<PlatformCommercialSettings>) =>
    request<PlatformCommercialSettings>('/api/v1/platform/commercial-settings', { method: 'PATCH', body: JSON.stringify(data) }),

  getPlatformCreditPurchases: () =>
    request<Array<MemorialCreditPurchase & { funeralHome: { id: string; name: string } }>>('/api/v1/platform/credit-purchases'),

  verifyPlatformCreditPurchase: (id: string) =>
    request<MemorialCreditPurchase>(`/api/v1/platform/credit-purchases/${id}/verify`, { method: 'POST', body: JSON.stringify({ confirmed: true }) }),

  // ── Funeral Feedback ─────────────────────────────────────────────────────

  getMemorialFeedback: (id: string) =>
    request<FuneralFeedback[]>(`/api/v1/admin/memorials/${id}/feedback`),

  getMemorialFeedbackSummary: (id: string) =>
    request<FuneralFeedbackSummary>(`/api/v1/admin/memorials/${id}/feedback/summary`),

  updateFeedbackContactStatus: (memorialId: string, feedbackId: string, contactStatus: 'NEW' | 'CONTACTED' | 'CLOSED') =>
    request<FuneralFeedback>(`/api/v1/admin/memorials/${memorialId}/feedback/${feedbackId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ contactStatus }),
    }),

  getContactEnquiries: () =>
    request<{ enquiries: FuneralContactEnquiry[]; summary: { NEW: number; CONTACTED: number; CLOSED: number; total: number; thisMonth: number } }>('/api/v1/admin/contact-enquiries'),

  getMemorialPublicUrl: (id: string) =>
    request<{ slug: string; publicUrl: string; qrCodeUrl: string }>(`/api/v1/admin/memorials/${id}/public-url`),

  // ── Marketing Hub ─────────────────────────────────────────────────────────

  getMarketingDashboard: () =>
    request<MarketingDashboard>('/api/v1/marketing/dashboard'),

  getMarketingContact: () =>
    request<MarketingContact | null>('/api/v1/marketing/contact'),

  updateMarketingContact: (data: Partial<MarketingContact>) =>
    request<MarketingContact>('/api/v1/marketing/contact', { method: 'PUT', body: JSON.stringify(data) }),

  uploadMarketingContactLogo: async (file: File) => {
    const form = new FormData();
    form.append('logo', file);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${API_URL}/api/v1/marketing/contact/logo`, {
        method: 'POST',
        headers: authHeaders(),
        body: form,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || 'Logo upload failed');
      return json.data as { logoUrl: string };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        if (error.name === 'AbortError') throw new Error('Logo upload timed out');
        throw error;
      }
      throw new Error('Logo upload failed');
    }
  },

  uploadMarketingContactCover: async (file: File) => {
    const form = new FormData();
    form.append('cover', file);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${API_URL}/api/v1/marketing/contact/cover`, {
        method: 'POST',
        headers: authHeaders(),
        body: form,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || 'Cover upload failed');
      return json.data as { coverImageUrl: string };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        if (error.name === 'AbortError') throw new Error('Cover upload timed out');
        throw error;
      }
      throw new Error('Cover upload failed');
    }
  },

  getBrochureCategories: () =>
    request<BrochureCategory[]>('/api/v1/marketing/categories'),

  createBrochureCategory: (data: { name: string }) =>
    request<BrochureCategory>('/api/v1/marketing/categories', { method: 'POST', body: JSON.stringify(data) }),

  updateBrochureCategory: (id: string, data: { name: string }) =>
    request<BrochureCategory>(`/api/v1/marketing/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteBrochureCategory: (id: string) =>
    request<void>(`/api/v1/marketing/categories/${id}`, { method: 'DELETE' }),

  getBrochures: () =>
    request<Brochure[]>('/api/v1/marketing/brochures'),

  createBrochure: (data: Partial<Brochure>) =>
    request<Brochure>('/api/v1/marketing/brochures', { method: 'POST', body: JSON.stringify(data) }),

  getBrochure: (id: string) =>
    request<Brochure>(`/api/v1/marketing/brochures/${id}`),

  updateBrochure: (id: string, data: Partial<Brochure>) =>
    request<Brochure>(`/api/v1/marketing/brochures/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteBrochure: (id: string) =>
    request<void>(`/api/v1/marketing/brochures/${id}`, { method: 'DELETE' }),

  duplicateBrochure: (id: string) =>
    request<Brochure>(`/api/v1/marketing/brochures/${id}/duplicate`, { method: 'POST' }),

  uploadBrochureCover: async (id: string, file: File) => {
    const form = new FormData();
    form.append('cover', file);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${API_URL}/api/v1/marketing/brochures/${id}/cover`, {
        method: 'POST',
        headers: authHeaders(),
        body: form,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || 'Cover upload failed');
      return json.data as { coverImageUrl: string };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        if (error.name === 'AbortError') throw new Error('Cover upload timed out');
        throw error;
      }
      throw new Error('Cover upload failed');
    }
  },

  uploadBrochureGallery: async (id: string, files: FileList) => {
    const form = new FormData();
    Array.from(files).forEach((file) => form.append('gallery', file));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch(`${API_URL}/api/v1/marketing/brochures/${id}/gallery`, {
        method: 'POST',
        headers: authHeaders(),
        body: form,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || 'Gallery upload failed');
      return json.data as BrochureGalleryItem[];
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        if (error.name === 'AbortError') throw new Error('Gallery upload timed out');
        throw error;
      }
      throw new Error('Gallery upload failed');
    }
  },

  deleteBrochureGalleryItem: (id: string, galleryId: string) =>
    request<void>(`/api/v1/marketing/brochures/${id}/gallery/${galleryId}`, { method: 'DELETE' }),

  uploadBrochurePdf: async (id: string, file: File) => {
    const form = new FormData();
    form.append('pdf', file);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch(`${API_URL}/api/v1/marketing/brochures/${id}/pdf`, {
        method: 'POST',
        headers: authHeaders(),
        body: form,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || 'PDF upload failed');
      return json.data as { pdfUrl: string };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        if (error.name === 'AbortError') throw new Error('PDF upload timed out');
        throw error;
      }
      throw new Error('PDF upload failed');
    }
  },

  getBrochureQrCode: (id: string) =>
    request<{ qrCodeUrl: string; publicUrl: string }>(`/api/v1/marketing/brochures/${id}/qr-code`),

  reorderBrochures: (order: Array<{ id: string; displayOrder: number }>) =>
    request<void>('/api/v1/marketing/brochures/reorder', { method: 'PATCH', body: JSON.stringify(order) }),

  getPromotions: () =>
    request<Promotion[]>('/api/v1/marketing/promotions'),

  createPromotion: (data: Partial<Promotion>) =>
    request<Promotion>('/api/v1/marketing/promotions', { method: 'POST', body: JSON.stringify(data) }),

  getPromotion: (id: string) =>
    request<Promotion>(`/api/v1/marketing/promotions/${id}`),

  updatePromotion: (id: string, data: Partial<Promotion>) =>
    request<Promotion>(`/api/v1/marketing/promotions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deletePromotion: (id: string) =>
    request<void>(`/api/v1/marketing/promotions/${id}`, { method: 'DELETE' }),

  uploadPromotionBanner: async (id: string, file: File) => {
    const form = new FormData();
    form.append('banner', file);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${API_URL}/api/v1/marketing/promotions/${id}/banner`, {
        method: 'POST',
        headers: authHeaders(),
        body: form,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || 'Banner upload failed');
      return json.data as { bannerImageUrl: string };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        if (error.name === 'AbortError') throw new Error('Banner upload timed out');
        throw error;
      }
      throw new Error('Banner upload failed');
    }
  },

  getMarketingBranches: () =>
    request<MarketingBranch[]>('/api/v1/marketing/branches'),

  createMarketingBranch: (data: Partial<MarketingBranch>) =>
    request<MarketingBranch>('/api/v1/marketing/branches', { method: 'POST', body: JSON.stringify(data) }),

  getMarketingBranch: (id: string) =>
    request<MarketingBranch>(`/api/v1/marketing/branches/${id}`),

  updateMarketingBranch: (id: string, data: Partial<MarketingBranch>) =>
    request<MarketingBranch>(`/api/v1/marketing/branches/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteMarketingBranch: (id: string) =>
    request<void>(`/api/v1/marketing/branches/${id}`, { method: 'DELETE' }),

  getMarketingEnquiries: () =>
    request<Enquiry[]>('/api/v1/marketing/enquiries'),

  getMarketingEnquiry: (id: string) =>
    request<Enquiry>(`/api/v1/marketing/enquiries/${id}`),

  deleteMarketingEnquiry: (id: string) =>
    request<void>(`/api/v1/marketing/enquiries/${id}`, { method: 'DELETE' }),

  getMarketingAnalytics: (days: number = 30) =>
    request<MarketingAnalytics>(`/api/v1/marketing/analytics?days=${days}`),
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
  createdAt?: string;
  status?: 'Pending' | 'Accepted' | 'Expired';
  inviteUrl?: string | null;
  accountStatus?: 'Invitation pending' | 'Invitation accepted' | 'Account created';
  passwordSet?: boolean;
  lastLoginAt?: string | null;
  userId?: string | null;
}

export interface FamilyAccess {
  id: string;
  memorialId: string;
  userId: string;
  role: 'FAMILY_MANAGER' | 'FAMILY_CONTRIBUTOR';
  createdAt: string;
  user: { id: string; name: string; email: string; passwordSetAt?: string | null; lastLoginAt?: string | null; createdAt?: string };
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

export interface PlatformSummary {
  registrations: { total: number; today: number; month: number; pending: number; active: number; inactive: number };
  trials: { active: number; expired: number };
  users: { total: number; withoutPassword: number };
  payments: { totalRevenueCents: number; todayRevenueCents: number; monthRevenueCents: number; successful: number; failed: number; pending: number; creditPurchases: number; creditPurchaseRevenueCents: number };
  memorials: { total: number; draft: number; published: number; locked: number; expired: number; deleted: number; publishedThisMonth: number };
  totalPublicViews: number;
}

export interface PlatformFuneralHome {
  id: string;
  name: string;
  ownerName?: string | null;
  email: string;
  phone?: string | null;
  registeredAt: string;
  memorialCount: number;
  paymentsTotalCents: number;
  lastActivityAt: string;
  status: string;
  trialStartsAt?: string | null;
  trialEndsAt?: string | null;
  trialMemorialsUsed?: number;
  memorialCreditsPurchased?: number;
  memorialCreditsRemaining?: number;
  health?: PlatformHomeHealth;
}

export interface PlatformPayment {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  paystackReference: string;
  paidAt?: string | null;
  createdAt: string;
  funeralHome: { id: string; name: string };
  memorial: { id: string; deceasedName: string };
}

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: string;
  passwordSetAt?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  funeralHome?: { id: string; name: string; status: string } | null;
  passwordResetTokens: Array<{ id: string; createdAt: string; expiresAt: string }>;
}

export interface PlatformAuditLog {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: unknown;
  createdAt: string;
  actor: { name: string; email: string };
  funeralHome?: { name: string } | null;
}

export interface PlatformSupport {
  resetRequests: Array<{ id: string; createdAt: string; expiresAt: string; user: { id: string; name: string; email: string; funeralHome?: { id: string; name: string } | null } }>;
  failedLogins: Array<{ id: string; email: string; createdAt: string }>;
  pendingInvites: number;
  expiredInvites: number;
  usersWithoutPasswords: Array<{ id: string; name: string; email: string; role: string; funeralHome?: { id: string; name: string } | null }>;
}

export interface PlatformAnalytics {
  totalViews: number;
  viewsToday: number;
  mostViewedMemorials: Array<{ id: string; deceasedName: string; slug: string; viewCount: number; funeralHome: { id: string; name: string } }>;
  topHomesByMemorials: Array<{ id: string; name: string; memorialCount: number }>;
  topHomesByRevenue: Array<{ id: string; name: string; revenueCents: number }>;
  performance: {
    averageFirstDayViews: number;
    average72HourViews: number;
    memorialsOver100Views: number;
    memorialsOver500Views: number;
    monitoringCount: number;
    trendingMemorials: Array<{
      id: string;
      slug: string;
      deceasedName: string;
      funeralHome: { id: string; name: string };
      day: number | null;
      currentDayViews: number;
      total72HourViews: number;
      performanceRating: string;
      highestMilestoneAwarded: string | null;
      monitoring: boolean;
    }>;
  };
}

export interface PlatformRevenueTrendEntry {
  month: string;
  paymentsCents: number;
  creditsCents: number;
  totalCents: number;
}

export interface PlatformRevenueSummary {
  thisYearCents: number;
  thisMonthCents: number;
  lastMonthCents: number;
  growthPct: number;
}

export interface PlatformRevenueTopHome {
  id: string;
  name: string;
  revenueCents: number;
}

export interface PlatformRevenueStatusBreakdown {
  payments: { successful: number; failed: number; pending: number };
  creditPurchases: { successful: number; failed: number; pending: number };
}

export interface PlatformRevenue {
  trend: PlatformRevenueTrendEntry[];
  summary: PlatformRevenueSummary;
  topHomes: PlatformRevenueTopHome[];
  statusBreakdown: PlatformRevenueStatusBreakdown;
}

export interface PlatformFuneralHomeDetail extends FuneralHomeProfile {
  status: string;
  suspendedAt?: string | null;
  createdAt: string;
  trialStartsAt?: string | null;
  trialEndsAt?: string | null;
  trialMemorialsUsed?: number;
  memorialCreditsPurchased?: number;
  memorialCreditsRemaining?: number;
  lastCreditPurchaseAt?: string | null;
  users: PlatformUser[];
  memorials: Array<Memorial & { deletedAt?: string | null; editLocksAt?: string | null; publicExpiresAt?: string | null }>;
  payments: PlatformPayment[];
  creditPurchases: MemorialCreditPurchase[];
  familyInvitations: Array<FamilyInvitation & { memorial: { deceasedName: string } }>;
  platformAuditLogs: PlatformAuditLog[];
  featureOverrides: Array<{
    enabled: boolean;
    releaseChannelOverride?: string | null;
    enabledAt: string;
    featureKey: string;
    feature?: { key: string; name: string; releaseChannel: string; premium?: boolean } | null;
  }>;
  vehicles: Array<{ id: string; name: string; registrationNumber: string; vehicleType: string; status: string }>;
  assets: Array<{ id: string; name: string; category: string; status: string }>;
  storageBytes?: number;
  health?: PlatformHomeHealth;
  plan?: string;
  edition?: string;
  _count: { users: number; memorials: number; vehicles: number; assets: number };
}

export interface MarketingDashboard {
  totalBrochures: number;
  publishedBrochures: number;
  totalPromotions: number;
  activePromotions: number;
  totalEnquiries: number;
  totalBranches: number;
  totalViews: number;
  contactConfigured: boolean;
  recentEnquiries: Array<{
    id: string;
    fullName: string;
    phoneNumber?: string | null;
    emailAddress?: string | null;
    message?: string | null;
    brochure?: { title: string; slug: string };
    createdAt: string;
  }>;
}

export type ServiceStatus = 'ok' | 'warning' | 'critical';

export interface PlatformServiceHealth {
  status: ServiceStatus;
  label: string;
  detail?: string;
}

export interface PlatformServerLoad {
  version: string;
  uptimeSeconds: number;
  cpu: { loadAverage: [number, number, number]; percent: number };
  memory: { usedMb: number; totalMb: number; percent: number };
  storage: { usedBytes: number };
}

export interface PlatformTodayNumbers {
  revenueCents: number;
  memorialsCreated: number;
  memorialsPublished: number;
  visitors: number;
  qrScans: number;
  photoUploads: number;
  videosUploaded: number;
  newHomes: number;
  enquiries: number;
}

export type ActivityType = 'memorial' | 'payment' | 'home' | 'feature' | 'audit';
export interface PlatformActivity {
  id: string;
  type: ActivityType;
  title: string;
  detail: string;
  funeralHomeName: string | null;
  link: string;
  createdAt: string | null;
}

export interface PlatformHomeHealth {
  segment: string;
  label: string;
  color: 'emerald' | 'amber' | 'red' | 'slate';
  reasons: string[];
}

export interface PlatformFuneralHomeHealthRow {
  id: string;
  name: string;
  status: string;
  segment: string;
  segmentLabel: string;
  score?: number;
  reasons: string[];
  revenueCents: number;
  memorialCount: number;
  lastActivityAt: string;
}

export interface PlatformCustomerSuccess {
  segments: Record<string, number>;
  total: number;
  customerHealth?: PlatformFuneralHomeHealthRow[];
  atRiskHomes: PlatformFuneralHomeHealthRow[];
}

export interface PlatformTodayMemorials {
  created: number;
  published: number;
  scheduled: number;
  live: number;
}

export interface PlatformTodayRevenue {
  todayCents: number;
  weekCents: number;
  monthCents: number;
  prevMonthCents: number;
  pendingCents: number;
  failedCents: number;
  pendingCount: number;
  failedCount: number;
}

export interface PlatformUpcomingService {
  id: string;
  deceasedName: string;
  serviceDate: string | null;
  serviceEndTime?: string | null;
  serviceVenue?: string | null;
  status: string;
  missingCover: boolean;
  published: boolean;
  homeId: string;
  homeName: string;
}

export interface PlatformAttentionItem {
  id: string;
  kind: 'memorial' | 'home';
  title: string;
  detail: string;
  reason: string;
  homeId?: string | null;
  homeName?: string | null;
  link?: string | null;
  severity: 'critical' | 'warning' | 'info';
}

export interface PlatformPipeline {
  draft: number;
  ready: number;
  scheduled: number;
  published: number;
  archived: number;
}

export interface PlatformConversionFunnel {
  visitedWebsite: number;
  registered: number;
  startedTrial: number;
  publishedMemorial: number;
  paid: number;
}

export interface PlatformGeoRow {
  province: string;
  homes: number;
  country: string;
}

export interface PlatformAssistRequest {
  id: string;
  homeId: string;
  homeName: string;
  request: string;
  detail: string;
  severity: 'critical' | 'warning';
  actionLink: string;
}

export interface PlatformRevenuePoint {
  label: string;
  ts: number;
  revenueCents: number;
}

export interface PlatformOperations {
  todayMemorials: PlatformTodayMemorials;
  todayRevenue: PlatformTodayRevenue;
  upcomingServices: PlatformUpcomingService[];
  requiringAttention: PlatformAttentionItem[];
  pipeline: PlatformPipeline;
  funnel: PlatformConversionFunnel;
  geographic: PlatformGeoRow[];
  assistRequests: PlatformAssistRequest[];
  revenueGraph: PlatformRevenuePoint[];
}

export interface PlatformDashboard {
  health: Record<string, PlatformServiceHealth>;
  server: PlatformServerLoad;
  today: PlatformTodayNumbers;
  activity: PlatformActivity[];
  operations: PlatformOperations;
  customerSuccess: PlatformCustomerSuccess;
}

export interface SearchResult {
  id: string;
  name?: string;
  label?: string;
  detail?: string;
}

export interface PlatformSearchResults {
  query: string;
  totalResults: number;
  funeralHomes: Array<{ id: string; name: string; email: string; status: string }>;
  users: Array<{ id: string; name: string; email: string; role: string; funeralHomeId?: string | null }>;
  memorials: Array<{ id: string; deceasedName: string; slug: string; funeralHome: { id: string; name: string } }>;
  qrCodes: Array<{ id: string; url: string; shortUrl?: string | null; scanCount: number; funeralHome: { id: string; name: string } }>;
  payments: Array<{ id: string; paystackReference: string; amountCents: number; status: string; funeralHome: { name: string } }>;
  features: Array<{ key: string; name: string; category: string; releaseChannel: string; enabledGlobally: boolean }>;
  auditLogs: Array<{ id: string; action: string; targetType: string; targetId: string; createdAt: string }>;
  enquiries: Array<{ id: string; fullName: string; emailAddress?: string | null; message?: string | null; createdAt: string; funeralHome: { id: string; name: string } }>;
}

export type NotificationSeverity = 'info' | 'warning' | 'critical';
export interface PlatformNotification {
  id: string;
  severity: NotificationSeverity;
  title: string;
  detail: string;
  link?: string;
}

export interface MarketingContact {
  id?: string;
  funeralHomeId?: string;
  businessName?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  description?: string | null;
  address?: string | null;
  telephone?: string | null;
  mobile?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;
  businessHours?: string | null;
  googleMapsUrl?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  linkedin?: string | null;
  enableBrochures?: boolean;
  enableContact?: boolean;
  enableBranches?: boolean;
  enablePromotions?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BrochureCategory {
  id: string;
  funeralHomeId?: string;
  name: string;
  slug: string;
  description?: string | null;
  displayOrder?: number;
  isDefault?: boolean;
  _count?: { brochures: number };
  createdAt?: string;
  updatedAt?: string;
}

export interface BrochureGalleryItem {
  id: string;
  brochureId?: string;
  url: string;
  caption?: string | null;
  displayOrder: number;
}

export interface Brochure {
  id: string;
  funeralHomeId?: string;
  categoryId?: string | null;
  category?: BrochureCategory | null;
  title: string;
  slug?: string;
  coverImageUrl?: string | null;
  description?: string | null;
  pdfUrl?: string | null;
  includedItems?: string[];
  price?: string | null;
  depositRequired?: boolean;
  monthlyPaymentAvailable?: boolean;
  financeAvailable?: boolean;
  ctaEnabled?: boolean;
  ctaType?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
  whatsappNumber?: string | null;
  phoneNumber?: string | null;
  emailAddress?: string | null;
  contactPerson?: string | null;
  branchName?: string | null;
  websiteUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  published?: boolean;
  featured?: boolean;
  displayOrder?: number;
  viewCount?: number;
  shortUrl?: string | null;
  gallery?: BrochureGalleryItem[];
  _count?: { enquiries: number };
  createdAt?: string;
  updatedAt?: string;
}

export interface Promotion {
  id: string;
  funeralHomeId?: string;
  title: string;
  description?: string | null;
  bannerImageUrl?: string | null;
  startDate: string;
  endDate: string;
  buttonText?: string | null;
  buttonUrl?: string | null;
  published?: boolean;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MarketingBranch {
  id: string;
  funeralHomeId?: string;
  name: string;
  manager?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  businessHours?: string | null;
  googleMapsUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Enquiry {
  id: string;
  brochureId: string;
  funeralHomeId?: string;
  fullName: string;
  phoneNumber?: string | null;
  emailAddress?: string | null;
  message?: string | null;
  brochure?: { title: string; slug: string };
  createdAt: string;
}

export interface MarketingAnalytics {
  totalViews: number;
  totalUniqueVisitors: number;
  totalQrScans: number;
  totalPdfDownloads: number;
  totalPhoneClicks: number;
  totalWhatsappClicks: number;
  totalCtaClicks: number;
  totalEnquiries: number;
  conversionRate: number;
  viewsByDay: Array<{ date: string; count: number }>;
  brochureViews: Array<{ id: string; title: string; slug: string; viewCount: number }>;
}

// ── Vehicle APIs ────────────────────────────────────────────────────────────

export interface VehiclePhoto {
  id: string; url: string; caption: string | null;
}

export interface ServiceHistory {
  id: string; serviceDate: string; description: string | null; mileageAtService: number | null;
  cost: number | null; provider: string | null; nextServiceDate: string | null; notes: string | null;
}

export interface FuelLog {
  id: string; date: string; amount: number; cost: number; mileage: number | null;
  fuelType: string | null; station: string | null; receiptUrl: string | null; notes: string | null;
}

export interface MaintenanceLog {
  id: string; date: string; type: string; description: string | null; cost: number | null;
  provider: string | null; mileageAtService: number | null; nextServiceDue: string | null;
  status: string; notes: string | null;
}

export interface Vehicle {
  id: string; name: string; registrationNumber: string; vehicleType: string;
  manufacturer: string | null; model: string | null; year: number | null; vin: string | null;
  colour: string | null; capacity: number | null; currentMileage: number | null;
  fuelType: string | null; transmission: string | null; status: string;
  assignedDriver: string | null; insuranceCompany: string | null; insuranceNumber: string | null;
  insuranceExpiry: string | null; roadworthyExpiry: string | null; licenseDiskExpiry: string | null;
  nextServiceDate: string | null; notes: string | null;
  photos: VehiclePhoto[]; serviceHistories: ServiceHistory[];
  fuelLogs: FuelLog[]; maintenanceLogs: MaintenanceLog[];
  createdAt: string; updatedAt: string;
}

export interface VehicleDashboard {
  total: number; available: number; booked: number; maintenance: number;
  inactive: number; licenseExpiringSoon: number;
}

export const vehicleApi = {
  list: (status?: string) => request<Vehicle[]>(`/api/v1/vehicles${status ? `?status=${status}` : ''}`),
  dashboard: () => request<VehicleDashboard>('/api/v1/vehicles/dashboard'),
  get: (id: string) => request<Vehicle>(`/api/v1/vehicles/${id}`),
  create: (data: Record<string, unknown>) => request<Vehicle>('/api/v1/vehicles', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) => request<Vehicle>(`/api/v1/vehicles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => request<null>(`/api/v1/vehicles/${id}`, { method: 'DELETE' }),
  uploadPhoto: async (vehicleId: string, file: File) => {
    const form = new FormData(); form.append('photo', file);
    return apiUpload<Vehicle>(`/api/v1/vehicles/${vehicleId}/photos`, form);
  },
  deletePhoto: (vehicleId: string, photoId: string) => request<null>(`/api/v1/vehicles/${vehicleId}/photos/${photoId}`, { method: 'DELETE' }),
  addServiceHistory: (vehicleId: string, data: Record<string, unknown>) =>
    request<ServiceHistory>(`/api/v1/vehicles/${vehicleId}/service-history`, { method: 'POST', body: JSON.stringify(data) }),
  deleteServiceHistory: (vehicleId: string, historyId: string) =>
    request<null>(`/api/v1/vehicles/${vehicleId}/service-history/${historyId}`, { method: 'DELETE' }),
  addFuelLog: (vehicleId: string, data: Record<string, unknown>) =>
    request<FuelLog>(`/api/v1/vehicles/${vehicleId}/fuel-log`, { method: 'POST', body: JSON.stringify(data) }),
  deleteFuelLog: (vehicleId: string, logId: string) =>
    request<null>(`/api/v1/vehicles/${vehicleId}/fuel-log/${logId}`, { method: 'DELETE' }),
  addMaintenanceLog: (vehicleId: string, data: Record<string, unknown>) =>
    request<MaintenanceLog>(`/api/v1/vehicles/${vehicleId}/maintenance-log`, { method: 'POST', body: JSON.stringify(data) }),
  updateMaintenanceLog: (vehicleId: string, logId: string, data: Record<string, unknown>) =>
    request<MaintenanceLog>(`/api/v1/vehicles/${vehicleId}/maintenance-log/${logId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMaintenanceLog: (vehicleId: string, logId: string) =>
    request<null>(`/api/v1/vehicles/${vehicleId}/maintenance-log/${logId}`, { method: 'DELETE' }),
};

// ── Asset APIs ─────────────────────────────────────────────────────────────

export interface AssetPhoto {
  id: string; url: string; caption: string | null;
}

export interface AssetDocument {
  id: string; name: string; url: string; type: string | null;
}

export interface AssetMovement {
  id: string; fromBranch: string | null; toBranch: string | null;
  fromLocation: string | null; toLocation: string | null; movedBy: string | null;
  notes: string | null; movedAt: string;
}

export interface AssetDamageReport {
  id: string; reportedBy: string | null; date: string; description: string;
  severity: string; status: string; cost: number | null; notes: string | null;
}

export interface Asset {
  id: string; name: string; category: string; serialNumber: string | null;
  barcodeQrCode: string | null; purchaseDate: string | null; purchasePrice: number | null;
  supplier: string | null; warrantyExpiry: string | null; currentLocation: string | null;
  branchId: string | null; branch: { id: string; name: string } | null;
  condition: string; status: string; assignedEmployee: string | null; notes: string | null;
  photos: AssetPhoto[]; documents: AssetDocument[];
  movementHistories: AssetMovement[]; damageReports: AssetDamageReport[];
  createdAt: string; updatedAt: string;
}

export interface AssetDashboard {
  total: number; byCategory: Record<string, number>; byStatus: Record<string, number>;
  warrantyExpiringSoon: number;
}

export const assetApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<Asset[]>(`/api/v1/assets${qs}`);
  },
  dashboard: () => request<AssetDashboard>('/api/v1/assets/dashboard'),
  get: (id: string) => request<Asset>(`/api/v1/assets/${id}`),
  create: (data: Record<string, unknown>) => request<Asset>('/api/v1/assets', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) => request<Asset>(`/api/v1/assets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => request<null>(`/api/v1/assets/${id}`, { method: 'DELETE' }),
  uploadPhoto: async (assetId: string, file: File) => {
    const form = new FormData(); form.append('photo', file);
    return apiUpload<Asset>(`/api/v1/assets/${assetId}/photos`, form);
  },
  deletePhoto: (assetId: string, photoId: string) => request<null>(`/api/v1/assets/${assetId}/photos/${photoId}`, { method: 'DELETE' }),
  addMovement: (assetId: string, data: Record<string, unknown>) =>
    request<AssetMovement>(`/api/v1/assets/${assetId}/movements`, { method: 'POST', body: JSON.stringify(data) }),
  addDamageReport: (assetId: string, data: Record<string, unknown>) =>
    request<AssetDamageReport>(`/api/v1/assets/${assetId}/damage-reports`, { method: 'POST', body: JSON.stringify(data) }),
  updateDamageReport: (assetId: string, reportId: string, data: Record<string, unknown>) =>
    request<AssetDamageReport>(`/api/v1/assets/${assetId}/damage-reports/${reportId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getQrCode: (assetId: string) => request<{ qrCode: string; assetId: string }>(`/api/v1/assets/${assetId}/qr-code`),
};

// ── Funeral Resource Reservation APIs ─────────────────────────────────────

export interface FuneralResourceReservation {
  id: string; memorialId: string; vehicleId: string | null; assetId: string | null;
  quantity: number; reservedAt: string; reservedBy: string | null;
  checkedInAt: string | null; checkedOutAt: string | null; returnedAt: string | null;
  status: string; notes: string | null;
  memorial: { id: string; deceasedName: string; slug: string; status: string; serviceDate: string };
  vehicle: { id: string; name: string; registrationNumber: string } | null;
  asset: { id: string; name: string; category: string } | null;
}

export const funeralResourceApi = {
  list: (memorialId?: string) =>
    request<FuneralResourceReservation[]>(`/api/v1/funeral-resources${memorialId ? `?memorialId=${memorialId}` : ''}`),
  getForMemorial: (memorialId: string) =>
    request<FuneralResourceReservation[]>(`/api/v1/funeral-resources/memorial/${memorialId}`),
  create: (data: Record<string, unknown>) =>
    request<FuneralResourceReservation>('/api/v1/funeral-resources', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    request<FuneralResourceReservation>(`/api/v1/funeral-resources/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => request<null>(`/api/v1/funeral-resources/${id}`, { method: 'DELETE' }),
  checkAvailability: (params: { vehicleId?: string; assetId?: string; date: string }) => {
    const qs = '?' + new URLSearchParams(params).toString();
    return request<{ date: string; available: boolean }>(`/api/v1/funeral-resources/availability${qs}`);
  },
};

export const featureApi = {
  getFeatures: () => request<{ features: FeatureWithOverrides[]; auditCount: number; featureVersion?: number }>('/api/v1/platform/features'),
  getAll: () => request<Feature[]>('/api/v1/platform/features/all'),
  getAuditLog: (limit = 100) => request<FeatureAuditLogEntry[]>(`/api/v1/platform/features/audit-log?limit=${limit}`),
  getFuneralHomes: () =>
    request<Array<{ id: string; name: string; plan: string; edition: string; status: string; featureOverrides: Array<{ id: string; featureKey: string; enabled: boolean; releaseChannelOverride: string | null; enabledAt: string }> }>>('/api/v1/platform/features/funeral-homes'),
  create: (data: Record<string, unknown>) => request<Feature>('/api/v1/platform/features', { method: 'POST', body: JSON.stringify(data) }),
  update: (key: string, data: Record<string, unknown>) => request<Feature>(`/api/v1/platform/features/${key}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (key: string) => request<null>(`/api/v1/platform/features/${key}`, { method: 'DELETE' }),
  seed: () => request<{ created: number; total: number }>('/api/v1/platform/features/seed', { method: 'POST' }),
  setFuneralHomeOverride: (homeId: string, key: string, data: FuneralHomeFeatureInput) =>
    request<unknown>(`/api/v1/platform/features/funeral-homes/${homeId}/features/${key}`, { method: 'PUT', body: JSON.stringify(data) }),
  removeFuneralHomeOverride: (homeId: string, key: string) =>
    request<null>(`/api/v1/platform/features/funeral-homes/${homeId}/features/${key}`, { method: 'DELETE' }),
  setUserOverride: (userId: string, key: string, data: UserFeatureInput) =>
    request<unknown>(`/api/v1/platform/features/users/${userId}/features/${key}`, { method: 'PUT', body: JSON.stringify(data) }),
  removeUserOverride: (userId: string, key: string) =>
    request<null>(`/api/v1/platform/features/users/${userId}/features/${key}`, { method: 'DELETE' }),
  resolveForHome: (homeId: string) =>
    request<{ funeralHome: { id: string; plan: string; edition: string; name: string; tradingName: string | null }; features: ResolvedFeature[] }>(`/api/v1/platform/features/resolve/${homeId}`),
  resolveAll: () =>
    request<Array<{ funeralHomeId: string; name: string; features: ResolvedFeature[] }>>('/api/v1/platform/features/resolve-all'),
  getDependencies: () => request<FeatureDependency[]>('/api/v1/platform/features/dependencies'),
  addDependency: (featureKey: string, dependsOnFeature: string) =>
    request<FeatureDependency>(`/api/v1/platform/features/dependencies/${featureKey}/depends-on/${dependsOnFeature}`, { method: 'PUT' }),
  removeDependency: (featureKey: string, dependsOnFeature: string) =>
    request<null>(`/api/v1/platform/features/dependencies/${featureKey}/depends-on/${dependsOnFeature}`, { method: 'DELETE' }),
  myFeatures: () => request<{ features: ResolvedFeature[] }>('/api/v1/auth/my-features'),
};

function apiUpload<T>(url: string, form: FormData): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  return (async () => {
    try {
      const res = await fetch(`${API_URL}${url}`, {
        method: 'POST',
        headers: authHeaders(),
        body: form,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || 'Upload failed');
      return json.data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') throw new Error('Upload timed out');
      throw error;
    }
  })();
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
  FuneralFeedback,
  FuneralFeedbackSummary,
  FuneralContactEnquiry,
  Feature,
  FeatureWithOverrides,
  ResolvedFeature,
  FeatureAuditLogEntry,
  FeatureDependency,
  MemorialPerformanceSummary,
};

