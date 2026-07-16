import { z } from 'zod';

export type BrandTemplate =
  | 'classic'
  | 'elegant'
  | 'modern'
  | 'luxury'
  | 'gold'
  | 'dark'
  | 'minimal'
  | 'traditional-african'
  | 'church'
  | 'corporate';

export type BrandFontFamily = 'serif' | 'sans-serif' | 'traditional' | 'elegant' | 'large-print';
export type BrandButtonStyle = 'solid' | 'outline' | 'soft' | 'pill';
export type BrandCardStyle = 'square' | 'rounded' | 'glass' | 'shadow';
export type BrandAnimationLevel = 'none' | 'subtle' | 'expressive';

export interface BrandProfile {
  companyName: string;
  tradingName?: string | null;
  logoUrl?: string | null;
  iconUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: BrandFontFamily | string;
  buttonStyle: BrandButtonStyle | string;
  cardStyle: BrandCardStyle | string;
  borderRadius: string;
  companyEmail?: string | null;
  companyPhone?: string | null;
  whatsapp?: string | null;
  physicalAddress?: string | null;
  websiteUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  footerText?: string | null;
  copyrightText?: string | null;
  whiteLabelEnabled: boolean;
  themeTemplate: BrandTemplate | string;
  homeBackgroundUrl?: string | null;
  loginBackgroundUrl?: string | null;
  memorialHeroUrl?: string | null;
  projectorBackgroundUrl?: string | null;
  pdfWatermarkUrl?: string | null;
  splashScreenUrl?: string | null;
  memorialStyle: string;
  animationLevel: BrandAnimationLevel | string;
  galleryLayout: string;
  timelineStyle: string;
  programmeStyle: string;
}

