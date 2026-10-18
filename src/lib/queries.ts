import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';
import { api, type Page } from './api';
import type { Page as ServerPage } from './api';

export type { Page };

// ------------------------------------------------------------------ keys

export const qk = {
  me: ['me'] as const,
  bootstrap: ['meta', 'bootstrap'] as const,
  stats: ['meta', 'stats'] as const,
  quizzes: (params: Record<string, unknown>) => ['quizzes', params] as const,
  quiz: (id: string) => ['quiz', id] as const,
  myQuizzes: (params: Record<string, unknown>) => ['my-quizzes', params] as const,
  polls: (params: Record<string, unknown>) => ['polls', params] as const,
  poll: (id: string) => ['poll', id] as const,
  myPolls: (params: Record<string, unknown>) => ['my-polls', params] as const,
  attempt: (id: string) => ['attempt', id] as const,
  attempts: (params: Record<string, unknown>) => ['attempts', params] as const,
  wallet: ['wallet'] as const,
  transactions: (params: Record<string, unknown>) => ['transactions', params] as const,
  refunds: ['refunds'] as const,
  refundable: ['refundable-attempts'] as const,
  notifications: (params: Record<string, unknown>) => ['notifications', params] as const,
  achievements: ['achievements'] as const,
  leaderboards: (params: Record<string, unknown>) => ['leaderboards', params] as const,
  quizLeaderboard: (id: string, params: Record<string, unknown>) => ['quiz-leaderboard', id, params] as const,
  ratings: (params: Record<string, unknown>) => ['ratings', params] as const,
  myReports: ['my-reports'] as const,
  myAppeals: ['my-appeals'] as const,
  creatorOverview: ['creator', 'overview'] as const,
  creatorAnalytics: (days: number) => ['creator', 'analytics', days] as const,
  creatorFeedback: (params: Record<string, unknown>) => ['creator', 'feedback', params] as const,
  creatorContent: (params: Record<string, unknown>) => ['creator', 'content', params] as const,
  adminOverview: (params: Record<string, unknown>) => ['admin', 'overview', params] as const,
  adminAnalytics: (days: number) => ['admin', 'analytics', days] as const,
  adminActivity: (limit: number) => ['admin', 'activity', limit] as const,
  adminQuizzes: (params: Record<string, unknown>) => ['admin', 'quizzes', params] as const,
  adminQuiz: (id: string) => ['admin', 'quiz', id] as const,
  adminPolls: (params: Record<string, unknown>) => ['admin', 'polls', params] as const,
  adminPoll: (id: string) => ['admin', 'poll', id] as const,
  adminQueue: (params: Record<string, unknown>) => ['admin', 'queue', params] as const,
  adminCategories: ['admin', 'categories'] as const,
  adminTags: ['admin', 'tags'] as const,
  adminDifficulties: ['admin', 'difficulties'] as const,
  adminUsers: (params: Record<string, unknown>) => ['admin', 'users', params] as const,
  adminUser: (id: string) => ['admin', 'user', id] as const,
  adminUserFilters: ['admin', 'users', 'filters'] as const,
  adminReports: (params: Record<string, unknown>) => ['admin', 'reports', params] as const,
  adminAppeals: (params: Record<string, unknown>) => ['admin', 'appeals', params] as const,
  adminModerationHistory: (params: Record<string, unknown>) => ['admin', 'moderation-history', params] as const,
  adminReportedContent: (params: Record<string, unknown>) => ['admin', 'reported-content', params] as const,
  adminQcoinOverview: (params: Record<string, unknown>) => ['admin', 'qcoin', 'overview', params] as const,
  adminTransactions: (params: Record<string, unknown>) => ['admin', 'transactions', params] as const,
  adminAnomalies: ['admin', 'anomalies'] as const,
  adminQcoinRefunds: (params: Record<string, unknown>) => ['admin', 'qcoin-refunds', params] as const,
  adminRewardDisputes: (params: Record<string, unknown>) => ['admin', 'reward-disputes', params] as const,
  adminReconciliation: (params: Record<string, unknown>) => ['admin', 'reconciliation', params] as const,
  adminPolicies: ['admin', 'policies'] as const,
  adminRatings: (params: Record<string, unknown>) => ['admin', 'ratings', params] as const,
  adminDisputes: (params: Record<string, unknown>) => ['admin', 'rating-disputes', params] as const,
  adminReputation: (params: Record<string, unknown>) => ['admin', 'reputation', params] as const,
  adminRatingAbuse: ['admin', 'rating-abuse'] as const,
  adminConfig: ['admin', 'config'] as const,
  adminConfigKey: (key: string) => ['admin', 'config', key] as const,
  adminHealth: ['admin', 'health'] as const,
  adminJobs: (params: Record<string, unknown>) => ['admin', 'jobs', params] as const,
  adminErrors: (params: Record<string, unknown>) => ['admin', 'errors', params] as const,
  adminDiagnostics: ['admin', 'diagnostics'] as const,
  adminAuditLogs: (params: Record<string, unknown>) => ['admin', 'audit', params] as const,
  adminSecurityEvents: (params: Record<string, unknown>) => ['admin', 'security-events', params] as const,
  adminExportCounts: ['admin', 'export-counts'] as const,
};

// ------------------------------------------------------------------ hooks

export function useApiQuery<T>(
  key: readonly unknown[],
  path: string | null,
  options?: Partial<UseQueryOptions<T, Error>>,
) {
  return useQuery<T, Error>({
    queryKey: key,
    queryFn: () => api.get<T>(path as string),
    enabled: path !== null && options?.enabled !== false,
    ...options,
  });
}

/** Convenience wrapper for paginated endpoints. */
export function usePagedQuery<T>(
  key: readonly unknown[],
  path: string | null,
  options?: Partial<UseQueryOptions<ServerPage<T>, Error>>,
) {
  return useQuery<ServerPage<T>, Error>({
    queryKey: key,
    queryFn: () => api.get<ServerPage<T>>(path as string),
    enabled: path !== null && options?.enabled !== false,
    placeholderData: (prev) => prev,
    ...options,
  });
}

export function useApiMutation<TData, TVariables>(
  method: 'post' | 'put' | 'patch' | 'delete',
  buildPath: (variables: TVariables) => string,
  options?: UseMutationOptions<TData, Error, TVariables>,
) {
  return useMutation<TData, Error, TVariables>({
    mutationFn: (variables: TVariables) => {
      const path = buildPath(variables);
      if (method === 'delete') return api.del<TData>(path);
      return api[method]<TData>(path);
    },
    ...options,
  });
}

export function useApiBodyMutation<TData, TVariables extends { body?: unknown; path?: string }>(
  method: 'post' | 'put' | 'patch',
  buildPath: (variables: TVariables) => string,
  options?: UseMutationOptions<TData, Error, TVariables>,
) {
  return useMutation<TData, Error, TVariables>({
    mutationFn: (variables: TVariables) => api[method]<TData>(buildPath(variables), variables.body),
    ...options,
  });
}

export function invalidateAll(queryClient: ReturnType<typeof useQueryClient>): void {
  queryClient.invalidateQueries();
}
