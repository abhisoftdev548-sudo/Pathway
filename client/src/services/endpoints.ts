import api, { apiErrorMessage } from './api';

/**
 * Thin typed wrappers around REST endpoints (`/api/v1`).
 * Every dynamic value in the UI comes from these calls — never from fakes.
 */

export interface ApiList<T> {
  items: T[];
  meta?: { page: number; limit: number; total: number; totalPages: number; hasMore: boolean };
}

async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await api.get(url, { params });
  return data.data as T;
}

async function post<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await api.post(url, body);
  return data.data as T;
}

async function patch<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await api.patch(url, body);
  return data.data as T;
}

async function put<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await api.put(url, body);
  return data.data as T;
}

async function del<T>(url: string): Promise<T> {
  const { data } = await api.delete(url);
  return data.data as T;
}

/** GET a paginated list including meta. */
async function getList<T>(url: string, params?: Record<string, unknown>): Promise<ApiList<T>> {
  const { data } = await api.get(url, { params });
  return { items: (data.data?.items ?? []) as T[], meta: data.meta };
}

export const endpoints = {
  auth: {
    register: (body: { name: string; email: string; password: string }) =>
      post<{ user: UserDto; accessToken: string }>('/auth/register', body),
    login: (body: { email: string; password: string }) =>
      post<{ user: UserDto; accessToken: string }>('/auth/login', body),
    logout: () => post<{ loggedOut: boolean }>('/auth/logout'),
    me: () => get<{ user: UserDto }>('/auth/me'),
    forgotPassword: (body: { email: string }) =>
      post<{ issued: boolean; devResetToken?: string }>('/auth/forgot-password', body),
    resetPassword: (body: { token: string; password: string }) => post<{ reset: boolean }>('/auth/reset-password', body),
    changePassword: (body: { currentPassword: string; newPassword: string }) =>
      post<{ changed: boolean }>('/auth/change-password', body),
    sessions: () => get<{ items: SessionDto[] }>('/auth/sessions'),
    revokeSessions: () => del<{ revoked: number }>('/auth/sessions'),
  },

  users: {
    me: () => get<{ user: UserDto }>('/users/me'),
    updateMe: (body: Record<string, unknown>) => patch<{ user: UserDto }>('/users/me', body),
    myStats: () => get<UserStatsDto>('/users/me/stats'),
    myAchievements: () => get<{ items: AchievementDto[] }>('/users/me/achievements'),
    publicProfile: (id: string) => get<PublicProfileDto>(`/users/${id}`),
    avatarUpload: () => get<UploadParamsDto>('/users/me/avatar-upload'),
  },

  quizzes: {
    list: (params?: Record<string, unknown>) => getList<QuizSummary>('/quizzes', params),
    mine: (params?: Record<string, unknown>) => getList<QuizSummary>('/quizzes/mine', params),
    moderation: (params?: Record<string, unknown>) => getList<QuizAdminDto>('/quizzes/moderation', params),
    get: (slugOrId: string) => get<QuizPlayDto>(`/quizzes/${encodeURIComponent(slugOrId)}`),
    detail: (id: string) => get<{ quiz: QuizAdminDto; versions: QuizVersionDto[] }>(`/quizzes/${id}/detail`),
    versions: (id: string) => get<{ versions: QuizVersionDto[] }>(`/quizzes/${id}/versions`),
    create: (body: QuizInput) => post<{ quiz: QuizAdminDto }>('/quizzes', body),
    update: (id: string, body: Partial<QuizInput> & { changeNote?: string }) =>
      patch<{ quiz: QuizAdminDto }>(`/quizzes/${id}`, body),
    remove: (id: string) => del<{ archived: boolean }>(`/quizzes/${id}`),
    duplicate: (id: string) => post<{ quiz: QuizAdminDto }>(`/quizzes/${id}/duplicate`),
    submit: (id: string, changeNote?: string) => post<{ quiz: QuizAdminDto }>(`/quizzes/${id}/submit`, { changeNote }),
    startAttempt: (id: string) => post<AttemptStartDto>(`/quizzes/${id}/attempts`),
    submitAttempt: (attemptId: string, body: { answers: AttemptAnswer[]; timeSpentSec: number }) =>
      post<AttemptResultDto>(`/quizzes/attempts/${attemptId}/submit`, body),
    getAttempt: (attemptId: string) => get<AttemptResultDto>(`/quizzes/attempts/${attemptId}`),
  },

  polls: {
    list: (params?: Record<string, unknown>) => getList<PollSummary>('/polls', params),
    mine: (params?: Record<string, unknown>) => getList<PollSummary>('/polls/mine', params),
    moderation: (params?: Record<string, unknown>) => getList<PollAdminDto>('/polls/moderation', params),
    get: (slugOrId: string) => get<PollDetailDto>(`/polls/${encodeURIComponent(slugOrId)}`),
    create: (body: PollInput) => post<{ poll: PollAdminDto }>('/polls', body),
    update: (id: string, body: Partial<PollInput>) => patch<{ poll: PollAdminDto }>(`/polls/${id}`, body),
    remove: (id: string) => del<{ archived: boolean }>(`/polls/${id}`),
    submit: (id: string, changeNote?: string) => post<{ poll: PollAdminDto }>(`/polls/${id}/submit`, { changeNote }),
    vote: (id: string, optionIds: string[]) =>
      post<{ voteId: string; optionIds: string[]; rewardInfo: RewardInfoDto | null }>(`/polls/${id}/vote`, { optionIds }),
  },

  ratings: {
    create: (body: { targetType: 'QUIZ' | 'POLL'; targetId: string; score: number; review?: string }) =>
      post<{ rating: RatingDto }>('/ratings', body),
    forTarget: (targetType: string, targetId: string, params?: Record<string, unknown>) =>
      get<{ items: RatingDto[]; summary: RatingSummaryDto }>(`/ratings/${targetType}/${targetId}`, params),
    creatorFeedback: (params?: Record<string, unknown>) => getList<RatingDto>('/ratings/creator/feedback', params),
    reputation: (userId: string) => get<ReputationDto>(`/reputation/${userId}`),
  },

  reports: {
    create: (body: { targetType: string; targetId: string; reason: string; details?: string }) =>
      post<{ report: ReportDto }>('/reports', body),
    mine: (params?: Record<string, unknown>) => getList<ReportDto>('/reports/mine', params),
  },

  notifications: {
    list: (params?: Record<string, unknown>) =>
      get<{ items: NotificationDto[]; unreadCount: number }>('/notifications', params),
    markRead: (id: string) => post<{ notification: NotificationDto }>(`/notifications/${id}/read`),
    markAllRead: () => post<{ marked: number }>('/notifications/read-all'),
  },

  wallet: {
    get: () => get<{ wallet: WalletDto }>('/wallet'),
    transactions: (params?: Record<string, unknown>) => getList<LedgerDto>('/wallet/transactions', params),
    rewards: (params?: Record<string, unknown>) => getList<LedgerDto>('/wallet/rewards', params),
    policy: () => get<WalletPolicyDto>('/wallet/policy'),
  },

  leaderboards: {
    performance: (limit = 20) => get<{ items: LeaderboardRow[] }>('/leaderboards/performance', { limit }),
    consistency: (limit = 20) => get<{ items: LeaderboardRow[] }>('/leaderboards/consistency', { limit }),
    creators: (limit = 20) => get<{ items: LeaderboardRow[] }>('/leaderboards/creators', { limit }),
  },

  public: {
    stats: () => get<{ stats: Record<string, number> }>('/stats'),
    highlights: () => get<{ quizzes?: QuizSummary[]; polls?: PollSummary[] }>('/highlights'),
    categories: () => get<{ items: CategoryDto[] }>('/categories'),
    tags: () => get<{ items: TagDto[] }>('/tags'),
    health: () => get<{ status: string }>('/health'),
  },

  admin: {
    overview: () => get<AdminOverviewDto>('/admin/overview'),
    analytics: () => get<AdminAnalyticsDto>('/admin/analytics'),
    diagnostics: () => get<AdminDiagnosticsDto>('/admin/diagnostics'),
    moderate: (targetType: 'quiz' | 'poll', id: string, body: ModerationInput) =>
      post<{ id: string; status: string }>(`/admin/moderate/${targetType}/${id}`, body),
    moderationHistory: (params?: Record<string, unknown>) => getList<AdminReviewDto>('/admin/moderation/history', params),
    qualityRatings: (params?: Record<string, unknown>) => getList<QualityRatingDto>('/admin/quality-ratings', params),
    users: (params?: Record<string, unknown>) => getList<AdminUserDto>('/admin/users', params),
    userDetail: (id: string) => get<AdminUserDetailDto>(`/admin/users/${id}`),
    manageUser: (id: string, body: Record<string, unknown>) => post<{ user: AdminUserDto }>(`/admin/users/${id}/manage`, body),
    reconcile: (id: string) => get<ReconcileDto>(`/admin/users/${id}/reconcile`),
    ledger: (params?: Record<string, unknown>) => getList<LedgerDto>('/admin/ledger', params),
    suspicious: (params?: Record<string, unknown>) =>
      get<SuspiciousDto>('/admin/suspicious-transactions', params),
    refunds: (params?: Record<string, unknown>) => getList<RefundRequestDto>('/admin/refunds', params),
    processRefund: (kind: string, id: string, body: { approve: boolean; reason: string }) =>
      post<{ approved: boolean }>(`/admin/refunds/${kind}/${id}`, body),
    reports: (params?: Record<string, unknown>) => getList<ReportDto>('/admin/reports', params),
    resolveReport: (id: string, body: { status: string; resolution?: string }) =>
      post<{ report: ReportDto }>(`/admin/reports/${id}/resolve`, body),
    categories: () => get<{ categories: CategoryDto[]; tags: TagDto[] }>('/admin/categories'),
    createCategory: (body: { name: string; description?: string; parent?: string | null }) =>
      post<{ category: CategoryDto }>('/admin/categories', body),
    updateCategory: (id: string, body: Record<string, unknown>) => patch<{ category: CategoryDto }>(`/admin/categories/${id}`, body),
    deleteCategory: (id: string) => del<{ deleted: boolean }>(`/admin/categories/${id}`),
    createTag: (body: { name: string }) => post<{ tag: TagDto }>('/admin/tags', body),
    updateTag: (id: string, body: Record<string, unknown>) => patch<{ tag: TagDto }>(`/admin/tags/${id}`, body),
    deleteTag: (id: string) => del<{ deleted: boolean }>(`/admin/tags/${id}`),
    settings: () => get<{ items: SettingDto[]; defaults: Record<string, unknown>; keys: Record<string, string> }>('/admin/settings'),
    updateSetting: (body: { key: string; value: unknown; description?: string }) =>
      put<{ setting: SettingDto }>('/admin/settings', body),
    broadcast: (body: { title: string; body?: string; link?: string; userRole?: string }) =>
      post<{ delivered: number }>('/admin/notifications/broadcast', body),
    templates: () => get<{ items: TemplateDto[] }>('/admin/notifications/templates'),
    saveTemplate: (body: TemplateDto) => post<{ items: TemplateDto[] }>('/admin/notifications/templates', body),
    auditLogs: (params?: Record<string, unknown>) => getList<AuditLogDto>('/admin/audit-logs', params),
  },
};

