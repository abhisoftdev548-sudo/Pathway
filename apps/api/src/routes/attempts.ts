import { Router } from 'express';
import { z } from 'zod';
import { notSuspended, requireAuth } from '../middleware/auth.js';
import { badRequest, forbidden, id, notFound, now, parse, shuffle } from '../lib/utils.js';
import { findQuiz, publishedVersion } from '../lib/services.js';
import { sanitizeQuestion } from '../lib/serializers.js';
import { scoreAttempt, scoreQuestion } from '../lib/scoring.js';
import type { QuizAttempt, QuizVersion } from '../types.js';

const router = Router();
const GRACE_MS = 30 * 1000;

function deadline(attempt: QuizAttempt, version: QuizVersion): number | null {
  const limit = version.metadata.timeLimit;
  return limit ? new Date(attempt.startedAt).getTime() + limit * 60 * 1000 : null;
}
async function finalize(store: any, attempt: QuizAttempt, version: QuizVersion): Promise<QuizAttempt> {
  if (attempt.status === 'submitted') return attempt;
  const scored = scoreAttempt(version.questions, attempt.responses);
  const t = now();
  const updated = await store.attempts.update(attempt.id, {
    status: 'submitted', ...scored, submittedAt: t, updatedAt: t,
    timeTaken: Math.max(0, Math.round((Date.now() - new Date(attempt.startedAt).getTime()) / 1000)),
  });
  const quiz = await store.quizzes.byId(attempt.quizId);
  if (quiz) await store.quizzes.update(quiz.id, { attemptsCount: quiz.attemptsCount + 1 });
  return updated!;
}
/** Timed quizzes auto-submit saved responses once the limit + grace passes. */
async function maybeExpire(store: any, attempt: QuizAttempt): Promise<QuizAttempt> {
  if (attempt.status !== 'in_progress') return attempt;
  const version = await store.versions.byId(attempt.quizVersionId);
  if (!version) return attempt;
  const dl = deadline(attempt, version);
  if (dl && Date.now() > dl + GRACE_MS) return finalize(store, attempt, version);
  return attempt;
}

function attemptView(attempt: QuizAttempt, version: QuizVersion, quizTitle: string, slug: string) {
  const byId = new Map(version.questions.map(q => [q.id, q]));
  const questions = attempt.displayedQuestionOrder
    .map(qid => byId.get(qid))
    .filter(Boolean)
    .map(q => sanitizeQuestion(q!, attempt.displayedOptionOrders[q!.id]));
  const dl = deadline(attempt, version);
  return {
    id: attempt.id, quizId: attempt.quizId, quizSlug: slug, title: quizTitle,
    quizVersionId: attempt.quizVersionId, status: attempt.status,
    startedAt: attempt.startedAt, submittedAt: attempt.submittedAt,
    timeLimitMinutes: version.metadata.timeLimit ?? null,
    deadline: dl ? new Date(dl).toISOString() : null,
    explanationMode: version.metadata.settings?.explanationMode || 'after_submission',
    questions, responses: attempt.responses,
    score: attempt.score, maximumScore: attempt.maximumScore, percentage: attempt.percentage,
    pendingMarks: attempt.pendingMarks, evaluationStatus: attempt.evaluationStatus,
  };
}
async function ownedAttempt(req: any, attemptId: string): Promise<QuizAttempt> {
  const attempt = await req.store!.attempts.byId(attemptId);
  if (!attempt) throw notFound('Attempt not found');
  if (attempt.userId !== req.user!.id) throw forbidden('You can only access your own attempts');
  return attempt;
}

