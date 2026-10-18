import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app, closeTestDatabase, makeAdmin, quizPayload, register, useTestDatabase } from './helpers';

useTestDatabase('permissions');

let admin: Awaited<ReturnType<typeof register>>;
let member: Awaited<ReturnType<typeof register>>;
let outsider: Awaited<ReturnType<typeof register>>;

beforeAll(async () => {
  await app();
  member = await register('perm_member');
  outsider = await register('perm_outsider');
  admin = await register('perm_admin');
  await makeAdmin(admin.session.user.id);
});

afterAll(() => closeTestDatabase());

describe('admin route protection', () => {
  const adminPaths = [
    '/api/admin/overview',
    '/api/admin/users',
    '/api/admin/content/queue',
    '/api/admin/qcoin/overview',
    '/api/admin/ratings',
    '/api/admin/audit/logs',
    '/api/admin/system/health',
    '/api/admin/config/quiz_rules',
  ];

  it('blocks anonymous callers from every admin endpoint', async () => {
    const express = await app();
    const { default: request } = await import('supertest');
    for (const path of adminPaths) {
      const res = await request(express).get(path);
      expect(res.status, `${path} should require a session`).toBe(401);
    }
  });

  it('blocks ordinary members from every admin endpoint', async () => {
    for (const path of adminPaths) {
      const res = await member.api.get(path);
      expect(res.status, `${path} should require the admin role`).toBe(403);
    }
  });

  it('allows administrators', async () => {
    for (const path of adminPaths) {
      const res = await admin.api.get(path);
      expect(res.status, `${path} should be reachable by an admin`).toBe(200);
    }
  });

  it('never leaks password hashes or session tokens through the user API', async () => {
    const res = await admin.api.get('/api/admin/users');
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('password_hash');
    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toContain('token');
  });
});

describe('account administration rules', () => {
  it('refuses to let an administrator suspend their own account', async () => {
    const res = await admin.api
      .post(`/api/admin/users/${admin.session.user.id}/suspend`)
      .send({ reason: 'Self suspension should not be possible.' });
    expect(res.status).toBe(409);
  });

  it('refuses to let an administrator change their own role', async () => {
    const res = await admin.api
      .post(`/api/admin/users/${admin.session.user.id}/role`)
      .send({ role: 'user', reason: 'Self demotion should not be possible.' });
    expect(res.status).toBe(409);
  });

  it('refuses to demote the last active administrator', async () => {
    const res = await admin.api
      .post(`/api/admin/users/${admin.session.user.id}/role`)
      .send({ role: 'user', reason: 'Attempting to remove the final admin.' });
    expect(res.status).toBe(409);
  });

  it('requires a reason to suspend another account', async () => {
    const res = await admin.api.post(`/api/admin/users/${outsider.session.user.id}/suspend`).send({ reason: 'x' });
    expect(res.status).toBe(422);
    expect(res.body.details?.reason).toBeTruthy();
  });

  it('suspends and restores an account with an audit record', async () => {
    const suspend = await admin.api
      .post(`/api/admin/users/${outsider.session.user.id}/suspend`)
      .send({ reason: 'Repeated guideline breaches.' });
    expect(suspend.status).toBe(200);

    const blocked = await outsider.api.get('/api/wallet');
    expect([401, 403]).toContain(blocked.status);

    const restore = await admin.api
      .post(`/api/admin/users/${outsider.session.user.id}/restore`)
      .send({ reason: 'Appeal accepted.' });
    expect(restore.status).toBe(200);

    const audit = await admin.api.get('/api/admin/audit/logs?action=admin.user_suspended');
    expect(audit.body.items.length).toBeGreaterThan(0);
    expect(audit.body.items[0].actor_label).toBeTruthy();
  });
});

describe('content ownership rules', () => {
  it('stops a non-owner from editing a draft quiz', async () => {
    const other = await register('perm_other_a');
    const created = await member.api.post('/api/quizzes').send(quizPayload());
    expect(created.status).toBe(201);

    const patched = await other.api.patch(`/api/quizzes/${created.body.id}`).send(
      quizPayload({ title: 'Someone elses quiz title' }),
    );
    expect(patched.status).toBe(403);
  });

  it('stops a non-owner from submitting someone elses quiz for review', async () => {
    const other = await register('perm_other_b');
    const created = await member.api.post('/api/quizzes').send(quizPayload({ title: 'Another members quiz' }));
    const res = await other.api.post(`/api/quizzes/${created.body.id}/submit`);
    expect(res.status).toBe(403);
  });

  it('hides correct answers and explanations from non-owners', async () => {
    const secret = 'The answer was settled in the treaty of 1815.';
    const created = await member.api
      .post('/api/quizzes')
      .send(quizPayload({ title: 'Answer hiding quiz', questions: quizPayload().questions.map((q) => ({ ...q, explanation: secret })) }));
    const id = created.body.id as string;

    const ownerView = await member.api.get(`/api/quizzes/${id}`);
    expect(JSON.stringify(ownerView.body)).toContain('isCorrect');
    expect(JSON.stringify(ownerView.body)).toContain(secret);

    const submitted = await member.api.post(`/api/quizzes/${id}/submit`);
    expect(submitted.status).toBe(200);
    await admin.api.post(`/api/admin/content/quizzes/${id}/approve`).send({});

    const reader = await register('perm_reader');
    const publicView = await reader.api.get(`/api/quizzes/${id}`);
    const raw = JSON.stringify(publicView.body);
    expect(raw).not.toContain('isCorrect');
    expect(raw).not.toContain(secret);
  });
});
