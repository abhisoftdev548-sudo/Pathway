import { Router } from 'express';
import { z } from 'zod';
import { notSuspended, optionalAuth, requireAuth } from '../middleware/auth.js';
import { badRequest, conflict, forbidden, id, notFound, now, paginate, parse } from '../lib/utils.js';
import { quizPayloadSchema, totalPoints, validateForSubmission } from '../lib/validation.js';
import { findQuiz, modLog, publishedVersion, toCard, uniqueSlug } from '../lib/services.js';
import { popularity, publicUser, questionTypeSummary } from '../lib/serializers.js';
import type { Quiz, QuizVersion, VersionMeta } from '../types.js';

const router = Router();

/* ---------- Public discovery ---------- */

const listQuery = z.object({
  q: z.string().optional().default(''), categoryId: z.string().optional(), subcategoryId: z.string().optional(),
  tags: z.string().optional(), difficulty: z.string().optional(), language: z.string().optional(),
  questionType: z.string().optional(), creatorId: z.string().optional(),
  maxDuration: z.coerce.number().optional(), minQuestions: z.coerce.number().optional(), maxQuestions: z.coerce.number().optional(),
  sort: z.enum(['newest', 'most_attempted', 'rating', 'popular']).optional().default('newest'),
  page: z.coerce.number().optional().default(1), limit: z.coerce.number().optional().default(12),
});

async function liveCards(req: any) {
  const store = req.store!;
  const quizzes = await store.quizzes.find((q: Quiz) => q.isLive && !!q.currentPublishedVersionId);
  const cards = [];
  for (const quiz of quizzes) {
    const v = await publishedVersion(store, quiz);
    if (v) cards.push(await toCard(store, quiz, v));
  }
  return cards;
}

router.get('/quizzes/filters', async (req, res, next) => {
  try {
    const store = req.store!;
    const cards = await liveCards(req);
    const cats = await store.categories.find(c => c.isActive);
    // Only surface filter values that actually have published quizzes.
    const catCounts = new Map<string, number>();
    cards.forEach(c => { if (c.category) catCounts.set(c.category.id, (catCounts.get(c.category.id) || 0) + 1); if (c.subcategory) catCounts.set(c.subcategory.id, (catCounts.get(c.subcategory.id) || 0) + 1); });
    const withCounts = cats.map(c => ({ ...c, quizCount: catCounts.get(c.id) || 0 })).filter(c => c.quizCount > 0);
    const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort();
    res.json({
      categories: withCounts.filter(c => !c.parentCategoryId),
      subcategories: withCounts.filter(c => !!c.parentCategoryId),
      languages: uniq(cards.map(c => c.language)),
      difficulties: uniq(cards.map(c => c.difficulty)),
      tags: uniq(cards.flatMap(c => c.tags)),
      questionTypes: uniq(cards.flatMap(c => Object.keys(c.questionTypes))),
    });
  } catch (e) { next(e); }
});

router.get('/quizzes', async (req, res, next) => {
  try {
    const f = parse(listQuery, req.query);
    let cards = await liveCards(req);
    const tags = f.tags ? f.tags.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
    cards = cards.filter(c => {
      if (f.q) { const hay = `${c.title} ${c.description} ${c.tags.join(' ')}`.toLowerCase(); if (!hay.includes(f.q.toLowerCase())) return false; }
      if (f.categoryId && c.category?.id !== f.categoryId) return false;
      if (f.subcategoryId && c.subcategory?.id !== f.subcategoryId) return false;
      if (tags.length && !tags.every(t => c.tags.map(x => x.toLowerCase()).includes(t))) return false;
      if (f.difficulty && c.difficulty !== f.difficulty) return false;
      if (f.language && c.language !== f.language) return false;
      if (f.questionType && !c.questionTypes[f.questionType]) return false;
      if (f.creatorId && c.creator?.id !== f.creatorId) return false;
      if (f.maxDuration != null && c.estimatedDuration > f.maxDuration) return false;
      if (f.minQuestions != null && c.questionCount < f.minQuestions) return false;
      if (f.maxQuestions != null && c.questionCount > f.maxQuestions) return false;
      return true;
    });
    const sorters: Record<string, (a: any, b: any) => number> = {
      newest: (a, b) => (b.publishedAt || b.createdAt).localeCompare(a.publishedAt || a.createdAt),
      most_attempted: (a, b) => b.attemptsCount - a.attemptsCount,
      rating: (a, b) => (b.ratingAvg - a.ratingAvg) || (b.ratingCount - a.ratingCount),
      popular: (a, b) => popularity(b) - popularity(a),
    };
    cards.sort(sorters[f.sort || 'newest']);
    const { items, pagination } = paginate(cards, f.page, f.limit);
    // attach bookmark state for the signed-in user
    let bookmarked = new Set<string>();
    if (req.user) bookmarked = new Set((await req.store!.bookmarks.find(b => b.userId === req.user!.id)).map(b => b.quizId));
    res.json({ items: items.map(c => ({ ...c, isBookmarked: bookmarked.has(c.id) })), pagination });
  } catch (e) { next(e); }
});

