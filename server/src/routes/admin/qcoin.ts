import { Router } from 'express';
import { z } from 'zod';
import { all, count, get, nowIso, run, tx } from '../../db/index.js';
import { conflict, notFound, validationError } from '../../lib/errors.js';
import { handler, parseBody, parseQuery } from '../../lib/http.js';
import { auditFromRequest } from '../../lib/audit.js';
import { currentUser } from '../../lib/auth.js';
import { pageResult, paging, Where, dateRangeTo } from '../../lib/paging.js';
import { getSetting } from '../../lib/settings.js';
import {
  credit,
  debit,
  getBalance,
  getWallet,
  ledgerForAll,
  ledgerForUser,
  ledgerTotals,
  detectAnomalies,
  recomputeBalance,
} from '../../lib/wallet.js';
import { notify, renderTemplate } from '../../lib/notify.js';

export const adminQcoinRouter = Router();

adminQcoinRouter.get(
  '/overview',
  handler((req, res) => {
    const query = parseQuery(
      z.object({ from: z.string().trim().optional(), to: z.string().trim().optional(), days: z.coerce.number().int().min(1).max(365).optional() }),
      req.query,
    );
    const range = dateRangeTo(query.from, query.to);
    const totals = ledgerTotals(range.from, range.to);

    const circulation = get<{ in_circulation: number; accounts: number; zero: number }>(
      `SELECT COALESCE(SUM(balance),0) AS in_circulation,
              COUNT(*) AS accounts,
              SUM(CASE WHEN balance = 0 THEN 1 ELSE 0 END) AS zero
         FROM wallet_accounts`,
    );

    const byType = all(
      `SELECT entry_type, COUNT(*) AS entries,
              SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS issued,
              SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS spent
         FROM ledger_entries WHERE created_at >= ? AND created_at <= ?
        GROUP BY entry_type ORDER BY entries DESC`,
      range.from,
      range.to,
    );

    const anomalies = detectAnomalies();

    res.json({
      range,
      circulation: {
        totalOutstanding: circulation?.in_circulation ?? 0,
        fundedAccounts: circulation?.accounts ?? 0,
        zeroBalanceAccounts: circulation?.zero ?? 0,
      },
      issuedInRange: totals.issued,
      spentInRange: totals.spent,
      entriesInRange: totals.entries,
      byType,
      pending: {
        refunds: count("SELECT COUNT(*) AS t FROM refund_requests WHERE status='pending'"),
        rewardDisputes: count("SELECT COUNT(*) AS t FROM reward_disputes WHERE status='pending'"),
      },
      anomalyCounts: {
        negativeBalances: anomalies.negativeBalances.length,
        mismatched: anomalies.mismatched.length,
        duplicateRewards: anomalies.duplicateRewards.length,
        repeatedRefunds: anomalies.repeatedRefunds.length,
        farming: anomalies.farming.length,
      },
      limits: getSetting('reward_limits', {}),
    });
  }),
);

adminQcoinRouter.get(
  '/transactions',
  handler((req, res) => {
    const query = parseQuery(
      z.object({
        type: z.string().trim().optional(),
        search: z.string().trim().max(120).optional(),
        from: z.string().trim().optional(),
        to: z.string().trim().optional(),
        minAmount: z.coerce.number().int().min(0).optional(),
        maxAmount: z.coerce.number().int().min(0).optional(),
        userId: z.string().trim().optional(),
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(200).optional(),
      }),
      req.query,
    );
    const p = paging({ page: query.page, pageSize: query.pageSize ?? 50 });
    const filter = {
      limit: p.pageSize,
      offset: p.offset,
      entryType: query.type && query.type !== 'all' ? query.type : undefined,
      dateFrom: query.from,
      dateTo: query.to,
      search: query.search,
      minAmount: query.minAmount,
      maxAmount: query.maxAmount,
    };
    const { rows, total } = query.userId
      ? ledgerForUser(query.userId, filter)
      : ledgerForAll(filter);
    res.json(pageResult(rows, total, p));
  }),
);

adminQcoinRouter.get(
  '/anomalies',
  handler((_req, res) => {
    res.json({ ...detectAnomalies(), generatedAt: nowIso() });
  }),
);

