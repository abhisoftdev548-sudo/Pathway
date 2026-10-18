import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import type { Store } from '../db/store.js';
import type { User } from '../types.js';
import { forbidden, unauthorized } from '../lib/utils.js';

declare global { namespace Express { interface Request { user?: User; store?: Store } } }

export function signToken(user: User) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: '7d' });
}
export function setAuthCookie(res: Response, token: string) {
  res.cookie(config.cookieName, token, {
    httpOnly: true, sameSite: 'lax', secure: config.nodeEnv === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, path: '/',
  });
}
function tokenFrom(req: Request): string | null {
  const cookie = (req as any).cookies?.[config.cookieName];
  if (cookie) return cookie;
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7) : null;
}
async function loadUser(req: Request): Promise<User | null> {
  const token = tokenFrom(req); if (!token || !req.store) return null;
  try { const payload = jwt.verify(token, config.jwtSecret) as { sub: string }; return await req.store.users.byId(payload.sub); }
  catch { return null; }
}
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try { const u = await loadUser(req); if (u) req.user = u; next(); } catch (e) { next(e); }
};
export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try { const u = await loadUser(req); if (!u) throw unauthorized(); req.user = u; next(); } catch (e) { next(e); }
};
export const requireAdmin = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const u = await loadUser(req); if (!u) throw unauthorized();
    if (u.role !== 'admin') throw forbidden('Administrator access required');
    req.user = u; next();
  } catch (e) { next(e); }
};
/** Suspended accounts may read public content but cannot write/attempt. */
export const notSuspended = (req: Request, _res: Response, next: NextFunction) => {
  if (req.user?.isSuspended) return next(forbidden('This account is suspended. Contact an administrator.'));
  next();
};
