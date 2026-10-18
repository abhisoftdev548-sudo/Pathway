export interface User { id: string; displayName: string; email?: string; role: 'user' | 'admin'; avatar?: string; bio?: string; isSuspended?: boolean; createdAt?: string }
export interface Category { id: string; name: string; slug: string; description?: string; parentCategoryId?: string | null; isActive: boolean; quizCount?: number }
export type QuestionType = 'single_choice' | 'multiple_choice' | 'True_false' | 'fill_blank' | 'short_answer';
export interface QOption { id: string; text: string }
export interface Question {
  id: string; type: QuestionType; text: string; options: QOption[]; correctOptionIds: string[];
  acceptedAnswers: string[]; caseInsensitive: boolean; explanation: string; hint?: string;
  imageUrl?: string; codeSnippet?: { code: string; language?: string } | null;
  difficulty: string; marks: number; topicTag?: string; order: number; allowPartialCredit?: boolean;
}
export interface QuizCard {
  id: string; slug: string; title: string; description: string; coverImage?: string;
  category: { id: string; name: string; slug: string } | null; subcategory: { id: string; name: string; slug: string } | null;
  tags: string[]; difficulty: string; language: string; estimatedDuration: number; timeLimit: number | null;
  questionCount: number; totalPoints: number; questionTypes: Record<string, number>;
  hasPartialCredit: boolean; hasShortAnswer: boolean; explanationMode: string;
  attemptsCount: number; ratingAvg: number; ratingCount: number; bookmarkCount: number;
  creator: User | null; publishedAt?: string; createdAt: string; isBookmarked?: boolean; myRating?: number | null; canRate?: boolean;
}
export interface AttemptQuestion extends Omit<Question, 'correctOptionIds' | 'acceptedAnswers' | 'explanation'> {}
export interface AttemptView {
  id: string; quizId: string; quizSlug: string; title: string; status: string;
  startedAt: string; deadline: string | null; timeLimitMinutes: number | null;
  explanationMode: string; questions: any[]; responses: AttemptResponse[];
}
export interface AttemptResponse { questionId: string; selectedOptionIds: string[]; textAnswer?: string; markedForReview?: boolean }