// ------------------------------------------------------------------ refunds

adminQcoinRouter.get(
  '/refunds',
  handler((req, res) => {
    const query = parseQuery(
      z.object({
        status: z.enum(['all', 'pending', 'approved', 'rejected']).optional(),
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(100).optional(),
      }),
      req.query,
    );
    const p = paging({ page: query.page, pageSize: query.pageSize ?? 25 });
    const where = new Where();
    where.addIf(query.status && query.status !== 'all', 'r.status = ?', query.status);

    const rows = all(
      `SELECT r.id, r.amount, r.reason, r.status, r.decision_note, r.created_at, r.resolved_at,
              u.id AS user_id, u.username, u.display_name,
              a.id AS attempt_id, a.score_percent, a.submitted_at, a.entry_fee_charged,
              q.id AS quiz_id, q.title AS quiz_title,
              (SELECT COUNT(*) FROM refund_requests r2 WHERE r2.user_id = r.user_id AND r2.status = 'approved') AS prior_approved_refunds
         FROM refund_requests r
         JOIN users u ON u.id = r.user_id
         LEFT JOIN quiz_attempts a ON a.id = r.attempt_id
         LEFT JOIN quizzes q ON q.id = a.quiz_id
         ${where.build()}
        ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.created_at ASC
        LIMIT ? OFFSET ?`,
      ...where.params,
      p.pageSize,
      p.offset,
    );
    const total = count(`SELECT COUNT(*) AS total FROM refund_requests r ${where.build()}`, ...where.params);
    res.json(pageResult(rows, total, p));
  }),
);

const refundDecisionSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  note: z.string().trim().min(5, 'Record the reason for this decision.').max(1000),
});

adminQcoinRouter.post(
  '/refunds/:id/decision',
  handler((req, res) => {
    const admin = currentUser(req);
    const body = parseBody(refundDecisionSchema, req.body);
    const request = get<{ id: string; user_id: string; amount: number; status: string; attempt_id: string | null }>(
      'SELECT id, user_id, amount, status, attempt_id FROM refund_requests WHERE id = ?',
      req.params.id,
    );
    if (!request) throw notFound('That refund request does not exist.');
    if (request.status !== 'pending') throw conflict('That request has already been decided.');

    tx(() => {
      if (body.status === 'approved') {
        credit({
          userId: request.user_id,
          amount: request.amount,
          entryType: 'refund',
          description: 'Approved entry fee refund',
          referenceType: 'refund_request',
          referenceId: request.id,
          actorId: admin.id,
          idempotencyKey: `refund:${request.id}`,
        });
        if (request.attempt_id) {
          run('UPDATE quiz_attempts SET entry_fee_charged = 0 WHERE id = ?', request.attempt_id);
        }
      }
      run(
        'UPDATE refund_requests SET status = ?, decision_note = ?, resolved_by = ?, resolved_at = ? WHERE id = ?',
        body.status,
        body.note,
        admin.id,
        nowIso(),
        request.id,
      );
    });

    notify({
      userId: request.user_id,
      kind: 'wallet',
      title: body.status === 'approved' ? 'Refund approved' : 'Refund declined',
      body: renderTemplate(
        body.status === 'approved' ? 'refund_approved' : 'refund_rejected',
        { amount: request.amount, reason: body.note },
        body.status === 'approved'
          ? `${request.amount} QCoin has been returned to your wallet.`
          : body.note,
      ),
      link: '/app/wallet',
    });
    auditFromRequest(req, 'qcoin.refund_decided', 'refund_request', request.id, {
      status: body.status,
      amount: request.amount,
      note: body.note,
    });
    res.json({ ok: true });
  }),
);

// ------------------------------------------------------------------ reward disputes

