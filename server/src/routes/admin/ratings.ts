import { Router } from 'express';
import { z } from 'zod';
import { all, count, get, nowIso, run, tx } from '../../db/index.js';
import { conflict, notFound } from '../../lib/errors.js';
import { handler, parseBody, parseQuery } from '../../lib/http.js';
import { auditFromRequest } from '../../lib/audit.js';
import { currentUser } from '../../lib/auth.js';
import { pageResult, paging, Where } from '../../lib/paging.js';
import { notify } from '../../lib/notify.js';

export const adminRatingsRouter = Router();

const listSchema = z.object({
  contentType: z.enum(['all', 'quiz', 'poll']).optional(),
  score: z.coerce.number().int().min(1).max(5).optional(),
  status: z.enum(['all', 'published', 'hidden']).optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

function contentTitle(contentType: string, contentId: string): string {
  return contentType === 'quiz'
    ? get<{ t: string }>('SELECT title AS t FROM quizzes WHERE id = ?', contentId)?.t ?? '(deleted quiz)'
    : get<{ t: string }>('SELECT question AS t FROM polls WHERE id = ?', contentId)?.t ?? '(deleted poll)';
}

adminRatingsRouter.get(
  '/',
  handler((req, res) => {
    const query = parseQuery(listSchema, req.query);
    const p = paging({ page: query.page, pageSize: query.pageSize ?? 25 });
    const where = new Where();
    where.addIf(query.contentType && query.contentType !== 'all', 'r.content_type = ?', query.contentType);
    where.addIf(query.score, 'r.score = ?', query.score);
    where.addIf(query.status && query.status !== 'all', 'r.status = ?', query.status);
    where.addIf(query.q, '(r.review_text LIKE ? OR u.username LIKE ?)', `%${query.q}%`, `%${query.q}%`);

    const rows = all(
      `SELECT r.id, r.content_type, r.content_id, r.score, r.review_text, r.status, r.created_at, r.updated_at,
              u.id AS user_id, u.username, u.display_name,
              (SELECT COUNT(*) FROM rating_disputes d WHERE d.rating_id = r.id) AS dispute_count
         FROM ratings r JOIN users u ON u.id = r.user_id
         ${where.build()}
        ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
      ...where.params,
      p.pageSize,
      p.offset,
    );
    const total = count(`SELECT COUNT(*) AS total FROM ratings r JOIN users u ON u.id = r.user_id ${where.build()}`, ...where.params);

    res.json({
      ...pageResult(
        rows.map((r: any) => ({ ...r, contentTitle: contentTitle(r.content_type, r.content_id) })),
        total,
        p,
      ),
      summary: {
        total: count('SELECT COUNT(*) AS t FROM ratings'),
        hidden: count("SELECT COUNT(*) AS t FROM ratings WHERE status = 'hidden'"),
        disputes: count("SELECT COUNT(*) AS t FROM rating_disputes WHERE status = 'pending'"),
        average: get<{ a: number | null }>("SELECT ROUND(AVG(score),2) AS a FROM ratings WHERE status='published'")?.a ?? null,
      },
    });
  }),
);

const moderateSchema = z.object({
  reason: z.string().trim().min(5, 'Record why this rating is being moderated.').max(800),
});

adminRatingsRouter.post(
  '/:id/hide',
  handler((req, res) => {
    const admin = currentUser(req);
    const body = parseBody(moderateSchema, req.body);
    const rating = get<{ id: string; user_id: string; content_type: string; content_id: string }>(
      'SELECT id, user_id, content_type, content_id FROM ratings WHERE id = ?',
      req.params.id,
    );
    if (!rating) throw notFound('That rating does not exist.');
    run("UPDATE ratings SET status = 'hidden', updated_at = ? WHERE id = ?", nowIso(), rating.id);
    notify({
      userId: rating.user_id,
      kind: 'moderation',
      title: 'Your review was hidden',
      body: body.reason,
      link: '/app/support',
    });
    auditFromRequest(req, 'ratings.hidden', 'rating', rating.id, { reason: body.reason });
    res.json({ ok: true });
  }),
);

adminRatingsRouter.post(
  '/:id/restore',
  handler((req, res) => {
    const body = parseBody(moderateSchema.optional(), req.body ?? {});
    const rating = get<{ id: string; status: string }>('SELECT id, status FROM ratings WHERE id = ?', req.params.id);
    if (!rating) throw notFound('That rating does not exist.');
    if (rating.status === 'published') throw conflict('That rating is already visible.');
    run("UPDATE ratings SET status = 'published', updated_at = ? WHERE id = ?", nowIso(), rating.id);
    auditFromRequest(req, 'ratings.restored', 'rating', rating.id, { reason: body?.reason ?? '' });
    res.json({ ok: true });
  }),
);

// ------------------------------------------------------------------ disputes

adminRatingsRouter.get(
  '/disputes',
  handler((req, res) => {
    const query = parseQuery(
      z.object({
        status: z.enum(['all', 'pending', 'upheld', 'rejected']).optional(),
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(100).optional(),
      }),
      req.query,
    );
    const p = paging({ page: query.page, pageSize: query.pageSize ?? 25 });
    const where = new Where();
    where.addIf(query.status && query.status !== 'all', 'd.status = ?', query.status);

    const rows = all(
      `SELECT d.id, d.reason, d.status, d.resolution, d.created_at, d.resolved_at,
              d.rating_id, r.score, r.review_text, r.content_type, r.content_id,
              u.id AS raised_by_id, u.username AS raised_by_username,
              ru.username AS author_username, ru.id AS author_id
         FROM rating_disputes d
         JOIN ratings r ON r.id = d.rating_id
         JOIN users u ON u.id = d.raised_by
         JOIN users ru ON ru.id = r.user_id
         ${where.build()}
        ORDER BY CASE d.status WHEN 'pending' THEN 0 ELSE 1 END, d.created_at DESC
        LIMIT ? OFFSET ?`,
      ...where.params,
      p.pageSize,
      p.offset,
    );
    const total = count(`SELECT COUNT(*) AS total FROM rating_disputes d ${where.build()}`, ...where.params);
    res.json({
      ...pageResult(
        rows.map((r: any) => ({ ...r, contentTitle: contentTitle(r.content_type, r.content_id) })),
        total,
        p,
      ),
    });
  }),
);

const disputeSchema = z.object({
  status: z.enum(['upheld', 'rejected']),
  resolution: z.string().trim().min(5, 'Record the outcome.').max(1000),
  hideRating: z.boolean().optional().default(false),
});

adminRatingsRouter.post(
  '/disputes/:id/decision',
  handler((req, res) => {
    const admin = currentUser(req);
    const body = parseBody(disputeSchema, req.body);
    const dispute = get<{ id: string; status: string; rating_id: string; raised_by: string }>(
      'SELECT id, status, rating_id, raised_by FROM rating_disputes WHERE id = ?',
      req.params.id,
    );
    if (!dispute) throw notFound('That dispute does not exist.');
    if (dispute.status !== 'pending') throw conflict('That dispute has already been decided.');

    tx(() => {
      run(
        'UPDATE rating_disputes SET status = ?, resolution = ?, resolved_by = ?, resolved_at = ? WHERE id = ?',
        body.status,
        body.resolution,
        admin.id,
        nowIso(),
        dispute.id,
      );
      if (body.status === 'upheld' && body.hideRating) {
        run("UPDATE ratings SET status = 'hidden', updated_at = ? WHERE id = ?", nowIso(), dispute.rating_id);
      }
    });

    notify({
      userId: dispute.raised_by,
      kind: 'moderation',
      title: body.status === 'upheld' ? 'Rating dispute upheld' : 'Rating dispute declined',
      body: body.resolution,
      link: '/app/support',
    });
    auditFromRequest(req, 'ratings.dispute_decided', 'rating_dispute', dispute.id, {
      status: body.status,
      hideRating: body.hideRating,
    });
    res.json({ ok: true });
  }),
);

// ------------------------------------------------------------------ reputation

adminRatingsRouter.get(
  '/reputation',
  handler((req, res) => {
    const query = parseQuery(
      z.object({
        q: z.string().trim().max(120).optional(),
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(100).optional(),
      }),
      req.query,
    );
    const p = paging({ page: query.page, pageSize: query.pageSize ?? 25 });
    const where = new Where().add("u.role IN ('creator','admin')");
    where.addIf(query.q, '(u.username LIKE ? OR u.display_name LIKE ?)', `%${query.q}%`, `%${query.q}%`);

    const rows = all(
      `SELECT u.id, u.username, u.display_name, u.role, u.account_status,
              (SELECT COUNT(*) FROM quizzes q WHERE q.creator_id = u.id AND q.status='approved') AS approved_quizzes,
              (SELECT COUNT(*) FROM polls p WHERE p.creator_id = u.id AND p.status='published') AS published_polls,
              (SELECT COUNT(*) FROM ratings r WHERE r.status='published' AND (
                 (r.content_type='quiz' AND r.content_id IN (SELECT id FROM quizzes WHERE creator_id = u.id)) OR
                 (r.content_type='poll' AND r.content_id IN (SELECT id FROM polls WHERE creator_id = u.id)))) AS rating_count,
              (SELECT ROUND(AVG(r.score),2) FROM ratings r WHERE r.status='published' AND (
                 (r.content_type='quiz' AND r.content_id IN (SELECT id FROM quizzes WHERE creator_id = u.id)) OR
                 (r.content_type='poll' AND r.content_id IN (SELECT id FROM polls WHERE creator_id = u.id)))) AS average_rating,
              (SELECT COUNT(*) FROM moderation_reviews m WHERE m.decision='approved' AND (
                 (m.content_type='quiz' AND m.content_id IN (SELECT id FROM quizzes WHERE creator_id = u.id)) OR
                 (m.content_type='poll' AND m.content_id IN (SELECT id FROM polls WHERE creator_id = u.id)))) AS approvals,
              (SELECT COUNT(*) FROM moderation_reviews m WHERE m.decision='rejected' AND (
                 (m.content_type='quiz' AND m.content_id IN (SELECT id FROM quizzes WHERE creator_id = u.id)) OR
                 (m.content_type='poll' AND m.content_id IN (SELECT id FROM polls WHERE creator_id = u.id)))) AS rejections
         FROM users u ${where.build()}
        ORDER BY average_rating DESC NULLS LAST, rating_count DESC
        LIMIT ? OFFSET ?`,
      ...where.params,
      p.pageSize,
      p.offset,
    );
    const total = count(`SELECT COUNT(*) AS total FROM users u ${where.build()}`, ...where.params);
    res.json(pageResult(rows, total, p));
  }),
);

/**
 * Rating abuse signals. Each row is a real pattern found in the data —
 * nothing is inferred or invented.
 */
adminRatingsRouter.get(
  '/abuse',
  handler((_req, res) => {
    const burstRatings = all(
      `SELECT u.id AS user_id, u.username, u.display_name, COUNT(*) AS ratings,
              MIN(r.created_at) AS first_at, MAX(r.created_at) AS last_at
         FROM ratings r JOIN users u ON u.id = r.user_id
        WHERE r.created_at >= datetime('now', '-1 day')
        GROUP BY u.id HAVING COUNT(*) >= 5
        ORDER BY ratings DESC LIMIT 50`,
    );

    const singleScoreRaters = all(
      `SELECT u.id AS user_id, u.username, u.display_name, r.score, COUNT(*) AS ratings
         FROM ratings r JOIN users u ON u.id = r.user_id
        GROUP BY u.id, r.score HAVING COUNT(*) >= 5
        ORDER BY ratings DESC LIMIT 50`,
    );

    const disputed = all(
      `SELECT r.id AS rating_id, r.content_type, r.content_id, r.score,
              COUNT(d.id) AS disputes, MAX(d.created_at) AS last_disputed_at
         FROM ratings r JOIN rating_disputes d ON d.rating_id = r.id
        GROUP BY r.id ORDER BY disputes DESC, last_disputed_at DESC LIMIT 50`,
    ).map((r: any) => ({ ...r, contentTitle: contentTitle(r.content_type, r.content_id) }));

    res.json({ burstRatings, singleScoreRaters, disputed, generatedAt: nowIso() });
  }),
);

export { run };
