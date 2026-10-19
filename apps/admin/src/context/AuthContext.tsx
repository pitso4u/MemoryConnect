import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { getApiUrl } from '../lib/config';
import { getStoredManagingTarget, storeManagingTarget, ManagingTarget } from '../lib/manageContext';
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
  /** True while a temporary-password session must set a new password before normal access. */
  needsPasswordChange: boolean;
  setPendingPasswordChange: (token: string, user: User) => void;
  completePasswordChange: (token: string, user: User) => void;
  isLoading: boolean;
  featuresReady: boolean;
  resolvedFeatures: ResolvedFeature[];
  hasFeature: (key: string) => boolean;
  refreshFeatures: () => Promise<void>;
  /** Funeral home a SUPER_ADMIN is currently managing, or null when not managing. */
  managingHome: ManagingTarget | null;
  startManagingHome: (target: ManagingTarget) => void;
  stopManagingHome: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [featuresReady, setFeaturesReady] = useState(false);
  const [resolvedFeatures, setResolvedFeatures] = useState<ResolvedFeature[]>([]);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [managingHome, setManagingHome] = useState<ManagingTarget | null>(() => getStoredManagingTarget());
  const resolvedFeaturesRef = useRef<ResolvedFeature[]>([]);
  const refreshingRef = useRef(false);

  const applyFeatures = useCallback((features: ResolvedFeature[]) => {
    resolvedFeaturesRef.current = features;
    setResolvedFeatures(features);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem('mc_token');
    localStorage.removeItem('mc_user');
    localStorage.removeItem('mc_feature_version');
    localStorage.removeItem('mc_pending_change');
    storeManagingTarget(null);
    setToken(null);
    setUser(null);
    setManagingHome(null);
    applyFeatures([]);
    setFeaturesReady(false);
    setNeedsPasswordChange(false);
  }, [applyFeatures]);

  const refreshFeatures = useCallback(async (force = false) => {
    if (!force && refreshingRef.current) return;
    const saved = localStorage.getItem('mc_token');
    if (!saved) {
      applyFeatures([]);
      setFeaturesReady(true);
      return;
    }
    refreshingRef.current = true;
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${saved}` };
      const managingId = getStoredManagingTarget()?.id;
      if (managingId) headers['X-Managing-Funeral-Home'] = managingId;
      const version = force ? null : localStorage.getItem('mc_feature_version');
      if (version) headers['If-None-Match'] = version;
      const res = await fetch(`${getApiUrl()}/api/v1/auth/my-features`, { headers });
      if (res.status === 401) {
        // The stored token is no longer accepted (expired, invalidated, or the
        // user was removed). End the session so the dead token stops polling
        // auth endpoints and feeding 401s into the login/register rate limit.
        // Once cleared, `token` is null, so every later refreshFeatures() call
        // short-circuits before reaching the network — no logout loop.
        clearSession();
        return;
      }
      if (res.status === 304) {
        // A 304 is only valid when this page already holds the feature payload.
        // After a full reload the payload was lost while the version survived, so
        // invalidate the stored version and perform exactly one unconditional
        // refetch. `force` bypasses the in-flight guard and omits If-None-Match,
        // which guarantees this retry cannot recurse back into a 304.
        if (resolvedFeaturesRef.current.length > 0) return;
        localStorage.removeItem('mc_feature_version');
        await refreshFeatures(true);
        return;
      }
      if (res.ok) {
        const json = await res.json();
        applyFeatures(json.data?.features ?? []);
        const next = json.data?.featureVersion;
        if (next != null) localStorage.setItem('mc_feature_version', String(next));
      } else {
        applyFeatures([]);
      }
    } catch {
      // Feature availability is best-effort; the app still renders without it.
      applyFeatures([]);
    } finally {
      refreshingRef.current = false;
      setFeaturesReady(true);
    }
  }, [clearSession]);

  useEffect(() => {
    const saved = localStorage.getItem('mc_token');
    const savedUser = localStorage.getItem('mc_user');
    if (saved && savedUser) {
      const restored = JSON.parse(savedUser) as User;
      setToken(saved);
      setUser(restored);
      // A management target only ever applies to a SUPER_ADMIN session. If the
      // restored session is not a platform owner (e.g. the account was demoted
      // or a different user signed in on this browser), drop it so the stale
      // header cannot lock the owner out of their own API calls.
      if (restored.role !== 'SUPER_ADMIN') {
        storeManagingTarget(null);
        setManagingHome(null);
      }
      // A pending forced change survives reloads; the change-password screen
      // re-uses the stored restricted token instead of bouncing back to login.
      if (localStorage.getItem('mc_pending_change')) {
        setNeedsPasswordChange(true);
        setFeaturesReady(true);
      } else {
        void refreshFeatures();
      }
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
    localStorage.removeItem('mc_pending_change');
    // A fresh sign-in never inherits a management context.
    storeManagingTarget(null);
    setManagingHome(null);
    setToken(newToken);
    setUser(newUser);
    setNeedsPasswordChange(false);
    void refreshFeatures();
  };

  // SUPER_ADMIN management context. While active, the app behaves as the chosen
  // funeral home (nav, branding, API scoping via the X-Managing-Funeral-Home
  // header) while the identity stays the platform owner.
  const startManagingHome = useCallback((target: ManagingTarget) => {
    storeManagingTarget(target);
    setManagingHome(target);
    void refreshFeatures(true);
  }, [refreshFeatures]);

  const stopManagingHome = useCallback(() => {
    storeManagingTarget(null);
    setManagingHome(null);
    void refreshFeatures(true);
  }, [refreshFeatures]);

  // Called after a successful login with a temporary password. The restricted
  // session is stored but the user is kept out of the normal app until they set
  // a permanent password.
  const setPendingPasswordChange = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem('mc_token', newToken);
    localStorage.setItem('mc_user', JSON.stringify(newUser));
    localStorage.setItem('mc_pending_change', '1');
    setToken(newToken);
    setUser(newUser);
    setNeedsPasswordChange(true);
    applyFeatures([]);
    setFeaturesReady(false);
  }, [applyFeatures]);

  // Called after /auth/change-password succeeds with the fresh full-access token.
  const completePasswordChange = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem('mc_token', newToken);
    localStorage.setItem('mc_user', JSON.stringify(newUser));
    localStorage.removeItem('mc_pending_change');
    setToken(newToken);
    setUser(newUser);
    setNeedsPasswordChange(false);
    void refreshFeatures();
  }, [refreshFeatures]);

  const logout = clearSession;

  const hasFeature = useCallback(
    (key: string) => resolvedFeatures.some((f) => f.key === key && f.enabled),
    [resolvedFeatures],
  );

  return (
    <AuthContext.Provider value={{ user, token, login, logout, needsPasswordChange, setPendingPasswordChange, completePasswordChange, isLoading, featuresReady, resolvedFeatures, hasFeature, refreshFeatures, managingHome, startManagingHome, stopManagingHome }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