export const BRAND_TEMPLATES: Record<BrandTemplate, Pick<BrandProfile, 'primaryColor' | 'secondaryColor' | 'accentColor' | 'backgroundColor' | 'textColor' | 'fontFamily' | 'buttonStyle' | 'cardStyle' | 'borderRadius' | 'memorialStyle' | 'animationLevel' | 'galleryLayout' | 'timelineStyle' | 'programmeStyle'>> = {
  classic: { primaryColor: '#1a1a2e', secondaryColor: '#f5f0e8', accentColor: '#c9a84c', backgroundColor: '#f5f0e8', textColor: '#1a1a2e', fontFamily: 'serif', buttonStyle: 'solid', cardStyle: 'rounded', borderRadius: '12px', memorialStyle: 'rounded', animationLevel: 'subtle', galleryLayout: 'grid', timelineStyle: 'classic', programmeStyle: 'formal' },
  elegant: { primaryColor: '#263238', secondaryColor: '#f8f5ef', accentColor: '#b9965b', backgroundColor: '#f8f5ef', textColor: '#182024', fontFamily: 'elegant', buttonStyle: 'soft', cardStyle: 'shadow', borderRadius: '14px', memorialStyle: 'rounded', animationLevel: 'subtle', galleryLayout: 'masonry', timelineStyle: 'editorial', programmeStyle: 'formal' },
  modern: { primaryColor: '#0f766e', secondaryColor: '#ecfeff', accentColor: '#f59e0b', backgroundColor: '#f8fafc', textColor: '#10201f', fontFamily: 'sans-serif', buttonStyle: 'pill', cardStyle: 'rounded', borderRadius: '16px', memorialStyle: 'rounded', animationLevel: 'expressive', galleryLayout: 'grid', timelineStyle: 'compact', programmeStyle: 'clean' },
  luxury: { primaryColor: '#111111', secondaryColor: '#f7f1e3', accentColor: '#d4af37', backgroundColor: '#fbf8f0', textColor: '#17120a', fontFamily: 'elegant', buttonStyle: 'solid', cardStyle: 'shadow', borderRadius: '10px', memorialStyle: 'rounded', animationLevel: 'subtle', galleryLayout: 'editorial', timelineStyle: 'editorial', programmeStyle: 'formal' },
  gold: { primaryColor: '#6f4e00', secondaryColor: '#fff8dc', accentColor: '#e2b13c', backgroundColor: '#fffaf0', textColor: '#2d2412', fontFamily: 'serif', buttonStyle: 'soft', cardStyle: 'shadow', borderRadius: '12px', memorialStyle: 'rounded', animationLevel: 'subtle', galleryLayout: 'grid', timelineStyle: 'classic', programmeStyle: 'formal' },
  dark: { primaryColor: '#101828', secondaryColor: '#1f2937', accentColor: '#fbbf24', backgroundColor: '#0b1120', textColor: '#f8fafc', fontFamily: 'sans-serif', buttonStyle: 'outline', cardStyle: 'glass', borderRadius: '14px', memorialStyle: 'glass', animationLevel: 'subtle', galleryLayout: 'masonry', timelineStyle: 'compact', programmeStyle: 'clean' },
  minimal: { primaryColor: '#111827', secondaryColor: '#ffffff', accentColor: '#64748b', backgroundColor: '#ffffff', textColor: '#111827', fontFamily: 'sans-serif', buttonStyle: 'outline', cardStyle: 'square', borderRadius: '4px', memorialStyle: 'square', animationLevel: 'none', galleryLayout: 'grid', timelineStyle: 'minimal', programmeStyle: 'clean' },
  'traditional-african': { primaryColor: '#3b2416', secondaryColor: '#fff7ed', accentColor: '#b45309', backgroundColor: '#fff7ed', textColor: '#2f1d12', fontFamily: 'traditional', buttonStyle: 'solid', cardStyle: 'shadow', borderRadius: '10px', memorialStyle: 'rounded', animationLevel: 'subtle', galleryLayout: 'masonry', timelineStyle: 'story', programmeStyle: 'ceremonial' },
  church: { primaryColor: '#243c5a', secondaryColor: '#f8fafc', accentColor: '#b08d57', backgroundColor: '#f8fafc', textColor: '#172033', fontFamily: 'serif', buttonStyle: 'soft', cardStyle: 'rounded', borderRadius: '12px', memorialStyle: 'rounded', animationLevel: 'subtle', galleryLayout: 'grid', timelineStyle: 'classic', programmeStyle: 'ceremonial' },
  corporate: { primaryColor: '#0f3d5e', secondaryColor: '#eef6fb', accentColor: '#22a6b3', backgroundColor: '#f6fbfd', textColor: '#0b2233', fontFamily: 'sans-serif', buttonStyle: 'solid', cardStyle: 'rounded', borderRadius: '8px', memorialStyle: 'rounded', animationLevel: 'none', galleryLayout: 'grid', timelineStyle: 'compact', programmeStyle: 'clean' },
};

export const DEFAULT_BRAND_PROFILE: BrandProfile = {
  companyName: 'Memory Connect',
  tradingName: null,
  logoUrl: null,
  iconUrl: null,
  companyEmail: null,
  companyPhone: null,
  whatsapp: null,
  physicalAddress: null,
  websiteUrl: null,
  facebookUrl: null,
  instagramUrl: null,
  tiktokUrl: null,
  footerText: null,
  copyrightText: null,
  whiteLabelEnabled: false,
  themeTemplate: 'classic',
  homeBackgroundUrl: null,
  loginBackgroundUrl: null,
  memorialHeroUrl: null,
  projectorBackgroundUrl: null,
  pdfWatermarkUrl: null,
  splashScreenUrl: null,
  ...BRAND_TEMPLATES.classic,
};

