export const SOCIAL_PLATFORMS = [
  "facebook",
  "instagram",
  "linkedin",
  "tiktok",
  "x",
  "google",
  "youtube",
  "whatsapp",
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

/** Platforms that support direct post generation for the MVP. */
export const GENERATOR_PLATFORMS = [
  "facebook",
  "linkedin",
  "instagram",
  "tiktok",
  "youtube",
  "blog",
  "newsletter",
] as const;

export type GeneratorPlatform = (typeof GENERATOR_PLATFORMS)[number];

export const CONTENT_SOURCE_TYPES = [
  "website",
  "blog",
  "products",
  "events",
  "memorials",
  "announcements",
  "promotions",
] as const;

export type ContentSourceType = (typeof CONTENT_SOURCE_TYPES)[number];

export const TONES = ["Friendly", "Professional", "Luxury", "Modern"] as const;
export type Tone = (typeof TONES)[number];

export const AUDIENCES = [
  "South Africa",
  "UK",
  "USA",
  "Australia",
] as const;
export type Audience = (typeof AUDIENCES)[number];

export const POST_STATUSES = [
  "DRAFT",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHED",
  "FAILED",
] as const;

export type PostStatus = (typeof POST_STATUSES)[number];

export const SCHEDULE_STATUSES = [
  "SCHEDULED",
  "PUBLISHED",
  "FAILED",
  "CANCELLED",
] as const;

export const TENANT_PLANS = ["STARTER", "GROWTH", "PRO", "ENTERPRISE"] as const;

export const ROLES = ["SUPER_ADMIN", "ORG_ADMIN", "MEMBER"] as const;
export type Role = (typeof ROLES)[number];

export const LEAD_SOURCES = ["COMMENT", "FORM", "WHATSAPP", "REFERRAL"] as const;
export const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"] as const;

export interface BusinessProfile {
  name: string;
  industry: string;
  website?: string;
  logoUrl?: string;
  description?: string;
  primaryColor: string;
  secondaryColor: string;
  fonts: string;
  tone: Tone;
  audience: Audience;
  keywords: string[];
}

export interface ContentSourceInput {
  type: ContentSourceType;
  label: string;
  url?: string;
  content?: string;
}

export interface ConnectedAccountInput {
  platform: SocialPlatform;
  handle: string;
}

export interface DashboardStats {
  connectedCount: number;
  lastPost: { platform: string; publishedAt: string } | null;
  todayReach: number;
  todayVisits: number;
  todayLeads: number;
  upcomingCount: number;
  publishedCount: number;
  scheduledCount: number;
}

export interface CalendarEntry {
  id: string;
  platform: string;
  status: string;
  publishAt: string;
  body: string;
  title?: string;
}

export interface AnalyticsPoint {
  date: string;
  reach: number;
  visits: number;
  clicks: number;
  shares: number;
  conversions: number;
  followers: number;
}

export interface PlatformPerformance {
  platform: string;
  posts: number;
  reach: number;
  clicks: number;
  shares: number;
  conversions: number;
}

export interface LeadRow {
  id: string;
  name: string;
  email: string;
  source: string;
  status: string;
  notes?: string;
  createdAt: string;
}

export interface PostRow {
  id: string;
  title?: string;
  body: string;
  platform: string;
  status: string;
  tone?: string;
  publishedAt?: string;
  scheduledAt?: string;
  createdAt: string;
}
