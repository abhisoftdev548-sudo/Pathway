import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../middleware/auth.js';
import { badRequest, conflict, id, notFound, now, parse, slugify } from '../lib/utils.js';
import { findQuiz, modLog, notify, publishedVersion } from '../lib/services.js';
import { publicUser } from '../lib/serializers.js';
import type { Quiz } from '../types.js';

const router = Router();
router.use(requireAdmin);

async function submissionView(store: any, quiz: Quiz) {
  const versionId = quiz.pendingVersionId || quiz.draftVersionId || quiz.currentPublishedVersionId;
  const version = versionId ? await store.versions.byId(versionId) : null;
  const creator = await store.users.byId(quiz.creatorId);
  const logs = await store.moderationLogs.find((l: any) => l.quizId === quiz.id);
  logs.sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));
  const versions = await store.versions.find((v: any) => v.quizId === quiz.id);
  versions.sort((a: any, b: any) => b.versionNumber - a.versionNumber);
  return {
    quiz: { id: quiz.id, slug: quiz.slug, status: quiz.status, isLive: quiz.isLive, hasPending: !!quiz.pendingVersionId, hasPublished: !!quiz.currentPublishedVersionId, attemptsCount: quiz.attemptsCount, createdAt: quiz.createdAt, updatedAt: quiz.updatedAt, latestFeedback: quiz.latestFeedback || '' },
    creator: publicUser(creator),
    version, moderationLogs: logs,
    revisions: versions.map((v: any) => ({ id: v.id, versionNumber: v.versionNumber, state: v.state, questionCount: v.questions.length, totalPoints: v.totalPoints, createdAt: v.createdAt, title: v.metadata.title })),
  };
}

router.get('/admin/dashboard', async (req, res, next) => {
  try {
    const store = req.store!;
    const quizzes = await store.quizzes.all();
    const byStatus = (s: string) => quizzes.filter(q => q.status === s).length;
    const pending = quizzes.filter(q => !!q.pendingVersionId);
    const reportsOpen = await store.reports.count(r => r.status === 'open');
    const recentPending = [...pending].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8);
    const recentPendingViews = await Promise.all(recentPending.map(q => submissionSummary(store, q)));
    const live = quizzes.filter(q => q.isLive);
    const logs = await store.moderationLogs.all();
    res.json({
      counts: {
        pending: pending.length, approved: live.length, rejected: byStatus('REJECTED'),
        changesRequested: byStatus('CHANGES_REQUESTED'), drafts: byStatus('DRAFT'), unpublished: byStatus('UNPUBLISHED'),
        users: await store.users.count(), reportsOpen,
        totalAttempts: quizzes.reduce((s, q) => s + q.attemptsCount, 0),
        moderationActions: logs.length,
      },
      recentSubmissions: recentPendingViews,
    });
  } catch (e) { next(e); }
});
async function submissionSummary(store: any, quiz: Quiz) {
  const version = quiz.pendingVersionId ? await store.versions.byId(quiz.pendingVersionId) : null;
  const creator = await store.users.byId(quiz.creatorId);
  const category = version?.metadata.categoryId ? await store.categories.byId(version.metadata.categoryId) : null;
  return {
    quizId: quiz.id, slug: quiz.slug, status: quiz.status, updatedAt: quiz.updatedAt,
    isRevision: !!quiz.currentPublishedVersionId,
    title: version?.metadata.title || '(untitled)', questionCount: version?.questions.length || 0,
    difficulty: version?.metadata.difficulty, language: version?.metadata.language,
    category: category?.name || '', versionNumber: version?.versionNumber,
    creator: publicUser(creator),
  };
}

router.get('/admin/submissions', async (req, res, next) => {
  try {
    const store = req.store!;
    const pending = await store.quizzes.find(q => !!q.pendingVersionId);
    pending.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)); // oldest first = fair queue
    res.json({ items: await Promise.all(pending.map(q => submissionSummary(store, q))) });
  } catch (e) { next(e); }
});
router.get('/admin/submissions/:quizId', async (req, res, next) => {
  try {
    const quiz = await findQuiz(req.store!, req.params.quizId);
    if (!quiz) throw notFound('Quiz not found');
    res.json(await submissionView(req.store!, quiz));
  } catch (e) { next(e); }
});