export function brandFromFuneralHome(home: Partial<FuneralHome> & Record<string, unknown>): BrandProfile {
  const template = (home.themeTemplate as BrandTemplate) || DEFAULT_BRAND_PROFILE.themeTemplate;
  const templateDefaults = BRAND_TEMPLATES[template as BrandTemplate] || BRAND_TEMPLATES.classic;
  return {
    ...DEFAULT_BRAND_PROFILE,
    ...templateDefaults,
    companyName: String(home.name || DEFAULT_BRAND_PROFILE.companyName),
    tradingName: (home.tradingName as string | null | undefined) || null,
    logoUrl: (home.logoUrl as string | null | undefined) || null,
    iconUrl: (home.iconUrl as string | null | undefined) || null,
    primaryColor: (home.primaryColor as string | null | undefined) || templateDefaults.primaryColor,
    secondaryColor: (home.secondaryColor as string | null | undefined) || templateDefaults.secondaryColor,
    accentColor: (home.accentColor as string | null | undefined) || templateDefaults.accentColor,
    backgroundColor: (home.backgroundColor as string | null | undefined) || templateDefaults.backgroundColor,
    textColor: (home.textColor as string | null | undefined) || templateDefaults.textColor,
    fontFamily: (home.fontFamily as string | null | undefined) || templateDefaults.fontFamily,
    buttonStyle: (home.buttonStyle as string | null | undefined) || templateDefaults.buttonStyle,
    cardStyle: (home.cardStyle as string | null | undefined) || templateDefaults.cardStyle,
    borderRadius: (home.borderRadius as string | null | undefined) || templateDefaults.borderRadius,
    companyEmail: (home.email as string | null | undefined) || null,
    companyPhone: (home.phone as string | null | undefined) || null,
    whatsapp: (home.whatsapp as string | null | undefined) || null,
    physicalAddress: (home.address as string | null | undefined) || null,
    websiteUrl: (home.websiteUrl as string | null | undefined) || null,
    facebookUrl: (home.facebookUrl as string | null | undefined) || null,
    instagramUrl: (home.instagramUrl as string | null | undefined) || null,
    tiktokUrl: (home.tiktokUrl as string | null | undefined) || null,
    footerText: (home.footerText as string | null | undefined) || null,
    copyrightText: (home.copyrightText as string | null | undefined) || null,
    whiteLabelEnabled: Boolean(home.whiteLabelEnabled),
    themeTemplate: template,
    homeBackgroundUrl: (home.homeBackgroundUrl as string | null | undefined) || null,
    loginBackgroundUrl: (home.loginBackgroundUrl as string | null | undefined) || null,
    memorialHeroUrl: (home.memorialHeroUrl as string | null | undefined) || null,
    projectorBackgroundUrl: (home.projectorBackgroundUrl as string | null | undefined) || null,
    pdfWatermarkUrl: (home.pdfWatermarkUrl as string | null | undefined) || null,
    splashScreenUrl: (home.splashScreenUrl as string | null | undefined) || null,
    memorialStyle: (home.memorialStyle as string | null | undefined) || templateDefaults.memorialStyle,
    animationLevel: (home.animationLevel as string | null | undefined) || templateDefaults.animationLevel,
    galleryLayout: (home.galleryLayout as string | null | undefined) || templateDefaults.galleryLayout,
    timelineStyle: (home.timelineStyle as string | null | undefined) || templateDefaults.timelineStyle,
    programmeStyle: (home.programmeStyle as string | null | undefined) || templateDefaults.programmeStyle,
  };
}

export function brandCssVariables(brand: BrandProfile): Record<string, string> {
  return {
    '--brand-primary': brand.primaryColor,
    '--brand-secondary': brand.secondaryColor,
    '--brand-accent': brand.accentColor,
    '--brand-background': brand.backgroundColor,
    '--brand-text': brand.textColor,
    '--brand-radius': brand.borderRadius,
    '--brand-font': brand.fontFamily === 'serif' ? 'Georgia, serif' : brand.fontFamily === 'elegant' ? 'Cormorant Garamond, Georgia, serif' : brand.fontFamily === 'traditional' ? 'Trebuchet MS, Georgia, serif' : brand.fontFamily === 'large-print' ? 'Atkinson Hyperlegible, Verdana, sans-serif' : 'Source Sans 3, system-ui, sans-serif',
  };
}

/**
 * Status of a memorial in the system
 */
export type MemorialStatus = 'DRAFT' | 'PAID_PENDING' | 'PUBLISHED' | 'LOCKED' | 'EXPIRED' | 'DELETED';

/**
 * Type of programme item in a funeral service
 */
export type ProgrammeItemType =
  | 'opening_prayer'
  | 'scripture'
  | 'hymn'
  | 'speaker'
  | 'family_tribute'
  | 'closing_prayer'
  | 'burial'
  | 'other';

/**
 * A single item in the funeral programme
 */
