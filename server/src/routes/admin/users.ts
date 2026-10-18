import { Router } from 'express';
import { z } from 'zod';
import { all, count, get, nowIso, run, tx } from '../../db/index.js';
import { conflict, notFound, validationError } from '../../lib/errors.js';
import { handler, parseBody, parseQuery } from '../../lib/http.js';
import { auditFromRequest } from '../../lib/audit.js';
import { currentUser } from '../../lib/auth.js';
import { pageResult, paging, Where } from '../../lib/paging.js';
import { revokeAllSessions } from '../../lib/auth.js';
import { getWallet, ledgerForUser } from '../../lib/wallet.js';
import { notify } from '../../lib/notify.js';

export const adminUsersRouter = Router();

/**
 * Never select password_hash or session tokens: administrators must not see
 * authentication secrets.
 */
const USER_COLUMNS = `
  u.id, u.email, u.username, u.display_name, u.role, u.account_status, u.email_verified_at,
  u.created_at, u.updated_at, u.last_active_at, u.suspended_at, u.suspended_reason, u.bio,
  (SELECT COUNT(*) FROM quizzes q WHERE q.creator_id = u.id) AS quiz_count,
  (SELECT COUNT(*) FROM quizzes q WHERE q.creator_id = u.id AND q.status='approved') AS quiz_published_count,
  (SELECT COUNT(*) FROM polls p WHERE p.creator_id = u.id) AS poll_count,
  (SELECT COUNT(*) FROM quiz_attempts a WHERE a.user_id = u.id AND a.status='submitted') AS attempt_count,
  (SELECT COUNT(*) FROM reports r WHERE r.target_type='user' AND r.target_id = u.id) AS report_count
`;