async function decide(req: any, action: 'approve' | 'reject' | 'request_changes') {
  const store = req.store!;
  const quiz = await findQuiz(store, req.params.quizId);
  if (!quiz) throw notFound('Quiz not found');
  if (!quiz.pendingVersionId) throw conflict('This submission has already been decided');
  const feedback = (req.body?.feedback || '').trim();
  if (action !== 'approve' && !feedback) throw badRequest('Feedback is required when rejecting or requesting changes');
  const versionId = quiz.pendingVersionId; const prev = quiz.status; const t = now();
  const title = (await store.versions.byId(versionId))?.metadata.title || quiz.slug;
  if (action === 'approve') {
    if (quiz.currentPublishedVersionId && quiz.currentPublishedVersionId !== versionId) {
      await store.versions.update(quiz.currentPublishedVersionId, { state: 'superseded', updatedAt: t });
    }
    await store.versions.update(versionId, { state: 'published', updatedAt: t });
    await store.quizzes.update(quiz.id, {
      status: 'APPROVED', isLive: true, currentPublishedVersionId: versionId, pendingVersionId: null,
      publishedAt: t, latestFeedback: feedback, updatedAt: t,
    });
    await modLog(store, quiz.id, versionId, req.user.id, 'approve', prev, 'APPROVED', feedback);
    await notify(store, quiz.creatorId, 'quiz_approved', `Your quiz "${title}" was approved and is now published.`, quiz.id);
  } else {
    const toStatus = quiz.currentPublishedVersionId ? 'APPROVED' : action === 'reject' ? 'REJECTED' : 'CHANGES_REQUESTED';
    await store.versions.update(versionId, { state: 'returned', updatedAt: t });
    await store.quizzes.update(quiz.id, {
      status: toStatus, pendingVersionId: null, draftVersionId: versionId,
      latestFeedback: feedback, updatedAt: t,
    });
    await modLog(store, quiz.id, versionId, req.user.id, action, prev, toStatus, feedback);
    await notify(store, quiz.creatorId, action === 'reject' ? 'quiz_rejected' : 'changes_requested',
      action === 'reject' ? `Your quiz "${title}" was rejected: ${feedback}` : `Changes requested for "${title}": ${feedback}`, quiz.id);
  }
  const updated = await store.quizzes.byId(quiz.id);
  return submissionView(store, updated!);
}
router.post('/admin/submissions/:quizId/approve', async (req, res, next) => { try { res.json(await decide(req, 'approve')); } catch (e) { next(e); } });
router.post('/admin/submissions/:quizId/reject', async (req, res, next) => { try { res.json(await decide(req, 'reject')); } catch (e) { next(e); } });
router.post('/admin/submissions/:quizId/request-changes', async (req, res, next) => { try { res.json(await decide(req, 'request_changes')); } catch (e) { next(e); } });

