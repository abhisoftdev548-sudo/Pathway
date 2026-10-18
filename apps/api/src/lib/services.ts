import type { Store } from '../db/store.js';
import type { Quiz, QuizVersion } from '../types.js';
import { id, now, slugify } from './utils.js';
import { quizCard } from './serializers.js';

export async function uniqueSlug(store: Store, title: string, ignoreQuizId?: string): Promise<string> {
  const base = slugify(title); let slug = base; let n = 2;
  while (await store.quizzes.findOne(q => q.slug === slug && q.id !== ignoreQuizId)) { slug = `${base}-${n++}`; }
  return slug;
}
export async function findQuiz(store: Store, slugOrId: string): Promise<Quiz | null> {
  return (await store.quizzes.byId(slugOrId)) || (await store.quizzes.findOne(q => q.slug === slugOrId));
}
export async function publishedVersion(store: Store, quiz: Quiz): Promise<QuizVersion | null> {
  if (!quiz.isLive || !quiz.currentPublishedVersionId) return null;
  return store.versions.byId(quiz.currentPublishedVersionId);
}
export async function toCard(store: Store, quiz: Quiz, version: QuizVersion) {
  const [creator, category, subcategory, bookmarkCount] = await Promise.all([
    store.users.byId(quiz.creatorId),
    version.metadata.categoryId ? store.categories.byId(version.metadata.categoryId) : Promise.resolve(null),
    version.metadata.subcategoryId ? store.categories.byId(version.metadata.subcategoryId) : Promise.resolve(null),
    store.bookmarks.count(b => b.quizId === quiz.id),
  ]);
  return quizCard(quiz, version, creator, category, subcategory, bookmarkCount);
}
export async function notify(store: Store, userId: string, type: string, message: string, quizId?: string | null) {
  await store.notifications.insert({ id: id(), userId, type, message, quizId: quizId ?? null, read: false, createdAt: now() });
}
export async function modLog(store: Store, quizId: string, quizVersionId: string | null | undefined, adminId: string, action: any, prev: string, next: string, feedback?: string) {
  await store.moderationLogs.insert({ id: id(), quizId, quizVersionId: quizVersionId ?? null, adminId, action, previousStatus: prev, newStatus: next, feedback: feedback || '', createdAt: now() });
}
