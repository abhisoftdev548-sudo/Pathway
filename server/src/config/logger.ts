import pino from 'pino';
import { env } from './env.js';

/**
 * Structured application logger.
 * Redacts anything that could contain credentials, cookies or reset tokens.
 */
export const logger = pino({
  level: env.logLevel,
  base: { service: 'pathforge-api', env: env.nodeEnv },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.refreshToken',
      '*.accessToken',
      '*.cookie',
    ],
    censor: '[redacted]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