adminQcoinRouter.get(
  '/reward-disputes',
  handler((req, res) => {
    const query = parseQuery(
      z.object({
        status: z.enum(['all', 'pending', 'resolved', 'rejected']).optional(),
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
              u.id AS user_id, u.username, u.display_name,
              a.id AS attempt_id, a.score_percent, a.reward_paid, a.entry_fee_charged,
              q.title AS quiz_title
         FROM reward_disputes d
         JOIN users u ON u.id = d.user_id
         LEFT JOIN quiz_attempts a ON a.id = d.attempt_id
         LEFT JOIN quizzes q ON q.id = a.quiz_id
         ${where.build()}
        ORDER BY CASE d.status WHEN 'pending' THEN 0 ELSE 1 END, d.created_at DESC
        LIMIT ? OFFSET ?`,
      ...where.params,
      p.pageSize,
      p.offset,
    );
    const total = count(`SELECT COUNT(*) AS total FROM reward_disputes d ${where.build()}`, ...where.params);
    res.json(pageResult(rows, total, p));
  }),
);

adminQcoinRouter.post(
  '/reward-disputes/:id/decision',
  handler((req, res) => {
    const admin = currentUser(req);
    const body = parseBody(refundDecisionSchema, req.body);
    const dispute = get<{ id: string; status: string; user_id: string }>(
      'SELECT id, status, user_id FROM reward_disputes WHERE id = ?',
      req.params.id,
    );
    if (!dispute) throw notFound('That dispute does not exist.');
    if (dispute.status !== 'pending') throw conflict('That dispute has already been decided.');
    run(
      'UPDATE reward_disputes SET status = ?, resolution = ?, resolved_by = ?, resolved_at = ? WHERE id = ?',
      body.status === 'approved' ? 'resolved' : 'rejected',
      body.note,
      admin.id,
      nowIso(),
      dispute.id,
    );
    notify({
      userId: dispute.user_id,
      kind: 'wallet',
      title: 'Reward dispute updated',
      body: body.note,
      link: '/app/wallet',
    });
    auditFromRequest(req, 'qcoin.reward_dispute_decided', 'reward_dispute', dispute.id, { status: body.status });
    res.json({ ok: true });
  }),
);

// ------------------------------------------------------------------ manual adjustments

const adjustmentSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().int().min(1, 'Enter a whole number of QCoins greater than zero.'),
  direction: z.enum(['credit', 'debit']),
  reason: z.string().trim().min(10, 'Record a clear reason for this adjustment (at least 10 characters).').max(800),
});

adminQcoinRouter.post(
  '/adjustments',
  handler((req, res) => {
    const admin = currentUser(req);
    const body = parseBody(adjustmentSchema, req.body);
    const limits = getSetting<{ max_manual_adjustment: number }>('reward_limits', { max_manual_adjustment: 1000 });
    if (body.amount > limits.max_manual_adjustment) {
      throw validationError('Adjustment exceeds the configured limit.', {
        amount: `The maximum single adjustment is ${limits.max_manual_adjustment} QCoin. Change the limit in Reward Limits first.`,
      });
    }
    const target = get<{ id: string; username: string; display_name: string }>(
      'SELECT id, username, display_name FROM users WHERE id = ?',
      body.userId,
    );
    if (!target) throw notFound('That user does not exist.');

    const balanceBefore = getBalance(target.id);
    const result = tx(() => {
      const posted =
        body.direction === 'credit'
          ? credit({
              userId: target.id,
              amount: body.amount,
              entryType: 'manual_adjustment',
              description: `Manual credit by ${admin.displayName}: ${body.reason}`,
              actorId: admin.id,
            })
          : debit({
              userId: target.id,
              amount: body.amount,
              entryType: 'manual_adjustment',
              description: `Manual debit by ${admin.displayName}: ${body.reason}`,
              actorId: admin.id,
            });
      return posted;
    });

    notify({
      userId: target.id,
      kind: 'wallet',
      title: body.direction === 'credit' ? 'QCoin credit applied' : 'QCoin debit applied',
      body: `${body.direction === 'credit' ? '+' : '-'}${body.amount} QCoin. Reason: ${body.reason}`,
      link: '/app/wallet',
    });

    auditFromRequest(req, 'qcoin.manual_adjustment', 'user', target.id, {
      amount: body.direction === 'credit' ? body.amount : -body.amount,
      reason: body.reason,
      balanceBefore,
      balanceAfter: result.balanceAfter,
      ledgerEntryId: result.entryId,
    });
    res.status(201).json({ ledgerEntryId: result.entryId, balanceAfter: result.balanceAfter });
  }),
);

// ------------------------------------------------------------------ reconciliation

adminQcoinRouter.get(
  '/reconciliation',
  handler((req, res) => {
    const query = parseQuery(
      z.object({
        onlyMismatched: z.coerce.boolean().optional(),
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(200).optional(),
      }),
      req.query,
    );
    const p = paging({ page: query.page, pageSize: query.pageSize ?? 50 });
    const mismatchPredicate = `w.balance <> COALESCE((SELECT SUM(amount) FROM ledger_entries l WHERE l.user_id = w.user_id), 0)`;
    const where = query.onlyMismatched ? `WHERE ${mismatchPredicate}` : '';
    const rows = all(
      `SELECT w.user_id, u.username, u.display_name, w.balance AS stored_balance,
              COALESCE((SELECT SUM(amount) FROM ledger_entries l WHERE l.user_id = w.user_id), 0) AS computed_balance,
              (SELECT COUNT(*) FROM ledger_entries l WHERE l.user_id = w.user_id) AS entry_count,
              w.updated_at
         FROM wallet_accounts w JOIN users u ON u.id = w.user_id
        ${where}
        ORDER BY ABS(${mismatchPredicate.replace('<>', '-')}) DESC, u.username
        LIMIT ? OFFSET ?`,
      p.pageSize,
      p.offset,
    );
    const total = count(
      `SELECT COUNT(*) AS total FROM (
         SELECT w.user_id FROM wallet_accounts w
          WHERE w.balance <> COALESCE((SELECT SUM(amount) FROM ledger_entries l WHERE l.user_id = w.user_id), 0)
       )`,
    );
    res.json({
      ...pageResult(rows, query.onlyMismatched ? total : count('SELECT COUNT(*) AS t FROM wallet_accounts'), p),
      mismatchedTotal: total,
    });
  }),
);

adminQcoinRouter.post(
  '/reconciliation/:userId/repair',
  handler((req, res) => {
    const admin = currentUser(req);
    const body = parseBody(
      z.object({ reason: z.string().trim().min(10, 'Record why this balance is being repaired.').max(800) }),
      req.body,
    );
    const check = recomputeBalance(req.params.userId);
    if (!get('SELECT 1 FROM users WHERE id = ?', req.params.userId)) throw notFound('That user does not exist.');
    if (check.matches) throw conflict('That balance already matches its ledger. No repair needed.');

    const difference = check.computed - check.stored;

    // The ledger is the source of truth. Posting another entry would move the
    // stored balance and the ledger sum by the same amount and leave the drift
    // in place, so a repair recomputes the cached wallet row from the ledger
    // instead and records the change in the audit log.
    const sums = get<{ balance: number; earned: number; spent: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS balance,
              COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS earned,
              COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0) AS spent
         FROM ledger_entries WHERE user_id = ?`,
      req.params.userId,
    )!;

    tx(() => {
      run(
        'UPDATE wallet_accounts SET balance = ?, lifetime_earned = ?, lifetime_spent = ?, updated_at = ? WHERE user_id = ?',
        sums.balance,
        sums.earned,
        sums.spent,
        nowIso(),
        req.params.userId,
      );
    });

    auditFromRequest(req, 'qcoin.balance_repaired', 'user', req.params.userId, {
      stored: check.stored,
      computed: check.computed,
      difference,
      reason: body.reason,
      balanceAfter: sums.balance,
      method: 'recomputed from ledger',
    });
    res.json({ ok: true, balanceAfter: sums.balance });
  }),
);

adminQcoinRouter.get(
  '/policies',
  handler((_req, res) => {
    res.json({
      rewards: getSetting('reward_limits', {}),
      quizRules: getSetting('quiz_rules', {}),
    });
  }),
);

adminQcoinRouter.get(
  '/users/:id/wallet',
  handler((req, res) => {
    const wallet = getWallet(req.params.id);
    const { rows, total } = ledgerForUser(req.params.id, { limit: 50, offset: 0 });
    res.json({ wallet, transactions: rows, total, reconciliation: recomputeBalance(req.params.id) });
  }),
);

export { run };
