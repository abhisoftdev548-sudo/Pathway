import { ApiError } from '../utils/ApiError.js';
import { safeEqual, randomToken } from '../utils/crypto.js';
import config from '../config/env.js';

/**
 * CSRF protection for cookie-authenticated endpoints (refresh/logout).
 *
 * Double-submit token pattern:
 *  - `qs_csrf` cookie (readable by JS, SameSite=strict-ish) is set at login/refresh.
 *  - State-changing cookie-auth requests must echo its value in `X-CSRF-Token`.
 *  - SameSite cookies + explicit Origin allowlist provide additional layers.
 *
 * Bearer-token endpoints (Authorization header) are inherently CSRF-safe and
 * skip this check.
 */

export const CSRF_COOKIE = 'qs_csrf';
export const CSRF_HEADER = 'x-csrf-token';

export function issueCsrfCookie(res) {
  const token = randomToken(24);
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false, // must be readable by the SPA to echo the header
    secure: config.cookies.secure,
    sameSite: config.cookies.sameSite,
    path: '/',
    maxAge: config.tokens.refreshTtlDays * 24 * 60 * 60 * 1000,
  });
  return token;
}

export function csrfProtection(req, _res, next) {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();

  // Bearer-token requests are not CSRF-exploitable.
  if (req.headers.authorization?.startsWith('Bearer ')) return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];
  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    return next(ApiError.forbidden('CSRF token missing or invalid', 'CSRF_FAILED'));
  }
  return next();
}

/** Origin allowlist enforcement for state-changing requests. */
export function originGuard(req, _res, next) {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();

  const origin = req.headers.origin;
  if (!origin) return next(); // non-browser clients (curl, tests)

  if (!config.corsOrigins.includes(origin)) {
    return next(ApiError.forbidden(`Origin ${origin} is not allowed`, 'ORIGIN_NOT_ALLOWED'));
  }
  return next();
}
