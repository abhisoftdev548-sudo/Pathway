import { Router } from 'express';
import { z } from 'zod';
import { all, count, get, nowIso, run, tx } from '../../db/index.js';
import { conflict, notFound, validationError } from '../../lib/errors.js';
import { handler, parseBody, parseQuery } from '../../lib/http.js';
import { auditFromRequest } from '../../lib/audit.js';
import { currentUser } from '../../lib/auth.js';
import { pageResult, paging, Where } from '../../lib/paging.js';
import { notify } from '../../lib/notify.js';

export const adminModerationRouter = Router();

// ------------------------------------------------------------------ reports

const reportsSchema = z.object({
  status: z.enum(['all', 'pending', 'reviewing', 'resolved', 'dismissed']).optional(),
  targetType: z.enum(['all', 'content', 'quiz', 'poll', 'review', 'user']).optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

function targetTitle(targetType: string, targetId: string): string {
  switch (targetType) {
    case 'quiz':
      return get<{ t: string }>('SELECT title AS t FROM quizzes WHERE id = ?', targetId)?.t ?? '(deleted quiz)';
    case 'poll':
      return get<{ t: string }>('SELECT question AS t FROM polls WHERE id = ?', targetId)?.t ?? '(deleted poll)';
    case 'review':
      return get<{ t: string }>('SELECT substr(review_text,1,80) AS t FROM ratings WHERE id = ?', targetId)?.t ?? '(deleted review)';
    case 'user':
      return get<{ t: string }>('SELECT username AS t FROM users WHERE id = ?', targetId)?.t ?? '(deleted user)';
    default:
      return targetId;
  }
}

adminModerationRouter.get(
  '/reports',
  handler((req, res) => {
    const query = parseQuery(reportsSchema, req.query);
    const p = paging({ page: query.page, pageSize: query.pageSize ?? 25 });
    const where = new Where();
    where.addIf(query.status && query.status !== 'all', 'r.status = ?', query.status);
    where.addIf(query.targetType && query.targetType !== 'all' && query.targetType !== 'content', 'r.target_type = ?', query.targetType);
    where.addIf(query.targetType === 'content', "r.target_type IN ('quiz','poll')");
    where.addIf(query.q, '(r.reason LIKE ? OR r.details LIKE ?)', `%${query.q}%`, `%${query.q}%`);

    const rows = all(
      `SELECT r.id, r.target_type, r.target_id, r.reason, r.details, r.status, r.resolution, r.created_at, r.resolved_at,
              u.id AS reporter_id, u.username AS reporter_username, u.display_name AS reporter_name,
              ru.username AS resolved_by_username
         FROM reports r
         JOIN users u ON u.id = r.reporter_id
         LEFT JOIN users ru ON ru.id = r.resolved_by
         ${where.build()}
        ORDER BY CASE r.status WHEN 'pending' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END, r.created_at DESC
        LIMIT ? OFFSET ?`,
      ...where.params,
      p.pageSize,
      p.offset,
    );
    const total = count(
      `SELECT COUNT(*) AS total FROM reports r JOIN users u ON u.id = r.reporter_id ${where.build()}`,
      ...where.params,
    );

    res.json({
      ...pageResult(
        rows.map((r: any) => ({ ...r, targetTitle: targetTitle(r.target_type, r.target_id) })),
        total,
        p,
      ),
      summary: {
        pending: count("SELECT COUNT(*) AS t FROM reports WHERE status = 'pending'"),
        reviewing: count("SELECT COUNT(*) AS t FROM reports WHERE status = 'reviewing'"),
        resolved: count("SELECT COUNT(*) AS t FROM reports WHERE status = 'resolved'"),
        dismissed: count("SELECT COUNT(*) AS t FROM reports WHERE status = 'dismissed'"),
      },
    });
  }),
);

const resolveSchema = z.object({
  status: z.enum(['reviewing', 'resolved', 'dismissed']),
  resolution: z.string().trim().min(5, 'Record what you decided and why.').max(1000),
});

adminModerationRouter.post(
  '/reports/:id/resolve',
  handler((req, res) => {
    const admin = currentUser(req);
    const body = parseBody(resolveSchema, req.body);
    const report = get<{ id: string; reporter_id: string; target_type: string; target_id: string }>(
      'SELECT id, reporter_id, target_type, target_id FROM reports WHERE id = ?',
      req.params.id,
    );
    if (!report) throw notFound('That report does not exist.');

    run(
      'UPDATE reports SET status = ?, resolution = ?, resolved_by = ?, resolved_at = ? WHERE id = ?',
      body.status,
      body.resolution,
      admin.id,
      nowIso(),
      report.id,
    );
    notify({
      userId: report.reporter_id,
      kind: 'moderation',
      title: 'Your report was reviewed',
      body: body.resolution,
      link: '/app/support',
    });
    auditFromRequest(req, 'moderation.report_resolved', 'report', report.id, {
      status: body.status,
      targetType: report.target_type,
      targetId: report.target_id,
    });
    res.json({ ok: true });
  }),
);

// ------------------------------------------------------------------ appeals

const appealsSchema = z.object({
  status: z.enum(['all', 'pending', 'accepted', 'rejected']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

adminModerationRouter.get(
  '/appeals',
  handler((req, res) => {
    const query = parseQuery(appealsSchema, req.query);
    const p = paging({ page: query.page, pageSize: query.pageSize ?? 25 });
    const where = new Where();
    where.addIf(query.status && query.status !== 'all', 'a.status = ?', query.status);

    const rows = all(
      `SELECT a.id, a.content_type, a.content_id, a.reason, a.status, a.resolution, a.created_at, a.resolved_at,
              u.id AS submitter_id, u.username, u.display_name
         FROM appeals a JOIN users u ON u.id = a.submitted_by
         ${where.build()}
        ORDER BY CASE a.status WHEN 'pending' THEN 0 ELSE 1 END, a.created_at DESC
        LIMIT ? OFFSET ?`,
      ...where.params,
      p.pageSize,
      p.offset,
    );
    const total = count(`SELECT COUNT(*) AS total FROM appeals a ${where.build()}`, ...where.params);
    res.json({
      ...pageResult(
        rows.map((r: any) => ({ ...r, contentTitle: targetTitle(r.content_type, r.content_id) })),
        total,
        p,
      ),
    });
  }),
);

const appealDecisionSchema = z.object({
  status: z.enum(['accepted', 'rejected']),
  resolution: z.string().trim().min(5, 'Record the outcome of the appeal.').max(1000),
});

adminModerationRouter.post(
  '/appeals/:id/decision',
  handler((req, res) => {
    const admin = currentUser(req);
    const body = parseBody(appealDecisionSchema, req.body);
    const appeal = get<{ id: string; content_type: string; content_id: string; submitted_by: string }>(
      'SELECT id, content_type, content_id, submitted_by FROM appeals WHERE id = ?',
      req.params.id,
    );
    if (!appeal) throw notFound('That appeal does not exist.');

    tx(() => {
      run(
        'UPDATE appeals SET status = ?, resolution = ?, resolved_by = ?, resolved_at = ? WHERE id = ?',
        body.status,
        body.resolution,
        admin.id,
        nowIso(),
        appeal.id,
      );
      if (body.status === 'accepted') {
        // An accepted appeal returns the content to the review queue.
        const table = appeal.content_type === 'quiz' ? 'quizzes' : 'polls';
        run(`UPDATE ${table} SET status = 'pending_review', submitted_at = ?, review_notes = NULL, updated_at = ? WHERE id = ?`, nowIso(), nowIso(), appeal.content_id);
      }
    });

    notify({
      userId: appeal.submitted_by,
      kind: 'moderation',
      title: body.status === 'accepted' ? 'Appeal accepted' : 'Appeal declined',
      body: body.resolution,
      link: appeal.content_type === 'quiz' ? `/app/quizzes/${appeal.content_id}` : `/app/polls/${appeal.content_id}`,
    });
    auditFromRequest(req, 'moderation.appeal_decided', 'appeal', appeal.id, {
      status: body.status,
      contentType: appeal.content_type,
      contentId: appeal.content_id,
    });
    res.json({ ok: true });
  }),
);

// ------------------------------------------------------------------ history

adminModerationRouter.get(
  '/history',
  handler((req, res) => {
    const query = parseQuery(
      z.object({
        decision: z.string().trim().optional(),
        reviewer: z.string().trim().optional(),
        contentType: z.enum(['all', 'quiz', 'poll']).optional(),
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(100).optional(),
      }),
      req.query,
    );
    const p = paging({ page: query.page, pageSize: query.pageSize ?? 25 });
    const where = new Where();
    where.addIf(query.decision && query.decision !== 'all', 'm.decision = ?', query.decision);
    where.addIf(query.contentType && query.contentType !== 'all', 'm.content_type = ?', query.contentType);
    where.addIf(query.reviewer, '(u.username LIKE ? OR u.display_name LIKE ?)', `%${query.reviewer}%`, `%${query.reviewer}%`);

    const rows = all(
      `SELECT m.id, m.content_type, m.content_id, m.decision, m.reason, m.notes, m.quality_rating, m.version, m.created_at,
              u.username AS reviewer_username, u.display_name AS reviewer_name
         FROM moderation_reviews m LEFT JOIN users u ON u.id = m.reviewer_id
         ${where.build()}
        ORDER BY m.created_at DESC LIMIT ? OFFSET ?`,
      ...where.params,
      p.pageSize,
      p.offset,
    );
    const total = count(
      `SELECT COUNT(*) AS total FROM moderation_reviews m LEFT JOIN users u ON u.id = m.reviewer_id ${where.build()}`,
      ...where.params,
    );
    res.json({
      ...pageResult(
        rows.map((r: any) => ({ ...r, contentTitle: targetTitle(r.content_type, r.content_id) })),
        total,
        p,
      ),
      decisions: all('SELECT decision, COUNT(*) AS total FROM moderation_reviews GROUP BY decision ORDER BY total DESC'),
    });
  }),
);

adminModerationRouter.get(
  '/reported-content',
  handler((req, res) => {
    const query = parseQuery(
      z.object({ page: z.coerce.number().int().min(1).optional(), pageSize: z.coerce.number().int().min(1).max(100).optional() }),
      req.query,
    );
    const p = paging({ page: query.page, pageSize: query.pageSize ?? 25 });

    const rows = all(
      `SELECT r.target_type, r.target_id, COUNT(*) AS report_count,
              MAX(r.created_at) AS last_reported_at,
              SUM(CASE WHEN r.status = 'pending' THEN 1 ELSE 0 END) AS open_reports
         FROM reports r
        WHERE r.target_type IN ('quiz','poll')
        GROUP BY r.target_type, r.target_id
        ORDER BY open_reports DESC, report_count DESC, last_reported_at DESC
        LIMIT ? OFFSET ?`,
      p.pageSize,
      p.offset,
    );
    const total = count(
      'SELECT COUNT(*) AS total FROM (SELECT 1 FROM reports WHERE target_type IN (\'quiz\',\'poll\') GROUP BY target_type, target_id)',
    );
    res.json({
      ...pageResult(
        rows.map((r: any) => ({ ...r, contentTitle: targetTitle(r.target_type, r.target_id) }),
        ),
        total,
        p,
      ),
    });
  }),
);

export { validationError, conflict };
