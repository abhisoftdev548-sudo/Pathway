export type Role = 'user' | 'admin';
export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type QuestionType = 'single_choice' | 'multiple_choice' | 'True_false' | 'fill_blank' | 'short_answer';
export type QuizStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED' | 'UNPUBLISHED' | 'ARCHIVED';
export type ExplanationMode = 'after_submission' | 'immediate' | 'after_manual_review';

export interface User {
  id: string; displayName: string; email: string; passwordHash: string; role: Role;
  avatar?: string; bio?: string; isSuspended: boolean;
  resetTokenHash?: string; resetTokenExpiresAt?: string;
  preferences?: Record<string, unknown>; createdAt: string; updatedAt: string;
}
export interface Category {
  id: string; name: string; slug: string; description?: string;
  parentCategoryId?: string | null; isActive: boolean; createdAt: string; updatedAt: string;
}
export interface QuestionOption { id: string; text: string }
export interface Question {
  id: string; type: QuestionType; text: string;
  options: QuestionOption[]; correctOptionIds: string[];
  acceptedAnswers: string[]; caseInsensitive: boolean;
  explanation: string; hint?: string; imageUrl?: string;
  codeSnippet?: { code: string; language?: string } | null;
  difficulty: Difficulty; marks: number; topicTag?: string;
  order: number; allowPartialCredit?: boolean;
}
export interface QuizSettings {
  explanationMode: ExplanationMode; shuffleQuestions: boolean; shuffleOptions: boolean;
  showScoreImmediately: boolean;
}
export interface VersionMeta {
  title: string; description: string; coverImage?: string;
  categoryId: string; subcategoryId?: string | null; tags: string[];
  difficulty: Difficulty; language: string; estimatedDuration: number;
  timeLimit?: number | null; settings: QuizSettings;
}
export interface QuizVersion {
  id: string; quizId: string; versionNumber: number;
  state: 'draft' | 'pending' | 'published' | 'superseded' | 'returned';
  metadata: VersionMeta; questions: Question[]; totalPoints: number;
  createdBy: string; createdAt: string; updatedAt: string;
}
export interface Quiz {
  id: string; slug: string; creatorId: string; status: QuizStatus;
  draftVersionId?: string | null; pendingVersionId?: string | null;
  currentPublishedVersionId?: string | null; isLive: boolean;
  nextVersionNumber: number; attemptsCount: number;
  ratingAvg: number; ratingCount: number;
  latestFeedback?: string; publishedAt?: string | null;
  createdAt: string; updatedAt: string;
}
export interface AttemptResponse {
  questionId: string; selectedOptionIds: string[]; textAnswer?: string; markedForReview?: boolean;
}
export interface QuestionResult {
  questionId: string; awarded: number; maxMarks: number;
  isCorrect: boolean | null; status: 'correct' | 'incorrect' | 'unanswered' | 'pending_review' | 'partial';
}
export interface QuizAttempt {
  id: string; userId: string; quizId: string; quizVersionId: string;
  responses: AttemptResponse[]; displayedQuestionOrder: string[];
  displayedOptionOrders: Record<string, string[]>;
  status: 'in_progress' | 'submitted';
  score: number; maximumScore: number; pendingMarks: number; percentage: number | null;
  correctCount: number; incorrectCount: number; unansweredCount: number;
  results: QuestionResult[]; evaluationStatus: 'in_progress' | 'auto_graded' | 'pending_manual';
  startedAt: string; submittedAt?: string | null; timeTaken?: number | null;
  createdAt: string; updatedAt: string;
}
export interface Bookmark { id: string; userId: string; quizId: string; createdAt: string }
export interface ModerationLog {
  id: string; quizId: string; quizVersionId?: string | null; adminId: string;
  action: 'approve' | 'reject' | 'request_changes' | 'unpublish' | 'restore' | 'submit' | 'resubmit';
  previousStatus: string; newStatus: string; feedback?: string; createdAt: string;
}
export interface QuizReport {
  id: string; quizId: string; reporterId: string; reason: string; details?: string;
  status: 'open' | 'reviewed' | 'dismissed'; reviewedBy?: string | null; createdAt: string; updatedAt: string;
}
export interface Notification {
  id: string; userId: string; type: string; message: string; quizId?: string | null;
  read: boolean; createdAt: string;
}
export interface QuizRating { id: string; userId: string; quizId: string; rating: number; createdAt: string; updatedAt: string }
