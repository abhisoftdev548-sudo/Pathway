import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from './db/migrate.js';
import { getDb, newId, nowIso, run, resolveDbPath } from './db/index.js';
import { attachUser, requireAdmin } from './lib/auth.js';
import { errorResponse, logUnexpected, notFoundHandler, handler } from './lib/http.js';
import { AppError } from './lib/errors.js';
import { maintenanceStatus } from './lib/settings.js';
import { startWorker } from './jobs/index.js';
import { authRouter } from './routes/auth.js';
import { metaRouter } from './routes/meta.js';
import { quizzesRouter } from './routes/quizzes.js';
import { leaderboardRouter } from './routes/social.js';
import { attemptsRouter } from './routes/attempts.js';
import { pollsRouter } from './routes/polls.js';
import { walletRouter } from './routes/wallet.js';
import { ratingsRouter, reportsRouter, appealsRouter } from './routes/ratings.js';
import { socialRouter } from './routes/social.js';
import { creatorRouter } from './routes/creator.js';
import { adminRouter } from './routes/admin/index.js';
import { adminContentRouter } from './routes/admin/content.js';
import { adminUsersRouter } from './routes/admin/users.js';
import { adminModerationRouter } from './routes/admin/moderation.js';
import { adminQcoinRouter } from './routes/admin/qcoin.js';
import { adminRatingsRouter } from './routes/admin/ratings.js';
import { adminConfigRouter } from './routes/admin/config.js';
import { adminSystemRouter } from './routes/admin/system.js';
import { adminAuditRouter } from './routes/admin/audit.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  migrate();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(attachUser);

  // Reject cross-origin state-changing requests without a permissive CORS policy.
  app.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.headers.origin;
    if (origin) {
      const allowed = process.env.QUIZSPHERE_ALLOWED_ORIGIN;
      const host = req.headers.host;
      let originHost = '';
      try {
        originHost = new URL(origin).host;
      } catch {
        originHost = '';
      }
      if (originHost && originHost !== host && originHost !== allowed) {
        return res.status(403).json({ error: 'forbidden', message: 'Cross-origin writes are not allowed.' });
      }
    }
    return next();
  });

  // Maintenance mode blocks writes for non-administrators.
  app.use('/api', (req, res, next) => {
    const maintenance = maintenanceStatus();
    if (!maintenance.enabled) return next();
    if (req.method === 'GET') return next();
    if (req.ctx?.user.role === 'admin') return next();
    if (String(req.path).startsWith('/auth/')) return next();
    return res.status(503).json({
      error: 'maintenance',
      message: maintenance.message || 'The platform is in maintenance mode. Please try again shortly.',
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/meta', metaRouter);
  app.use('/api/quizzes', quizzesRouter);
  app.use('/api/quizzes', leaderboardRouter);
  app.use('/api/attempts', attemptsRouter);
  app.use('/api/polls', pollsRouter);
  app.use('/api/wallet', walletRouter);
  app.use('/api/ratings', ratingsRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/appeals', appealsRouter);
  app.use('/api', socialRouter);
  app.use('/api/creator', creatorRouter);

  // Every admin route is protected by server-side authorization.
  app.use('/api/admin/users', requireAdmin, adminUsersRouter);
  app.use('/api/admin/content', requireAdmin, adminContentRouter);
  app.use('/api/admin/moderation', requireAdmin, adminModerationRouter);
  app.use('/api/admin/qcoin', requireAdmin, adminQcoinRouter);
  app.use('/api/admin/ratings', requireAdmin, adminRatingsRouter);
  app.use('/api/admin/config', requireAdmin, adminConfigRouter);
  app.use('/api/admin/system', requireAdmin, adminSystemRouter);
  app.use('/api/admin/audit', requireAdmin, adminAuditRouter);
  app.use('/api/admin', requireAdmin, adminRouter);

  app.get(
    '/api/health',
    handler((_req, res) => {
      let dbOk = true;
      try {
        getDb().prepare('SELECT 1 AS ok').get();
      } catch {
        dbOk = false;
      }
      res.json({ ok: dbOk, time: nowIso() });
    }),
  );

  app.use('/api', notFoundHandler);

  // Serve the built client when it exists (production / preview builds).
  const clientDir = path.resolve(here, '../../dist/client');
  if (fs.existsSync(clientDir)) {
    app.use(express.static(clientDir, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDir, 'index.html'));
    });
  }

  app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logUnexpected(err, req);
    const { status, body } = errorResponse(err);
    if (status >= 500) {
      try {
        run(
          `INSERT INTO error_logs (id, method, path, status, message, stack, user_id, created_at)
           VALUES (?,?,?,?,?,?,?,?)`,
          newId(),
          req.method,
          req.originalUrl.slice(0, 300),
          status,
          err instanceof Error ? err.message.slice(0, 500) : 'Unknown error',
          err instanceof Error ? String(err.stack ?? '').slice(0, 4000) : '',
          req.ctx?.user.id ?? null,
          nowIso(),
        );
      } catch {
        /* never let logging break the response */
      }
    }
    if (!res.headersSent) res.status(status).json(body);
  });

  return app;
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const port = Number(process.env.PORT ?? 3001);
  const app = createApp();
  app.listen(port, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`[quizsphere] api listening on http://0.0.0.0:${port} (db: ${resolveDbPath()})`);
  });
  startWorker();
}

export { AppError };
