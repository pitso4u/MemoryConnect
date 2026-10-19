import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { eventsApi } from './api';

interface AuthState {
  token: string | null;
  user: { id: string; name: string; organiserId: string; role: string; organiser: { id: string; name: string } } | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, organiserName: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('events_token'));
  const [user, setUser] = useState<AuthState['user']>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    eventsApi
      .me()
      .then((me) => setUser({ id: me.id, name: me.name, organiserId: me.organiserId, role: me.role ?? 'ORGANISER', organiser: me.organiser }))
      .catch(() => {
        localStorage.removeItem('events_token');
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function login(email: string, password: string) {
    const data = await eventsApi.login({ email, password });
    localStorage.setItem('events_token', data.accessToken);
    setToken(data.accessToken);
    const me = await eventsApi.me();
    setUser({ id: me.id, name: me.name, organiserId: me.organiserId, role: me.role ?? 'ORGANISER', organiser: me.organiser });
  }

  async function register(name: string, organiserName: string, email: string, password: string) {
    const data = await eventsApi.register({ name, organiserName, email, password });
    localStorage.setItem('events_token', data.accessToken);
    setToken(data.accessToken);
    const me = await eventsApi.me();
    setUser({ id: me.id, name: me.name, organiserId: me.organiserId, role: me.role ?? 'ORGANISER', organiser: me.organiser });
  }

  function logout() {
    localStorage.removeItem('events_token');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
