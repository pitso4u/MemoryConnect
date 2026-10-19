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
  serviceEndTime?: string;
  serviceVenue?: string;
  timezone?: string;
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
  performance?: {
    total72HourViews: number;
    performanceRating: string;
    highestDailyViews: number;
    highestMilestoneAwarded: string | null;
    finalized: boolean;
  };
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

export interface CreditBundle {
  credits: number;
  priceCents: number;
}

export interface PlatformCommercialSettings {
  trialEnabled: boolean;
  trialDays: number;
  freeMemorialLimit: number;
  singleMemorialPriceCents: number;
  currency: string;
  subscriptionsEnabled: boolean;
  creditBundles: CreditBundle[];
}

export interface EntitlementSnapshot {
  mode: 'TRIAL' | 'CREDITS' | 'PAY_AS_YOU_GO';
  trial: {
    active: boolean;
    startedAt: string | null;
    endsAt: string | null;
    daysRemaining: number | null;
    freeMemorialsUsed: number;
    freeMemorialLimit: number;
  };
  creditsRemaining: number;
  creditsPurchased: number;
  lastCreditPurchaseAt: string | null;
  singleMemorialPriceCents: number;
  currency: string;
  bundles: CreditBundle[];
  subscriptionsEnabled: boolean;
}

export interface MemorialCreditPurchase {
  id: string;
  funeralHomeId: string;
  credits: number;
  amountCents: number;
  currency: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'ABANDONED';
  paystackReference: string;
  paidAt?: string | null;
  createdAt: string;
}

export interface MemorialAnalytics {
  totalViews: number;
  uniqueVisitors: number;
  viewsToday: number;
  viewsLast7Days: number;
  viewsByMemorial: Array<{ id: string; deceasedName: string; viewCount: number }>;
  topViewedMemorials: Array<{ id: string; deceasedName: string; viewCount: number }>;
  performance?: MemorialPerformance;
}

// ── 72-Hour Memorial Performance Analytics ──────────────────────────────────

export interface MemorialPerformanceDay {
  day: number;
  label: string;
  views: number;
  uniqueVisitors: number;
  qrScans: number;
  shares: number;
  snapshot: boolean;
  rating: string;
}

export interface MemorialPerformanceMilestone {
  day: number;
  badge: string;
  label: string;
  views: number;
}

export interface MemorialPerformance {
  memorialId: string;
  publishedAt: string | null;
  monitoringActive: boolean;
  finalized: boolean;
  days: MemorialPerformanceDay[];
  totals: {
    views: number;
    uniqueVisitors: number;
    qrScans: number;
    shares: number;
    performanceRating: string;
    highestDailyViews: number;
    highestMilestoneAwarded: string | null;
  };
  milestones: MemorialPerformanceMilestone[];
  trend: Array<{ day: number; views: number; changePercent: number | null }>;
  snapshots: Array<{ day: number; views: number; visitors: number }>;
}

export interface MemorialPerformanceSummary {
  trending: Array<{
    id: string;
    slug: string;
    deceasedName: string;
    status: string;
    publishedAt: string;
    day: number;
    currentDayViews: number;
    total72HourViews: number;
    uniqueVisitors: number;
    performanceRating: string;
    highestMilestoneAwarded: string | null;
    finalized: boolean;
  }>;
  averages: {
    day1Views: number;
    day2Views: number;
    day3Views: number;
    total72HourViews: number;
    qrScans: number;
  };
  bestPerforming: {
    id: string;
    slug: string;
    deceasedName: string;
    total72HourViews: number;
    highestMilestoneAwarded: string | null;
  } | null;
  highestQrScans: {
    id: string;
    slug: string;
    deceasedName: string;
    qrScans: number;
  } | null;
  fastestGrowing: {
    id: string;
    slug: string;
    deceasedName: string;
    growthPercent: number;
  } | null;
  monitoringCount: number;
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
  trialStartsAt?: string | Date | null;
  trialEndsAt?: string | Date | null;
  trialMemorialsUsed?: number;
  memorialCreditsPurchased?: number;
  memorialCreditsRemaining?: number;
  lastCreditPurchaseAt?: string | Date | null;
}

