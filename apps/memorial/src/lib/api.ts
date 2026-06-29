import { getApiUrl } from './config';
import type {
  ProgrammeItem,
  Photo,
  Tribute,
  Memorial,
  Announcement,
  MemorialLocation,
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

export interface PublicMemorial extends Memorial {
  funeralHome: { name: string; phone?: string; logoUrl?: string };
  photos: Photo[];
  tributes: Tribute[];
  locations: MemorialLocation[];
}

export interface ProjectorData {
  deceasedName: string;
  currentIndex: number;
  totalItems: number;
  currentItem: ProgrammeItem | null;
  nextItem: ProgrammeItem | null;
  announcements: Announcement[];
}

export type { ProgrammeItem, Photo, Tribute, Announcement, MemorialLocation };

export const api = {
  getMemorial: (slug: string) => request<PublicMemorial>(`/api/v1/public/memorials/${slug}`),
  getProjector: (slug: string) => request<ProjectorData>(`/api/v1/public/memorials/${slug}/projector`),
  submitTribute: (slug: string, data: { authorName: string; message: string }) =>
    request<{ pending: boolean }>(`/api/v1/public/memorials/${slug}/tributes`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