router.get('/categories', async (req, res, next) => {
  try {
    const cats = await req.store!.categories.find(c => c.isActive);
    cats.sort((a, b) => a.name.localeCompare(b.name));
    res.json({ categories: cats.filter(c => !c.parentCategoryId), subcategories: cats.filter(c => !!c.parentCategoryId) });
  } catch (e) { next(e); }
});

router.get('/stats', async (req, res, next) => {
  try {
    const store = req.store!;
    const cards = await liveCards(req);
    res.json({
      publishedQuizzes: cards.length,
      totalQuestions: cards.reduce((s, c) => s + c.questionCount, 0),
      totalAttempts: cards.reduce((s, c) => s + c.attemptsCount, 0),
      creators: new Set(cards.map(c => c.creator?.id)).size,
      categories: new Set(cards.map(c => c.category?.id).filter(Boolean)).size,
      featured: [...cards].sort((a, b) => popularity(b) - popularity(a)).slice(0, 6),
    });
  } catch (e) { next(e); }
});

router.get('/quizzes/:slug', optionalAuth, async (req, res, next) => {
  try {
    const store = req.store!;
    const quiz = await findQuiz(store, req.params.slug);
    if (!quiz) throw notFound('Quiz not found');
    const version = await publishedVersion(store, quiz);
    if (!version) throw notFound('Quiz not found or not published');
    const card = await toCard(store, quiz, version);
    const isBookmarked = req.user ? !!(await store.bookmarks.findOne(b => b.userId === req.user!.id && b.quizId === quiz.id)) : false;
    const myAttempts = req.user ? await store.attempts.find(a => a.userId === req.user!.id && a.quizId === quiz.id) : [];
    const inProgress = myAttempts.find(a => a.status === 'in_progress');
    const myRating = req.user ? (await store.ratings.findOne(r => r.userId === req.user!.id && r.quizId === quiz.id))?.rating ?? null : null;
    // NOTE: no questions, answer keys or explanations are exposed here.
    res.json({
      quiz: { ...card, isBookmarked, myRating, canRate: myAttempts.some(a => a.status === 'submitted') },
      inProgressAttemptId: inProgress?.id || null,
      mySubmittedAttempts: myAttempts.filter(a => a.status === 'submitted').length,
    });
  } catch (e) { next(e); }
});

/* ---------- Public creator profiles ---------- */

router.get('/users/:id', async (req, res, next) => {
  try {
    const store = req.store!;
    const user = await store.users.byId(req.params.id);
    if (!user) throw notFound('Creator not found');
    const cards = (await liveCards(req)).filter(c => c.creator?.id === user.id);
    res.json({
      creator: publicUser(user),
      stats: { publishedQuizzes: cards.length, totalAttempts: cards.reduce((s, c) => s + c.attemptsCount, 0) },
      quizzes: cards,
    });
  } catch (e) { next(e); }
});
router.get('/users/:id/quizzes', async (req, res, next) => {
  try { const cards = (await liveCards(req)).filter(c => c.creator?.id === req.params.id); res.json({ items: cards }); }
  catch (e) { next(e); }
});

/* ---------- Bookmarks, reports, ratings ---------- */

