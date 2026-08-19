import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, setAccessToken, getAccessToken } from "../api/client";

interface Session {
  user: { id: string; email: string; name: string };
  tenant: { id: string; name: string; slug: string; plan: string } | null;
  role: string | null;
}

interface AuthState {
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; tenantName: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const boot = async () => {
      if (!getAccessToken()) {
        setLoading(false);
        return;
      }
      try {
        const me = await api.get<Session>("/auth/me");
        setSession(me);
      } catch {
        setAccessToken(null);
      } finally {
        setLoading(false);
      }
    };
    boot();
    const onUnauth = () => setSession(null);
    window.addEventListener("sr:unauthorized", onUnauth);
    return () => window.removeEventListener("sr:unauthorized", onUnauth);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post<Session & { accessToken: string; refreshToken: string }>("/auth/login", {
      email,
      password,
    });
    setAccessToken(res.accessToken);
    localStorage.setItem("sr_refresh_token", res.refreshToken);
    setSession({ user: res.user, tenant: res.tenant, role: res.role });
  };

  const register = async (data: { name: string; email: string; password: string; tenantName: string }) => {
    const res = await api.post<Session & { accessToken: string; refreshToken: string }>("/auth/register", data);
    setAccessToken(res.accessToken);
    localStorage.setItem("sr_refresh_token", res.refreshToken);
    setSession({ user: res.user, tenant: res.tenant, role: res.role });
  };

  const logout = () => {
    api.post("/auth/logout", { refreshToken: localStorage.getItem("sr_refresh_token") }).catch(() => {});
    setAccessToken(null);
    localStorage.removeItem("sr_refresh_token");
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
