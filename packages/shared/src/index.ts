import { z } from 'zod';

/**
 * Status of a memorial in the system
 */
export type MemorialStatus = 'draft' | 'published' | 'archived';

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
  coverPhotoUrl?: string;
  status: MemorialStatus;
  createdAt: string;
  updatedAt: string;
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
  isDemo?: boolean;
}

export type PlanCode = 'starter' | 'professional' | 'unlimited';
export type PaymentKind = 'subscription' | 'extra_memorial';
export type PaymentStatus = 'pending' | 'success' | 'failed';
export type SubscriptionStatus = 'pending' | 'active' | 'attention' | 'non-renewing' | 'cancelled' | 'expired';

export interface BillingPlan {
  code: PlanCode;
  name: string;
  amount: number;
  currency: 'ZAR';
  interval: 'monthly';
  memorialLimit: number;
  extraMemorialAmount: number;
  fairUseUnlimited: boolean;
  checkoutAvailable: boolean;
}

export interface BillingPayment {
  id: string;
  kind: PaymentKind;
  status: PaymentStatus;
  amount: number;
  currency: string;
  paystackReference: string;
  paidAt?: string | null;
  createdAt: string;
}

export interface BillingStatus {
  checkoutAvailable: boolean;
  plan: BillingPlan;
  plans: BillingPlan[];
  subscription: {
    status: SubscriptionStatus;
    planCode: PlanCode;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  usage: {
    memorialsUsed: number;
    memorialLimit: number;
    extraCredits: number;
    unlimited: boolean;
    remaining: number | null;
  };
  payments: BillingPayment[];
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
}

/**
 * User account for funeral home staff
 */
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'staff';
  funeralHomeId: string;
}

/**
 * Funeral home organization
 */
export interface FuneralHome {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
  plan: 'demo' | 'starter' | 'single' | 'professional' | 'unlimited' | 'enterprise';
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
  coverPhotoUrl: z.string().url().optional().or(z.literal('')),
  obituary: z.string().optional(),
  biography: z.any().optional(),
  programme: z.array(z.any()).optional(),
  currentProgrammeIndex: z.number().int().min(0).optional(),
  announcements: z.array(z.any()).optional(),
  settings: z.any().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
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