router.get('/admin/quizzes', async (req, res, next) => {
  try {
    const store = req.store!;
    const quizzes = await store.quizzes.all();
    quizzes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const items = await Promise.all(quizzes.map(async q => {
      const v = await publishedVersion(store, q) || (q.draftVersionId ? await store.versions.byId(q.draftVersionId) : null) || (q.pendingVersionId ? await store.versions.byId(q.pendingVersionId) : null) || (q.currentPublishedVersionId ? await store.versions.byId(q.currentPublishedVersionId) : null);
      const creator = await store.users.byId(q.creatorId);
      return { id: q.id, slug: q.slug, title: v?.metadata.title || '(untitled)', status: q.status, isLive: q.isLive, attemptsCount: q.attemptsCount, questionCount: v?.questions.length || 0, creator: publicUser(creator), updatedAt: q.updatedAt, hasPending: !!q.pendingVersionId };
    }));
    res.json({ items });
  } catch (e) { next(e); }
});
router.post('/admin/quizzes/:quizId/unpublish', async (req, res, next) => {
  try {
    const store = req.store!; const quiz = await findQuiz(store, req.params.quizId);
    if (!quiz) throw notFound('Quiz not found');
    const feedback = (req.body?.feedback || '').trim(); const prev = quiz.status; const t = now();
    await store.quizzes.update(quiz.id, { isLive: false, status: 'UNPUBLISHED', latestFeedback: feedback, updatedAt: t });
    await modLog(store, quiz.id, quiz.currentPublishedVersionId, req.user!.id, 'unpublish', prev, 'UNPUBLISHED', feedback);
    await notify(store, quiz.creatorId, 'quiz_unpublished', `Your quiz was unpublished by an administrator.${feedback ? ' Reason: ' + feedback : ''}`, quiz.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
router.post('/admin/quizzes/:quizId/restore', async (req, res, next) => {
  try {
    const store = req.store!; const quiz = await findQuiz(store, req.params.quizId);
    if (!quiz) throw notFound('Quiz not found');
    if (!quiz.currentPublishedVersionId) throw badRequest('Only previously approved quizzes can be restored');
    const prev = quiz.status; const t = now();
    await store.quizzes.update(quiz.id, { isLive: true, status: 'APPROVED', updatedAt: t });
    await modLog(store, quiz.id, quiz.currentPublishedVersionId, req.user!.id, 'restore', prev, 'APPROVED');
    await notify(store, quiz.creatorId, 'quiz_restored', 'Your quiz was restored and is public again.', quiz.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/admin/moderation-logs', async (req, res, next) => {
  try {
    const store = req.store!;
    const logs = await store.moderationLogs.all();
    logs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const items = await Promise.all(logs.slice(0, 100).map(async l => {
      const quiz = await store.quizzes.byId(l.quizId);
      const version = l.quizVersionId ? await store.versions.byId(l.quizVersionId) : null;
      const admin = await store.users.byId(l.adminId);
      return { ...l, quizTitle: version?.metadata.title || quiz?.slug || l.quizId, adminName: admin?.displayName || 'System' };
    }));
    res.json({ items });
  } catch (e) { next(e); }
});

/* Categories CRUD */
const categorySchema = z.object({
  name: z.string().trim().min(2).max(80), description: z.string().max(500).optional().default(''),
  parentCategoryId: z.string().nullable().optional().default(null), isActive: z.boolean().optional().default(true),
});
router.post('/admin/categories', async (req, res, next) => {
  try {
    const store = req.store!; const body = parse(categorySchema, req.body);
    if (body.parentCategoryId) {
      const parent = await store.categories.byId(body.parentCategoryId);
      if (!parent || parent.parentCategoryId) throw badRequest('Parent must be a top-level category');
    }
    let slug = slugify(body.name); let n = 2; const base = slug;
    while (await store.categories.findOne(c => c.slug === slug)) slug = `${base}-${n++}`;
    const t = now();
    const cat = await store.categories.insert({ id: id(), name: body.name, slug, description: body.description, parentCategoryId: body.parentCategoryId || null, isActive: body.isActive ?? true, createdAt: t, updatedAt: t });
    res.status(201).json({ category: cat });
  } catch (e) { next(e); }
});
router.patch('/admin/categories/:id', async (req, res, next) => {
  try {
    const store = req.store!; const cat = await store.categories.byId(req.params.id);
    if (!cat) throw notFound('Category not found');
    const body = parse(categorySchema.partial(), req.body);
    const updated = await store.categories.update(cat.id, { ...body, updatedAt: now() } as any);
    res.json({ category: updated });
  } catch (e) { next(e); }
});
router.delete('/admin/categories/:id', async (req, res, next) => {
  try {
    const store = req.store!; const cat = await store.categories.byId(req.params.id);
    if (!cat) throw notFound('Category not found');
    const inUse = await store.versions.findOne(v => v.metadata.categoryId === cat.id || v.metadata.subcategoryId === cat.id);
    if (inUse) { await store.categories.update(cat.id, { isActive: false, updatedAt: now() }); return res.json({ deactivated: true, message: 'Category is used by quizzes, so it was deactivated instead of deleted.' }); }
    await store.categories.remove(cat.id);
    res.json({ deleted: true });
  } catch (e) { next(e); }
});

/* Reports */
router.get('/admin/reports', async (req, res, next) => {
  try {
    const store = req.store!;
    const reports = await store.reports.all();
    reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const items = await Promise.all(reports.map(async r => {
      const quiz = await store.quizzes.byId(r.quizId);
      const v = quiz ? await publishedVersion(store, quiz) || (quiz.currentPublishedVersionId ? await store.versions.byId(quiz.currentPublishedVersionId) : null) : null;
      const reporter = await store.users.byId(r.reporterId);
      return { ...r, quizTitle: v?.metadata.title || quiz?.slug || '', quizSlug: quiz?.slug || '', reporterName: reporter?.displayName || '' };
    }));
    res.json({ items });
  } catch (e) { next(e); }
});
router.patch('/admin/reports/:id', async (req, res, next) => {
  try {
    const { status } = parse(z.object({ status: z.enum(['open', 'reviewed', 'dismissed']) }), req.body);
    const report = await req.store!.reports.byId(req.params.id);
    if (!report) throw notFound('Report not found');
    const updated = await req.store!.reports.update(report.id, { status, reviewedBy: req.user!.id, updatedAt: now() });
    res.json({ report: updated });
  } catch (e) { next(e); }
});

/* Users (suspend / restore abusive creators) */
router.get('/admin/users', async (req, res, next) => {
  try {
    const store = req.store!;
    const users = await store.users.all();
    const items = await Promise.all(users.map(async u => ({
      id: u.id, displayName: u.displayName, email: u.email, role: u.role, isSuspended: u.isSuspended, createdAt: u.createdAt,
      quizCount: await store.quizzes.count(q => q.creatorId === u.id),
    })));
    res.json({ items });
  } catch (e) { next(e); }
});
router.patch('/admin/users/:id', async (req, res, next) => {
  try {
    const { isSuspended } = parse(z.object({ isSuspended: z.boolean() }), req.body);
    const user = await req.store!.users.byId(req.params.id);
    if (!user) throw notFound('User not found');
    if (user.role === 'admin') throw badRequest('Administrator accounts cannot be suspended');
    const updated = await req.store!.users.update(user.id, { isSuspended, updatedAt: now() });
    res.json({ user: { id: updated!.id, isSuspended: updated!.isSuspended } });
  } catch (e) { next(e); }
});

export default router;