router.post('/quizzes/:id/bookmark', requireAuth, async (req, res, next) => {
  try {
    const store = req.store!; const quiz = await findQuiz(store, req.params.id);
    if (!quiz || !(await publishedVersion(store, quiz))) throw notFound('Quiz not found');
    const existing = await store.bookmarks.findOne(b => b.userId === req.user!.id && b.quizId === quiz.id);
    if (!existing) await store.bookmarks.insert({ id: id(), userId: req.user!.id, quizId: quiz.id, createdAt: now() });
    res.status(existing ? 200 : 201).json({ bookmarked: true });
  } catch (e) { next(e); }
});
router.delete('/quizzes/:id/bookmark', requireAuth, async (req, res, next) => {
  try {
    const store = req.store!; const quiz = await findQuiz(store, req.params.id);
    const existing = quiz && await store.bookmarks.findOne(b => b.userId === req.user!.id && b.quizId === quiz.id);
    if (existing) await store.bookmarks.remove(existing.id);
    res.json({ bookmarked: false });
  } catch (e) { next(e); }
});

router.post('/quizzes/:id/report', requireAuth, notSuspended, async (req, res, next) => {
  try {
    const store = req.store!;
    const body = parse(z.object({ reason: z.string().trim().min(3).max(200), details: z.string().max(2000).optional().default('') }), req.body);
    const quiz = await findQuiz(store, req.params.id);
    if (!quiz || !(await publishedVersion(store, quiz))) throw notFound('Quiz not found');
    if (quiz.creatorId === req.user!.id) throw badRequest('You cannot report your own quiz');
    const open = await store.reports.findOne(r => r.quizId === quiz.id && r.reporterId === req.user!.id && r.status === 'open');
    if (open) throw conflict('You already have an open report for this quiz');
    const t = now();
    const report = await store.reports.insert({ id: id(), quizId: quiz.id, reporterId: req.user!.id, reason: body.reason, details: body.details, status: 'open', reviewedBy: null, createdAt: t, updatedAt: t });
    res.status(201).json({ report });
  } catch (e) { next(e); }
});

router.post('/quizzes/:id/rating', requireAuth, async (req, res, next) => {
  try {
    const store = req.store!;
    const { rating } = parse(z.object({ rating: z.number().int().min(1).max(5) }), req.body);
    const quiz = await findQuiz(store, req.params.id);
    if (!quiz || !(await publishedVersion(store, quiz))) throw notFound('Quiz not found');
    const attempted = await store.attempts.findOne(a => a.userId === req.user!.id && a.quizId === quiz.id && a.status === 'submitted');
    if (!attempted) throw forbidden('Attempt this quiz before rating it');
    const t = now();
    const existing = await store.ratings.findOne(r => r.userId === req.user!.id && r.quizId === quiz.id);
    if (existing) await store.ratings.update(existing.id, { rating, updatedAt: t });
    else await store.ratings.insert({ id: id(), userId: req.user!.id, quizId: quiz.id, rating, createdAt: t, updatedAt: t });
    const all = await store.ratings.find(r => r.quizId === quiz.id);
    const avg = all.reduce((s, r) => s + r.rating, 0) / all.length;
    await store.quizzes.update(quiz.id, { ratingAvg: Math.round(avg * 10) / 10, ratingCount: all.length });
    res.json({ rating, ratingAvg: Math.round(avg * 10) / 10, ratingCount: all.length });
  } catch (e) { next(e); }
});

/* ---------- Quiz creation / builder (mine) ---------- */