export interface ProgrammeItem {
  id: string;
  type: ProgrammeItemType;
  title: string;
  speaker?: string;
  duration?: number;
  notes?: string;
  order: number;
}

/**
 * Summary view of a memorial (list view)
 */
export interface MemorialSummary {
  id: string;
  slug: string;
  deceasedName: string;
  dateOfBirth?: string;
  dateOfDeath?: string;
  serviceDate?: string;
  serviceVenue?: string;
  deceasedPhotoUrl?: string;
  status: MemorialStatus;
  isDemo?: boolean;
  paymentStatus: 'UNPAID' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'ABANDONED';
  paymentId?: string;
  publishedAt?: string;
  editLocksAt?: string;
  publicExpiresAt?: string;
  deleteAfter?: string;
  deletedAt?: string;
  viewCount: number;
  storageBytes?: number;
  createdAt: string;
  updatedAt: string;
  logoUrl?: string;
}

/**
 * Full memorial details
 */
export interface Memorial extends MemorialSummary {
  obituary?: string;
  biography?: Biography;
  programme: ProgrammeItem[];
  currentProgrammeIndex: number;
  announcements: Announcement[];
  settings: MemorialSettings;
  locations?: MemorialLocation[];
  funeralHome?: FuneralHome & { brand?: BrandProfile };
}

export interface PublishPayment {
  id: string;
  memorialId: string;
  amountCents: 29999;
  currency: 'ZAR';
  purpose: 'FUNERAL_PUBLISH';
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'ABANDONED';
  paystackReference: string;
  paidAt?: string | null;
  createdAt: string;
}

export interface MemorialAnalytics {
  totalViews: number;
  viewsToday: number;
  viewsLast7Days: number;
  viewsByMemorial: Array<{ id: string; deceasedName: string; viewCount: number }>;
  topViewedMemorials: Array<{ id: string; deceasedName: string; viewCount: number }>;
}

export type MemorialLocationType = 'HOME' | 'CHURCH' | 'CEMETERY' | 'RECEPTION' | 'OTHER';

export interface MemorialLocation {
  id: string;
  memorialId: string;
  type: MemorialLocationType;
  name: string;
  addressText?: string | null;
  latitude: number;
  longitude: number;
  notes?: string | null;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Biography information for the deceased
 */
export interface Biography {
  lifeStory?: string;
  education?: string;
  career?: string;
  marriage?: string;
  children?: string;
  achievements?: string;
  timeline: TimelineEvent[];
}

/**
 * A timeline event in the biography
 */
export interface TimelineEvent {
  id: string;
  year: string;
  title: string;
  description?: string;
}

/**
 * Live announcement for a memorial service
 */
export interface Announcement {
  id: string;
  message: string;
  createdAt: string;
  active: boolean;
}

/**
 * Configuration settings for a memorial
 */
export interface MemorialSettings {
  theme: 'light' | 'dark' | 'elegant';
  showTributeWall: boolean;
  moderateTributes: boolean;
  showDonations: boolean;
  livestreamUrl?: string;
  donationDetails?: string;
  /** Local-network demo URL for QR codes, e.g. http://192.168.0.105:5174 */
  demoNetworkUrl?: string;
}

/**
 * Tribute message from a guest
 */
export interface Tribute {
  id: string;
  memorialId: string;
  authorName: string;
  message: string;
  approved: boolean;
  createdAt: string;
}

/**
 * Photo uploaded to a memorial
 */
export interface Photo {
  id: string;
  memorialId?: string;
  url: string;
  caption?: string;
  category: 'childhood' | 'school' | 'wedding' | 'family' | 'friends' | 'recent' | 'other' | string;
  order: number;
  storageBytes?: number;
  deletedAt?: string | null;
}

/**
 * User account for funeral home staff
 */
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'FUNERAL_HOME_ADMIN' | 'FUNERAL_HOME_STAFF' | 'FAMILY_MANAGER' | 'FAMILY_CONTRIBUTOR';
  funeralHomeId?: string | null;
}

/**
 * Funeral home organization
 */
