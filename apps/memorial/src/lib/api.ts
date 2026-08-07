import { getApiUrl } from './config';
import type {
  ProgrammeItem,
  Photo,
  Tribute,
  Memorial,
  Announcement,
  MemorialLocation,
  BrandProfile,
} from '@memorialconnect/shared';

const API_URL = getApiUrl();

export function photoUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${API_URL}${path}`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers as Record<string, string>) },
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

export interface PublicMemorial extends Omit<Memorial, 'funeralHome'> {
  serviceEndTime?: string;
  timezone?: string;
  isPreview?: boolean;
  qrPosterUrl?: string;
  funeralHome: {
    id?: string;
    name: string;
    slug?: string;
    phone?: string;
    email?: string;
    address?: string;
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    websiteUrl?: string;
    facebookUrl?: string;
    instagramUrl?: string;
    tiktokUrl?: string;
    whatsapp?: string;
    footerText?: string;
    copyrightText?: string;
    whiteLabelEnabled?: boolean;
    brand?: BrandProfile;
  };
  photos: Photo[];
  tributes: Tribute[];
  locations: MemorialLocation[];
  isDemo?: boolean;
}

export interface ProjectorData {
  deceasedName: string;
  currentIndex: number;
  totalItems: number;
  currentItem: ProgrammeItem | null;
  nextItem: ProgrammeItem | null;
  announcements: Announcement[];
  photos: Photo[];
  funeralHome?: PublicMemorial['funeralHome'];
}

export type { ProgrammeItem, Photo, Tribute, Announcement, MemorialLocation, BrandProfile };

export const api = {
  getMemorial: (slug: string, previewToken?: string) => request<PublicMemorial>(`/api/v1/public/memorials/${slug}${previewToken ? `?preview=${encodeURIComponent(previewToken)}` : ''}`),
  recordMemorialView: (slug: string, visitorId: string) =>
    request<{ counted: boolean; viewCount?: number }>(`/api/v1/public/memorials/${slug}/view`, {
      method: 'POST',
      body: JSON.stringify({ visitorId }),
    }),
  recordQrScan: (slug: string, visitorId: string) =>
    request<{ counted: boolean }>(`/api/v1/public/memorials/${slug}/qr-scan`, {
      method: 'POST',
      body: JSON.stringify({ visitorId }),
    }),
  recordShare: (slug: string, visitorId: string) =>
    request<{ counted: boolean }>(`/api/v1/public/memorials/${slug}/share`, {
      method: 'POST',
      body: JSON.stringify({ visitorId }),
    }),
  getProjector: (slug: string, previewToken?: string) => request<ProjectorData>(`/api/v1/public/memorials/${slug}/projector${previewToken ? `?preview=${encodeURIComponent(previewToken)}` : ''}`),
  submitTribute: (slug: string, data: { authorName: string; message: string }) =>
    request<{ pending: boolean }>(`/api/v1/public/memorials/${slug}/tributes`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  submitFeedback: (slug: string, data: FuneralFeedbackInput) =>
    request<{ id: string }>(`/api/v1/public/memorials/${slug}/feedback`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export interface FuneralFeedbackInput {
  overallRating: number;
  staffRating?: number | null;
  organisationRating?: number | null;
  venueRating?: number | null;
  recommend?: boolean | null;
  useAgain?: boolean | null;
  comments?: string | null;
  allowContact?: boolean;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}

// ── Marketing Hub Public API ──────────────────────────────────────────────

export interface MarketingContactPublic {
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
  enableBrochures: boolean;
  enableContact: boolean;
  enableBranches: boolean;
  enablePromotions: boolean;
}

export interface BrochureCategoryPublic {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}

export interface BrochureGalleryPublic {
  id: string;
  url: string;
  caption?: string | null;
  displayOrder: number;
}

export interface BrochurePublic {
  id: string;
  title: string;
  slug: string;
  coverImageUrl?: string | null;
  description?: string | null;
  pdfUrl?: string | null;
  includedItems?: string[];
  price?: string | null;
  depositRequired?: boolean;
  monthlyPaymentAvailable?: boolean;
  financeAvailable?: boolean;
  ctaEnabled: boolean;
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
  viewCount: number;
  category?: BrochureCategoryPublic | null;
  gallery?: BrochureGalleryPublic[];
}

export interface PromotionPublic {
  id: string;
  title: string;
  bannerImageUrl?: string | null;
  description?: string | null;
  startDate: string;
  endDate: string;
  buttonText?: string | null;
  buttonUrl?: string | null;
  active: boolean;
}

export interface BranchPublic {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  whatsapp?: string | null;
  manager?: string | null;
  businessHours?: string | null;
  googleMapsUrl?: string | null;
}

export interface FuneralHomeMarketingPage {
  funeralHome: {
    id: string;
    name: string;
    slug?: string | null;
    tradingName?: string | null;
    logoUrl?: string | null;
    phone?: string | null;
    brand?: BrandProfile;
  };
  contact: MarketingContactPublic | null;
  brochures: BrochurePublic[];
  promotions: PromotionPublic[];
  branches: BranchPublic[];
}

export interface BrochureDetailPage {
  brochure: BrochurePublic;
  funeralHome: {
    id: string;
    name: string;
    slug?: string | null;
    tradingName?: string | null;
    logoUrl?: string | null;
    brand?: BrandProfile;
  } | null;
  contact: MarketingContactPublic | null;
}

// Add marketing methods to the api object
export const marketingApi = {
  getFuneralHomePage: (slug: string) =>
    request<FuneralHomeMarketingPage>(`/api/v1/public/funeral-homes/${encodeURIComponent(slug)}`),

  getBrochure: (fhSlug: string, slug: string) =>
    request<BrochureDetailPage>(`/api/v1/public/brochures/${encodeURIComponent(fhSlug)}/${encodeURIComponent(slug)}`),

  /** Legacy /services/{slug} link: resolves to the canonical path or throws. */
  resolveLegacyBrochure: (slug: string) =>
    request<{ canonicalPath: string }>(`/api/v1/public/brochures/${encodeURIComponent(slug)}`),

  submitEnquiry: (fhSlug: string, slug: string, data: { fullName: string; phoneNumber?: string | null; emailAddress?: string | null; message?: string | null }) =>
    request<{ id: string }>(`/api/v1/public/brochures/${encodeURIComponent(fhSlug)}/${encodeURIComponent(slug)}/enquiry`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  trackAnalytics: (data: { eventType: string; brochureId?: string | null; visitorId?: string | null }) =>
    request<{ tracked: boolean }>('/api/v1/public/analytics/track', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