// ── DTO types (mirroring API responses) ──────────────────────────────────────

export interface UserDto {
  _id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED';
  bio?: string;
  avatar?: { url?: string; publicId?: string };
  wallet: WalletDto;
  settings?: { emailNotifications?: boolean; showOnLeaderboards?: boolean; theme?: string };
  createdAt: string;
  lastActiveAt?: string;
}

export interface WalletDto {
  balance: number;
  totalEarned: number;
  totalSpent: number;
}

export interface SessionDto {
  familyId: string;
  createdAt: string;
  expiresAt: string;
  userAgent?: string;
  ip?: string;
}

export interface CategoryDto {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  parent?: string | null;
  isActive?: boolean;
}

export interface TagDto {
  _id: string;
  name: string;
  slug: string;
  usageCount?: number;
  isActive?: boolean;
}

export interface QuizSummary {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  difficulty?: string;
  language?: string;
  tags?: string[];
  cover?: { url?: string };
  category?: { _id: string; name: string; slug: string } | null;
  creator?: { _id: string; name: string; avatar?: { url?: string } };
  status?: string;
  entryFee?: number;
  reward?: number;
  publishedAt?: string;
  updatedAt?: string;
  stats?: {
    attemptsCount?: number;
    completionsCount?: number;
    passesCount?: number;
    avgScore?: number;
    ratingCount?: number;
    ratingBayes?: number;
    ratingRawAvg?: number;
    adminQualityRating?: number;
    totalRewardsPaid?: number;
  };
  moderation?: {
    lastDecision?: string | null;
    lastNotes?: string;
    changesRequestedNote?: string;
    adminQualityRating?: number | null;
    lastReviewedAt?: string;
  };
  versionNumber?: number;
}

