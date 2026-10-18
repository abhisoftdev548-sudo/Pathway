import { Router } from 'express';
import { z } from 'zod';
import { all, count, get, newId, nowIso, run, tx } from '../db/index.js';
import { conflict, notFound } from '../lib/errors.js';
import { handler, parseBody, parseQuery } from '../lib/http.js';
import { auditFromRequest } from '../lib/audit.js';
import { currentUser, requireAuth } from '../lib/auth.js';
import { pageResult, paging } from '../lib/paging.js';
import { getSetting } from '../lib/settings.js';
import { getWallet, ledgerForUser, credit, postEntry } from '../lib/wallet.js';
import { notify, renderTemplate } from '../lib/notify.js';
import { notifyAdmins } from '../lib/notify.js';

export const walletRouter = Router();
walletRouter.use(requireAuth);

walletRouter.get(
  '/',
  handler((req, res) => {
    const user = currentUser(req);
    const wallet = getWallet(user.id);
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);
    const month = get<{ earned: number; spent: number }>(
      `SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END),0) AS earned,
              COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END),0) AS spent
         FROM ledger_entries WHERE user_id = ? AND created_at >= ?`,
      user.id,
      startOfMonth.toISOString(),
    );
    res.json({
      wallet: { ...wallet, earnedThisMonth: month?.earned ?? 0, spentThisMonth: month?.spent ?? 0 },
    });
  }),
);

const txQuery = z.object({
  type: z.string().trim().optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

walletRouter.get(
  '/transactions',
  handler((req, res) => {
    const user = currentUser(req);
    const query = parseQuery(txQuery, req.query);
    const p = paging({ page: query.page, pageSize: query.pageSize ?? 20 });
    const { rows, total } = ledgerForUser(user.id, {
      limit: p.pageSize,
      offset: p.offset,
      entryType: query.type && query.type !== 'all' ? query.type : undefined,
      dateFrom: query.from,
      dateTo: query.to,
    });
    res.json(
      pageResult(
        rows.map((r) => ({
          id: r.id,
          amount: r.amount,
          balanceAfter: r.balance_after,
          entryType: r.entry_type,
          description: r.description,
          referenceType: r.reference_type,
          referenceId: r.reference_id,
          createdAt: r.created_at,
        })),
        total,
        p,
      ),
    );
  }),
);

// ------------------------------------------------------------------ refunds

const refundSchema = z.object({
  attemptId: z.string().min(1, 'Choose the attempt to request a refund for.'),
  reason: z.string().trim().min(10, 'Explain why you are requesting a refund (at least 10 characters).').max(800),
});

walletRouter.get(
  '/refund-requests',
  handler((req, res) => {
    const user = currentUser(req);
    const rows = all(
      `SELECT r.id, r.amount, r.reason, r.status, r.decision_note, r.created_at, r.resolved_at,
              q.title AS quiz_title, a.score_percent
         FROM refund_requests r
         LEFT JOIN quiz_attempts a ON a.id = r.attempt_id
         LEFT JOIN quizzes q ON q.id = a.quiz_id
        WHERE r.user_id = ? ORDER BY r.created_at DESC`,
      user.id,
    );
    res.json({ items: rows });
  }),
);

walletRouter.post(
  '/refund-requests',
  handler((req, res) => {
    const user = currentUser(req);
    const body = parseBody(refundSchema, req.body);
    const limits = getSetting<{ refund_window_hours: number }>('reward_limits', { refund_window_hours: 24 });

    const attempt = get<{
      id: string;
      user_id: string;
      entry_fee_charged: number;
      submitted_at: string | null;
      quiz_id: string;
      title: string;
    }>(
      `SELECT a.id, a.user_id, a.entry_fee_charged, a.submitted_at, a.quiz_id, q.title
         FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id
        WHERE a.id = ?`,
      body.attemptId,
    );
    if (!attempt || attempt.user_id !== user.id) throw notFound('That attempt does not exist.');
    if (attempt.entry_fee_charged <= 0) throw conflict('That attempt had no entry fee to refund.');
    if (!attempt.submitted_at) throw conflict('Only completed attempts can be refunded.');

    const ageHours = (Date.now() - new Date(attempt.submitted_at).getTime()) / 3_600_000;
    if (ageHours > limits.refund_window_hours) {
      throw conflict(`Refunds must be requested within ${limits.refund_window_hours} hours of completing the quiz.`);
    }
    const existing = get(
      "SELECT id FROM refund_requests WHERE attempt_id = ? AND status IN ('pending','approved')",
      attempt.id,
    );
    if (existing) throw conflict('A refund request for this attempt is already open.');

    const id = newId();
    run(
      `INSERT INTO refund_requests (id, user_id, attempt_id, amount, reason, status, created_at)
       VALUES (?,?,?,?,?, 'pending', ?)`,
      id,
      user.id,
      attempt.id,
      attempt.entry_fee_charged,
      body.reason,
      nowIso(),
    );
    auditFromRequest(req, 'refund.requested', 'refund_request', id, { attemptId: attempt.id });
    notifyAdmins({
      kind: 'wallet',
      title: 'New refund request',
      body: `${user.displayName} requested a refund of ${attempt.entry_fee_charged} QCoin.`,
      link: '/admin/qcoin/refunds',
    });
    res.status(201).json({ id });
  }),
);

walletRouter.delete(
  '/refund-requests/:id',
  handler((req, res) => {
    const user = currentUser(req);
    const result = run(
      "DELETE FROM refund_requests WHERE id = ? AND user_id = ? AND status = 'pending'",
      req.params.id,
      user.id,
    );
    if (result.changes === 0) throw notFound('No open refund request found.');
    res.json({ ok: true });
  }),
);

/** Refundable attempts: paid attempts still inside the refund window. */
walletRouter.get(
  '/refundable-attempts',
  handler((req, res) => {
    const user = currentUser(req);
    const limits = getSetting<{ refund_window_hours: number }>('reward_limits', { refund_window_hours: 24 });
    const cutoff = new Date(Date.now() - limits.refund_window_hours * 3_600_000).toISOString();
    const rows = all(
      `SELECT a.id, a.entry_fee_charged, a.submitted_at, a.score_percent, q.title AS quiz_title
         FROM quiz_attempts a
         JOIN quizzes q ON q.id = a.quiz_id
        WHERE a.user_id = ? AND a.status = 'submitted' AND a.entry_fee_charged > 0 AND a.submitted_at >= ?
          AND NOT EXISTS (SELECT 1 FROM refund_requests r WHERE r.attempt_id = a.id AND r.status IN ('pending','approved'))
        ORDER BY a.submitted_at DESC`,
      user.id,
      cutoff,
    );
    res.json({ items: rows, windowHours: limits.refund_window_hours });
  }),
);

export { renderTemplate, credit, postEntry };
