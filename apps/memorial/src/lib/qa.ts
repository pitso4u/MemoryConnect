import { getApiUrl } from './config';

const API_URL = getApiUrl();

interface QAPayload {
  kind: 'qa_access';
  userId: string;
  role: 'SUPER_ADMIN';
  memorialId: string;
}

let _qaUser: QAPayload | null = null;

async function fetchQAVerification(token: string): Promise<QAPayload | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/public/verify-qa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch {
    return null;
  }
}

export async function initQA(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('qa');
  if (!token) return;
  _qaUser = await fetchQAVerification(token);
  if (_qaUser) {
    const url = new URL(window.location.href);
    url.searchParams.delete('qa');
    window.history.replaceState({}, '', url.toString());
  }
}

export function isQAMode(): boolean {
  return _qaUser !== null;
}

export function getQAUser(): QAPayload | null {
  return _qaUser;
}