export interface QuizAdminDto extends QuizSummary {
  questions?: QuestionDto[];
  timeLimitMinutes?: number;
  passingScore?: number;
  rewardMode?: string;
  topPercent?: number;
  maxRewardRecipients?: number;
  attemptsAllowed?: number;
  revisionHistory?: { versionNumber: number; note: string; changedAt: string }[];
}

export interface QuestionDto {
  id: string;
  type: string;
  text: string;
  hint?: string;
  explanation?: string;
  points: number;
  options?: { id: string; text: string; isCorrect?: boolean }[];
  correctBoolean?: boolean | null;
  correctAnswers?: string[];
  evaluationRules?: {
    mode: 'KEYWORDS' | 'MANUAL';
    keywords: { text: string; weight: number }[];
    minMatches?: number;
    passRatio?: number;
    caseSensitive?: boolean;
    flagForReviewOnFail?: boolean;
  };
}

export interface QuizInput {
  title: string;
  description?: string;
  category?: string | null;
  subcategory?: string | null;
  tags?: string[];
  difficulty?: string;
  language?: string;
  cover?: { url?: string; publicId?: string };
  timeLimitMinutes?: number;
  passingScore?: number;
  entryFee?: number;
  reward?: number;
  rewardMode?: string;
  topPercent?: number;
  maxRewardRecipients?: number;
  attemptsAllowed?: number;
  questions: QuestionDto[];
}

