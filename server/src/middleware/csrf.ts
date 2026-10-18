import type { NextFunction, Request, Response } from 'express';
import { cookieNames, env } from '../config/env.js';
import { forbidden } from '../utils/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Production only trusts CLIENT_ORIGIN. Development also trusts localhost and the
 * sandbox preview host so the embedded app can call the API.
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  const normalized = origin.replace(/\/$/, '');
  if (env.clientOrigins.includes(normalized)) return true;
  if (env.isProduction) return false;
  try {
    const url = new URL(normalized);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const host = url.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
    if (host.endsWith('.e2b.app')) return true;
  } catch {
    return false;
  }
  return false;
}

/**
 * CSRF strategy (cookie-based JWT auth):
 * 1. Access/refresh cookies are HttpOnly + SameSite (Lax in dev, None+Secure only when
 *    the frontend is hosted on a different site).
 * 2. Every state-changing request from a browser must come from an allowlisted Origin.
 * 3. Authenticated mutations also require a double-submit CSRF header that matches
 *    the readable `pf_csrf` cookie.
 * Requests without an Origin header (server-to-server, curl, tests) pass the origin
 * check; browsers always send Origin on cross-site state-changing requests.
 */
export function originGuard(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();
  if (!isAllowedOrigin(req.get('origin'))) {
    return next(forbidden('Request origin is not allowed'));
  }
  next();
}

export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.path.startsWith('/api/auth/')) return next();
  const cookieToken = req.cookies?.[cookieNames.csrf] as string | undefined;
  const headerToken = req.get('x-csrf-token');
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(forbidden('Invalid or missing CSRF token. Reload the page and try again.'));
  }
  next();
}