/**
 * Feedback submitted by a funeral attendee
 */
export interface FuneralFeedback {
  id: string;
  memorialId: string;
  overallRating: number;
  staffRating?: number | null;
  organisationRating?: number | null;
  venueRating?: number | null;
  recommend?: boolean | null;
  useAgain?: boolean | null;
  comments?: string | null;
  allowContact: boolean;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  contactStatus?: string;
  contactedAt?: string | null;
  createdAt: string;
}

/**
 * Aggregated feedback summary for a memorial
 */
export interface FuneralFeedbackSummary {
  averageRating: number;
  totalResponses: number;
  recommendPercentage: number;
  useAgainPercentage: number;
  averageStaffRating: number;
  averageOrganisationRating: number;
  averageVenueRating: number;
}

/**
 * Dashboard contact-request enquiry
 */
export interface FuneralContactEnquiry {
  id: string;
  memorialId: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  overallRating: number;
  comments?: string | null;
  contactStatus: string;
  contactedAt?: string | null;
  createdAt: string;
  memorial: { deceasedName: string; slug: string };
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
  serviceEndTime: z.string().optional(),
  serviceVenue: z.string().optional(),
  timezone: z.string().optional(),
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
  serviceEndTime: z.string().optional(),
  serviceVenue: z.string().optional(),
  timezone: z.string().optional(),
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

/**
 * Validation schema for funeral feedback submission
 */
export const funeralFeedbackSchema = z.object({
  overallRating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5'),
  staffRating: z.number().int().min(1).max(5).optional().nullable(),
  organisationRating: z.number().int().min(1).max(5).optional().nullable(),
  venueRating: z.number().int().min(1).max(5).optional().nullable(),
  recommend: z.boolean().optional().nullable(),
  useAgain: z.boolean().optional().nullable(),
  comments: z.string().max(2000, 'Comments must be less than 2000 characters').optional().nullable(),
  allowContact: z.boolean().default(false),
  name: z.string().min(1, 'Name is required when requesting contact').optional().nullable(),
  phone: z.string().min(1, 'Phone is required when requesting contact').optional().nullable(),
  email: z.string().email('Invalid email').optional().nullable(),
});

export type FuneralFeedbackInput = z.infer<typeof funeralFeedbackSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// Marketing Hub — Types & Schemas
// ═══════════════════════════════════════════════════════════════════════════════

export interface MarketingContact {
  id: string;
  funeralHomeId: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface BrochureCategory {
  id: string;
  funeralHomeId: string;
  name: string;
  slug: string;
  description?: string | null;
  displayOrder: number;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BrochureGalleryItem {
  id: string;
  brochureId: string;
  url: string;
  caption?: string | null;
  displayOrder: number;
}

export interface Brochure {
  id: string;
  funeralHomeId: string;
  categoryId?: string | null;
  category?: BrochureCategory | null;
  title: string;
  slug: string;
  coverImageUrl?: string | null;
  description?: string | null;
  pdfUrl?: string | null;
  ctaEnabled: boolean;
  ctaText?: string | null;
  ctaUrl?: string | null;
  whatsappNumber?: string | null;
  phoneNumber?: string | null;
  emailAddress?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  published: boolean;
  featured: boolean;
  displayOrder: number;
  viewCount: number;
  shortUrl?: string | null;
  gallery?: BrochureGalleryItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Promotion {
  id: string;
  funeralHomeId: string;
  title: string;
  bannerImageUrl?: string | null;
  description?: string | null;
  startDate: string;
  endDate: string;
  buttonText?: string | null;
  buttonUrl?: string | null;
  published: boolean;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MarketingBranch {
  id: string;
  funeralHomeId: string;
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
  createdAt?: string;
  updatedAt?: string;
}

export interface Enquiry {
  id: string;
  brochureId: string;
  funeralHomeId: string;
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

export interface MarketingDashboard {
  totalBrochures: number;
  publishedBrochures: number;
  totalPromotions: number;
  activePromotions: number;
  totalEnquiries: number;
  totalBranches: number;
  totalViews: number;
  recentEnquiries: Enquiry[];
  contactConfigured: boolean;
}

// ── Zod Schemas ──────────────────────────────────────────────────────────────

export const updateMarketingContactSchema = z.object({
  businessName: z.string().max(200).optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  coverImageUrl: z.string().optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  telephone: z.string().max(50).optional().nullable(),
  mobile: z.string().max(50).optional().nullable(),
  whatsapp: z.string().max(50).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  website: z.string().max(500).optional().nullable(),
  businessHours: z.string().max(1000).optional().nullable(),
  googleMapsUrl: z.string().max(1000).optional().nullable(),
  facebook: z.string().max(500).optional().nullable(),
  instagram: z.string().max(500).optional().nullable(),
  tiktok: z.string().max(500).optional().nullable(),
  linkedin: z.string().max(500).optional().nullable(),
  enableBrochures: z.boolean().optional(),
  enableContact: z.boolean().optional(),
  enableBranches: z.boolean().optional(),
  enablePromotions: z.boolean().optional(),
});

export type UpdateMarketingContactInput = z.infer<typeof updateMarketingContactSchema>;

export const createBrochureCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  slug: z.string().max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  displayOrder: z.number().int().min(0).optional(),
});

export const updateBrochureCategorySchema = createBrochureCategorySchema.partial();

export type CreateBrochureCategoryInput = z.infer<typeof createBrochureCategorySchema>;
export type UpdateBrochureCategoryInput = z.infer<typeof updateBrochureCategorySchema>;

export const createBrochureSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300),
  slug: z.string().max(300).optional(),
  categoryId: z.string().optional().nullable(),
  coverImageUrl: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  pdfUrl: z.string().optional().nullable(),
  includedItems: z.array(z.string().max(300)).optional(),
  price: z.string().max(100).optional().nullable(),
  depositRequired: z.boolean().optional(),
  monthlyPaymentAvailable: z.boolean().optional(),
  financeAvailable: z.boolean().optional(),
  ctaEnabled: z.boolean().optional(),
  ctaType: z.enum(['call', 'whatsapp', 'email', 'branch', 'custom', 'enquire']).optional().nullable(),
  ctaText: z.string().max(100).optional().nullable(),
  ctaUrl: z.string().max(1000).optional().nullable(),
  whatsappNumber: z.string().max(50).optional().nullable(),
  phoneNumber: z.string().max(50).optional().nullable(),
  emailAddress: z.string().email().optional().nullable().or(z.literal('')),
  contactPerson: z.string().max(200).optional().nullable(),
  branchName: z.string().max(200).optional().nullable(),
  websiteUrl: z.string().max(500).optional().nullable(),
  seoTitle: z.string().max(200).optional().nullable(),
  seoDescription: z.string().max(400).optional().nullable(),
  published: z.boolean().optional(),
  featured: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
  gallery: z.array(z.object({
    url: z.string(),
    caption: z.string().optional().nullable(),
    displayOrder: z.number().int().min(0).optional(),
  })).optional(),
});

export const updateBrochureSchema = createBrochureSchema.partial();

export type CreateBrochureInput = z.infer<typeof createBrochureSchema>;
export type UpdateBrochureInput = z.infer<typeof updateBrochureSchema>;

export const createPromotionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300),
  bannerImageUrl: z.string().optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  startDate: z.string().refine((v) => !isNaN(Date.parse(v)), 'Invalid start date'),
  endDate: z.string().refine((v) => !isNaN(Date.parse(v)), 'Invalid end date'),
  buttonText: z.string().max(100).optional().nullable(),
  buttonUrl: z.string().max(1000).optional().nullable(),
  published: z.boolean().optional(),
});

