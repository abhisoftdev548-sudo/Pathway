import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const isDisabled = env.isTest || !env.isProduction;
const base = {
  standardHeaders: true as const,
  legacyHeaders: false,
  skip: () => isDisabled,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please wait a moment before trying again.',
    },
  },
};

// In production these limits protect credential endpoints from brute force / spam.
export const authLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, max: 25 });
export const passwordResetLimiter = rateLimit({ ...base, windowMs: 60 * 60 * 1000, max: 8 });
export const apiLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, max: 1200 });