export interface FuneralHome {
  id: string;
  name: string;
  tradingName?: string | null;
  email: string;
  phone?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  iconUrl?: string | null;
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
  whiteLabelEnabled?: boolean;
  themeTemplate?: string;
  homeBackgroundUrl?: string | null;
  loginBackgroundUrl?: string | null;
  memorialHeroUrl?: string | null;
  projectorBackgroundUrl?: string | null;
  pdfWatermarkUrl?: string | null;
  splashScreenUrl?: string | null;
  memorialStyle?: string;
  animationLevel?: string;
  galleryLayout?: string;
  timelineStyle?: string;
  programmeStyle?: string;
  analyticsAccessEnabled: boolean;
  apiAccessEnabled: boolean;
  dedicatedSupportEnabled: boolean;
}

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Authentication response with token and user info
 */
export interface AuthTokens {
  accessToken: string;
  user: User;
}

/**
 * State of the projector mode for live service display
 */
export interface ProjectorState {
  memorialId: string;
  currentIndex: number;
  autoMode: boolean;
  updatedAt: string;
}

// ============ ZOD SCHEMAS ============

/**
 * Validation schema for user registration
 */
export const registerSchema = z.object({
  funeralHomeName: z.string().min(2, 'Funeral home name must be at least 2 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * Validation schema for user login
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Validation schema for creating a memorial
 */
export const createMemorialSchema = z.object({
  deceasedName: z.string().min(2, 'Deceased name is required'),
  serviceDate: z.string().optional(),
  serviceVenue: z.string().optional(),
  logoUrl: z.string().regex(/^(https?:\/\/|\/)/).optional().or(z.literal('')),
});

/**
 * Validation schema for updating a memorial
 */
export const updateMemorialSchema = z.object({
  deceasedName: z.string().min(2).optional(),
  dateOfBirth: z.string().optional(),
  dateOfDeath: z.string().optional(),
  serviceDate: z.string().optional(),
  serviceVenue: z.string().optional(),
  deceasedPhotoUrl: z.string().url().optional().or(z.literal('')).nullable(),
  logoUrl: z.string().regex(/^(https?:\/\/|\/)/).optional().or(z.literal('')).nullable(),
  obituary: z.string().optional(),
  biography: z.any().optional(),
  programme: z.array(z.any()).optional(),
  currentProgrammeIndex: z.number().int().min(0).optional(),
  announcements: z.array(z.any()).optional(),
  settings: z.any().optional(),
});

export const memorialLocationTypeSchema = z.enum([
  'HOME',
  'CHURCH',
  'CEMETERY',
  'RECEPTION',
  'OTHER',
]);

export const createMemorialLocationSchema = z.object({
  type: memorialLocationTypeSchema,
  name: z.string().trim().min(1, 'Location name is required').max(120),
  addressText: z.string().trim().max(300).optional().nullable(),
  latitude: z.number({ required_error: 'Latitude is required' })
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z.number({ required_error: 'Longitude is required' })
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  notes: z.string().trim().max(500).optional().nullable(),
  orderIndex: z.number().int().min(0).optional(),
});

export const updateMemorialLocationSchema = createMemorialLocationSchema.partial();

export type CreateMemorialLocationInput = z.infer<typeof createMemorialLocationSchema>;
export type UpdateMemorialLocationInput = z.infer<typeof updateMemorialLocationSchema>;

/**
 * Validation schema for programme item
 */
export const programmeItemSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['opening_prayer', 'scripture', 'hymn', 'speaker', 'family_tribute', 'closing_prayer', 'burial', 'other']),
  title: z.string().min(1, 'Title is required'),
  speaker: z.string().optional(),
  duration: z.number().int().positive().optional(),
  notes: z.string().optional(),
  order: z.number().int().min(0),
});

/**
 * Validation schema for photo metadata
 */
export const photoSchema = z.object({
  caption: z.string().optional(),
  category: z.enum(['childhood', 'school', 'wedding', 'family', 'friends', 'recent', 'other']).default('other'),
  order: z.number().int().min(0).default(0),
});

/**
 * Validation schema for tribute submission
 */
export const tributeSchema = z.object({
  authorName: z.string().min(2, 'Name must be at least 2 characters'),
  message: z.string().min(1, 'Message is required').max(1000, 'Message must be less than 1000 characters'),
});