const listSchema = z.object({
  q: z.string().trim().max(120).optional(),
  role: z.enum(['all', 'user', 'creator', 'admin']).optional(),
  status: z.enum(['all', 'active', 'suspended', 'pending_verification']).optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  sort: z.enum(['newest', 'oldest', 'activity', 'username']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

adminUsersRouter.get(
  '/',
  handler((req, res) => {
    const query = parseQuery(listSchema, req.query);
    const p = paging({ page: query.page, pageSize: query.pageSize ?? 25 });
    const where = new Where();
    where.addIf(query.q, '(u.username LIKE ? OR u.display_name LIKE ? OR u.email LIKE ?)', ...lk(query.q));
    where.addIf(query.role && query.role !== 'all', 'u.role = ?', query.role);
    where.addIf(
      query.status && query.status !== 'all' && query.status !== 'pending_verification',
      'u.account_status = ?',
      query.status,
    );
    // Verification state is derived from the email verification timestamp, not
    // the account status: an account can be active but unverified.
    where.addIf(query.status === 'pending_verification', 'u.email_verified_at IS NULL');
    where.addIf(query.from, 'u.created_at >= ?', query.from);
    where.addIf(query.to, 'u.created_at <= ?', query.to);

    const order = {
      newest: 'u.created_at DESC',
      oldest: 'u.created_at ASC',
      activity: 'u.last_active_at DESC NULLS LAST',
      username: 'u.username ASC',
    }[query.sort ?? 'newest'];

    const rows = all(
      `SELECT ${USER_COLUMNS} FROM users u ${where.build()} ORDER BY ${order} LIMIT ? OFFSET ?`,
      ...where.params,
      p.pageSize,
      p.offset,
    );
    const total = count(`SELECT COUNT(*) AS total FROM users u ${where.build()}`, ...where.params);
    res.json(pageResult(rows, total, p));
  }),
);

function lk(term?: string): string[] {
  const v = `%${term ?? ''}%`;
  return [v, v, v];
}

/** Distinct values that populate the filter controls. */
adminUsersRouter.get(
  '/meta/filters',
  handler((_req, res) => {
    res.json({
      roles: all('SELECT role, COUNT(*) AS total FROM users GROUP BY role ORDER BY role'),
      statuses: all('SELECT account_status AS status, COUNT(*) AS total FROM users GROUP BY account_status'),
      earliestRegistration: get<{ d: string | null }>('SELECT MIN(created_at) AS d FROM users')?.d ?? null,
    });
  }),
);

adminUsersRouter.get(
  '/:id',
  handler((req, res) => {
    const user = get<any>(`SELECT ${USER_COLUMNS} FROM users u WHERE u.id = ?`, req.params.id);
    if (!user) throw notFound('That user does not exist.');

    const wallet = getWallet(user.id);
    const ledger = ledgerForUser(user.id, { limit: 20, offset: 0 });

    res.json({
      user: {
        ...user,
        emailVerified: !!user.email_verified_at,
      },
      wallet,
      recentTransactions: ledger.rows.map((r) => ({
        id: r.id,
        amount: r.amount,
        balanceAfter: r.balance_after,
        entryType: r.entry_type,
        description: r.description,
        createdAt: r.created_at,
      })),
      performance: get(
        `SELECT COUNT(*) AS attempts,
                SUM(CASE WHEN passed=1 THEN 1 ELSE 0 END) AS passes,
                ROUND(AVG(score_percent),1) AS average_score,
                MAX(score_percent) AS best_score,
                SUM(entry_fee_charged) AS fees_paid,
                SUM(reward_paid) AS rewards_earned
           FROM quiz_attempts WHERE user_id = ? AND status = 'submitted'`,
        user.id,
      ) ?? { attempts: 0, passes: 0, average_score: null, best_score: null, fees_paid: 0, rewards_earned: 0 },
      content: {
        quizzes: all(
          `SELECT id, title, status, submitted_at, published_at, total_attempts, entry_fee, reward_coins
             FROM quizzes WHERE creator_id = ? ORDER BY updated_at DESC LIMIT 50`,
          user.id,
        ),
        polls: all(
          `SELECT p.id, p.question AS title, p.status, p.published_at, p.closes_at,
                  (SELECT COUNT(*) FROM poll_votes v WHERE v.poll_id = p.id) AS votes
             FROM polls p WHERE p.creator_id = ? ORDER BY updated_at DESC LIMIT 50`,
          user.id,
        ),
      },
      moderationHistory: all(
        `SELECT m.id, m.content_type, m.content_id, m.decision, m.reason, m.created_at, m.quality_rating
           FROM moderation_reviews m
          WHERE (m.content_type='quiz' AND m.content_id IN (SELECT id FROM quizzes WHERE creator_id = ?))
             OR (m.content_type='poll' AND m.content_id IN (SELECT id FROM polls WHERE creator_id = ?))
          ORDER BY m.created_at DESC LIMIT 30`,
        user.id,
        user.id,
      ),
      reportsAgainst: all(
        `SELECT r.id, r.target_type, r.target_id, r.reason, r.details, r.status, r.created_at, u.username AS reporter
           FROM reports r JOIN users u ON u.id = r.reporter_id
          WHERE r.target_type='user' AND r.target_id = ? ORDER BY r.created_at DESC`,
        user.id,
      ),
      reportsBy: all(
        `SELECT r.id, r.target_type, r.target_id, r.reason, r.status, r.created_at
           FROM reports r WHERE r.reporter_id = ? ORDER BY r.created_at DESC LIMIT 30`,
        user.id,
      ),
      auditTrail: all(
        `SELECT id, action, target_type, target_id, metadata, created_at FROM audit_logs
          WHERE actor_id = ? OR (target_type='user' AND target_id = ?)
          ORDER BY created_at DESC LIMIT 40`,
        user.id,
        user.id,
      ),
      sessions: all(
        `SELECT id, created_at, expires_at, last_used_at, ip, user_agent FROM sessions
          WHERE user_id = ? ORDER BY last_used_at DESC LIMIT 10`,
        user.id,
      ).map((s: any) => ({ ...s, user_agent: s.user_agent ? String(s.user_agent).slice(0, 120) : null })),
    });
  }),
);

const actionSchema = z.object({
  reason: z.string().trim().max(800).optional().default(''),
});

adminUsersRouter.post(
  '/:id/suspend',
  handler((req, res) => {
    const admin = currentUser(req);
    const body = parseBody(actionSchema.extend({ reason: z.string().trim().min(5, 'Record a reason for the suspension.').max(800) }), req.body);
    const target = get<{ id: string; role: string; display_name: string }>(
      'SELECT id, role, display_name FROM users WHERE id = ?',
      req.params.id,
    );
    if (!target) throw notFound('That user does not exist.');
    if (target.id === admin.id) throw conflict('You cannot suspend your own account.');

    tx(() => {
      run(
        "UPDATE users SET account_status = 'suspended', suspended_at = ?, suspended_reason = ?, updated_at = ? WHERE id = ?",
        nowIso(),
        body.reason,
        nowIso(),
        target.id,
      );
      revokeAllSessions(target.id);
    });
    notify({
      userId: target.id,
      kind: 'moderation',
      title: 'Account suspended',
      body: body.reason,
      link: '/app/support',
    });
    auditFromRequest(req, 'admin.user_suspended', 'user', target.id, { reason: body.reason });
    res.json({ ok: true });
  }),
);

adminUsersRouter.post(
  '/:id/restore',
  handler((req, res) => {
    const body = parseBody(actionSchema, req.body);
    const target = get<{ id: string; account_status: string }>('SELECT id, account_status FROM users WHERE id = ?', req.params.id);
    if (!target) throw notFound('That user does not exist.');
    if (target.account_status !== 'suspended') throw conflict('That account is not suspended.');
    run(
      "UPDATE users SET account_status = 'active', suspended_at = NULL, suspended_reason = NULL, updated_at = ? WHERE id = ?",
      nowIso(),
      target.id,
    );
    notify({ userId: target.id, kind: 'moderation', title: 'Account restored', body: body.reason || 'Your access has been restored.', link: '/app' });
    auditFromRequest(req, 'admin.user_restored', 'user', target.id, { reason: body.reason });
    res.json({ ok: true });
  }),
);

const roleSchema = z.object({
  role: z.enum(['user', 'creator', 'admin']),
  reason: z.string().trim().min(5, 'Record why the role is changing.').max(800),
});

adminUsersRouter.post(
  '/:id/role',
  handler((req, res) => {
    const admin = currentUser(req);
    const body = parseBody(roleSchema, req.body);
    const target = get<{ id: string; role: string }>('SELECT id, role FROM users WHERE id = ?', req.params.id);
    if (!target) throw notFound('That user does not exist.');
    if (target.id === admin.id) throw conflict('You cannot change your own role.');
    if (target.role === body.role) throw conflict('That user already has this role.');

    const adminCount = count("SELECT COUNT(*) AS t FROM users WHERE role = 'admin' AND account_status = 'active'");
    if (target.role === 'admin' && body.role !== 'admin' && adminCount <= 1) {
      throw conflict('At least one active administrator must remain.');
    }

    run('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', body.role, nowIso(), target.id);
    notify({
      userId: target.id,
      kind: 'system',
      title: 'Your role changed',
      body: `You are now a ${body.role}. ${body.reason}`,
      link: '/app',
    });
    auditFromRequest(req, 'admin.role_changed', 'user', target.id, { from: target.role, to: body.role, reason: body.reason });
    res.json({ ok: true });
  }),
);

adminUsersRouter.post(
  '/:id/verify',
  handler((req, res) => {
    const target = get<{ id: string; email_verified_at: string | null }>(
      'SELECT id, email_verified_at FROM users WHERE id = ?',
      req.params.id,
    );
    if (!target) throw notFound('That user does not exist.');
    if (target.email_verified_at) throw conflict('That address is already verified.');
    run('UPDATE users SET email_verified_at = ?, updated_at = ? WHERE id = ?', nowIso(), nowIso(), target.id);
    auditFromRequest(req, 'admin.user_verified', 'user', target.id, {});
    res.json({ ok: true });
  }),
);

adminUsersRouter.post(
  '/:id/revoke-sessions',
  handler((req, res) => {
    const target = get<{ id: string }>('SELECT id FROM users WHERE id = ?', req.params.id);
    if (!target) throw notFound('That user does not exist.');
    revokeAllSessions(target.id);
    auditFromRequest(req, 'admin.sessions_revoked', 'user', target.id, {});
    res.json({ ok: true });
  }),
);

export { validationError };
