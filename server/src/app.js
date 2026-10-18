import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';

import config from './config/env.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { originGuard } from './middleware/csrf.js';
import { dbGuard } from './middleware/dbGuard.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import quizRoutes from './routes/quizRoutes.js';
import pollRoutes from './routes/pollRoutes.js';
import socialRoutes from './routes/socialRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import miscRoutes from './routes/miscRoutes.js';

export function createApp() {
  const app = express();

  // Behind Render/Vercel proxies: trust the first hop for correct client IPs.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Security headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false, // API only — the SPA sets its own CSP at the edge
    })
  );

  // CORS allowlist (explicit origins; credentials for refresh cookies)
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
        // Omit CORS headers (no error); originGuard enforces 403 on writes.
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
      exposedHeaders: ['RateLimit', 'RateLimit-Limit', 'RateLimit-Remaining'],
    })
  );

  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // NoSQL injection + parameter pollution protection
  app.use(mongoSanitize({ replaceWith: '_' }));
  app.use(hpp());

  // Origin allowlist for state-changing requests (CSRF layer)
  app.use(originGuard);

  // General rate limit for the whole API
  app.use('/api/', apiLimiter);

  // Fail fast with a clear 503 when MongoDB is unreachable (health stays up).
  app.use('/api/', dbGuard);

  // Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/quizzes', quizRoutes);
  app.use('/api/v1/polls', pollRoutes);
  app.use('/api/v1', socialRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1', miscRoutes);

  // Health root (useful for uptime monitors)
  app.get('/', (_req, res) => {
    res.json({ success: true, data: { name: 'QuizSphere API', docs: '/api/v1/health' } });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
