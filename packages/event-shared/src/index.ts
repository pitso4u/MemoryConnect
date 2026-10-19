import { z } from 'zod';

// ── Event types & lifecycle (generic, NOT memorial) ──────────────────────────

export const EVENT_TYPES = [
  'WEDDING',
  'BIRTHDAY',
  'GRADUATION',
  'BABY_SHOWER',
  'ANNIVERSARY',
  'CELEBRATION',
  'CORPORATE',
  'COMMUNITY',
  'CUSTOM',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_STATUSES = ['DRAFT', 'PUBLISHED', 'EXPIRED', 'ARCHIVED'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_VISIBILITY = ['PUBLIC', 'UNLISTED'] as const;
export type EventVisibility = (typeof EVENT_VISIBILITY)[number];

export const EVENT_THEMES = ['CLASSIC', 'MODERN', 'ELEGANT', 'CELEBRATION', 'CORPORATE'] as const;
export type EventTheme = (typeof EVENT_THEMES)[number];

// ── Domain types ─────────────────────────────────────────────────────────────

export interface Organiser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface EventUser {
  id: string;
  email: string;
  name: string;
  organiserId: string;
}

export interface EventPhoto {
  id: string;
  eventId: string;
  url: string;
  caption?: string | null;
  order: number;
  createdAt: string;
}

export interface EventMessage {
  id: string;
  eventId: string;
  authorName: string;
  message: string;
  approved: boolean;
  createdAt: string;
}

export interface EventLocation {
  id: string;
  eventId: string;
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  order: number;
}

export interface EventAgendaItem {
  id: string;
  eventId: string;
  title: string;
  description?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  order: number;
}

export interface EventSummary {
  id: string;
  slug: string;
  organiserId: string;
  eventType: EventType;
  title: string;
  description?: string | null;
  hostName?: string | null;
  startDateTime?: string | null;
  endDateTime?: string | null;
  timezone: string;
  status: EventStatus;
  visibility: EventVisibility;
  coverImage?: string | null;
  theme: EventTheme;
  publishedAt?: string | null;
  expiresAt?: string | null;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EventDetails extends EventSummary {
  photos: EventPhoto[];
  messages: EventMessage[];
  locations: EventLocation[];
  agenda: EventAgendaItem[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ── 72-Hour Event Performance Analytics ─────────────────────────────────────

export interface EventPerformanceDay {
  day: number;
  label: string;
  views: number;
  uniqueVisitors: number;
  qrScans: number;
  shares: number;
  snapshot: boolean;
  rating: string;
}

export interface EventPerformanceMilestone {
  day: number;
  badge: string;
  label: string;
  views: number;
}

export interface EventPerformance {
  eventId: string;
  publishedAt: string | null;
  monitoringActive: boolean;
  finalized: boolean;
  days: EventPerformanceDay[];
  totals: {
    views: number;
    uniqueVisitors: number;
    qrScans: number;
    shares: number;
    performanceRating: string;
    highestDailyViews: number;
    highestMilestoneAwarded: string | null;
  };
  milestones: EventPerformanceMilestone[];
  trend: Array<{ day: number; views: number; changePercent: number | null }>;
  snapshots: Array<{ day: number; views: number; visitors: number }>;
}

export interface EventPerformanceTrending {
  id: string;
  slug: string;
  title: string;
  status: string;
  publishedAt: string;
  day: number;
  currentDayViews: number;
  total72HourViews: number;
  uniqueVisitors: number;
  performanceRating: string;
  highestMilestoneAwarded: string | null;
  finalized: boolean;
}

export interface EventPerformanceSummary {
  trending: EventPerformanceTrending[];
}

// ── Template catalogue (presentation only, never alters the model) ───────────
// Each event type maps to an ordered list of section keys. The frontend
// renders sections generically; adding a type = adding an entry here.

export const EVENT_TEMPLATE_SECTIONS: Record<EventType, string[]> = {
  WEDDING: ['story', 'party', 'agenda', 'venue', 'photos', 'rsvp', 'messages'],
  BIRTHDAY: ['about', 'agenda', 'venue', 'photos', 'messages'],
  GRADUATION: ['about', 'achievements', 'agenda', 'venue', 'photos', 'messages'],
  BABY_SHOWER: ['about', 'agenda', 'venue', 'photos', 'messages'],
  ANNIVERSARY: ['story', 'agenda', 'venue', 'photos', 'messages'],
  CELEBRATION: ['about', 'agenda', 'venue', 'photos', 'messages'],
  CORPORATE: ['about', 'agenda', 'venue', 'photos', 'messages'],
  COMMUNITY: ['about', 'agenda', 'venue', 'photos', 'messages'],
  CUSTOM: ['about', 'agenda', 'venue', 'photos', 'messages'],
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  WEDDING: 'Wedding',
  BIRTHDAY: 'Birthday',
  GRADUATION: 'Graduation',
  BABY_SHOWER: 'Baby Shower',
  ANNIVERSARY: 'Anniversary',
  CELEBRATION: 'Celebration',
  CORPORATE: 'Corporate Event',
  COMMUNITY: 'Community Event',
  CUSTOM: 'Custom Event',
};

// Section metadata: the UI derives headings from this catalogue keyed by the
// section keys in EVENT_TEMPLATE_SECTIONS. Adding an event type or section
// means editing this file — never adding `if (eventType === ...)` branches.
export interface EventSectionMeta {
  title: string;
  emptyHint: string;
}

export const EVENT_SECTION_META: Record<string, EventSectionMeta> = {
  story: { title: 'Our Story', emptyHint: 'The story will appear here.' },
  party: { title: 'Wedding Party', emptyHint: 'The wedding party will appear here.' },
  about: { title: 'About', emptyHint: 'Details about the celebration will appear here.' },
  achievements: { title: 'Achievements', emptyHint: 'Achievements will appear here.' },
  agenda: { title: 'Programme', emptyHint: 'The programme will appear here.' },
  venue: { title: 'Venue', emptyHint: 'Venue details will appear here.' },
  photos: { title: 'Photos', emptyHint: 'Photos will appear here.' },
  rsvp: { title: 'RSVP', emptyHint: 'RSVP details will appear here.' },
  messages: { title: 'Guest Messages', emptyHint: 'Be the first to leave a message.' },
};

export function sectionsFor(eventType: EventType): string[] {
  return EVENT_TEMPLATE_SECTIONS[eventType] ?? EVENT_TEMPLATE_SECTIONS.CUSTOM;
}

// Per-type presentation: hero kicker line, story section heading override,
// and card accent used by the landing page and dashboards. The UI reads these
// generically — adding a type means adding an entry here, never a branch.
export interface EventTemplatePresentation {
  kicker: string;
  storyTitle: string;
  cardAccent: string;
}

export const EVENT_TEMPLATE_PRESENTATION: Record<EventType, EventTemplatePresentation> = {
  WEDDING: { kicker: 'We are getting married', storyTitle: 'Our Story', cardAccent: 'ev-accent-rose' },
  BIRTHDAY: { kicker: "Let's celebrate!", storyTitle: 'About the Celebrant', cardAccent: 'ev-accent-violet' },
  GRADUATION: { kicker: 'Class of 2026', storyTitle: 'About the Graduate', cardAccent: 'ev-accent-sky' },
  BABY_SHOWER: { kicker: 'A little one is on the way', storyTitle: 'About', cardAccent: 'ev-accent-mint' },
  ANNIVERSARY: { kicker: 'Celebrating years together', storyTitle: 'Our Story', cardAccent: 'ev-accent-amber' },
  CELEBRATION: { kicker: "Let's celebrate!", storyTitle: 'About', cardAccent: 'ev-accent-violet' },
  CORPORATE: { kicker: 'You are invited', storyTitle: 'About the Event', cardAccent: 'ev-accent-slate' },
  COMMUNITY: { kicker: 'Everyone is welcome', storyTitle: 'About', cardAccent: 'ev-accent-leaf' },
  CUSTOM: { kicker: 'You are invited', storyTitle: 'About', cardAccent: 'ev-accent-violet' },
};

export function presentationFor(eventType: EventType): EventTemplatePresentation {
  return EVENT_TEMPLATE_PRESENTATION[eventType] ?? EVENT_TEMPLATE_PRESENTATION.CUSTOM;
}

// ── Validation schemas ───────────────────────────────────────────────────────

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  organiserName: z.string().trim().min(2, 'Organisation or family name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const createEventSchema = z.object({
  eventType: z.enum(EVENT_TYPES),
  title: z.string().trim().min(2, 'Event title is required').max(200),
  description: z.string().max(5000).optional().nullable(),
  hostName: z.string().max(200).optional().nullable(),
  startDateTime: z.string().optional().nullable(),
  endDateTime: z.string().optional().nullable(),
  timezone: z.string().max(80).optional(),
  visibility: z.enum(EVENT_VISIBILITY).optional(),
  coverImage: z.string().max(1000).optional().nullable(),
  theme: z.enum(EVENT_THEMES).optional(),
});

export const updateEventSchema = createEventSchema.partial();

export const photoSchema = z.object({
  caption: z.string().max(300).optional().nullable(),
  order: z.number().int().min(0).optional(),
});

export const messageSchema = z.object({
  authorName: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  message: z.string().trim().min(1, 'Message is required').max(1000),
});

export const locationSchema = z.object({
  name: z.string().trim().min(1, 'Location name is required').max(200),
  address: z.string().max(500).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  order: z.number().int().min(0).optional(),
});

export const agendaItemSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional().nullable(),
  startTime: z.string().max(40).optional().nullable(),
  endTime: z.string().max(40).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  order: z.number().int().min(0).optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type CreateMessageInput = z.infer<typeof messageSchema>;