export const updatePromotionSchema = createPromotionSchema.partial();

export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;
export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>;

export const createBranchSchema = z.object({
  name: z.string().min(1, 'Branch name is required').max(200),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  province: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  whatsapp: z.string().max(50).optional().nullable(),
  manager: z.string().max(200).optional().nullable(),
  businessHours: z.string().max(1000).optional().nullable(),
  googleMapsUrl: z.string().max(1000).optional().nullable(),
});

export const updateBranchSchema = createBranchSchema.partial();

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;

export const enquirySchema = z.object({
  fullName: z.string().min(1, 'Name is required').max(200),
  phoneNumber: z.string().max(50).optional().nullable(),
  emailAddress: z.string().email().optional().nullable().or(z.literal('')),
  message: z.string().max(5000).optional().nullable(),
});

export type EnquiryInput = z.infer<typeof enquirySchema>;

export const analyticsEventSchema = z.object({
  eventType: z.enum(['page_view', 'qr_scan', 'pdf_download', 'phone_click', 'whatsapp_click', 'cta_click', 'enquiry']),
  brochureId: z.string().optional().nullable(),
  metadata: z.string().optional().nullable(),
  visitorId: z.string().optional().nullable(),
});

export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>;

// ── Vehicle Types ──────────────────────────────────────────────────────────

