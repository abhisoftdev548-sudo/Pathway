import crypto from 'node:crypto';
import { get, run, nowIso, newId, tx } from '../db/index.js';
import { unauthorized, forbidden } from './errors.js';
import type { NextFunction, Request, Response } from 'express';

export type Role = 'user' | 'creator' | 'admin';

const ROLE_RANK: Record<Role, number> = { user: 0, creator: 1, admin: 2 };

export interface SessionUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: Role;
  accountStatus: 'active' | 'suspended' | 'pending_verification';
  isAdmin: boolean;
  isCreator: boolean;
}

export interface RequestContext {
  user: SessionUser;
  sessionId: string;
}

// ------------------------------------------------------------------ passwords

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expected] = parts;
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  const a = Buffer.from(derived, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ------------------------------------------------------------------ sessions

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createSession(userId: string, ip?: string | null, userAgent?: string | null): { token: string; expiresAt: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const id = newId();
  const now = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  run(
    'INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, last_used_at, ip, user_agent) VALUES (?,?,?,?,?,?,?,?)',
    id,
    userId,
    hashToken(token),
    now,
    expiresAt,
    now,
    ip ?? null,
    userAgent ?? null,
  );
  return { token, expiresAt };
}

export function revokeSession(token: string): void {
  run('DELETE FROM sessions WHERE token_hash = ?', hashToken(token));
}

export function revokeAllSessions(userId: string): void {
  run('DELETE FROM sessions WHERE user_id = ?', userId);
}

export function purgeExpiredSessions(): number {
  return run('DELETE FROM sessions WHERE expires_at < ?', nowIso()).changes;
}

function loadSessionUser(token: string): RequestContext | null {
  const row = get<SessionUser & { session_id: string; expires_at: string }>(
    `SELECT u.id, u.email, u.username, u.display_name AS displayName, u.role,
            u.account_status AS accountStatus, s.id AS session_id, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?`,
    hashToken(token),
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    run('DELETE FROM sessions WHERE id = ?', row.session_id);
    return null;
  }
  const user: SessionUser = {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.displayName,
    role: row.role,
    accountStatus: row.accountStatus,
    isAdmin: row.role === 'admin',
    isCreator: row.role === 'creator' || row.role === 'admin',
  };
  return { user, sessionId: row.session_id };
}

// ------------------------------------------------------------------ express glue

export const SESSION_COOKIE = 'qs_session';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      ctx?: RequestContext;
    }
  }
}

function readToken(req: Request): string | null {
  const raw = req.headers.cookie;
  if (raw) {
    const match = raw.match(/(?:^|;\s*)qs_session=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

/** Attaches `req.ctx` when a valid session cookie/token is present. */
export function attachUser(req: Request, _res: Response, next: NextFunction): void {
  const token = readToken(req);
  if (token) {
    const ctx = loadSessionUser(token);
    if (ctx) {
      req.ctx = ctx;
      run('UPDATE sessions SET last_used_at = ? WHERE id = ?', nowIso(), ctx.sessionId);
    }
  }
  next();
}

export function setSessionCookie(res: Response, token: string, expiresAt: string): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(
      expiresAt,
    ).toUTCString()}${secure}`,
  );
}

export function clearSessionCookie(res: Response): void {
  res.append('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.ctx) return next(unauthorized('Please sign in to continue.'));
  if (req.ctx.user.accountStatus === 'suspended') {
    return next(forbidden('This account is suspended. Contact support for help.'));
  }
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.ctx) return next(unauthorized('Please sign in to continue.'));
  if (req.ctx.user.role !== 'admin') {
    return next(forbidden('Administrator access is required for this action.'));
  }
  next();
}

export function requireRole(min: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.ctx) return next(unauthorized('Please sign in to continue.'));
    if (ROLE_RANK[req.ctx.user.role] < ROLE_RANK[min]) {
      return next(forbidden('You do not have permission to do that.'));
    }
    next();
  };
}

export function currentUser(req: Request): SessionUser {
  if (!req.ctx) throw unauthorized('Please sign in to continue.');
  return req.ctx.user;
}

export function currentUserId(req: Request): string {
  return currentUser(req).id;
}

export function requireAdminUser(req: Request): SessionUser {
  const user = currentUser(req);
  if (user.role !== 'admin') throw forbidden('Administrator access is required for this action.');
  return user;
}

/** Refresh materialised counters used by admin listings. */
export function touchUserActivity(userId: string): void {
  tx(() => {
    run('UPDATE users SET last_active_at = ? WHERE id = ?', nowIso(), userId);
  });
}
