import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiGet, apiPost, fetchCsrfToken, setCsrfToken } from './api';
import type { User } from './types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: { name: string; email: string; password: string; timezone?: string }) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthResponse {
  user: User;
  csrfToken?: string;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      await fetchCsrfToken();
      try {
        const response = await apiGet<AuthResponse>('/auth/me');
        if (!cancelled) {
          setUser(response.user);
          if (response.csrfToken) setCsrfToken(response.csrfToken);
        }
      } catch {
        try {
          const refreshed = await apiPost<AuthResponse>('/auth/refresh');
          if (!cancelled) {
            setUser(refreshed.user);
            if (refreshed.csrfToken) setCsrfToken(refreshed.csrfToken);
          }
        } catch {
          if (!cancelled) setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiPost<AuthResponse>('/auth/login', { email, password });
    if (response.csrfToken) setCsrfToken(response.csrfToken);
    setUser(response.user);
    return response.user;
  }, []);

  const register = useCallback(
    async (input: { name: string; email: string; password: string; timezone?: string }) => {
      const response = await apiPost<AuthResponse>('/auth/register', input);
      if (response.csrfToken) setCsrfToken(response.csrfToken);
      setUser(response.user);
      return response.user;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await apiPost('/auth/logout');
    } finally {
      setUser(null);
      setCsrfToken(null);
      void fetchCsrfToken(true);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const response = await apiGet<AuthResponse>('/auth/me');
    setUser(response.user);
    if (response.csrfToken) setCsrfToken(response.csrfToken);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
