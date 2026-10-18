import { get, run, tx, nowIso, newId, all, count } from '../db/index.js';
import { conflict, notFound } from './errors.js';

export type LedgerEntryType =
  | 'signup_bonus'
  | 'entry_fee'
  | 'quiz_reward'
  | 'poll_reward'
  | 'refund'
  | 'manual_adjustment'
  | 'reversal'
  | 'dispute_resolution';

export interface LedgerInput {
  userId: string;
  amount: number; // positive credits, negative debits
  entryType: LedgerEntryType;
  description: string;
  referenceType?: string | null;
  referenceId?: string | null;
  actorId?: string | null;
  idempotencyKey?: string | null;
  /** Set false only where a negative balance is explicitly permitted. */
  allowNegative?: boolean;
}

export interface LedgerResult {
  entryId: string;
  balanceAfter: number;
}

export function ensureWallet(userId: string): void {
  run('INSERT OR IGNORE INTO wallet_accounts (user_id, balance, updated_at) VALUES (?, 0, ?)', userId, nowIso());
}

export function getBalance(userId: string): number {
  const row = get<{ balance: number }>('SELECT balance FROM wallet_accounts WHERE user_id = ?', userId);
  return row?.balance ?? 0;
}

export function getWallet(userId: string): {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  updatedAt: string | null;
} {
  const row = get<{
    balance: number;
    lifetime_earned: number;
    lifetime_spent: number;
    updated_at: string;
  }>('SELECT balance, lifetime_earned, lifetime_spent, updated_at FROM wallet_accounts WHERE user_id = ?', userId);
  if (!row) return { balance: 0, lifetimeEarned: 0, lifetimeSpent: 0, updatedAt: null };
  return {
    balance: row.balance,
    lifetimeEarned: row.lifetime_earned,
    lifetimeSpent: row.lifetime_spent,
    updatedAt: row.updated_at,
  };
}

/**
 * The single write path for QCoin balances.
 *
 * Balance integrity rules enforced here:
 *  - the wallet row is created on demand;
 *  - the balance update is conditional on the resulting balance being >= 0;
 *  - the ledger row and the balance update happen in one transaction;
 *  - an idempotency key prevents duplicate credits/debits for the same event.
 */
