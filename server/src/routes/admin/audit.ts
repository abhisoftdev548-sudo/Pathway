import { Router } from 'express';
import { z } from 'zod';
import { all, count, get } from '../../db/index.js';
import { notFound } from '../../lib/errors.js';
import { handler, parseQuery } from '../../lib/http.js';
import { auditFromRequest } from '../../lib/audit.js';
import { currentUser } from '../../lib/auth.js';
import { pageResult, paging, Where } from '../../lib/paging.js';

export const adminAuditRouter = Router();

const auditSchema = z.object({
  action: z.string().trim().optional(),
  actor: z.string().trim().optional(),
  targetType: z.string().trim().optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
});

adminAuditRouter.get(
  '/logs',
  handler((req, res) => {
    const query = parseQuery(auditSchema, req.query);
    const p = paging({ page: query.page, pageSize: query.pageSize ?? 50 });
    const where = new Where();
    where.addIf(query.action && query.action !== 'all', 'a.action = ?', query.action);
    where.addIf(query.actor, 'a.actor_label LIKE ?', `%${query.actor}%`);
    where.addIf(query.targetType && query.targetType !== 'all', 'a.target_type = ?', query.targetType);
    where.addIf(query.from, 'a.created_at >= ?', query.from);
    where.addIf(query.to, 'a.created_at <= ?', query.to);

    const rows = all(
      `SELECT a.id, a.actor_label, a.action, a.target_type, a.target_id, a.metadata, a.ip, a.created_at
         FROM audit_logs a ${where.build()}
        ORDER BY a.created_at DESC, a.rowid DESC LIMIT ? OFFSET ?`,
      ...where.params,
      p.pageSize,
      p.offset,
    );
    const total = count(`SELECT COUNT(*) AS total FROM audit_logs a ${where.build()}`, ...where.params);
    res.json({
      ...pageResult(rows, total, p),
      actions: all('SELECT action, COUNT(*) AS total FROM audit_logs GROUP BY action ORDER BY total DESC LIMIT 60'),
    });
  }),
);

adminAuditRouter.get(
  '/security-events',
  handler((req, res) => {
    const query = parseQuery(
      z.object({
        event: z.string().trim().optional(),
        outcome: z.enum(['all', 'success', 'failure', 'blocked']).optional(),
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(200).optional(),
      }),
      req.query,
    );
    const p = paging({ page: query.page, pageSize: query.pageSize ?? 50 });
    const where = new Where();
    where.addIf(query.event && query.event !== 'all', 's.event = ?', query.event);
    where.addIf(query.outcome && query.outcome !== 'all', 's.outcome = ?', query.outcome);

    const rows = all(
      `SELECT s.id, s.event, s.outcome, s.ip, s.user_agent, s.metadata, s.created_at, u.username
         FROM security_events s LEFT JOIN users u ON u.id = s.user_id
         ${where.build()}
        ORDER BY s.created_at DESC, s.rowid DESC LIMIT ? OFFSET ?`,
      ...where.params,
      p.pageSize,
      p.offset,
    );
    const total = count(
      `SELECT COUNT(*) AS total FROM security_events s LEFT JOIN users u ON u.id = s.user_id ${where.build()}`,
      ...where.params,
    );
    res.json({
      ...pageResult(rows, total, p),
      events: all('SELECT event, outcome, COUNT(*) AS total FROM security_events GROUP BY event, outcome ORDER BY total DESC'),
    });
  }),
);

// ------------------------------------------------------------------ exports

type ExportType = 'users' | 'quizzes' | 'polls' | 'transactions' | 'audit' | 'moderation' | 'ratings';

