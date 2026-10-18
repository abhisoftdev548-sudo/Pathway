import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { originGuard, csrfProtection, isAllowedOrigin } from './middleware/csrf.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { authRouter } from './routes/auth.js';
import { roadmapsRouter } from './routes/roadmaps.js';
import { curriculumRouter } from './routes/curriculum.js';
import { profileRouter } from './routes/profile.js';
import { notificationsRouter } from './routes/notifications.js';
import { meRoadmapsRouter } from './routes/meRoadmaps.js';
import { meTasksRouter } from './routes/meTasks.js';
import { dashboardRouter } from './routes/dashboard.js';
import { analyticsRouter } from './routes/analytics.js';
import { achievementsRouter } from './routes/achievements.js';
import { adminRouter } from './routes/admin.js';
import { adminCurriculumRouter } from './routes/adminCurriculum.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.trustProxy) app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // Dev previews are embedded in a cross-origin iframe. Production keeps the default.
      frameguard: env.isProduction ? { action: 'sameorigin' } : false,
      hsts: env.isProduction ? { maxAge: 15552000, includeSubDomains: true } : false,
    }),
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(new Error('Origin not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Requested-With'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    const requestId = String(req.headers['x-request-id'] ?? crypto.randomUUID());
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    const startedAt = process.hrtime.bigint();
    res.on('finish', () => {
      if (req.originalUrl === '/api/health' || req.originalUrl === '/health') return;
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      logger.info(
        {
          requestId,
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          durationMs: Math.round(durationMs * 10) / 10,
          userId: req.user?.id,
        },
        'request completed',
      );
    });
    next();
  });

  app.use(originGuard);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'pathforge-api', uptime: Math.round(process.uptime()) });
  });
  app.get('/api/health', (_req, res) => {
    const state = mongoose.connection.readyState;
    const connected = state === 1;
    res.status(connected ? 200 : 503).json({
      status: connected ? 'ok' : 'degraded',
      service: 'pathforge-api',
      database: connected ? 'connected' : 'disconnected',
      environment: env.nodeEnv,
      uptime: Math.round(process.uptime()),
    });
  });
  app.get('/', (_req, res) => {
    res.json({
      name: 'PathForge API',
      version: '1.0.0',
      documentation: '/api/health',
      message: 'Roadmap-based learning and progress tracking API',
    });
  });

  app.use('/api', apiLimiter);
  app.use('/api/auth', authRouter);
  app.use('/api', csrfProtection);
  app.use('/api', roadmapsRouter);
  app.use('/api', curriculumRouter);
  app.use('/api', profileRouter);
  app.use('/api', notificationsRouter);
  app.use('/api', meRoadmapsRouter);
  app.use('/api', meTasksRouter);
  app.use('/api', dashboardRouter);
  app.use('/api', analyticsRouter);
  app.use('/api', achievementsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/admin', adminCurriculumRouter);

  const clientDist = process.env.CLIENT_DIST
    ? path.resolve(process.env.CLIENT_DIST)
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
  if (env.isProduction && fs.existsSync(path.join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
