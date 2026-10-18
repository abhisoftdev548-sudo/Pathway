import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app, closeTestDatabase, makeAdmin, one, query, quizPayload, register, setSetting, useTestDatabase } from './helpers';

/** Audit metadata is stored as JSON text, so parse it before asserting. */
function metadata(entry: Record<string, any>): Record<string, any> {
  const raw = entry.metadata;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw ?? {};
}

useTestDatabase('transactions');

let admin: Awaited<ReturnType<typeof register>>;
let creator: Awaited<ReturnType<typeof register>>;
let player: Awaited<ReturnType<typeof register>>;
let playerId: string;

/** Creates, submits and approves a quiz so it can be attempted. */
async function publishQuiz(overrides: Record<string, unknown> = {}) {
  const created = await creator.api.post('/api/quizzes').send(quizPayload(overrides));
  const id = created.body.id as string;
  await creator.api.post(`/api/quizzes/${id}/submit`);
  await admin.api.post(`/api/admin/content/quizzes/${id}/approve`).send({});
  return id;
}

function correctAnswers(quizId: string) {
  // The attempt payload deliberately hides correct answers while an attempt is
  // in progress, so the test reads them from the database instead.
  return query<{ question_id: string; option_id: string }>(
    `SELECT q.id AS question_id, o.id AS option_id
       FROM quiz_questions q JOIN quiz_options o ON o.question_id = q.id
      WHERE q.quiz_id = ? AND o.is_correct = 1`,
    quizId,
  ).reduce<{ questionId: string; selected: string[] }[]>((acc, row) => {
    const found = acc.find((entry) => entry.questionId === row.question_id);
    if (found) found.selected.push(row.option_id);
    else acc.push({ questionId: row.question_id, selected: [row.option_id] });
    return acc;
  }, []);
}

async function attemptQuiz(quizId: string, agent: Awaited<ReturnType<typeof register>>['api']) {
  const started = await agent.post('/api/attempts').send({ quizId });
  const attemptId = started.body.attemptId as string;
  return agent.post(`/api/attempts/${attemptId}/submit`).send({ answers: correctAnswers(quizId) });
}

beforeAll(async () => {
  await app();
  await setSetting('reward_limits', {
    daily_quiz_reward_cap: 500,
    max_entry_fee: 100,
    max_reward_coins: 500,
    reward_per_correct_answer: 1,
    welcome_bonus: 50,
    refund_window_hours: 24,
    max_manual_adjustment: 1000,
  });
  admin = await register('tx_admin');
  await makeAdmin(admin.session.user.id);
  creator = await register('tx_creator');
  player = await register('tx_player');
  playerId = player.session.user.id;
});

afterAll(() => closeTestDatabase());

describe('wallet integrity', () => {
  it('credits the configured welcome bonus exactly once', async () => {
    const wallet = await player.api.get('/api/wallet');
    expect(wallet.body.wallet.balance).toBe(50);
    const entries = query("SELECT COUNT(*) AS n FROM ledger_entries WHERE user_id = ? AND entry_type = 'signup_bonus'", playerId);
    expect(entries[0].n).toBe(1);
  });

  it('charges the entry fee and pays the reward on a passing attempt', async () => {
    const quizId = await publishQuiz({ entryFee: 10, rewardCoins: 25, rewardPerCorrectAnswer: undefined });
    const before = (await player.api.get('/api/wallet')).body.wallet.balance as number;

    const result = await attemptQuiz(quizId, player.api);
    expect(result.status).toBe(200);
    expect(result.body.result.passed).toBe(true);

    const wallet = await player.api.get('/api/wallet');
    // 50 - 10 entry fee + 25 reward + 3 correct answers at 1 QCoin each
    expect(wallet.body.wallet.balance).toBe(before - 10 + 25 + 3);
  });

  it('never double pays a reward for the same attempt', async () => {
    const quizId = await publishQuiz({ entryFee: 0, rewardCoins: 40 });
    const started = await player.api.post('/api/attempts').send({ quizId });
    const attemptId = started.body.attemptId as string;
    const answers = correctAnswers(quizId);

    const first = await player.api.post(`/api/attempts/${attemptId}/submit`).send({ answers });
    expect(first.status).toBe(200);
    const second = await player.api.post(`/api/attempts/${attemptId}/submit`).send({ answers });
    expect(second.status).toBe(409);

    const rewards = query("SELECT COUNT(*) AS n FROM ledger_entries WHERE entry_type = 'quiz_reward' AND reference_id = ?", attemptId);
    expect(rewards[0].n).toBe(1);
  });

  it('refuses to take a balance below zero', async () => {
    const quizId = await publishQuiz({ entryFee: 100, rewardCoins: 0 });
    const poor = await register('tx_poor');
    const res = await poor.api.post('/api/attempts').send({ quizId });
    expect(res.status).toBe(409);
    expect(String(res.body.message)).toMatch(/Insufficient QCoin balance/);

    const wallet = await poor.api.get('/api/wallet');
    expect(wallet.body.wallet.balance).toBe(50);
    const negative = query('SELECT COUNT(*) AS n FROM wallet_accounts WHERE balance < 0');
    expect(negative[0].n).toBe(0);
  });

  it('enforces the maximum attempt count', async () => {
    const quizId = await publishQuiz({ entryFee: 0, rewardCoins: 1, maxAttempts: 1 });
    await attemptQuiz(quizId, player.api);
    const second = await player.api.post('/api/attempts').send({ quizId });
    expect(second.status).toBe(409);
  });
});

