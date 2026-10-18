/**
 * Shared domain vocabulary — keep in sync with server/src/constants/index.js.
 */

export const ROLES = { USER: 'USER', ADMIN: 'ADMIN' } as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const CONTENT_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  UNPUBLISHED: 'UNPUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type ContentStatus = (typeof CONTENT_STATUS)[keyof typeof CONTENT_STATUS];

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Pending review',
  CHANGES_REQUESTED: 'Changes requested',
  APPROVED: 'Published',
  REJECTED: 'Rejected',
  UNPUBLISHED: 'Unpublished',
  ARCHIVED: 'Archived',
};

export const QUESTION_TYPES = {
  SINGLE_CHOICE: 'SINGLE_CHOICE',
  MULTIPLE_CHOICE: 'MULTIPLE_CHOICE',
  TRUE_FALSE: 'TRUE_FALSE',
  FILL_BLANK: 'FILL_BLANK',
  SHORT_ANSWER: 'SHORT_ANSWER',
} as const;
export type QuestionType = (typeof QUESTION_TYPES)[keyof typeof QUESTION_TYPES];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE_CHOICE: 'Single choice',
  MULTIPLE_CHOICE: 'Multiple choice',
  TRUE_FALSE: 'True / False',
  FILL_BLANK: 'Fill in the blank',
  SHORT_ANSWER: 'Short answer',
};

export const DIFFICULTY = { EASY: 'EASY', MEDIUM: 'MEDIUM', HARD: 'HARD' } as const;
export const DIFFICULTY_LABELS: Record<string, string> = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' };

export const VOTING_TYPE = { SINGLE: 'SINGLE', MULTIPLE: 'MULTIPLE' } as const;
export const RESULTS_VISIBILITY = {
  AFTER_VOTE: 'AFTER_VOTE',
  AFTER_END: 'AFTER_END',
  PUBLIC: 'PUBLIC',
} as const;

export const TX_TYPE = {
  SIGNUP_BONUS: 'SIGNUP_BONUS',
  ENTRY_FEE: 'ENTRY_FEE',
  REWARD: 'REWARD',
  REFUND: 'REFUND',
  FEE_REVERSAL: 'FEE_REVERSAL',
  ADJUSTMENT: 'ADJUSTMENT',
  ACHIEVEMENT_REWARD: 'ACHIEVEMENT_REWARD',
} as const;

export const TX_TYPE_LABELS: Record<string, string> = {
  SIGNUP_BONUS: 'Signup bonus',
  ENTRY_FEE: 'Entry fee',
  REWARD: 'Reward',
  REFUND: 'Refund',
  FEE_REVERSAL: 'Fee reversal',
  ADJUSTMENT: 'Adjustment',
  ACHIEVEMENT_REWARD: 'Achievement reward',
};

export const REPORT_REASONS = [
  'SPAM',
  'INAPPROPRIATE_CONTENT',
  'MISINFORMATION',
  'COPYRIGHT',
  'CHEATING_OR_FRAUD',
  'HARASSMENT',
  'OTHER',
] as const;

export const REPORT_REASON_LABELS: Record<string, string> = {
  SPAM: 'Spam',
  INAPPROPRIATE_CONTENT: 'Inappropriate content',
  MISINFORMATION: 'Misinformation',
  COPYRIGHT: 'Copyright concern',
  CHEATING_OR_FRAUD: 'Cheating or fraud',
  HARASSMENT: 'Harassment',
  OTHER: 'Other',
};