export interface QuizVersionDto {
  _id: string;
  versionNumber: number;
  changeNote?: string;
  createdAt: string;
  snapshot?: { title?: string };
}

export interface QuizPlayDto {
  quiz: QuizSummary;
  versionNumber: number;
  questions: QuestionDto[];
  questionCount: number;
  totalPoints: number;
  myAttempts: {
    _id: string;
    score: number;
    percentage: number;
    passed: boolean;
    submittedAt?: string;
    status: string;
    versionNumber: number;
  }[];
  solution?: QuestionDto[];
}

export interface AttemptStartDto {
  id: string;
  quiz: string;
  status: string;
  startedAt: string;
  questions: QuestionDto[];
  entryFeeCharged: number;
}

export interface AttemptAnswer {
  questionId: string;
  value: unknown;
}

export interface RewardInfoDto {
  eligible?: boolean;
  reason?: string;
  paid?: number;
  alreadyApplied?: boolean;
}

export interface AttemptResultDto {
  id: string;
  quiz: { id: string; title: string; slug: string; passingScore: number } | null;
  versionNumber: number;
  status: string;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  needsReview: boolean;
  timeSpentSec: number;
  submittedAt?: string;
  entryFeeCharged: number;
  rewardPaid: number;
  rewardInfo?: RewardInfoDto | null;
  questions: (QuestionDto & {
    yourAnswer?: unknown;
    awardedPoints?: number;
    correct?: boolean;
    needsReview?: boolean;
  })[];
}