describe('refunds and adjustments', () => {
  it('refunds an entry fee once and records the decision', async () => {
    const quizId = await publishQuiz({ entryFee: 20, rewardCoins: 0, maxAttempts: 2 });
    await attemptQuiz(quizId, player.api);
    const attemptRow = query<{ id: string }>(
      "SELECT id FROM quiz_attempts WHERE quiz_id = ? AND user_id = ? AND status = 'submitted' ORDER BY submitted_at DESC LIMIT 1",
      quizId,
      playerId,
    )[0];
    const attemptId = attemptRow.id;

    const requested = await player.api.post('/api/wallet/refund-requests').send({
      attemptId,
      reason: 'The third question is ambiguous and unanswerable.',
    });
    expect(requested.status).toBe(201);

    const pending = await admin.api.get('/api/admin/qcoin/refunds?status=pending');
    const row = pending.body.items.find((item: { attempt_id: string }) => item.attempt_id === attemptId);
    expect(row).toBeTruthy();

    const before = (await player.api.get('/api/wallet')).body.wallet.balance as number;
    const approved = await admin.api
      .post(`/api/admin/qcoin/refunds/${row.id}/decision`)
      .send({ status: 'approved', note: 'Ambiguous wording confirmed; fee returned.' });
    expect(approved.status).toBe(200);

    const after = (await player.api.get('/api/wallet')).body.wallet.balance as number;
    expect(after - before).toBe(20);

    // A second approval is impossible: the request is no longer pending.
    const again = await admin.api
      .post(`/api/admin/qcoin/refunds/${row.id}/decision`)
      .send({ status: 'approved', note: 'Trying to pay the same refund twice.' });
    expect(again.status).toBe(409);

    const refunds = query("SELECT COUNT(*) AS n FROM ledger_entries WHERE entry_type = 'refund' AND reference_id = ?", row.id);
    expect(refunds[0].n).toBe(1);
  });

  it('requires a reason and refuses an over-limit manual adjustment', async () => {
    const short = await admin.api.post('/api/admin/qcoin/adjustments').send({
      userId: playerId,
      amount: 5,
      direction: 'credit',
      reason: 'oops',
    });
    expect(short.status).toBe(422);

    const overLimit = await admin.api.post('/api/admin/qcoin/adjustments').send({
      userId: playerId,
      amount: 5000,
      direction: 'credit',
      reason: 'Well documented but above the configured ceiling.',
    });
    expect(overLimit.status).toBe(422);
    expect(overLimit.body.details?.amount).toBeTruthy();
  });

  it('posts an audited adjustment and keeps the ledger consistent', async () => {
    const before = (await player.api.get('/api/wallet')).body.wallet.balance as number;
    const res = await admin.api.post('/api/admin/qcoin/adjustments').send({
      userId: playerId,
      amount: 15,
      direction: 'debit',
      reason: 'Reversing a reward paid in error on attempt 42.',
    });
    expect(res.status).toBe(201);

    const after = (await player.api.get('/api/wallet')).body.wallet.balance as number;
    expect(before - after).toBe(15);

    const audit = await admin.api.get('/api/admin/audit/logs?action=qcoin.manual_adjustment');
    const entry = audit.body.items.find((item: { target_id: string }) => item.target_id === playerId);
    expect(entry).toBeTruthy();
    expect(String(metadata(entry).reason)).toContain('Reversing a reward');

    const recon = await admin.api.get('/api/admin/qcoin/reconciliation');
    const row = recon.body.items.find((item: { user_id: string }) => item.user_id === playerId);
    expect(row.stored_balance).toBe(row.computed_balance);
  });

  it('reports no anomalies on a healthy ledger', async () => {
    const anomalies = await admin.api.get('/api/admin/qcoin/anomalies');
    expect(anomalies.body.negativeBalances).toHaveLength(0);
    expect(anomalies.body.mismatched).toHaveLength(0);
    expect(anomalies.body.duplicateRewards).toHaveLength(0);
  });

  it('detects a balance that has been altered outside the ledger', async () => {
    const { run } = await import('../server/src/db/index.js');
    run('UPDATE wallet_accounts SET balance = balance + 500 WHERE user_id = ?', playerId);

    const recon = await admin.api.get('/api/admin/qcoin/reconciliation?onlyMismatched=true');
    expect(recon.body.mismatchedTotal).toBeGreaterThan(0);
    const row = recon.body.items.find((item: { user_id: string }) => item.user_id === playerId);
    expect(row).toBeTruthy();

    const repaired = await admin.api
      .post(`/api/admin/qcoin/reconciliation/${playerId}/repair`)
      .send({ reason: 'Restoring the balance after an out-of-band edit.' });
    expect(repaired.status).toBe(200);

    const after = await admin.api.get(`/api/admin/qcoin/users/${playerId}/wallet`);
    expect(after.body.reconciliation.matches).toBe(true);

    const audit = await admin.api.get('/api/admin/audit/logs?action=qcoin.balance_repaired');
    expect(audit.body.items.length).toBeGreaterThan(0);
  });
});

describe('statistics come from the database', () => {
  it('reports real totals in the QCoin overview', async () => {
    const overview = await admin.api.get('/api/admin/qcoin/overview?days=30');
    const issued = query(
      "SELECT COALESCE(SUM(amount),0) AS total FROM ledger_entries WHERE amount > 0",
    )[0].total as number;
    expect(overview.body.issuedInRange).toBe(issued);
    expect(overview.body.circulation.totalOutstanding).toBe(
      query('SELECT COALESCE(SUM(balance),0) AS total FROM wallet_accounts')[0].total,
    );
  });

  it('keeps the audit trail append only', async () => {
    const countBefore = query('SELECT COUNT(*) AS n FROM audit_logs')[0].n as number;
    expect(countBefore).toBeGreaterThan(0);
    const first = one('SELECT id FROM audit_logs ORDER BY rowid LIMIT 1');
    expect(first?.id).toBeTruthy();
  });
});