const EXPORT_QUERIES: Record<ExportType, { sql: string; columns: string[] }> = {
  users: {
    sql: `SELECT id, username, display_name, email, role, account_status, created_at, last_active_at FROM users ORDER BY created_at`,
    columns: ['id', 'username', 'displayName', 'email', 'role', 'accountStatus', 'createdAt', 'lastActiveAt'],
  },
  quizzes: {
    sql: `SELECT q.id, q.title, q.status, u.username AS creator, c.name AS category, d.name AS difficulty,
                 q.entry_fee, q.reward_coins, q.passing_score, q.total_attempts, q.published_at, q.created_at
            FROM quizzes q JOIN users u ON u.id = q.creator_id
            LEFT JOIN categories c ON c.id = q.category_id
            LEFT JOIN difficulty_levels d ON d.id = q.difficulty_id
           ORDER BY q.created_at`,
    columns: ['id', 'title', 'status', 'creator', 'category', 'difficulty', 'entryFee', 'rewardCoins', 'passingScore', 'attempts', 'publishedAt', 'createdAt'],
  },
  polls: {
    sql: `SELECT p.id, p.question, p.status, u.username AS creator, p.closes_at, p.published_at, p.created_at,
                 (SELECT COUNT(*) FROM poll_votes v WHERE v.poll_id = p.id) AS votes
            FROM polls p JOIN users u ON u.id = p.creator_id ORDER BY p.created_at`,
    columns: ['id', 'question', 'status', 'creator', 'closesAt', 'publishedAt', 'createdAt', 'votes'],
  },
  transactions: {
    sql: `SELECT l.id, l.created_at, u.username, l.entry_type, l.amount, l.balance_after, l.description, l.reference_type, l.reference_id
            FROM ledger_entries l JOIN users u ON u.id = l.user_id ORDER BY l.created_at DESC`,
    columns: ['id', 'createdAt', 'username', 'entryType', 'amount', 'balanceAfter', 'description', 'referenceType', 'referenceId'],
  },
  audit: {
    sql: `SELECT id, created_at, actor_label, action, target_type, target_id, ip FROM audit_logs ORDER BY created_at DESC`,
    columns: ['id', 'createdAt', 'actor', 'action', 'targetType', 'targetId', 'ip'],
  },
  moderation: {
    sql: `SELECT m.id, m.created_at, m.content_type, m.content_id, m.decision, m.reason, m.quality_rating, u.username AS reviewer
            FROM moderation_reviews m LEFT JOIN users u ON u.id = m.reviewer_id ORDER BY m.created_at DESC`,
    columns: ['id', 'createdAt', 'contentType', 'contentId', 'decision', 'reason', 'qualityRating', 'reviewer'],
  },
  ratings: {
    sql: `SELECT r.id, r.created_at, r.content_type, r.content_id, u.username, r.score, r.status, r.review_text
            FROM ratings r JOIN users u ON u.id = r.user_id ORDER BY r.created_at DESC`,
    columns: ['id', 'createdAt', 'contentType', 'contentId', 'username', 'score', 'status', 'review'],
  },
};

function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.join(',');
  const body = rows.map((row) => columns.map((c) => escape(row[c])).join(',')).join('\n');
  return `${header}\n${body}`;
}

adminAuditRouter.get(
  '/export/:type',
  handler((req, res) => {
    const admin = currentUser(req);
    const type = req.params.type as ExportType;
    const definition = EXPORT_QUERIES[type];
    if (!definition) throw notFound('That report type is not available.');

    const limitParam = Number(req.query.limit);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50_000) : 10_000;
    const rows = all(`${definition.sql} LIMIT ?`, limit) as Record<string, unknown>[];

    auditFromRequest(req, 'admin.report_exported', 'report', type, { rows: rows.length, limit });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="quizsphere-${type}-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(toCsv(rows, definition.columns));
  }),
);

adminAuditRouter.get(
  '/reports/counts',
  handler((_req, res) => {
    const counts: Record<string, number> = {};
    for (const [type, def] of Object.entries(EXPORT_QUERIES)) {
      counts[type] = count(`SELECT COUNT(*) AS t FROM (${def.sql})`);
    }
    res.json({ counts });
  }),
);

export { get };
