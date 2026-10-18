import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import endpoints, { type UserDto } from '@/services/endpoints';
import { apiErrorMessage, setAccessToken } from '@/services/api';

interface AuthContextValue {
  user: UserDto | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<UserDto>;
  register: (name: string, email: string, password: string) => Promise<UserDto>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Auth state lives here. The access token is kept in memory only
 * (see services/api.ts); the refresh token is an HttpOnly cookie.
 * On page load we try a silent refresh so sessions survive reloads without
 * ever exposing tokens to persistent browser storage.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  const bootstrap = useCallback(async () => {
    try {
      const result = await endpoints.auth.me();
      setUser(result.user);
    } catch {
      // No valid session — try one silent refresh via the HttpOnly cookie.
      try {
        const { data } = await import('@/services/api').then((m) =>
          m.api.post('/auth/refresh', {}, { withCredentials: true })
        );
        const token = data?.data?.accessToken as string | undefined;
        const refreshedUser = data?.data?.user as UserDto | undefined;
        if (token) {
          setAccessToken(token);
          setUser(refreshedUser ?? (await endpoints.auth.me()).user);
        }
      } catch {
        setAccessToken(null);
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const result = await endpoints.auth.login({ email, password });
      setAccessToken(result.accessToken);
      setUser(result.user);
      return result.user;
    } catch (error) {
      throw new Error(apiErrorMessage(error, 'Login failed'));
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    try {
      const result = await endpoints.auth.register({ name, email, password });
      setAccessToken(result.accessToken);
      setUser(result.user);
      return result.user;
    } catch (error) {
      throw new Error(apiErrorMessage(error, 'Registration failed'));
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await endpoints.auth.logout();
    } catch {
      // Logging out locally matters even if the API call fails.
    }
    setAccessToken(null);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const refreshUser = useCallback(async () => {
    const result = await endpoints.auth.me();
    setUser(result.user);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, isLoading, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthContext;
