import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { getApiUrl } from '../lib/config';
import type { ResolvedFeature } from '@memorialconnect/shared';

/** How often a signed-in session re-fetches /auth/my-features so owner-side flag changes propagate deterministically. */
const FEATURES_POLL_MS = 30_000;

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  funeralHomeId?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
  featuresReady: boolean;
  resolvedFeatures: ResolvedFeature[];
  hasFeature: (key: string) => boolean;
  refreshFeatures: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [featuresReady, setFeaturesReady] = useState(false);
  const [resolvedFeatures, setResolvedFeatures] = useState<ResolvedFeature[]>([]);
  const refreshingRef = useRef(false);

  const refreshFeatures = useCallback(async () => {
    if (refreshingRef.current) return;
    const saved = localStorage.getItem('mc_token');
    if (!saved) {
      setResolvedFeatures([]);
      setFeaturesReady(true);
      return;
    }
    refreshingRef.current = true;
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${saved}` };
      const version = localStorage.getItem('mc_feature_version');
      if (version) headers['If-None-Match'] = version;
      const res = await fetch(`${getApiUrl()}/api/v1/auth/my-features`, { headers });
      if (res.status === 304) {
        // Unchanged since the last fetch; keep the current feature set.
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setResolvedFeatures(json.data?.features ?? []);
        const next = json.data?.featureVersion;
        if (next != null) localStorage.setItem('mc_feature_version', String(next));
      } else {
        setResolvedFeatures([]);
      }
    } catch {
      // Feature availability is best-effort; the app still renders without it.
      setResolvedFeatures([]);
    } finally {
      refreshingRef.current = false;
      setFeaturesReady(true);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('mc_token');
    const savedUser = localStorage.getItem('mc_user');
    if (saved && savedUser) {
      setToken(saved);
      setUser(JSON.parse(savedUser));
      void refreshFeatures();
    } else {
      setFeaturesReady(true);
    }
    setIsLoading(false);
  }, [refreshFeatures]);

  // Refetch feature availability whenever the tab regains focus or the browser
  // regains network connectivity so a platform owner toggling a flag is reflected
  // immediately in this session's UI.
  useEffect(() => {
    const refresh = () => { void refreshFeatures(); };
    const onFocus = () => refresh();
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    const onOnline = () => refresh();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
    };
  }, [refreshFeatures]);

  // Deterministic propagation: while signed in, poll so feature changes made by a
  // platform owner reach this already-open session without a logout, reload, or
  // tab-focus event.
  useEffect(() => {
    if (!token) return;
    const id = window.setInterval(() => { void refreshFeatures(); }, FEATURES_POLL_MS);
    return () => window.clearInterval(id);
  }, [token, refreshFeatures]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('mc_token', newToken);
    localStorage.setItem('mc_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    void refreshFeatures();
  };

  const logout = () => {
    localStorage.removeItem('mc_token');
    localStorage.removeItem('mc_user');
    localStorage.removeItem('mc_feature_version');
    setToken(null);
    setUser(null);
    setResolvedFeatures([]);
    setFeaturesReady(false);
  };

  const hasFeature = useCallback(
    (key: string) => resolvedFeatures.some((f) => f.key === key && f.enabled),
    [resolvedFeatures],
  );

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading, featuresReady, resolvedFeatures, hasFeature, refreshFeatures }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