function metaFrom(p: any): VersionMeta {
  return {
    title: p.title, description: p.description, coverImage: p.coverImage || '', categoryId: p.categoryId,
    subcategoryId: p.subcategoryId || null, tags: [...new Set(((p.tags || []) as string[]).map((t: string) => t.trim()).filter(Boolean))],
    difficulty: p.difficulty, language: p.language, estimatedDuration: p.estimatedDuration,
    timeLimit: p.timeLimit ?? null, settings: p.settings,
  };
}
async function myQuizView(store: any, quiz: Quiz) {
  const [draft, pending, published] = await Promise.all([
    quiz.draftVersionId ? store.versions.byId(quiz.draftVersionId) : Promise.resolve(null),
    quiz.pendingVersionId ? store.versions.byId(quiz.pendingVersionId) : Promise.resolve(null),
    quiz.currentPublishedVersionId ? store.versions.byId(quiz.currentPublishedVersionId) : Promise.resolve(null),
  ]);
  const working: QuizVersion | null = draft || pending || published;
  return {
    id: quiz.id, slug: quiz.slug, status: quiz.status, isLive: quiz.isLive, creatorId: quiz.creatorId,
    attemptsCount: quiz.attemptsCount, ratingAvg: quiz.ratingAvg, ratingCount: quiz.ratingCount,
    latestFeedback: quiz.latestFeedback || '', publishedAt: quiz.publishedAt,
    hasDraft: !!draft, hasPending: !!pending, hasPublished: !!published,
    createdAt: quiz.createdAt, updatedAt: quiz.updatedAt,
    title: working?.metadata.title || '', description: working?.metadata.description || '',
    questionCount: working?.questions.length || 0, totalPoints: working?.totalPoints || 0,
    versionNumber: working?.versionNumber || 1,
    categoryId: working?.metadata.categoryId || '', difficulty: working?.metadata.difficulty || 'Beginner',
    language: working?.metadata.language || 'English', tags: working?.metadata.tags || [],
    workingVersion: working,
  };
}
async function ownedQuiz(req: any): Promise<Quiz> {
  const quiz = await findQuiz(req.store!, req.params.id);
  if (!quiz) throw notFound('Quiz not found');
  if (quiz.creatorId !== req.user!.id) throw forbidden('You can only manage your own quizzes');
  return quiz;
}

router.post('/quizzes', requireAuth, notSuspended, async (req, res, next) => {
  try {
    const store = req.store!;
    const payload = parse(quizPayloadSchema, req.body);
    const category = await store.categories.byId(payload.categoryId);
    if (!category || !category.isActive) throw badRequest('Select a valid category');
    const t = now(); const quizId = id(); const versionId = id();
    const meta = metaFrom(payload);
    const version: QuizVersion = {
      id: versionId, quizId, versionNumber: 1, state: 'draft', metadata: meta,
      questions: (payload.questions || []).map((q: any, i: number) => ({ ...q, order: i })),
      totalPoints: totalPoints((payload.questions || []) as any), createdBy: req.user!.id, createdAt: t, updatedAt: t,
    };
    await store.versions.insert(version);
    const quiz = await store.quizzes.insert({
      id: quizId, slug: await uniqueSlug(store, payload.title), creatorId: req.user!.id, status: 'DRAFT',
      draftVersionId: versionId, pendingVersionId: null, currentPublishedVersionId: null, isLive: false,
      nextVersionNumber: 2, attemptsCount: 0, ratingAvg: 0, ratingCount: 0, latestFeedback: '', publishedAt: null, createdAt: t, updatedAt: t,
    });
    res.status(201).json({ quiz: await myQuizView(store, quiz) });
  } catch (e) { next(e); }
});

router.get('/me/quizzes', requireAuth, async (req, res, next) => {
  try {
    const store = req.store!;
    const mine = await store.quizzes.find(q => q.creatorId === req.user!.id);
    mine.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const views = await Promise.all(mine.map(q => myQuizView(store, q)));
    res.json({ items: views });
  } catch (e) { next(e); }
});

router.get('/me/quizzes/:id', requireAuth, async (req, res, next) => {
  try { res.json({ quiz: await myQuizView(req.store!, await ownedQuiz(req)) }); } catch (e) { next(e); }
});

router.patch('/me/quizzes/:id', requireAuth, notSuspended, async (req, res, next) => {
  try {
    const store = req.store!;
    const quiz = await ownedQuiz(req);
    if (quiz.pendingVersionId) throw conflict('This quiz is under review. Withdraw the submission before editing.');
    const payload = parse(quizPayloadSchema, req.body);
    const category = await store.categories.byId(payload.categoryId);
    if (!category || !category.isActive) throw badRequest('Select a valid category');
    const meta = metaFrom(payload);
    const questions = (payload.questions || []).map((q: any, i: number) => ({ ...q, order: i }));
    const t = now();
    let draftId = quiz.draftVersionId;
    if (!draftId) {
      // Editing an approved quiz never touches the live published version:
      // a new draft version is created and must be re-approved.
      draftId = id();
      await store.versions.insert({
        id: draftId, quizId: quiz.id, versionNumber: quiz.nextVersionNumber, state: 'draft',
        metadata: meta, questions, totalPoints: totalPoints(questions as any),
        createdBy: req.user!.id, createdAt: t, updatedAt: t,
      });
      await store.quizzes.update(quiz.id, { draftVersionId: draftId, nextVersionNumber: quiz.nextVersionNumber + 1, updatedAt: t });
    } else {
      await store.versions.update(draftId, { metadata: meta, questions, totalPoints: totalPoints(questions as any), state: 'draft', updatedAt: t });
      await store.quizzes.update(quiz.id, { updatedAt: t });
    }
    const updated = await store.quizzes.byId(quiz.id);
    res.json({ quiz: await myQuizView(store, updated!) });
  } catch (e) { next(e); }
});

