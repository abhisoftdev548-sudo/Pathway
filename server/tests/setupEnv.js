/**
 * Test environment defaults — runs before any test file imports app.js.
 * Real secrets are NEVER used here; tests never touch production.
 */
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/quizsphere-test';
process.env.ACCESS_TOKEN_SECRET ??= 'test-access-secret-at-least-24-chars';
process.env.REFRESH_TOKEN_SECRET ??= 'test-refresh-secret-at-least-24-chars';
process.env.NODE_ENV ??= 'test';
process.env.BOOTSTRAP_FIRST_ADMIN ??= 'true';
process.env.CLIENT_ORIGIN ??= 'http://localhost:5173';
process.env.VERCEL_ORIGINS ??= '';
process.env.RENDER_ORIGINS ??= '';