export interface PollSummary {
  _id: string;
  title: string;
  slug: string;
  question?: string;
  description?: string;
  votingType?: 'SINGLE' | 'MULTIPLE';
  options?: { id: string; text: string }[];
  tags?: string[];
  cover?: { url?: string };
  category?: { _id: string; name: string; slug: string } | null;
  creator?: { _id: string; name: string; avatar?: { url?: string } };
  status?: string;
  startsAt?: string;
  endsAt: string;
  anonymous?: boolean;
  resultsVisibility?: string;
  entryFee?: number;
  reward?: number;
  rewardMode?: string;
  maxRewardRecipients?: number;
  publishedAt?: string;
  updatedAt?: string;
  stats?: {
    votesCount?: number;
    uniqueVoters?: number;
    ratingCount?: number;
    ratingBayes?: number;
    ratingRawAvg?: number;
    totalRewardsPaid?: number;
  };
  moderation?: {
    lastDecision?: string | null;
    lastNotes?: string;
    changesRequestedNote?: string;
    adminQualityRating?: number | null;
    lastReviewedAt?: string;
  };
}

export interface PollAdminDto extends PollSummary {
  revisionHistory?: { note: string; changedAt: string }[];
}

export interface PollInput {
  title: string;
  question: string;
  description?: string;
  category?: string | null;
  subcategory?: string | null;
  tags?: string[];
  language?: string;
  cover?: { url?: string; publicId?: string };
  votingType?: string;
  options: { id: string; text: string }[];
  startsAt?: string;
  endsAt: string;
  anonymous?: boolean;
  resultsVisibility?: string;
  entryFee?: number;
  reward?: number;
  rewardMode?: string;
  maxRewardRecipients?: number;
}

export interface PollDetailDto {
  poll: PollSummary;
  isClosed: boolean;
  hasVoted: boolean;
  myVote: { optionIds: string[]; votedAt: string } | null;
  voterCount: number;
  results: {
    tally: Record<string, number>;
    totalSelections: number;
    options: { id: string; text: string }[];
  } | null;
  voters: { user: { _id: string; name: string }; optionIds: string[]; votedAt: string }[];
}

export interface RatingDto {
  _id: string;
  user?: { _id: string; name: string; avatar?: { url?: string } };
  targetType: 'QUIZ' | 'POLL';
  targetId: string;
  score: number;
  review?: string;
  creatorReply?: { text?: string; repliedAt?: string };
  createdAt: string;
  target?: { title: string; slug: string } | null;
}

export interface RatingSummaryDto {
  count: number;
  rawAvg: number;
  bayesian: number;
  distribution: Record<string, number>;
}

export interface ReputationDto {
  community: { count: number; rawAvg: number; score: number; distribution: Record<string, number> };
  adminQuality: { count: number; score: number | null };
  publishedCount: number;
  overallScore: number;
}

export interface ReportDto {
  _id: string;
  reporter?: { _id: string; name: string; email?: string };
  targetType: string;
  targetId: string;
  reason: string;
  details?: string;
  status: string;
  resolution?: string;
  handledBy?: { name: string } | null;
  handledAt?: string;
  createdAt: string;
}

export interface NotificationDto {
  _id: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  readAt?: string | null;
  createdAt: string;
}

export interface LedgerDto {
  _id: string;
  txId: string;
  user?: { _id: string; name: string; email?: string };
  type: string;
  direction: 'CREDIT' | 'DEBIT';
  amount: number;
  balanceAfter: number;
  activityType?: string;
  activityId?: string | null;
  reason?: string;
  performedBy?: { name: string; email?: string } | null;
  createdAt: string;
}

export interface WalletPolicyDto {
  withdrawable: boolean;
  transferableBetweenUsers: boolean;
  description: string;
  rules: Record<string, string>;
}

export interface LeaderboardRow {
  rank: number;
  userId: string;
  name: string;
  avatarUrl?: string | null;
  avgScore?: number;
  passedCount?: number;
  completedCount?: number;
  scoreStdev?: number;
  consistencyScore?: number;
  publishedCount?: number;
  ratingCount?: number;
  ratingScore?: number;
}

export interface AchievementDto {
  key: string;
  title: string;
  description: string;
  earned: boolean;
  awardedAt?: string | null;
}

export interface UserStatsDto {
  recentAttempts: unknown[];
  counts: {
    quizzesCreated: number;
    pollsCreated: number;
    attempts: number;
    passedAttempts: number;
    notificationsUnread: number;
  };
  wallet: WalletDto;
  recentTransactions: LedgerDto[];
}