export function postEntry(input: LedgerInput): LedgerResult {
  if (!Number.isInteger(input.amount) || input.amount === 0) {
    throw conflict('Ledger amounts must be non-zero whole numbers.');
  }
  return tx(() => {
    ensureWallet(input.userId);

    if (input.idempotencyKey) {
      const existing = get<{ id: string; balance_after: number }>(
        'SELECT id, balance_after FROM ledger_entries WHERE idempotency_key = ?',
        input.idempotencyKey,
      );
      if (existing) return { entryId: existing.id, balanceAfter: existing.balance_after };
    }

    const guard = input.allowNegative ? '' : ' AND balance + ? >= 0';
    // Five amount placeholders in the SET clause (balance, the earned CASE's
    // test and value, the spent CASE's test and value), then updated_at and
    // user_id, then one more amount for the non-negative balance guard.
    const params: any[] = [input.amount, input.amount, input.amount, input.amount, input.amount, nowIso(), input.userId];
    if (!input.allowNegative) params.push(input.amount);

    const update = run(
      `UPDATE wallet_accounts
          SET balance = balance + ?,
              lifetime_earned = lifetime_earned + CASE WHEN ? > 0 THEN ? ELSE 0 END,
              lifetime_spent  = lifetime_spent  + CASE WHEN ? < 0 THEN -? ELSE 0 END,
              updated_at = ?
        WHERE user_id = ?${guard}`,
      ...params,
    );

    if (update.changes !== 1) {
      const wallet = get<{ balance: number }>('SELECT balance FROM wallet_accounts WHERE user_id = ?', input.userId);
      if (!wallet) throw notFound('Wallet account could not be created.');
      throw conflict(`Insufficient QCoin balance. Current balance is ${wallet.balance} QCoin.`);
    }

    const balanceAfter = get<{ balance: number }>(
      'SELECT balance FROM wallet_accounts WHERE user_id = ?',
      input.userId,
    )!.balance;

    const entryId = newId();
    run(
      `INSERT INTO ledger_entries
         (id, user_id, amount, balance_after, entry_type, description, reference_type, reference_id, actor_id, idempotency_key, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      entryId,
      input.userId,
      input.amount,
      balanceAfter,
      input.entryType,
      input.description,
      input.referenceType ?? null,
      input.referenceId ?? null,
      input.actorId ?? null,
      input.idempotencyKey ?? null,
      nowIso(),
    );

    return { entryId, balanceAfter };
  });
}

export function credit(input: Omit<LedgerInput, 'amount'> & { amount: number }): LedgerResult {
  if (input.amount <= 0) throw conflict('Credit amounts must be greater than zero.');
  return postEntry(input);
}

export function debit(input: Omit<LedgerInput, 'amount'> & { amount: number }): LedgerResult {
  if (input.amount <= 0) throw conflict('Debit amounts must be greater than zero.');
  return postEntry({ ...input, amount: -input.amount });
}

/** Recomputes a balance from the ledger. Used by reconciliation tooling. */
export function recomputeBalance(userId: string): { stored: number; computed: number; matches: boolean } {
  const stored = getBalance(userId);
  const computed =
    count('SELECT COALESCE(SUM(amount), 0) AS total FROM ledger_entries WHERE user_id = ?', userId) ?? 0;
  return { stored, computed, matches: stored === computed };
}

export interface LedgerFilter {
  limit: number;
  offset: number;
  entryType?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface LedgerRow {
  id: string;
  amount: number;
  balance_after: number;
  entry_type: string;
  description: string;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
  user_id: string;
  username: string;
  display_name: string;
  actor_username: string | null;
}

export function ledgerForUser(userId: string, filter: LedgerFilter): { rows: LedgerRow[]; total: number } {
  const where: string[] = ['l.user_id = ?'];
  const params: any[] = [userId];
  applyLedgerFilters(filter, where, params);
  const clause = `WHERE ${where.join(' AND ')}`;
  const rows = all<LedgerRow>(
    `SELECT l.id, l.amount, l.balance_after, l.entry_type, l.description, l.reference_type, l.reference_id,
            l.created_at, l.user_id, u.username, u.display_name, a.username AS actor_username
       FROM ledger_entries l
       JOIN users u ON u.id = l.user_id
       LEFT JOIN users a ON a.id = l.actor_id
       ${clause}
      ORDER BY l.created_at DESC, l.rowid DESC
      LIMIT ? OFFSET ?`,
    ...params,
    filter.limit,
    filter.offset,
  );
  const total = count(
    `SELECT COUNT(*) AS total FROM ledger_entries l JOIN users u ON u.id = l.user_id ${clause}`,
    ...params,
  );
  return { rows, total };
}

export function ledgerForAll(filter: LedgerFilter): { rows: LedgerRow[]; total: number } {
  const where: string[] = ['1=1'];
  const params: any[] = [];
  applyLedgerFilters(filter, where, params);
  const clause = `WHERE ${where.join(' AND ')}`;
  const rows = all<LedgerRow>(
    `SELECT l.id, l.amount, l.balance_after, l.entry_type, l.description, l.reference_type, l.reference_id,
            l.created_at, l.user_id, u.username, u.display_name, a.username AS actor_username
       FROM ledger_entries l
       JOIN users u ON u.id = l.user_id
       LEFT JOIN users a ON a.id = l.actor_id
       ${clause}
      ORDER BY l.created_at DESC, l.rowid DESC
      LIMIT ? OFFSET ?`,
    ...params,
    filter.limit,
    filter.offset,
  );
  const total = count(`SELECT COUNT(*) AS total FROM ledger_entries l JOIN users u ON u.id = l.user_id ${clause}`, ...params);
  return { rows, total };
}

function applyLedgerFilters(filter: LedgerFilter, where: string[], params: any[]): void {
  if (filter.entryType) {
    where.push('l.entry_type = ?');
    params.push(filter.entryType);
  }
  if (filter.dateFrom) {
    where.push('l.created_at >= ?');
    params.push(filter.dateFrom);
  }
  if (filter.dateTo) {
    where.push('l.created_at <= ?');
    params.push(filter.dateTo);
  }
  if (filter.minAmount !== undefined) {
    where.push('ABS(l.amount) >= ?');
    params.push(filter.minAmount);
  }
  if (filter.maxAmount !== undefined) {
    where.push('ABS(l.amount) <= ?');
    params.push(filter.maxAmount);
  }
  if (filter.search) {
    where.push('(u.username LIKE ? OR u.display_name LIKE ? OR l.description LIKE ?)');
    const like = `%${filter.search}%`;
    params.push(like, like, like);
  }
}

/** Aggregates used by the QCoin administration overview. */
export function ledgerTotals(rangeFrom: string, rangeTo: string) {
  const row = get<{ issued: number; spent: number; entries: number }>(
    `SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END),0) AS issued,
            COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END),0) AS spent,
            COUNT(*) AS entries
       FROM ledger_entries WHERE created_at >= ? AND created_at <= ?`,
    rangeFrom,
    rangeTo,
  );
  return { issued: row?.issued ?? 0, spent: row?.spent ?? 0, entries: row?.entries ?? 0 };
}

export function detectAnomalies() {
  const negativeBalances = all<{ user_id: string; username: string; balance: number }>(
    `SELECT w.user_id, u.username, w.balance FROM wallet_accounts w
       JOIN users u ON u.id = w.user_id WHERE w.balance < 0`,
  );

  const mismatched = all<{ user_id: string; username: string; stored: number; computed: number }>(
    `SELECT w.user_id, u.username, w.balance AS stored,
            COALESCE((SELECT SUM(amount) FROM ledger_entries l WHERE l.user_id = w.user_id), 0) AS computed
       FROM wallet_accounts w JOIN users u ON u.id = w.user_id
      WHERE w.balance <> COALESCE((SELECT SUM(amount) FROM ledger_entries l WHERE l.user_id = w.user_id), 0)`,
  );

  const duplicateRewards = all<{ user_id: string; username: string; reference_id: string; times: number; total: number }>(
    `SELECT l.user_id, u.username, l.reference_id, COUNT(*) AS times, SUM(l.amount) AS total
       FROM ledger_entries l JOIN users u ON u.id = l.user_id
      WHERE l.entry_type = 'quiz_reward' AND l.reference_id IS NOT NULL
      GROUP BY l.user_id, l.reference_id
     HAVING COUNT(*) > 1
      ORDER BY times DESC LIMIT 50`,
  );

  const repeatedRefunds = all<{ user_id: string; username: string; times: number; total: number }>(
    `SELECT l.user_id, u.username, COUNT(*) AS times, SUM(l.amount) AS total
       FROM ledger_entries l JOIN users u ON u.id = l.user_id
      WHERE l.entry_type = 'refund'
      GROUP BY l.user_id
     HAVING COUNT(*) >= 3
      ORDER BY times DESC LIMIT 50`,
  );

  const farming = all<{ user_id: string; username: string; attempts: number; earned: number }>(
    `SELECT a.user_id, u.username, COUNT(*) AS attempts, COALESCE(SUM(a.reward_paid),0) AS earned
       FROM quiz_attempts a JOIN users u ON u.id = a.user_id
      WHERE a.submitted_at >= datetime('now', '-1 day')
      GROUP BY a.user_id
     HAVING COUNT(*) >= 10
      ORDER BY earned DESC LIMIT 50`,
  );

  return { negativeBalances, mismatched, duplicateRewards, repeatedRefunds, farming };
}