export const VEHICLE_TYPES = ['Hearse', 'Family Car', 'Minibus', 'Truck', 'Utility'] as const;
export const VEHICLE_STATUSES = ['Available', 'Booked', 'Maintenance', 'Inactive'] as const;

export const createVehicleSchema = z.object({
  name: z.string().min(1).max(200),
  registrationNumber: z.string().min(1).max(50),
  vehicleType: z.enum(VEHICLE_TYPES),
  manufacturer: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  year: z.number().int().min(1900).max(2100).optional().nullable(),
  vin: z.string().max(50).optional().nullable(),
  colour: z.string().max(50).optional().nullable(),
  capacity: z.number().int().min(1).optional().nullable(),
  currentMileage: z.number().int().min(0).optional().nullable(),
  fuelType: z.string().max(50).optional().nullable(),
  transmission: z.string().max(50).optional().nullable(),
  status: z.enum(VEHICLE_STATUSES).optional(),
  assignedDriver: z.string().max(200).optional().nullable(),
  insuranceCompany: z.string().max(200).optional().nullable(),
  insuranceNumber: z.string().max(100).optional().nullable(),
  insuranceExpiry: z.string().optional().nullable(),
  roadworthyExpiry: z.string().optional().nullable(),
  licenseDiskExpiry: z.string().optional().nullable(),
  nextServiceDate: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export const updateVehicleSchema = createVehicleSchema.partial();

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;

export const CRM_LEAD_STATUSES = ['New', 'Contacted', 'Waiting', 'Demo Booked', 'Customer', 'Lost'] as const;
export const CRM_ACTIVITY_TYPES = ['Email', 'WhatsApp', 'Call', 'Follow-up', 'Demo', 'Closed Sale', 'Not Interested'] as const;

const optionalNullableString = z.string().max(500).optional().nullable();

export const createCrmLeadSchema = z.object({
  project: z.string().min(1).max(100).default('Memory Connect'),
  funeralHome: z.string().min(1).max(300),
  province: z.string().min(1).max(100).default('Free State'),
  town: optionalNullableString,
  owner: optionalNullableString,
  phone: optionalNullableString,
  whatsapp: optionalNullableString,
  email: z.string().email().optional().nullable().or(z.literal('')),
  website: z.string().max(500).optional().nullable().or(z.literal('')),
  facebook: z.string().max(500).optional().nullable().or(z.literal('')),
  source: z.string().max(200).optional().nullable(),
  status: z.enum(CRM_LEAD_STATUSES).optional(),
  revenue: z.number().min(0).optional(),
  followUpDate: z.string().max(20).optional().nullable().or(z.literal('')),
  demoDate: z.string().max(20).optional().nullable().or(z.literal('')),
  notes: z.string().max(10000).optional().nullable(),
});

export const updateCrmLeadSchema = createCrmLeadSchema.partial();

export const createCrmActivitySchema = z.object({
  type: z.enum(CRM_ACTIVITY_TYPES),
  note: z.string().max(2000).optional().nullable(),
});

export type CreateCrmLeadInput = z.infer<typeof createCrmLeadSchema>;
export type UpdateCrmLeadInput = z.infer<typeof updateCrmLeadSchema>;
export type CreateCrmActivityInput = z.infer<typeof createCrmActivitySchema>;

export const createServiceHistorySchema = z.object({
  serviceDate: z.string().refine((v) => !isNaN(Date.parse(v)), 'Invalid date'),
  description: z.string().max(2000).optional().nullable(),
  mileageAtService: z.number().int().min(0).optional().nullable(),
  cost: z.number().min(0).optional().nullable(),
  provider: z.string().max(200).optional().nullable(),
  nextServiceDate: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export type CreateServiceHistoryInput = z.infer<typeof createServiceHistorySchema>;

export const createFuelLogSchema = z.object({
  date: z.string().refine((v) => !isNaN(Date.parse(v)), 'Invalid date'),
  amount: z.number().min(0, 'Amount must be positive'),
  cost: z.number().min(0, 'Cost must be positive'),
  mileage: z.number().int().min(0).optional().nullable(),
  fuelType: z.string().max(50).optional().nullable(),
  station: z.string().max(200).optional().nullable(),
  receiptUrl: z.string().max(1000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export type CreateFuelLogInput = z.infer<typeof createFuelLogSchema>;

export const createMaintenanceLogSchema = z.object({
  date: z.string().refine((v) => !isNaN(Date.parse(v)), 'Invalid date'),
  type: z.string().min(1).max(100),
  description: z.string().max(5000).optional().nullable(),
  cost: z.number().min(0).optional().nullable(),
  provider: z.string().max(200).optional().nullable(),
  mileageAtService: z.number().int().min(0).optional().nullable(),
  nextServiceDue: z.string().optional().nullable(),
  status: z.enum(['Scheduled', 'InProgress', 'Completed', 'Cancelled']).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export type CreateMaintenanceLogInput = z.infer<typeof createMaintenanceLogSchema>;

// ── Asset Types ────────────────────────────────────────────────────────────

export const ASSET_CATEGORIES = [
  'Tent', 'Chair', 'Table', 'Stretcher', 'Lowering Device', 'Sound System',
  'Generator', 'Coffin Trolley', 'Gazebo', 'Flowers', 'Flags', 'Display Screen',
  'Projector', 'Lighting', 'Office Equipment',
] as const;

export const ASSET_CONDITIONS = ['Excellent', 'Good', 'Needs Repair', 'Broken'] as const;
export const ASSET_STATUSES = ['Available', 'Reserved', 'In Use', 'Maintenance', 'Retired'] as const;

export const createAssetSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().min(1),
  serialNumber: z.string().max(100).optional().nullable(),
  barcodeQrCode: z.string().max(200).optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  purchasePrice: z.number().min(0).optional().nullable(),
  supplier: z.string().max(200).optional().nullable(),
  warrantyExpiry: z.string().optional().nullable(),
  currentLocation: z.string().max(500).optional().nullable(),
  branchId: z.string().optional().nullable(),
  condition: z.enum(ASSET_CONDITIONS).optional(),
  status: z.enum(ASSET_STATUSES).optional(),
  assignedEmployee: z.string().max(200).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export const updateAssetSchema = createAssetSchema.partial();

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;

export const createDamageReportSchema = z.object({
  reportedBy: z.string().max(200).optional().nullable(),
  date: z.string().refine((v) => !isNaN(Date.parse(v)), 'Invalid date').optional(),
  description: z.string().min(1).max(5000),
  severity: z.enum(['Minor', 'Moderate', 'Major', 'Critical']).optional(),
  status: z.enum(['Open', 'Investigating', 'Resolved', 'Closed']).optional(),
  cost: z.number().min(0).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export type CreateDamageReportInput = z.infer<typeof createDamageReportSchema>;

// ── Funeral Resource Reservation Types ─────────────────────────────────────

export const RESERVATION_STATUSES = ['Reserved', 'CheckedOut', 'Returned', 'Cancelled'] as const;

export const createReservationSchema = z.object({
  memorialId: z.string().min(1),
  vehicleId: z.string().optional().nullable(),
  assetId: z.string().optional().nullable(),
  quantity: z.number().int().min(1).optional(),
  reservedBy: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;

export interface Vehicle {
  id: string;
  funeralHomeId: string;
  name: string;
  registrationNumber: string;
  vehicleType: string;
  manufacturer: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
  colour: string | null;
  capacity: number | null;
  currentMileage: number | null;
  fuelType: string | null;
  transmission: string | null;
  status: string;
  assignedDriver: string | null;
  insuranceCompany: string | null;
  insuranceNumber: string | null;
  insuranceExpiry: string | null;
  roadworthyExpiry: string | null;
  licenseDiskExpiry: string | null;
  nextServiceDate: string | null;
  notes: string | null;
  photos: VehiclePhoto[];
  documents: VehicleDocument[];
  serviceHistories: ServiceHistory[];
  fuelLogs: FuelLog[];
  maintenanceLogs: MaintenanceLog[];
  createdAt: string;
  updatedAt: string;
}

export interface VehiclePhoto {
  id: string;
  vehicleId: string;
  url: string;
  caption: string | null;
}

export interface VehicleDocument {
  id: string;
  vehicleId: string;
  name: string;
  url: string;
  type: string | null;
}

export interface ServiceHistory {
  id: string;
  vehicleId: string;
  serviceDate: string;
  description: string | null;
  mileageAtService: number | null;
  cost: number | null;
  provider: string | null;
  nextServiceDate: string | null;
  notes: string | null;
}

export interface FuelLog {
  id: string;
  vehicleId: string;
  date: string;
  amount: number;
  cost: number;
  mileage: number | null;
  fuelType: string | null;
  station: string | null;
  receiptUrl: string | null;
  notes: string | null;
}

export interface MaintenanceLog {
  id: string;
  vehicleId: string;
  date: string;
  type: string;
  description: string | null;
  cost: number | null;
  provider: string | null;
  mileageAtService: number | null;
  nextServiceDue: string | null;
  status: string;
  notes: string | null;
}

export interface Asset {
  id: string;
  funeralHomeId: string;
  name: string;
  category: string;
  serialNumber: string | null;
  barcodeQrCode: string | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  supplier: string | null;
  warrantyExpiry: string | null;
  currentLocation: string | null;
  branchId: string | null;
  branch?: { id: string; name: string } | null;
  condition: string;
  status: string;
  assignedEmployee: string | null;
  notes: string | null;
  photos: AssetPhoto[];
  documents: AssetDocument[];
  movementHistories: AssetMovementHistory[];
  damageReports: AssetDamageReport[];
  createdAt: string;
  updatedAt: string;
}

export interface AssetPhoto {
  id: string;
  assetId: string;
  url: string;
  caption: string | null;
}

export interface AssetDocument {
  id: string;
  assetId: string;
  name: string;
  url: string;
  type: string | null;
}

export interface AssetMovementHistory {
  id: string;
  assetId: string;
  fromBranch: string | null;
  toBranch: string | null;
  fromLocation: string | null;
  toLocation: string | null;
  movedBy: string | null;
  notes: string | null;
  movedAt: string;
}

export interface AssetDamageReport {
  id: string;
  assetId: string;
  reportedBy: string | null;
  date: string;
  description: string;
  severity: string;
  status: string;
  cost: number | null;
  notes: string | null;
}

export interface FuneralResourceReservation {
  id: string;
  funeralHomeId: string;
  memorialId: string;
  memorial?: { id: string; deceasedName: string; slug: string };
  vehicleId: string | null;
  vehicle?: { id: string; name: string; registrationNumber: string } | null;
  assetId: string | null;
  asset?: { id: string; name: string; category: string } | null;
  quantity: number;
  reservedAt: string;
  reservedBy: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  returnedAt: string | null;
  status: string;
  notes: string | null;
}

// ── Feature Management Types ───────────────────────────────────────────────

export const RELEASE_CHANNELS = [
  'INTERNAL', 'QA', 'BETA', 'EARLY_ACCESS', 'GENERAL_AVAILABILITY', 'DEPRECATED', 'ARCHIVED', 'DISABLED',
] as const;

export const FEATURE_CATEGORIES = [
  'MEMORIALS', 'OPERATIONS', 'VEHICLES', 'ASSETS', 'CASE_MANAGEMENT', 'MARKETING',
  'CRM', 'INSURANCE', 'MEMBERSHIP', 'REPORTS', 'STAFF', 'PAYMENTS', 'API', 'WHITE_LABEL', 'GENERAL',
] as const;

export const EDITIONS = [
  { key: 'MEMORIAL', name: 'MemoryConnect Memorial', rank: 0 },
  { key: 'FUNERAL_OFFICE', name: 'MemoryConnect Funeral Office', rank: 1 },
  { key: 'ENTERPRISE', name: 'MemoryConnect Enterprise', rank: 2 },
  { key: 'WHITE_LABEL', name: 'MemoryConnect White Label', rank: 3 },
] as const;

export const PLANS = [
  { key: 'STARTER', name: 'Starter', rank: 0 },
  { key: 'PROFESSIONAL', name: 'Professional', rank: 1 },
  { key: 'BUSINESS', name: 'Business', rank: 2 },
  { key: 'ENTERPRISE', name: 'Enterprise', rank: 3 },
] as const;

export const ROLLOUT_PERCENTS = [0, 5, 10, 25, 50, 75, 100] as const;

export const FEATURE_VISIBILITY_MODES = ['HIDDEN', 'COMING_SOON', 'ENABLED'] as const;

export const createFeatureSchema = z.object({
  key: z.string().min(1).max(100).regex(/^[A-Z0-9_]+$/, 'Key must be uppercase letters, numbers, or underscores'),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  category: z.enum(FEATURE_CATEGORIES).optional(),
  releaseChannel: z.enum(RELEASE_CHANNELS).optional(),
  enabledGlobally: z.boolean().optional(),
  premium: z.boolean().optional(),
  minimumEdition: z.string().optional().nullable(),
  minimumPlan: z.string().optional().nullable(),
  rolloutPercent: z.number().int().min(0).max(100).optional(),
});

export const updateFeatureSchema = createFeatureSchema.partial().omit({ key: true });

export type CreateFeatureInput = z.infer<typeof createFeatureSchema>;
export type UpdateFeatureInput = z.infer<typeof updateFeatureSchema>;

export const funeralHomeFeatureSchema = z.object({
  enabled: z.boolean(),
  releaseChannelOverride: z.enum(RELEASE_CHANNELS).optional().nullable(),
});

export type FuneralHomeFeatureInput = z.infer<typeof funeralHomeFeatureSchema>;

export const userFeatureSchema = z.object({
  enabled: z.boolean(),
  expiresAt: z.string().optional().nullable(),
});

export type UserFeatureInput = z.infer<typeof userFeatureSchema>;

export const createFeatureDependencySchema = z.object({
  featureKey: z.string().min(1).max(100),
  dependsOnFeature: z.string().min(1).max(100),
});

export type CreateFeatureDependencyInput = z.infer<typeof createFeatureDependencySchema>;

export interface FeatureDependency {
  id: string;
  featureKey: string;
  dependsOnFeature: string;
  createdAt: string;
}

export interface Feature {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  releaseChannel: string;
  enabledGlobally: boolean;
  premium: boolean;
  minimumEdition: string | null;
  minimumPlan: string | null;
  rolloutPercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureWithOverrides extends Feature {
  funeralHomeOverrides: { id: string; funeralHomeId: string; enabled: boolean; releaseChannelOverride: string | null }[];
  userOverrides: { id: string; userId: string; enabled: boolean; expiresAt: string | null }[];
  dependencies: string[];
  requiredBy: string[];
}

export interface FuneralHomeFeature {
  id: string;
  funeralHomeId: string;
  featureKey: string;
  enabled: boolean;
  releaseChannelOverride: string | null;
  enabledBy: string | null;
  enabledAt: string;
  feature?: Feature;
}

export interface UserFeature {
  id: string;
  userId: string;
  featureKey: string;
  enabled: boolean;
  expiresAt: string | null;
  enabledBy: string | null;
  feature?: Feature;
}

export interface FeatureAuditLogEntry {
  id: string;
  actorUserId: string | null;
  actorName: string | null;
  action: string;
  featureKey: string;
  targetType: string;
  targetId: string | null;
  funeralHomeId: string | null;
  details: string | null;
  createdAt: string;
}

export interface ResolvedFeature {
  key: string;
  name: string;
  enabled: boolean;
  visibility: 'HIDDEN' | 'COMING_SOON' | 'ENABLED';
  reason: string;
}
