export const ROLES = ['user', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const TASK_TYPES = ['learn', 'practice', 'code', 'quiz', 'project', 'revision', 'assessment'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const ENROLLMENT_STATUSES = ['active', 'paused', 'completed', 'archived'] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export const LEARNING_PACES = ['relaxed', 'standard', 'intensive', 'custom'] as const;
export type LearningPace = (typeof LEARNING_PACES)[number];

export const PACE_MINUTES: Record<Exclude<LearningPace, 'custom'>, number> = {
  relaxed: 20,
  standard: 45,
  intensive: 90,
};

export const PROGRESS_STATUSES = ['not_started', 'in_progress', 'completed'] as const;
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];

export const ACTIVITY_TYPES = [
  'task_completed',
  'task_reopened',
  'task_started',
  'note_updated',
  'time_logged',
  'task_submitted',
  'achievement_unlocked',
  'enrollment_created',
  'enrollment_paused',
  'enrollment_resumed',
  'enrollment_archived',
  'roadmap_completed',
  'password_changed',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const RESOURCE_TYPES = ['documentation', 'article', 'video', 'course', 'tool', 'suggestion'] as const;

export const NOTIFICATION_TYPES = ['achievement', 'milestone', 'enrollment', 'reminder', 'system'] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
