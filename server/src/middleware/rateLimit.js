import rateLimit from 'express-rate-limit';
import config from '../config/env.js';
import { sendError } from '../utils/responses.js';

const standardHeaders = true;
const legacyHeaders = false;

function limiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders,
    legacyHeaders,
    // Trust proxy is configured at app level for Render/Vercel deployments.
    handler: (_req, res) => sendError(res, 429, 'RATE_LIMITED', message),
  });
}

/** General API limiter. */
export const apiLimiter = limiter({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: 'Too many requests — please slow down.',
});

/** Strict limiter for authentication endpoints (login/register/reset). */
export const authLimiter = limiter({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  message: 'Too many authentication attempts — try again later.',
});

/** Tighter limiter for write endpoints that create content. */
export const writeLimiter = limiter({
  windowMs: config.rateLimit.windowMs,
  max: Math.max(30, Math.floor(config.rateLimit.max / 4)),
  message: 'Too many write requests — please slow down.',
});

export default apiLimiter;
