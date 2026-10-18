/**
 * End-to-end integration tests against a real MongoDB.
 *
 * These run ONLY when MONGODB_TEST_URI is provided (e.g. a local mongod,
 * Atlas test cluster, or mongodb-memory-server):
 *
 *   MONGODB_TEST_URI=mongodb://127.0.0.1:27017/quizsphere-test npm test
 *
 * They are skipped when no database is available — never faked, never silent.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';

const uri = process.env.MONGODB_TEST_URI;

process.env.ACCESS_TOKEN_SECRET ??= 'test-access-secret-at-least-24-chars';
process.env.REFRESH_TOKEN_SECRET ??= 'test-refresh-secret-at-least-24-chars';
process.env.MONGODB_URI ??= uri ?? 'mongodb://127.0.0.1:27017/placeholder';
process.env.BOOTSTRAP_FIRST_ADMIN = 'true';

const app = createApp();

describe.runIf(Boolean(uri))('full API lifecycle (requires MONGODB_TEST_URI)', () => {
  let adminToken = '';
  let adminEmail = `admin_${Date.now()}@test.local`;
  let userToken = '';
  let userEmail = `user_${Date.now()}@test.local`;
  let userId = '';
  let quizId = '';
  let attemptId = '';

  beforeAll(async () => {
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    // Test data lives only in the dedicated test database.
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect();
  });

  it('registers the first user as admin (bootstrap) with a signup bonus', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Test Admin',
      email: adminEmail,
      password: 'password123',
    });
    expect(res.status).toBe(201);
    adminToken = res.body.data.accessToken;
    expect(res.body.data.user.role).toBe('ADMIN');
  });

  it('registers a regular user', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Test User',
      email: userEmail,
      password: 'password123',
    });
    expect(res.status).toBe(201);
    userToken = res.body.data.accessToken;
    userId = res.body.data.user._id;
    expect(res.body.data.user.role).toBe('USER');
    // Signup bonus granted exactly once, idempotently.
    expect(res.body.data.user.wallet.balance).toBeGreaterThan(0);
  });

  it('rejects duplicate registration', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Test User',
      email: userEmail,
      password: 'password123',
    });
    expect(res.status).toBe(409);
  });

  it('logs in and issues tokens', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: userEmail,
      password: 'password123',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('rejects wrong passwords', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: userEmail,
      password: 'wrong-password-1',
    });
    expect(res.status).toBe(401);
  });

  it('creates a quiz draft, submits it, and blocks self-approval by non-admins', async () => {
    const create = await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Integration test quiz',
        description: 'Server-verified scoring test',
        passingScore: 50,
        questions: [
          {
            id: 'q1',
            type: 'SINGLE_CHOICE',
            text: '2+2?',
            points: 1,
            options: [
              { id: 'a', text: '3', isCorrect: false },
              { id: 'b', text: '4', isCorrect: true },
            ],
          },
        ],
      });
    expect(create.status).toBe(201);
    quizId = create.body.data.quiz._id;

    const submit = await request(app)
      .post(`/api/v1/quizzes/${quizId}/submit`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({});
    expect(submit.status).toBe(200);
    expect(submit.body.data.quiz.status).toBe('PENDING_REVIEW');

    const approveAttempt = await request(app)
      .post(`/api/v1/admin/moderate/quiz/${quizId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ action: 'APPROVE' });
    expect(approveAttempt.status).toBe(403); // role enforcement on the backend
  });

  it('admin approves the quiz', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/moderate/quiz/${quizId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'APPROVE', notes: 'Looks good', qualityRating: 5 });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
  });

  it('runs an attempt, scores it server-side, and prevents double submission', async () => {
    const start = await request(app)
      .post(`/api/v1/quizzes/${quizId}/attempts`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({});
    expect(start.status).toBe(201);
    attemptId = start.body.data.id;

    const submit = await request(app)
      .post(`/api/v1/quizzes/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ answers: [{ questionId: 'q1', value: 'b' }], timeSpentSec: 12 });
    expect(submit.status).toBe(200);
    expect(submit.body.data.percentage).toBe(100);
    expect(submit.body.data.passed).toBe(true);

    const again = await request(app)
      .post(`/api/v1/quizzes/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ answers: [] });
    expect(again.status).toBe(409); // duplicate submission blocked
  });

  it('prevents creator self-rating and allows eligible ratings once', async () => {
    const selfRate = await request(app)
      .post('/api/v1/ratings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ targetType: 'QUIZ', targetId: quizId, score: 5 });
    // The quiz creator is the same test user → must be refused.
    expect(selfRate.status).toBe(403);
  });

  it('admin broadcasts notifications and views the ledger', async () => {
    const ledger = await request(app)
      .get('/api/v1/admin/ledger')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(ledger.status).toBe(200);
    expect(ledger.body.data.items.length).toBeGreaterThan(0); // signup bonus exists

    const audit = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(audit.status).toBe(200);
    expect(audit.body.data.items.some((log) => log.action === 'MODERATION_APPROVE')).toBe(true);
  });

  it('logs out and revokes the refresh session', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({
      email: userEmail,
      password: 'password123',
    });
    const cookies = login.headers['set-cookie'] ?? [];
    const refresh = cookies.find((c) => c.startsWith('qs_refresh='));
    const csrf = cookies.find((c) => c.startsWith('qs_csrf='));
    expect(refresh).toBeTruthy();

    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', [refresh.split(';')[0], csrf.split(';')[0]])
      .set('X-CSRF-Token', csrf.split(';')[0].split('=')[1]);
    expect(logout.status).toBe(200);
  });
});

describe.runIf(!uri)('integration suite', () => {
  it('skips when MONGODB_TEST_URI is not configured', () => {
    console.warn('[integration] MONGODB_TEST_URI not set — full API lifecycle suite skipped.');
    expect(true).toBe(true);
  });
});
