import type { EventPerformance, EventPerformanceSummary } from '@memorialconnect/event-shared';

const API_URL = import.meta.env.VITE_EVENTS_API_URL || 'http://localhost:4101';

export function apiBase(): string {
  return API_URL;
}

export function photoUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${API_URL}${path}`;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('events_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...((options.headers as Record<string, string>) || {}) },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json?.error || `Request failed (${res.status})`, json?.code);
  return json.data as T;
}

function requireEventId(id: string): string {
  const normalized = id.trim();
  if (!normalized || normalized === 'undefined' || normalized === 'null') {
    throw new ApiError(400, 'This event link is missing its event ID. Return to Your events and open the event again.');
  }
  return encodeURIComponent(normalized);
}

export const eventsApi = {
  register: (body: { name: string; organiserName: string; email: string; password: string }) =>
    request<{ accessToken: string; user: unknown; organiser: unknown }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  login: (body: { email: string; password: string }) =>
    request<{ accessToken: string; user: unknown; organiser: unknown }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  me: () => request<{ id: string; organiserId: string; name: string; role?: string; organiser: { id: string; name: string } }>('/api/v1/auth/me'),
  listEvents: () => request<unknown[]>('/api/v1/events'),
  getEvent: (id: string) => request<Record<string, unknown>>(`/api/v1/events/${requireEventId(id)}`),
  createEvent: async (body: Record<string, unknown>) => {
    const event = await request<Record<string, unknown>>('/api/v1/events', { method: 'POST', body: JSON.stringify(body) });
    if (typeof event?.id !== 'string' || !event.id.trim()) {
      throw new ApiError(502, 'The Events API did not return an event ID. The event may have been saved; return to Your events and refresh before trying again.');
    }
    return event as Record<string, unknown> & { id: string };
  },
  updateEvent: (id: string, body: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/api/v1/events/${requireEventId(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  publish: (id: string) => request<{ authorizationUrl?: string; reference?: string; amountCents?: number; currency?: string; event?: Record<string, unknown> }>(`/api/v1/events/${requireEventId(id)}/publish`, { method: 'POST' }),
  verifyPublishPayment: (id: string, reference: string) => request<Record<string, unknown>>(`/api/v1/events/${requireEventId(id)}/verify-publish-payment/${encodeURIComponent(reference)}`),
  analytics: (id: string) => request<{ viewCount: number; uniqueVisitors: number; events: Record<string, number> }>(`/api/v1/events/${requireEventId(id)}/analytics`),
  eventPerformance: (id: string) => request<EventPerformance>(`/api/v1/events/${requireEventId(id)}/analytics/performance`),
  eventPerformanceSummary: (id: string) => request<EventPerformanceSummary>(`/api/v1/events/${requireEventId(id)}/analytics/performance-summary`),
  addAgenda: (id: string, body: Record<string, unknown>) =>
    request<unknown>(`/api/v1/events/${requireEventId(id)}/agenda`, { method: 'POST', body: JSON.stringify(body) }),
  deleteAgenda: (id: string, itemId: string) =>
    request<unknown>(`/api/v1/events/${requireEventId(id)}/agenda/${encodeURIComponent(itemId)}`, { method: 'DELETE' }),
  addLocation: (id: string, body: Record<string, unknown>) =>
    request<unknown>(`/api/v1/events/${requireEventId(id)}/locations`, { method: 'POST', body: JSON.stringify(body) }),
  deleteLocation: (id: string, locationId: string) =>
    request<unknown>(`/api/v1/events/${requireEventId(id)}/locations/${encodeURIComponent(locationId)}`, { method: 'DELETE' }),
  moderateMessage: (id: string, messageId: string, approved: boolean) =>
    request<unknown>(`/api/v1/events/${requireEventId(id)}/messages/${encodeURIComponent(messageId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ approved }),
    }),
  deleteMessage: (id: string, messageId: string) =>
    request<unknown>(`/api/v1/events/${requireEventId(id)}/messages/${encodeURIComponent(messageId)}`, { method: 'DELETE' }),
  uploadPhoto: async (id: string, file: File, caption?: string) => {
    const form = new FormData();
    form.append('photo', file);
    if (caption) form.append('caption', caption);
    const res = await fetch(`${API_URL}/api/v1/events/${requireEventId(id)}/photos`, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error || 'Upload failed');
    return json.data;
  },
  deletePhoto: (id: string, photoId: string) =>
    request<unknown>(`/api/v1/events/${requireEventId(id)}/photos/${encodeURIComponent(photoId)}`, { method: 'DELETE' }),
  publicEvent: (slug: string) => request<Record<string, unknown>>(`/api/v1/public/events/${slug}`),
  recordView: (slug: string, visitorId: string) =>
    request<unknown>(`/api/v1/public/events/${slug}/view`, {
      method: 'POST',
      body: JSON.stringify({ visitorId }),
    }),
  platformOverview: () => request<Record<string, number>>('/api/v1/platform/overview'),
  platformPerformanceSummary: () => request<EventPerformanceSummary>('/api/v1/platform/performance-summary'),
  platformOrganisers: () => request<any[]>('/api/v1/platform/organisers'),
  platformEvents: () => request<any[]>('/api/v1/platform/events'),
  platformPayments: () => request<any[]>('/api/v1/platform/payments'),
  platformAuditLogs: () => request<any[]>('/api/v1/platform/audit-logs'),
  platformOrganiserAction: (id: string, action: 'suspend' | 'reactivate') =>
    request<unknown>(`/api/v1/platform/organisers/${id}/${action}`, { method: 'POST' }),
  platformEventStatus: (id: string, status: 'DRAFT' | 'ARCHIVED') =>
    request<unknown>(`/api/v1/platform/events/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  recordShare: (slug: string) =>
    request<unknown>(`/api/v1/public/events/${slug}/share`, { method: 'POST', body: JSON.stringify({}) }),
  recordQrScan: (slug: string) =>
    request<unknown>(`/api/v1/public/events/${slug}/qr-scan`, { method: 'POST', body: JSON.stringify({}) }),
  postMessage: (slug: string, body: { authorName: string; message: string }) =>
    request<unknown>(`/api/v1/public/events/${slug}/messages`, { method: 'POST', body: JSON.stringify(body) }),
  qrUrl: (slug: string) => `${API_URL}/api/v1/public/events/${slug}/qr`,
};

export function getVisitorId(): string {
  let id = localStorage.getItem('events_visitor');
  if (!id || id.length < 12) {
    id = `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
    localStorage.setItem('events_visitor', id);
  }
  return id;
}
