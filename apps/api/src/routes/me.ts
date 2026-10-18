import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { now, parse } from '../lib/utils.js';
import { publishedVersion, toCard } from '../lib/services.js';
import { selfUser } from '../lib/serializers.js';

const router = Router();
router.use(requireAuth);

/* Profile: explicit allow-list — role/email can never be set through this route. */
router.patch('/me', async (req, res, next) => {
  try {
    const body = parse(z.object({
      displayName: z.string().trim().min(2).max(80).optional(),
      bio: z.string().max(500).optional(), avatar: z.string().max(1000).optional(),
    }), req.body);
    const updated = await req.store!.users.update(req.user!.id, { ...body, updatedAt: now() });
    res.json({ user: selfUser(updated!) });
  } catch (e) { next(e); }
});

router.get('/me/bookmarks', async (req, res, next) => {
  try {
    const store = req.store!;
    const marks = await store.bookmarks.find(b => b.userId === req.user!.id);
    marks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const items = [];
    for (const m of marks) {
      const quiz = await store.quizzes.byId(m.quizId);
      if (!quiz) continue;
      const v = await publishedVersion(store, quiz);
      if (v) items.push({ ...(await toCard(store, quiz, v)), isBookmarked: true });
    }
    res.json({ items });
  } catch (e) { next(e); }
});

router.get('/me/notifications', async (req, res, next) => {
  try {
    const items = await req.store!.notifications.find(n => n.userId === req.user!.id);
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ items: items.slice(0, 50), unread: items.filter(n => !n.read).length });
  } catch (e) { next(e); }
});
router.patch('/me/notifications/read', async (req, res, next) => {
  try {
    const mine = await req.store!.notifications.find(n => n.userId === req.user!.id && !n.read);
    for (const n of mine) await req.store!.notifications.update(n.id, { read: true });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/me/dashboard', async (req, res, next) => {
  try {
    const store = req.store!; const uid = req.user!.id;
    const attempts = await store.attempts.find(a => a.userId === uid && a.status === 'submitted');
    attempts.sort((a, b) => (a.submittedAt || '').localeCompare(b.submittedAt || ''));
    const percentages = attempts.map(a => a.percentage).filter((p): p is number => p != null);
    const myQuizzes = await store.quizzes.find(q => q.creatorId === uid);
    const byStatus: Record<string, number> = {};
    myQuizzes.forEach(q => { byStatus[q.status] = (byStatus[q.status] || 0) + 1; });
    let questionsAnswered = 0;
    attempts.forEach(a => { questionsAnswered += a.correctCount + a.incorrectCount; });
    const chart = attempts.slice(-12).map(a => ({ date: (a.submittedAt || a.startedAt).slice(0, 10), percentage: a.percentage ?? 0, score: a.score }));
    const editingInProgress = await store.attempts.count(a => a.userId === uid && a.status === 'in_progress');
    res.json({
      stats: {
        quizzesAttempted: new Set(attempts.map(a => a.quizId)).size,
        totalAttempts: attempts.length,
        inProgressAttempts: editingInProgress,
        averagePercentage: percentages.length ? Math.round((percentages.reduce((s, p) => s + p, 0) / percentages.length) * 10) / 10 : null,
        bestPercentage: percentages.length ? Math.max(...percentages) : null,
        questionsAnswered,
        createdQuizzes: myQuizzes.length,
        attemptsOnMyQuizzes: myQuizzes.reduce((s, q) => s + q.attemptsCount, 0),
        bookmarks: await store.bookmarks.count(b => b.userId === uid),
      },
      createdByStatus: byStatus,
      scoreChart: chart,
    });
  } catch (e) { next(e); }
});

export default router;
