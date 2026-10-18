import { Router } from 'express';
import { z } from 'zod';
import { all, count, get } from '../db/index.js';
import { notFound } from '../lib/errors.js';
import { handler, parseBody, parseQuery } from '../lib/http.js';
import { currentUser, requireAuth } from '../lib/auth.js';
import { pageResult, paging, Where } from '../lib/paging.js';
import { listDefinitions } from '../lib/achievements.js';
import { listNotifications, markAllRead, markRead, unreadCount } from '../lib/notify.js';
import { isFeatureEnabled } from '../lib/settings.js';

export const socialRouter = Router();

// ------------------------------------------------------------------ notifications

socialRouter.get(
  '/notifications',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const query = parseQuery(
      z.object({
        filter: z.enum(['all', 'unread']).optional(),
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(50).optional(),
      }),
      req.query,
    );
    const p = paging({ page: query.page, pageSize: query.pageSize ?? 20 });
    const { rows, total } = listNotifications(user.id, p.pageSize, p.offset, query.filter ?? 'all');
    res.json({ ...pageResult(rows, total, p), unread: unreadCount(user.id) });
  }),
);

socialRouter.post(
  '/notifications/read',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const body = parseBody(z.object({ id: z.string().min(1).optional() }).optional(), req.body ?? {});
    if (body?.id) {
      if (!markRead(user.id, body.id)) throw notFound('That notification no longer exists.');
    } else {
      markAllRead(user.id);
    }
    res.json({ ok: true, unread: unreadCount(user.id) });
  }),
);

// ------------------------------------------------------------------ achievements

socialRouter.get(
  '/achievements',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const definitions = listDefinitions();
    const earned = all<{ achievement_code: string; earned_at: string }>(
      'SELECT achievement_code, earned_at FROM user_achievements WHERE user_id = ? ORDER BY earned_at DESC',
      user.id,
    );
    const byCode = new Map(earned.map((e) => [e.achievement_code, e.earned_at]));
    res.json({
      items: definitions.map((d) => ({ ...d, earnedAt: byCode.get(d.code) ?? null })),
      earnedCount: byCode.size,
    });
  }),
);

// ------------------------------------------------------------------ leaderboards

const leaderboardSchema = z.object({
  scope: z.enum(['global', 'quiz']).optional(),
  quizId: z.string().optional(),
  period: z.enum(['all', '30d', '7d']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

socialRouter.get(
  '/leaderboards',
  handler((req, res) => {
    if (!isFeatureEnabled('leaderboards_enabled')) {
      res.json({ items: [], page: 1, pageSize: 0, total: 0, totalPages: 1, hasMore: false, disabled: true });
      return;
    }
    const query = parseQuery(leaderboardSchema, req.query);
    const p = paging({ page: query.page, pageSize: query.pageSize ?? 25 });
    const period = query.period ?? 'all';
    const since =
      period === '30d'
        ? new Date(Date.now() - 30 * 86400000).toISOString()
        : period === '7d'
          ? new Date(Date.now() - 7 * 86400000).toISOString()
          : null;

    if (query.scope === 'quiz') {
      if (!query.quizId) throw notFound('Choose a quiz to view its leaderboard.');
      const quiz = get<{ id: string; title: string }>('SELECT id, title FROM quizzes WHERE id = ? AND status = ?', query.quizId, 'approved');
      if (!quiz) throw notFound('That quiz is not published.');

      const where = new Where().add('a.quiz_id = ?', quiz.id).add("a.status = 'submitted'").add('a.counts_on_leaderboard = 1');
      if (since) where.add('a.submitted_at >= ?', since);

      const rows = all(
        `SELECT u.id AS user_id, u.username, u.display_name,
                MAX(a.score_percent) AS best_score,
                COUNT(*) AS attempts,
                MAX(a.submitted_at) AS last_attempt_at,
                MIN(a.time_spent_seconds) AS best_time_seconds,
                SUM(a.reward_paid) AS coins_earned
           FROM quiz_attempts a JOIN users u ON u.id = a.user_id
           ${where.build()}
          GROUP BY u.id
          ORDER BY best_score DESC, last_attempt_at ASC
          LIMIT ? OFFSET ?`,
        ...where.params,
        p.pageSize,
        p.offset,
      );
      const total = count(
        `SELECT COUNT(DISTINCT a.user_id) AS total FROM quiz_attempts a ${where.build()}`,
        ...where.params,
      );
      const ranked = rows.map((r: any, index: number) => ({ ...r, rank: p.offset + index + 1 }));
      res.json({ ...pageResult(ranked, total, p), quiz: { id: quiz.id, title: quiz.title } });
      return;
    }

    // Global: mean score across eligible attempts, minimum volume to appear.
    const where = new Where().add("a.status = 'submitted'").add('a.counts_on_leaderboard = 1');
    if (since) where.add('a.submitted_at >= ?', since);

    const rows = all(
      `SELECT u.id AS user_id, u.username, u.display_name,
              COUNT(*) AS attempts,
              ROUND(AVG(a.score_percent), 1) AS average_score,
              SUM(CASE WHEN a.passed = 1 THEN 1 ELSE 0 END) AS passes,
              SUM(a.reward_paid) AS coins_earned,
              MAX(a.submitted_at) AS last_attempt_at
         FROM quiz_attempts a JOIN users u ON u.id = a.user_id
         ${where.build()}
        GROUP BY u.id
       HAVING COUNT(*) >= 3
        ORDER BY average_score DESC, attempts DESC, last_attempt_at ASC
        LIMIT ? OFFSET ?`,
      ...where.params,
      p.pageSize,
      p.offset,
    );
    const total = count(
      `SELECT COUNT(*) AS total FROM (
         SELECT a.user_id FROM quiz_attempts a ${where.build()} GROUP BY a.user_id HAVING COUNT(*) >= 3
       )`,
      ...where.params,
    );
    const ranked = rows.map((r: any, index: number) => ({ ...r, rank: p.offset + index + 1 }));
    res.json(pageResult(ranked, total, p));
  }),
);

/** Leaderboard for a single quiz — mounted under /quizzes/:id/leaderboard. */
export const leaderboardRouter = Router();

leaderboardRouter.get(
  '/:id/leaderboard',
  handler((req, res) => {
    const p = paging({ page: Number(req.query.page) || 1, pageSize: 25 });
    const quiz = get<{ id: string }>('SELECT id FROM quizzes WHERE id = ?', req.params.id);
    if (!quiz) throw notFound('That quiz does not exist.');
    const rows = all(
      `SELECT u.id AS user_id, u.username, u.display_name,
              MAX(a.score_percent) AS best_score, COUNT(*) AS attempts,
              MIN(a.time_spent_seconds) AS best_time_seconds,
              MAX(a.submitted_at) AS last_attempt_at
         FROM quiz_attempts a JOIN users u ON u.id = a.user_id
        WHERE a.quiz_id = ? AND a.status = 'submitted' AND a.counts_on_leaderboard = 1
        GROUP BY u.id
        ORDER BY best_score DESC, last_attempt_at ASC
        LIMIT ? OFFSET ?`,
      quiz.id,
      p.pageSize,
      p.offset,
    );
    const total = count(
      `SELECT COUNT(DISTINCT user_id) AS total FROM quiz_attempts
        WHERE quiz_id = ? AND status = 'submitted' AND counts_on_leaderboard = 1`,
      quiz.id,
    );
    const ranked = rows.map((r: any, i: number) => ({ ...r, rank: p.offset + i + 1 }));
    res.json(pageResult(ranked, total, p));
  }),
);