router.delete('/me/quizzes/:id', requireAuth, async (req, res, next) => {
  try {
    const store = req.store!; const quiz = await ownedQuiz(req);
    const attempts = await store.attempts.count(a => a.quizId === quiz.id && a.status === 'submitted');
    if (attempts > 0) {
      // Preserve attempt history: archive instead of hard delete.
      await store.quizzes.update(quiz.id, { status: 'ARCHIVED', isLive: false, pendingVersionId: null, updatedAt: now() });
      return res.json({ archived: true, message: 'Quiz archived (attempt history preserved).' });
    }
    await store.quizzes.remove(quiz.id);
    res.json({ deleted: true });
  } catch (e) { next(e); }
});

async function submitQuiz(req: any, res: any, next: any, resubmit = false) {
  try {
    const store = req.store!;
    const quiz = await ownedQuiz(req);
    if (quiz.pendingVersionId) throw conflict('A version of this quiz is already pending review');
    if (!quiz.draftVersionId) throw badRequest('There is no draft version to submit. Save your changes first.');
    const version = await store.versions.byId(quiz.draftVersionId);
    if (!version) throw notFound('Draft version not found');
    const category = version.metadata.categoryId ? await store.categories.byId(version.metadata.categoryId) : null;
    const errors = validateForSubmission(version.metadata, version.questions, !!(category?.isActive));
    if (errors.length) throw badRequest('This quiz is not ready for submission', { errors });
    const prev = quiz.status; const t = now();
    await store.versions.update(version.id, { state: 'pending', updatedAt: t });
    const updated = await store.quizzes.update(quiz.id, { status: 'PENDING_REVIEW', pendingVersionId: version.id, draftVersionId: null, updatedAt: t });
    await modLog(store, quiz.id, version.id, req.user!.id, resubmit ? 'resubmit' : 'submit', prev, 'PENDING_REVIEW');
    res.json({ quiz: await myQuizView(store, updated!) });
  } catch (e) { next(e); }
}
router.post('/me/quizzes/:id/submit', requireAuth, notSuspended, (req, res, next) => submitQuiz(req, res, next, false));
router.post('/me/quizzes/:id/resubmit', requireAuth, notSuspended, (req, res, next) => submitQuiz(req, res, next, true));

router.post('/me/quizzes/:id/withdraw', requireAuth, async (req, res, next) => {
  try {
    const store = req.store!; const quiz = await ownedQuiz(req);
    if (!quiz.pendingVersionId) throw badRequest('Nothing to withdraw');
    const t = now();
    await store.versions.update(quiz.pendingVersionId, { state: 'draft', updatedAt: t });
    const nextStatus = quiz.currentPublishedVersionId ? 'APPROVED' : 'DRAFT';
    const updated = await store.quizzes.update(quiz.id, { draftVersionId: quiz.pendingVersionId, pendingVersionId: null, status: nextStatus, updatedAt: t });
    res.json({ quiz: await myQuizView(store, updated!) });
  } catch (e) { next(e); }
});

router.get('/me/quizzes/:id/revisions', requireAuth, async (req, res, next) => {
  try {
    const store = req.store!; const quiz = await ownedQuiz(req);
    const versions = await store.versions.find(v => v.quizId === quiz.id);
    versions.sort((a, b) => b.versionNumber - a.versionNumber);
    const logs = await store.moderationLogs.find(l => l.quizId === quiz.id);
    logs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({
      versions: versions.map(v => ({ id: v.id, versionNumber: v.versionNumber, state: v.state, questionCount: v.questions.length, totalPoints: v.totalPoints, questionTypes: questionTypeSummary(v), createdAt: v.createdAt, updatedAt: v.updatedAt, title: v.metadata.title })),
      moderationLogs: logs,
    });
  } catch (e) { next(e); }
});

export default router;
