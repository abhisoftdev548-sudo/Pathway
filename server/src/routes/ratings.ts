import { Router } from 'express';
import { z } from 'zod';
import { all, count, get, newId, nowIso, run, tx } from '../db/index.js';
import { conflict, forbidden, notFound } from '../lib/errors.js';
import { handler, parseBody, parseQuery } from '../lib/http.js';
import { auditFromRequest } from '../lib/audit.js';
import { currentUser, requireAuth } from '../lib/auth.js';
import { pageResult, paging } from '../lib/paging.js';
import { isFeatureEnabled } from '../lib/settings.js';
import { notify, notifyAdmins } from '../lib/notify.js';
import { evaluate } from '../lib/achievements.js';

export const ratingsRouter = Router();

const contentRef = z.object({
  contentType: z.enum(['quiz', 'poll']),
  contentId: z.string().min(1),
});

const listSchema = contentRef.extend({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  mine: z.coerce.boolean().optional(),
});

ratingsRouter.get(
  '/',
  handler((req, res) => {
    const query = parseQuery(listSchema, req.query);
    const p = paging({ page: query.page, pageSize: query.pageSize ?? 10 });
    const params: any[] = [query.contentType, query.contentId];
    let extra = "AND r.status = 'published'";
    if (query.mine && req.ctx) {
      extra = '';
      params.push(req.ctx.user.id);
    }
    const rows = all(
      `SELECT r.id, r.score, r.review_text, r.status, r.created_at, r.updated_at,
              u.id AS user_id, u.username, u.display_name
         FROM ratings r JOIN users u ON u.id = r.user_id
        WHERE r.content_type = ? AND r.content_id = ? ${extra}
        ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
      ...params,
      p.pageSize,
      p.offset,
    );
    const total = count(
      `SELECT COUNT(*) AS total FROM ratings r WHERE r.content_type = ? AND r.content_id = ? ${extra}`,
      ...params,
    );
    const distribution = all<{ score: number; n: number }>(
      `SELECT score, COUNT(*) AS n FROM ratings
        WHERE content_type = ? AND content_id = ? AND status = 'published' GROUP BY score`,
      query.contentType,
      query.contentId,
    );
    res.json({ ...pageResult(rows, total, p), distribution });
  }),
);

const upsertSchema = contentRef.extend({
  score: z.number().int().min(1, 'Choose a rating from 1 to 5.').max(5),
  reviewText: z.string().trim().max(1200, 'Keep your review under 1200 characters.').default(''),
});

ratingsRouter.post(
  '/',
  requireAuth,
  handler((req, res) => {
    if (!isFeatureEnabled('ratings_enabled')) throw conflict('Ratings are currently switched off.');
    const user = currentUser(req);
    const body = parseBody(upsertSchema, req.body);

    const ownerId = contentOwnerId(body.contentType, body.contentId);
    if (!ownerId) throw notFound('That content does not exist.');
    if (ownerId === user.id) throw conflict('You cannot rate your own content.');

    if (body.contentType === 'quiz') {
      const took = get(
        "SELECT 1 FROM quiz_attempts WHERE quiz_id = ? AND user_id = ? AND status = 'submitted'",
        body.contentId,
        user.id,
      );
      if (!took) throw conflict('Complete this quiz before rating it.');
    } else {
      const voted = get('SELECT 1 FROM poll_votes WHERE poll_id = ? AND user_id = ?', body.contentId, user.id);
      if (!voted) throw conflict('Vote in this poll before rating it.');
    }

    const existing = get<{ id: string }>(
      'SELECT id FROM ratings WHERE content_type = ? AND content_id = ? AND user_id = ?',
      body.contentType,
      body.contentId,
      user.id,
    );
    if (existing) {
      run(
        'UPDATE ratings SET score = ?, review_text = ?, updated_at = ? WHERE id = ?',
        body.score,
        body.reviewText,
        nowIso(),
        existing.id,
      );
      auditFromRequest(req, 'rating.updated', 'rating', existing.id, { score: body.score });
      res.json({ id: existing.id });
      return;
    }

    const id = newId();
    run(
      `INSERT INTO ratings (id, content_type, content_id, user_id, score, review_text, status, created_at, updated_at)
       VALUES (?,?,?,?,?,?, 'published', ?, ?)`,
      id,
      body.contentType,
      body.contentId,
      user.id,
      body.score,
      body.reviewText,
      nowIso(),
      nowIso(),
    );
    auditFromRequest(req, 'rating.created', 'rating', id, { score: body.score });
    notify({
      userId: ownerId,
      kind: 'rating',
      title: 'New rating on your content',
      body: `${user.displayName} left ${body.score} stars.`,
      link: body.contentType === 'quiz' ? `/app/quizzes/${body.contentId}` : `/app/polls/${body.contentId}`,
    });
    evaluate(user.id);
    res.status(201).json({ id });
  }),
);

// Ratings the signed-in user has left, across both content types.
ratingsRouter.get(
  '/mine',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const rows = all(
      `SELECT r.id, r.content_type, r.content_id, r.score, r.review_text AS review_text, r.status, r.created_at, r.updated_at,
              CASE WHEN r.content_type = 'quiz'
                   THEN (SELECT title FROM quizzes WHERE id = r.content_id)
                   ELSE (SELECT question FROM polls WHERE id = r.content_id) END AS content_title
         FROM ratings r
        WHERE r.user_id = ?
        ORDER BY r.updated_at DESC`,
      user.id,
    );
    res.json({ items: rows });
  }),
);

ratingsRouter.delete(
  '/:id',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const rating = get<{ user_id: string }>('SELECT user_id FROM ratings WHERE id = ?', req.params.id);
    if (!rating) throw notFound('That rating no longer exists.');
    if (rating.user_id !== user.id && user.role !== 'admin') throw forbidden('You can only remove your own rating.');
    run('DELETE FROM ratings WHERE id = ?', req.params.id);
    auditFromRequest(req, 'rating.deleted', 'rating', req.params.id, {});
    res.json({ ok: true });
  }),
);

const disputeSchema = z.object({
  reason: z.string().trim().min(10, 'Describe why you are disputing this rating.').max(800),
});

ratingsRouter.post(
  '/:id/dispute',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const rating = get<{ id: string; content_type: string; content_id: string; user_id: string }>(
      'SELECT id, content_type, content_id, user_id FROM ratings WHERE id = ?',
      req.params.id,
    );
    if (!rating) throw notFound('That rating no longer exists.');
    const ownerId = contentOwnerId(rating.content_type, rating.content_id);
    if (ownerId !== user.id) throw forbidden('Only the content owner can dispute a rating.');
    const body = parseBody(disputeSchema, req.body);

    run(
      `INSERT OR IGNORE INTO rating_disputes (id, rating_id, raised_by, reason, status, created_at)
       VALUES (?,?,?,?, 'pending', ?)`,
      newId(),
      rating.id,
      user.id,
      body.reason,
      nowIso(),
    );
    auditFromRequest(req, 'rating.disputed', 'rating', rating.id, {});
    notifyAdmins({
      kind: 'moderation',
      title: 'New rating dispute',
      body: body.reason.slice(0, 120),
      link: '/admin/ratings/disputes',
    });
    res.status(201).json({ ok: true });
  }),
);

// ------------------------------------------------------------------ reports

export const reportsRouter = Router();

const reportSchema = z.object({
  targetType: z.enum(['quiz', 'poll', 'review', 'user']),
  targetId: z.string().min(1),
  reason: z.string().trim().min(3, 'Choose or describe a reason.').max(120),
  details: z.string().trim().max(1000).default(''),
});

reportsRouter.post(
  '/',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const body = parseBody(reportSchema, req.body);
    if (body.targetType === 'user' && body.targetId === user.id) throw conflict('You cannot report yourself.');
    if (!targetExists(body.targetType, body.targetId)) throw notFound('That content no longer exists.');

    const id = newId();
    run(
      `INSERT INTO reports (id, reporter_id, target_type, target_id, reason, details, status, created_at)
       VALUES (?,?,?,?,?,?, 'pending', ?)
       ON CONFLICT(reporter_id, target_type, target_id) DO NOTHING`,
      id,
      user.id,
      body.targetType,
      body.targetId,
      body.reason,
      body.details,
      nowIso(),
    );
    auditFromRequest(req, 'report.created', body.targetType, body.targetId, { reason: body.reason });
    notifyAdmins({ kind: 'moderation', title: 'New report submitted', body: body.reason, link: '/admin/moderation/reports' });
    res.status(201).json({ id });
  }),
);

reportsRouter.get(
  '/mine',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const rows = all(
      `SELECT id, target_type, target_id, reason, status, resolution, created_at
         FROM reports WHERE reporter_id = ? ORDER BY created_at DESC`,
      user.id,
    );
    res.json({ items: rows });
  }),
);

// ------------------------------------------------------------------ appeals

export const appealsRouter = Router();

const appealSchema = z.object({
  contentType: z.enum(['quiz', 'poll']),
  contentId: z.string().min(1),
  reason: z.string().trim().min(15, 'Explain why you are appealing this decision.').max(1000),
});

appealsRouter.post(
  '/',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const body = parseBody(appealSchema, req.body);
    const ownerId = contentOwnerId(body.contentType, body.contentId);
    if (!ownerId) throw notFound('That content does not exist.');
    if (ownerId !== user.id) throw forbidden('You can only appeal decisions on your own content.');

    tx(() => {
      run(
        `INSERT INTO appeals (id, content_type, content_id, submitted_by, reason, status, created_at)
         VALUES (?,?,?,?,?, 'pending', ?)`,
        newId(),
        body.contentType,
        body.contentId,
        user.id,
        body.reason,
        nowIso(),
      );
    });
    auditFromRequest(req, 'appeal.created', body.contentType, body.contentId, {});
    notifyAdmins({ kind: 'moderation', title: 'New appeal submitted', body: body.reason.slice(0, 120), link: '/admin/moderation/appeals' });
    res.status(201).json({ ok: true });
  }),
);

appealsRouter.get(
  '/mine',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    res.json({
      items: all(
        `SELECT id, content_type, content_id, reason, status, resolution, created_at, resolved_at
           FROM appeals WHERE submitted_by = ? ORDER BY created_at DESC`,
        user.id,
      ),
    });
  }),
);

// ------------------------------------------------------------------ helpers

export function contentOwnerId(contentType: string, contentId: string): string | null {
  const row =
    contentType === 'quiz'
      ? get<{ creator_id: string }>('SELECT creator_id FROM quizzes WHERE id = ?', contentId)
      : get<{ creator_id: string }>('SELECT creator_id FROM polls WHERE id = ?', contentId);
  return row?.creator_id ?? null;
}

function targetExists(targetType: string, targetId: string): boolean {
  switch (targetType) {
    case 'quiz':
      return !!get('SELECT 1 FROM quizzes WHERE id = ?', targetId);
    case 'poll':
      return !!get('SELECT 1 FROM polls WHERE id = ?', targetId);
    case 'review':
      return !!get('SELECT 1 FROM ratings WHERE id = ?', targetId);
    case 'user':
      return !!get('SELECT 1 FROM users WHERE id = ?', targetId);
    default:
      return false;
  }
}