/* Start (or resume) an attempt */
router.post('/quizzes/:slug/attempts', requireAuth, notSuspended, async (req, res, next) => {
  try {
    const store = req.store!;
    const quiz = await findQuiz(store, req.params.slug);
    if (!quiz) throw notFound('Quiz not found');
    const version = await publishedVersion(store, quiz);
    if (!version) throw notFound('This quiz is not published, so it cannot be attempted');
    let attempt = await store.attempts.findOne(a => a.userId === req.user!.id && a.quizId === quiz.id && a.status === 'in_progress');
    if (attempt) attempt = await maybeExpire(store, attempt);
    if (attempt && attempt.status === 'in_progress') {
      const v = await store.versions.byId(attempt.quizVersionId);
      return res.json({ attempt: attemptView(attempt, v!, v!.metadata.title, quiz.slug), resumed: true });
    }
    const settings = version.metadata.settings;
    const ordered = [...version.questions].sort((a, b) => a.order - b.order);
    const displayedQuestionOrder = (settings?.shuffleQuestions ? shuffle(ordered) : ordered).map(q => q.id);
    const displayedOptionOrders: Record<string, string[]> = {};
    for (const q of version.questions) {
      const ids = q.options.map(o => o.id);
      displayedOptionOrders[q.id] = settings?.shuffleOptions ? shuffle(ids) : ids;
    }
    const t = now();
    attempt = await store.attempts.insert({
      id: id(), userId: req.user!.id, quizId: quiz.id, quizVersionId: version.id,
      responses: [], displayedQuestionOrder, displayedOptionOrders, status: 'in_progress',
      score: 0, maximumScore: 0, pendingMarks: 0, percentage: null,
      correctCount: 0, incorrectCount: 0, unansweredCount: 0, results: [],
      evaluationStatus: 'in_progress', startedAt: t, submittedAt: null, timeTaken: null, createdAt: t, updatedAt: t,
    });
    res.status(201).json({ attempt: attemptView(attempt, version, version.metadata.title, quiz.slug), resumed: false });
  } catch (e) { next(e); }
});

router.get('/attempts/:id', requireAuth, async (req, res, next) => {
  try {
    const store = req.store!;
    let attempt = await ownedAttempt(req, req.params.id);
    attempt = await maybeExpire(store, attempt);
    const version = await store.versions.byId(attempt.quizVersionId);
    const quiz = await store.quizzes.byId(attempt.quizId);
    if (!version) throw notFound('Quiz version not found');
    res.json({ attempt: attemptView(attempt, version, version.metadata.title, quiz?.slug || '') });
  } catch (e) { next(e); }
});

const responsesSchema = z.object({
  responses: z.array(z.object({
    questionId: z.string(), selectedOptionIds: z.array(z.string()).max(8).default([]),
    textAnswer: z.string().max(5000).optional().default(''), markedForReview: z.boolean().optional().default(false),
  })).max(200),
});
router.patch('/attempts/:id/responses', requireAuth, notSuspended, async (req, res, next) => {
  try {
    const store = req.store!;
    let attempt = await ownedAttempt(req, req.params.id);
    attempt = await maybeExpire(store, attempt);
    if (attempt.status !== 'in_progress') return res.json({ attempt, message: 'Attempt already submitted' });
    const { responses } = parse(responsesSchema, req.body);
    const validIds = new Set(attempt.displayedQuestionOrder);
    const merged = new Map(attempt.responses.map(r => [r.questionId, r]));
    for (const r of responses) if (validIds.has(r.questionId)) merged.set(r.questionId, r as any);
    const updated = await store.attempts.update(attempt.id, { responses: [...merged.values()], updatedAt: now() });
    res.json({ saved: true, responseCount: updated!.responses.length });
  } catch (e) { next(e); }
});

/* Immediate-mode per-question check (only when the creator enabled it). */
router.post('/attempts/:id/check', requireAuth, async (req, res, next) => {
  try {
    const store = req.store!;
    const attempt = await ownedAttempt(req, req.params.id);
    const version = await store.versions.byId(attempt.quizVersionId);
    if (!version) throw notFound('Quiz version not found');
    if (version.metadata.settings?.explanationMode !== 'immediate') throw badRequest('Explanations are available after submission for this quiz');
    const { questionId } = parse(z.object({ questionId: z.string() }), req.body);
    const q = version.questions.find(x => x.id === questionId);
    if (!q) throw notFound('Question not found');
    const response = attempt.responses.find(r => r.questionId === questionId);
    const result = scoreQuestion(q, response);
    res.json({ ...result, explanation: q.explanation, correctOptionIds: q.correctOptionIds, acceptedAnswers: q.acceptedAnswers });
  } catch (e) { next(e); }
});

