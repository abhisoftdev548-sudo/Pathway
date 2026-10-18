import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { qk } from './queries';

export interface CurrentUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: 'user' | 'creator' | 'admin';
  accountStatus: 'active' | 'suspended' | 'pending_verification';
  bio: string;
  createdAt: string;
  isAdmin: boolean;
  isCreator: boolean;
}

export interface WalletSummary {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  updatedAt: string | null;
}

export interface Permissions {
  canCreate: boolean;
  canModerate: boolean;
  canManageUsers: boolean;
  canManageQCoins: boolean;
  canManageConfig: boolean;
  canExportReports: boolean;
  features: Record<string, boolean>;
}

interface MeResponse {
  user: CurrentUser | null;
  wallet: WalletSummary | null;
  unreadNotifications: number;
  permissions: Permissions;
}

interface AuthContextValue {
  user: CurrentUser | null;
  wallet: WalletSummary | null;
  permissions: Permissions;
  unreadNotifications: number;
  loading: boolean;
  refresh: () => Promise<unknown>;
  signOut: () => Promise<void>;
}

const GUEST_PERMISSIONS: Permissions = {
  canCreate: false,
  canModerate: false,
  canManageUsers: false,
  canManageQCoins: false,
  canManageConfig: false,
  canExportReports: false,
  features: {},
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [userOverride, setUserOverride] = useState<CurrentUser | null>(null);

  const { data, isLoading, refetch } = useQuery<MeResponse>({
    queryKey: qk.me,
    queryFn: () => api.get<MeResponse>('/auth/me'),
    staleTime: 30_000,
    retry: false,
  });

  const user = userOverride ?? data?.user ?? null;

  useEffect(() => {
    setUserOverride(null);
  }, [data?.user?.id]);

  const signOut = useCallback(async () => {
    await api.post('/auth/logout');
    setUserOverride(null);
    queryClient.clear();
    await refetch();
  }, [queryClient, refetch]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      wallet: data?.wallet ?? null,
      permissions: data?.permissions ?? GUEST_PERMISSIONS,
      unreadNotifications: data?.unreadNotifications ?? 0,
      loading: isLoading,
      refresh: refetch,
      signOut,
    }),
    [user, data, isLoading, refetch, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function useFeature(name: string): boolean {
  const { permissions } = useAuth();
  return permissions.features?.[name] !== false;
}