export interface PublicProfileDto {
  profile: {
    id: string;
    name: string;
    bio?: string;
    avatar?: { url?: string };
    joinedAt: string;
    role: string;
  };
  stats: { publishedQuizzes: number; publishedPolls: number };
  reputation: ReputationDto;
  publishedQuizzes: QuizSummary[];
}

export interface UploadParamsDto {
  timestamp: number;
  folder: string;
  maxBytes: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  purpose: string;
  allowedFormats: string[];
}

export interface AdminOverviewDto {
  users: { registered: number; activeLast7Days: number };
  content: { approvedQuizzes: number; approvedPolls: number; pendingQuizzes: number; pendingPolls: number };
  moderation: { openReports: number; pendingRefunds: number };
  qcoins: { totalIssued: number; totalSpent: number; transactionCount: number };
  activity24h: { attempts: number; votes: number };
  recentModerationActions: {
    id: string;
    action: string;
    targetType: string;
    targetId: string;
    reviewer: string;
    createdAt: string;
    qualityRating?: number | null;
  }[];
}

export interface AdminAnalyticsDto {
  timeseries: {
    users: { _id: string; count: number }[];
    attempts: { _id: string; count: number; avgScore?: number }[];
    votes: { _id: string; count: number }[];
    transactions: { _id: string; credits: number; debits: number }[];
  };
  quizStatuses: { _id: string; count: number }[];
  pollStatuses: { _id: string; count: number }[];
}

export interface AdminDiagnosticsDto {
  database: { readyState: number; name?: string; host?: string };
  node: { version: string; uptimeSec: number; memoryMb: number };
  collections: Record<string, number | null>;
}

export interface ModerationInput {
  action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'UNPUBLISH' | 'RESTORE' | 'QUALITY_RATE';
  notes?: string;
  qualityRating?: number | null;
}

export interface AdminReviewDto {
  _id: string;
  reviewer?: { name: string; email?: string };
  targetType: string;
  targetId: string;
  versionNumber?: number;
  action: string;
  notes?: string;
  qualityRating?: number | null;
  createdAt: string;
}

export interface QualityRatingDto {
  _id: string;
  targetType: string;
  title: string;
  slug: string;
  creator?: { name: string };
  moderation?: { adminQualityRating?: number; lastReviewedAt?: string };
}

export interface AdminUserDto {
  _id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  avatar?: { url?: string };
  wallet?: WalletDto;
  createdAt: string;
  lastActiveAt?: string;
  suspendedAt?: string;
  suspendedReason?: string;
}

export interface AdminUserDetailDto {
  user: AdminUserDto & { bio?: string };
  activity: { quizzes: number; polls: number; attempts: number; votes: number };
  reports: ReportDto[];
  recentTransactions: LedgerDto[];
  reconciliation: ReconcileDto;
}

export interface ReconcileDto {
  wallet: WalletDto;
  ledger: { balance: number; totalEarned: number; totalSpent: number; transactionCount: number };
  discrepancy: { balance: number; totalEarned: number; totalSpent: number };
  consistent: boolean;
}

export interface SuspiciousDto {
  rewardFarming: {
    user: { name: string; email: string } | null;
    rewardCount: number;
    totalRewarded: number;
    window: string;
  }[];
  largeAdjustments: {
    txId: string;
    user: { name: string; email: string } | null;
    amount: number;
    reason?: string;
    performedBy: { name: string; email: string } | null;
    createdAt: string;
  }[];
}

export interface RefundRequestDto {
  kind: string;
  id: string;
  user?: { name: string; email?: string };
  activity?: { title: string; slug: string } | null;
  amount: number;
  reason: string;
  createdAt: string;
}

export interface SettingDto {
  key: string;
  value: unknown;
  description?: string;
  updatedAt?: string;
}

export interface TemplateDto {
  key: string;
  title: string;
  body?: string;
  link?: string;
}

export interface AuditLogDto {
  _id: string;
  actor?: { name: string; email?: string };
  action: string;
  targetType?: string;
  targetId?: string | null;
  details?: Record<string, unknown>;
  ip?: string;
  createdAt: string;
}

export { apiErrorMessage };
export default endpoints;