/* Idempotent submit: a second call returns the stored result, never a new one. */
router.post('/attempts/:id/submit', requireAuth, async (req, res, next) => {
  try {
    const store = req.store!;
    const attempt0 = await ownedAttempt(req, req.params.id);
    const version = await store.versions.byId(attempt0.quizVersionId);
    if (!version) throw notFound('Quiz version not found');
    if (attempt0.status !== 'submitted' && req.body?.responses) {
      const { responses } = parse(responsesSchema, req.body);
      const validIds = new Set(attempt0.displayedQuestionOrder);
      const merged = new Map(attempt0.responses.map(r => [r.questionId, r]));
      for (const r of responses) if (validIds.has(r.questionId)) merged.set(r.questionId, r as any);
      await store.attempts.update(attempt0.id, { responses: [...merged.values()] });
    }
    const fresh = await store.attempts.byId(attempt0.id);
    const done = await finalize(store, fresh!, version);
    res.json({ attempt: reviewPayload(done, version), alreadySubmitted: attempt0.status === 'submitted' });
  } catch (e) { next(e); }
});

function reviewPayload(attempt: QuizAttempt, version: QuizVersion) {
  const byId = new Map(version.questions.map(q => [q.id, q]));
  const responses = new Map(attempt.responses.map(r => [r.questionId, r]));
  const results = new Map(attempt.results.map(r => [r.questionId, r]));
  const questions = attempt.displayedQuestionOrder.map(qid => byId.get(qid)).filter(Boolean).map(q => ({
    ...sanitizeQuestion(q!, attempt.displayedOptionOrders[q!.id]),
    explanation: q!.explanation, correctOptionIds: q!.correctOptionIds,
    acceptedAnswers: q!.acceptedAnswers, caseInsensitive: q!.caseInsensitive,
    yourResponse: responses.get(q!.id) || { questionId: q!.id, selectedOptionIds: [], textAnswer: '' },
    result: results.get(q!.id) || null,
  }));
  return {
    id: attempt.id, quizId: attempt.quizId, quizVersionId: attempt.quizVersionId,
    title: version.metadata.title, status: attempt.status, score: attempt.score,
    maximumScore: attempt.maximumScore, pendingMarks: attempt.pendingMarks,
    percentage: attempt.percentage, correctCount: attempt.correctCount,
    incorrectCount: attempt.incorrectCount, unansweredCount: attempt.unansweredCount,
    evaluationStatus: attempt.evaluationStatus, startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt, timeTaken: attempt.timeTaken, questions,
  };
}

router.get('/me/attempts', requireAuth, async (req, res, next) => {
  try {
    const store = req.store!;
    const mine = await store.attempts.find(a => a.userId === req.user!.id);
    mine.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    const items = await Promise.all(mine.map(async a => {
      const quiz = await store.quizzes.byId(a.quizId);
      const version = await store.versions.byId(a.quizVersionId);
      return {
        id: a.id, quizId: a.quizId, quizSlug: quiz?.slug || '', title: version?.metadata.title || 'Quiz',
        status: a.status, score: a.score, maximumScore: a.maximumScore, percentage: a.percentage,
        pendingMarks: a.pendingMarks, evaluationStatus: a.evaluationStatus,
        correctCount: a.correctCount, questionCount: version?.questions.length || 0,
        startedAt: a.startedAt, submittedAt: a.submittedAt, timeTaken: a.timeTaken,
      };
    }));
    res.json({ items });
  } catch (e) { next(e); }
});

router.get('/me/attempts/:id/review', requireAuth, async (req, res, next) => {
  try {
    const store = req.store!;
    let attempt = await ownedAttempt(req, req.params.id);
    attempt = await maybeExpire(store, attempt);
    if (attempt.status !== 'submitted') throw badRequest('Submit the attempt before reviewing answers');
    const version = await store.versions.byId(attempt.quizVersionId);
    if (!version) throw notFound('Quiz version not found');
    res.json({ review: reviewPayload(attempt, version) });
  } catch (e) { next(e); }
});

export default router;
