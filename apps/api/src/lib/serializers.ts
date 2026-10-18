import type { Category, Question, Quiz, QuizVersion, User } from '../types.js';

export const publicUser = (u: User | null | undefined) => u ? {
  id: u.id, displayName: u.displayName, avatar: u.avatar || '', bio: u.bio || '', role: u.role, createdAt: u.createdAt,
} : null;
export const selfUser = (u: User) => ({ ...publicUser(u), email: u.email, isSuspended: u.isSuspended });

/** Strip answer keys + explanations: anything served before/during an attempt
 *  (and on public detail) MUST go through this. */
export function sanitizeQuestion(q: Question, optionOrder?: string[]) {
  const options = optionOrder
    ? optionOrder.map(oid => q.options.find(o => o.id === oid)).filter(Boolean)
    : q.options;
  return {
    id: q.id, type: q.type, text: q.text, options, difficulty: q.difficulty,
    marks: q.marks, topicTag: q.topicTag || '', hint: q.hint || '',
    imageUrl: q.imageUrl || '', codeSnippet: q.codeSnippet || null,
    allowPartialCredit: !!q.allowPartialCredit, caseInsensitive: q.caseInsensitive,
  };
}

export function questionTypeSummary(version: QuizVersion) {
  const counts: Record<string, number> = {};
  for (const q of version.questions) counts[q.type] = (counts[q.type] || 0) + 1;
  return counts;
}

export function quizCard(quiz: Quiz, version: QuizVersion, creator: User | null, category: Category | null, subcategory: Category | null, bookmarkCount = 0) {
  const m = version.metadata;
  return {
    id: quiz.id, slug: quiz.slug, title: m.title, description: m.description,
    coverImage: m.coverImage || '', category: category ? { id: category.id, name: category.name, slug: category.slug } : null,
    subcategory: subcategory ? { id: subcategory.id, name: subcategory.name, slug: subcategory.slug } : null,
    tags: m.tags, difficulty: m.difficulty, language: m.language,
    estimatedDuration: m.estimatedDuration, timeLimit: m.timeLimit ?? null,
    questionCount: version.questions.length, totalPoints: version.totalPoints,
    questionTypes: questionTypeSummary(version),
    hasPartialCredit: version.questions.some(q => q.type === 'multiple_choice' && q.allowPartialCredit),
    hasShortAnswer: version.questions.some(q => q.type === 'short_answer'),
    explanationMode: m.settings?.explanationMode || 'after_submission',
    attemptsCount: quiz.attemptsCount, ratingAvg: quiz.ratingAvg, ratingCount: quiz.ratingCount,
    bookmarkCount, creator: publicUser(creator), publishedAt: quiz.publishedAt,
    createdAt: quiz.createdAt, updatedAt: quiz.updatedAt, status: quiz.status,
  };
}
export type QuizCard = ReturnType<typeof quizCard>;

/** Popularity (documented): attempts dominate, rating and bookmarks boost. */
export function popularity(card: QuizCard) {
  return card.attemptsCount * 2 + (card.ratingAvg || 0) * 10 + (card.bookmarkCount || 0) * 3;
}
