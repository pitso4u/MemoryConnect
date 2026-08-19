import { getApiUrl } from './config';

const API_URL = getApiUrl();
const TOKEN_KEY = 'mc_crm_token';
const USER_KEY = 'mc_crm_user';

export type Status = 'New' | 'Contacted' | 'Waiting' | 'Demo Booked' | 'Customer' | 'Lost';
export type ActivityType = 'Email' | 'WhatsApp' | 'Call' | 'Follow-up' | 'Demo' | 'Closed Sale' | 'Not Interested';

export interface CrmActivity {
  id: string;
  type: ActivityType;
  at: string;
  note: string | null;
}

export interface CrmLead {
  id: string;
  project: string;
  funeralHome: string;
  province: string;
  town: string | null;
  owner: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  facebook: string | null;
  source: string | null;
  status: Status;
  revenue: number;
  followUpDate: string | null;
  demoDate: string | null;
  notes: string | null;
  dateAdded: string;
  activities: CrmActivity[];
}

export interface CrmUser {
  id: string;
  name: string;
  email: string;
  role: string;
  funeralHomeId?: string | null;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getSessionUser(): CrmUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CrmUser;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: CrmUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
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
  const timeoutId = setTimeout(() => controller.abort(), 30000);

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
      const error = new Error(message) as Error & { status?: number };
      error.status = res.status;
      throw error;
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

export interface CreateCrmLeadInput {
  project?: string;
  funeralHome: string;
  province?: string;
  town?: string | null;
  owner?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;
  facebook?: string | null;
  source?: string | null;
  status?: Status;
  revenue?: number;
  followUpDate?: string | null;
  demoDate?: string | null;
  notes?: string | null;
}

export const crmApi = {
  login: (email: string, password: string) =>
    request<{ accessToken: string; user: CrmUser }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  listLeads: () => request<CrmLead[]>('/api/v1/crm'),

  getLead: (id: string) => request<CrmLead>(`/api/v1/crm/${id}`),

  createLead: (data: CreateCrmLeadInput) =>
    request<CrmLead>('/api/v1/crm', { method: 'POST', body: JSON.stringify(data) }),

  updateLead: (id: string, patch: Partial<CreateCrmLeadInput>) =>
    request<CrmLead>(`/api/v1/crm/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  deleteLead: (id: string) =>
    request<null>(`/api/v1/crm/${id}`, { method: 'DELETE' }),

  addActivity: (id: string, data: { type: ActivityType; note?: string | null }) =>
    request<{ activity: CrmActivity; lead: CrmLead }>(`/api/v1/crm/${id}/activities`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteActivity: (activityId: string) =>
    request<null>(`/api/v1/crm/activities/${activityId}`, { method: 'DELETE' }),
};
