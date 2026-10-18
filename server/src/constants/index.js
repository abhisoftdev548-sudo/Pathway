/**
 * Shared domain constants for the QuizSphere API.
 * Keep this vocabulary in sync with the client's `src/utils/constants.ts`.
 */

export const ROLES = Object.freeze({
  USER: 'USER',
  ADMIN: 'ADMIN',
});

export const ACCOUNT_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
});

export const CONTENT_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  UNPUBLISHED: 'UNPUBLISHED',
  ARCHIVED: 'ARCHIVED',
});

/** Statuses that may accept participants / votes. */
export const PUBLIC_STATUSES = Object.freeze([CONTENT_STATUS.APPROVED]);

/** Statuses visible to their creator in workspace lists. */
export const OWNED_STATUSES = Object.freeze(Object.values(CONTENT_STATUS));

export const QUESTION_TYPES = Object.freeze({
  SINGLE_CHOICE: 'SINGLE_CHOICE',
  MULTIPLE_CHOICE: 'MULTIPLE_CHOICE',
  TRUE_FALSE: 'TRUE_FALSE',
  FILL_BLANK: 'FILL_BLANK',
  SHORT_ANSWER: 'SHORT_ANSWER',
});

export const SHORT_ANSWER_MODES = Object.freeze({
  KEYWORDS: 'KEYWORDS',
  MANUAL: 'MANUAL',
});

export const DIFFICULTY = Object.freeze({
  EASY: 'EASY',
  MEDIUM: 'MEDIUM',
  HARD: 'HARD',
});

export const VOTING_TYPE = Object.freeze({
  SINGLE: 'SINGLE',
  MULTIPLE: 'MULTIPLE',
});

export const RESULTS_VISIBILITY = Object.freeze({
  AFTER_VOTE: 'AFTER_VOTE',
  AFTER_END: 'AFTER_END',
  PUBLIC: 'PUBLIC',
});

export const POLL_REWARD_MODES = Object.freeze({
  ALL_PARTICIPANTS: 'ALL_PARTICIPANTS',
  FIRST_N: 'FIRST_N',
  RANDOM_DRAW: 'RANDOM_DRAW',
});

export const QUIZ_REWARD_MODES = Object.freeze({
  ALL_PASSERS: 'ALL_PASSERS',
  TOP_PERCENT: 'TOP_PERCENT',
});

export const ATTEMPT_STATUS = Object.freeze({
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  REVIEW_PENDING: 'REVIEW_PENDING',
  COMPLETED: 'COMPLETED',
  ABANDONED: 'ABANDONED',
});

export const TX_TYPE = Object.freeze({
  SIGNUP_BONUS: 'SIGNUP_BONUS',
  ENTRY_FEE: 'ENTRY_FEE',
  REWARD: 'REWARD',
  REFUND: 'REFUND',
  FEE_REVERSAL: 'FEE_REVERSAL',
  ADJUSTMENT: 'ADJUSTMENT',
  ACHIEVEMENT_REWARD: 'ACHIEVEMENT_REWARD',
});

export const TX_DIRECTION = Object.freeze({
  CREDIT: 'CREDIT',
  DEBIT: 'DEBIT',
});

export const ACTIVITY_TYPES = Object.freeze({
  QUIZ_ATTEMPT: 'QUIZ_ATTEMPT',
  POLL_VOTE: 'POLL_VOTE',
  ADMIN: 'ADMIN',
  SYSTEM: 'SYSTEM',
  ACHIEVEMENT: 'ACHIEVEMENT',
});

export const RATING_TARGETS = Object.freeze({
  QUIZ: 'QUIZ',
  POLL: 'POLL',
});

export const REPORT_TARGETS = Object.freeze({
  QUIZ: 'QUIZ',
  POLL: 'POLL',
  USER: 'USER',
});

export const REPORT_STATUS = Object.freeze({
  OPEN: 'OPEN',
  UNDER_REVIEW: 'UNDER_REVIEW',
  RESOLVED: 'RESOLVED',
  DISMISSED: 'DISMISSED',
});

export const REPORT_REASONS = Object.freeze([
  'SPAM',
  'INAPPROPRIATE_CONTENT',
  'MISINFORMATION',
  'COPYRIGHT',
  'CHEATING_OR_FRAUD',
  'HARASSMENT',
  'OTHER',
]);

export const NOTIFICATION_TYPES = Object.freeze({
  SYSTEM: 'SYSTEM',
  CONTENT_APPROVED: 'CONTENT_APPROVED',
  CONTENT_REJECTED: 'CONTENT_REJECTED',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  CONTENT_UNPUBLISHED: 'CONTENT_UNPUBLISHED',
  ATTEMPT_RESULT: 'ATTEMPT_RESULT',
  POLL_ENDED: 'POLL_ENDED',
  REWARD_CREDITED: 'REWARD_CREDITED',
  REFUND_PROCESSED: 'REFUND_PROCESSED',
  RATING_RECEIVED: 'RATING_RECEIVED',
  REPORT_UPDATE: 'REPORT_UPDATE',
  ACHIEVEMENT: 'ACHIEVEMENT',
  ACCOUNT: 'ACCOUNT',
});

export const ADMIN_ACTIONS = Object.freeze({
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  REQUEST_CHANGES: 'REQUEST_CHANGES',
  UNPUBLISH: 'UNPUBLISH',
  QUALITY_RATE: 'QUALITY_RATE',
  RESTORE: 'RESTORE',
});

export const ACHIEVEMENTS = Object.freeze({
  FIRST_QUIZ: { key: 'FIRST_QUIZ', title: 'Quiz Author', description: 'Created your first quiz.' },
  FIRST_POLL: { key: 'FIRST_POLL', title: 'Poll Creator', description: 'Created your first poll.' },
  FIRST_ATTEMPT: { key: 'FIRST_ATTEMPT', title: 'Curious Mind', description: 'Completed your first quiz attempt.' },
  FIRST_PASS: { key: 'FIRST_PASS', title: 'Passed!', description: 'Passed your first quiz.' },
  TEN_ATTEMPTS: { key: 'TEN_ATTEMPTS', title: 'Regular', description: 'Completed 10 quiz attempts.' },
  FIRST_VOTE: { key: 'FIRST_VOTE', title: 'Voter', description: 'Voted in your first poll.' },
  FIRST_RATING: { key: 'FIRST_RATING', title: 'Critic', description: 'Rated your first quiz or poll.' },
  PUBLISHED_CREATOR: { key: 'PUBLISHED_CREATOR', title: 'Published Creator', description: 'Got your first quiz or poll approved.' },
});

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Bayesian prior used when aggregating community ratings. */
export const RATING_PRIOR = Object.freeze({ mean: 3.5, weight: 5 });

/** Economy guardrails (also configurable via PlatformSetting). */
export const ECONOMY_LIMITS = Object.freeze({
  MAX_ENTRY_FEE: 1000,
  MAX_REWARD_PER_PARTICIPANT: 5000,
  MAX_REWARD_POOL_PER_ACTIVITY: 100000,
  SIGNUP_BONUS: 100,
});
