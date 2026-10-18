import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app, closeTestDatabase, makeAdmin, register, useTestDatabase } from './helpers';

/**
 * A brand new installation must show zeros and empty lists rather than sample
 * content, demo accounts or invented statistics.
 */
useTestDatabase('fresh');

let admin: Awaited<ReturnType<typeof register>>;

beforeAll(async () => {
  await app();
  admin = await register('fresh_admin');
  await makeAdmin(admin.session.user.id);
});

afterAll(() => closeTestDatabase());

describe('a fresh database', () => {
  it('has no users beyond the ones created here', async () => {
    const res = await admin.api.get('/api/admin/users');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });

  it('reports zero content, attempts and transactions', async () => {
    const overview = await admin.api.get('/api/admin/overview?days=30');
    expect(overview.body.quizzes.approved).toBe(0);
    expect(overview.body.quizzes.pendingReview).toBe(0);
    expect(overview.body.polls.published).toBe(0);
    expect(overview.body.moderation.queueTotal).toBe(0);
    expect(overview.body.moderation.reportsPending).toBe(0);
  });

  it('shows an empty moderation queue rather than sample submissions', async () => {
    const queue = await admin.api.get('/api/admin/content/queue');
    expect(queue.body.items).toHaveLength(0);
    expect(queue.body.total).toBe(0);
  });

  it('shows empty public browse lists', async () => {
    const quizzes = await admin.api.get('/api/quizzes');
    expect(quizzes.body.items).toHaveLength(0);
    expect(quizzes.body.total).toBe(0);

    const polls = await admin.api.get('/api/polls');
    expect(polls.body.items).toHaveLength(0);
  });

  it('reports zero QCoin circulation apart from real sign-up bonuses', async () => {
    const qcoin = await admin.api.get('/api/admin/qcoin/overview?days=30');
    // The only money in the system is the welcome bonus paid to this account.
    expect(qcoin.body.circulation.totalOutstanding).toBe(qcoin.body.issuedInRange);
    expect(qcoin.body.pending.refunds).toBe(0);
    expect(qcoin.body.pending.rewardDisputes).toBe(0);
  });

  it('detects no anomalies on an untouched ledger', async () => {
    const anomalies = await admin.api.get('/api/admin/qcoin/anomalies');
    expect(anomalies.body.negativeBalances).toHaveLength(0);
    expect(anomalies.body.mismatched).toHaveLength(0);
    expect(anomalies.body.duplicateRewards).toHaveLength(0);
    expect(anomalies.body.repeatedRefunds).toHaveLength(0);
    expect(anomalies.body.farming).toHaveLength(0);
  });

  it('seeds no categories, tags or difficulty levels', async () => {
    const bootstrap = await admin.api.get('/api/meta/bootstrap');
    expect(bootstrap.body.categories).toHaveLength(0);
    expect(bootstrap.body.tags).toHaveLength(0);
    expect(bootstrap.body.difficulties).toHaveLength(0);
  });

  it('reports an empty leaderboard until real attempts exist', async () => {
    const board = await admin.api.get('/api/social/leaderboard');
    expect(board.body).toBeTruthy();
    if (Array.isArray(board.body.entries)) {
      expect(board.body.entries).toHaveLength(0);
    }
  });
});

describe('registration and persistence', () => {
  it('persists a new account with a wallet and an audit record', async () => {
    const created = await register('fresh_member');
    expect(created.session.user.id).toBeTruthy();

    const me = await created.api.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.username).toBe('fresh_member');

    const wallet = await created.api.get('/api/wallet');
    expect(wallet.status).toBe(200);
    expect(wallet.body.wallet.balance).toBeGreaterThan(0);

    const ledger = await created.api.get('/api/wallet/transactions');
    expect(ledger.status).toBe(200);
    expect(ledger.body.items.length).toBeGreaterThan(0);

    const users = await admin.api.get('/api/admin/users?q=fresh_member');
    expect(users.body.total).toBe(1);

    const audit = await admin.api.get('/api/admin/audit/logs?action=user.registered');
    expect(audit.body.items.length).toBeGreaterThan(0);
  });

  it('rejects a duplicate email or username', async () => {
    const express = await app();
    const { default: request } = await import('supertest');
    const res = await request(express).post('/api/auth/register').send({
      email: 'fresh_member@example.test',
      username: 'fresh_member',
      displayName: 'Impostor',
      password: 'Str0ngPassphrase',
    });
    expect(res.status).toBe(409);
  });

  it('enforces the password rules on the server', async () => {
    const express = await app();
    const { default: request } = await import('supertest');
    const res = await request(express).post('/api/auth/register').send({
      email: 'fresh_weak@example.test',
      username: 'fresh_weak',
      displayName: 'Weak Password',
      password: 'short',
    });
    expect(res.status).toBe(422);
    expect(res.body.details?.password).toBeTruthy();
  });
});
