import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getApiUrl } from '../lib/config';
import type { ResolvedFeature } from '@memorialconnect/shared';

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

  const refreshFeatures = useCallback(async () => {
    const saved = localStorage.getItem('mc_token');
    if (!saved) {
      setResolvedFeatures([]);
      setFeaturesReady(true);
      return;
    }
    try {
      const res = await fetch(`${getApiUrl()}/api/v1/auth/my-features`, {
        headers: { Authorization: `Bearer ${saved}` },
      });
      if (res.ok) {
        const json = await res.json();
        setResolvedFeatures(json.data?.features ?? []);
      } else {
        setResolvedFeatures([]);
      }
    } catch {
      // Feature availability is best-effort; the app still renders without it.
      setResolvedFeatures([]);
    } finally {
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

  // Refetch feature availability whenever the tab regains focus so a platform
  // owner toggling a flag is reflected immediately in this session's UI.
  useEffect(() => {
    const onFocus = () => { void refreshFeatures(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshFeatures]);

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
