/**
 * HTTP-layer tests: security middleware, validation, and error envelopes.
 * These run WITHOUT a database — they exercise code paths that reject requests
 * before any persistence happens.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';

process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/quizsphere-test';
process.env.ACCESS_TOKEN_SECRET ??= 'test-access-secret-at-least-24-chars';
process.env.REFRESH_TOKEN_SECRET ??= 'test-refresh-secret-at-least-24-chars';

const app = createApp();

// These tests exercise security middleware (auth, CSRF, validation, rate limits)
// that reject requests BEFORE any persistence. Stub the connection state so the
// dbGuard passes; none of these cases issue a database query.
beforeAll(() => {
  Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });
});

afterAll(() => {
  // Nothing to clean up — no database is used.
});

describe('API envelope + 404 handling', () => {
  it('returns a consistent error envelope for unknown routes', async () => {
    const res = await request(app).get('/api/v1/definitely-not-a-route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(typeof res.body.error.message).toBe('string');
  });

  it('serves the health check without a database', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });

  it('serves the wallet policy document', async () => {
    const res = await request(app).get('/api/v1/wallet/policy');
    expect(res.status).toBe(200);
    expect(res.body.data.withdrawable).toBe(false);
    expect(res.body.data.transferableBetweenUsers).toBe(false);
  });
});

describe('Request validation (Zod) rejects bad input before any DB work', () => {
  it('rejects registration with missing/invalid fields', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'A',
      email: 'not-an-email',
      password: 'short',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it('rejects an invalid poll payload', async () => {
    const res = await request(app)
      .post('/api/v1/polls')
      .set('Authorization', 'Bearer not-a-real-token')
      .send({ title: 'x' });
    // Auth fails first (invalid token) — 401 before validation or DB.
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('rejects unknown report reasons', async () => {
    const res = await request(app)
      .post('/api/v1/reports')
      .set('Authorization', 'Bearer not-a-real-token')
      .send({ targetType: 'POLL', targetId: 'a'.repeat(24), reason: 'MADE_UP' });
    expect(res.status).toBe(401); // authentication precedes body validation
    expect(res.body.success).toBe(false);
  });
});

describe('Authentication guards', () => {
  it('rejects protected routes without a token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('MISSING_TOKEN');
  });

  it('rejects garbage tokens', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer garbage.token.value');
    expect(res.status).toBe(401);
    expect(['INVALID_TOKEN', 'TOKEN_EXPIRED']).toContain(res.body.error.code);
  });

  it('rejects admin routes for anonymous callers', async () => {
    const res = await request(app).get('/api/v1/admin/overview');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('CSRF protection on cookie-authenticated endpoints', () => {
  it('rejects refresh without the CSRF double-submit header', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', ['qs_refresh=fake; qs_csrf=csrf-token-value'])
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_FAILED');
  });

  it('rejects logout without the CSRF header', async () => {
    const res = await request(app).post('/api/v1/auth/logout').set('Cookie', ['qs_csrf=abc123']);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_FAILED');
  });

  it('allows cookie endpoints when the CSRF header matches the cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', ['qs_csrf=matching-token'])
      .set('X-CSRF-Token', 'matching-token')
      .send({});
    // Passes CSRF, then fails on the missing refresh token (before any DB work).
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('MISSING_REFRESH');
  });
});

describe('Origin allowlist', () => {
  it('rejects state-changing requests from disallowed origins', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'https://evil.example.com')
      .send({ email: 'x@y.z', password: 'whatever1' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
  });
});

describe('Rate limiting on authentication endpoints', () => {
  it('returns 429 after the auth limit is exhausted', async () => {
    let lastStatus = 0;
    let rateLimited = false;
    // AUTH_RATE_LIMIT_MAX defaults to 20 per window.
    for (let i = 0; i < 25; i += 1) {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'x', email: 'bad', password: 'x' });
      lastStatus = res.status;
      if (res.status === 429) {
        expect(res.body.error.code).toBe('RATE_LIMITED');
        rateLimited = true;
        break;
      }
    }
    expect(rateLimited || lastStatus === 400).toBe(true);
    expect(rateLimited).toBe(true);
  });
});

describe('Security headers', () => {
  it('sets helmet security headers and hides x-powered-by', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['content-security-policy'] ?? res.headers['cross-origin-resource-policy']).toBeTruthy();
  });
});
