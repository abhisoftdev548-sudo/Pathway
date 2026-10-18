import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { User } from '../lib/types';

interface AuthCtx {
  user: User | null; loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (displayName: string, email: string, password: string, bio?: string) => Promise<User>;
  logout: () => Promise<void>; refresh: () => Promise<void>; setUser: (u: User | null) => void;
}
const Ctx = createContext<AuthCtx>(null as any);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try { const { data } = await api.get('/api/auth/me'); setUser(data.user); }
    catch { setUser(null); } finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const login = async (email: string, password: string) => {
    const { data } = await api.post('/api/auth/login', { email, password }); setUser(data.user); return data.user;
  };
  const register = async (displayName: string, email: string, password: string, bio = '') => {
    const { data } = await api.post('/api/auth/register', { displayName, email, password, bio }); setUser(data.user); return data.user;
  };
  const logout = async () => { await api.post('/api/auth/logout'); setUser(null); };
  return <Ctx.Provider value={{ user, loading, login, register, logout, refresh, setUser }}>{children}</Ctx.Provider>;
}
