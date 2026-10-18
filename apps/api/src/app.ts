import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import type { Store } from './db/store.js';
import { ApiError } from './lib/utils.js';
import { optionalAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import quizzesRoutes from './routes/quizzes.js';
import attemptRoutes from './routes/attempts.js';
import adminRoutes from './routes/admin.js';
import meRoutes from './routes/me.js';
import { openapi } from './openapi.js';

export function createApp(store: Store) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  const allowed = new Set([config.frontendUrl, 'http://localhost:5173', 'http://127.0.0.1:5173']);
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl / same-origin proxy
      if (allowed.has(origin) || /\.e2b\.app$/.test(new URL(origin).hostname)) return cb(null, true);
      cb(null, false);
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use((req, _res, next) => { req.store = store; next(); });
  app.use(optionalAuth);

  const general = rateLimit({ windowMs: 15 * 60 * 1000, limit: 2000, standardHeaders: true, legacyHeaders: false });
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 200, standardHeaders: true, legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message: 'Too many auth requests, try again later' } } });
  const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false });
  app.use('/api', general);

  app.get('/api/health', (_req, res) => res.json({ ok: true, store: store.kind, time: new Date().toISOString() }));
  app.get('/api/openapi.json', (_req, res) => res.json(openapi));
  app.get('/api/docs', (_req, res) => res.type('html').send(`<!doctype html><title>QuizSphere API</title><body style="font-family:system-ui;padding:2rem"><h1>QuizSphere API</h1><p>OpenAPI spec: <a href="/api/openapi.json">/api/openapi.json</a> — import it into Swagger UI, Postman or Insomnia.</p></body>`));

  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api', quizzesRoutes);
  app.use('/api', attemptRoutes);
  app.use('/api', writeLimiter, meRoutes);
  app.use('/api', adminRoutes);

  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API route not found' } }));
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ApiError) return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    if ((err as any)?.type === 'entity.too.large') return res.status(413).json({ error: { code: 'TOO_LARGE', message: 'Request body too large' } });
    console.error('[api] unhandled error', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
  });
  return app;
}
