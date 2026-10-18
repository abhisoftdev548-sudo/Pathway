import { Router } from 'express';
import { z } from 'zod';
import { all, count, get, newId, nowIso, run, tx } from '../db/index.js';
import { conflict, notFound } from '../lib/errors.js';
import { audit, clientIp, recordSecurityEvent } from '../lib/audit.js';
import { handler, parseBody } from '../lib/http.js';
import {
  createSession,
  currentUser,
  hashPassword,
  revokeSession,
  SESSION_COOKIE,
  setSessionCookie,
  clearSessionCookie,
  verifyPassword,
  type SessionUser,
} from '../lib/auth.js';
import { ensureWallet, getWallet, postEntry } from '../lib/wallet.js';
import { unreadCount } from '../lib/notify.js';
import { getSetting } from '../lib/settings.js';
import { emailSchema, passwordSchema, usernameSchema, displayNameSchema } from '../lib/password.js';
import { evaluate as evaluateAchievements } from '../lib/achievements.js';

export const authRouter = Router();

const registerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  displayName: displayNameSchema,
  password: passwordSchema,
});

authRouter.post(
  '/register',
  handler((req, res) => {
    if (getSetting<Record<string, boolean>>('feature_config', {}).public_registration_enabled === false) {
      throw conflict('Public registration is currently closed.');
    }
    const body = parseBody(registerSchema, req.body);

    const existing =
      get('SELECT id FROM users WHERE email = ?', body.email) ??
      get('SELECT id FROM users WHERE username = ?', body.username);
    if (existing) throw conflict('That email or username is already registered.');

    const id = newId();
    const now = nowIso();

    const userId = tx(() => {
      run(
        `INSERT INTO users (id, email, username, display_name, password_hash, role, account_status, created_at, updated_at, last_active_at)
         VALUES (?,?,?,?,?, 'user', 'active', ?,?,?)`,
        id,
        body.email,
        body.username,
        body.displayName,
        hashPassword(body.password),
        now,
        now,
        now,
      );
      ensureWallet(id);
      const welcome = getSetting<{ welcome_bonus: number }>('reward_limits', { welcome_bonus: 0 });
      const bonus = Number.isInteger(welcome.welcome_bonus) ? welcome.welcome_bonus : 0;
      if (bonus > 0) {
        postEntry({
          userId: id,
          amount: bonus,
          entryType: 'signup_bonus',
          description: 'Welcome bonus',
          idempotencyKey: `signup_bonus:${id}`,
        });
      }
      return id;
    });

    audit({
      actor: null,
      action: 'user.registered',
      targetType: 'user',
      targetId: userId,
      metadata: { username: body.username },
      ip: clientIp(req),
    });
    recordSecurityEvent({ userId, event: 'register', outcome: 'success', req });

    const session = createSession(userId, clientIp(req), req.headers['user-agent']);
    setSessionCookie(res, session.token, session.expiresAt);
    res.status(201).json({ user: publicUser(userId) });
  }),
);

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email or username.'),
  password: z.string().min(1, 'Enter your password.'),
});

authRouter.post(
  '/login',
  handler((req, res) => {
    const body = parseBody(loginSchema, req.body);
    const identifier = body.identifier.toLowerCase();
    const row = get<{ id: string; password_hash: string; account_status: string }>(
      'SELECT id, password_hash, account_status FROM users WHERE email = ? OR username = ?',
      identifier,
      identifier,
    );

    if (!row || !verifyPassword(body.password, row.password_hash)) {
      recordSecurityEvent({
        userId: row?.id ?? null,
        event: 'login',
        outcome: 'failure',
        req,
        metadata: { identifier },
      });
      throw conflict('Those credentials did not match an account.');
    }

    if (row.account_status === 'suspended') {
      recordSecurityEvent({ userId: row.id, event: 'login', outcome: 'blocked', req });
      throw conflict('This account is suspended. Contact support for help.');
    }

    const session = createSession(row.id, clientIp(req), req.headers['user-agent']);
    setSessionCookie(res, session.token, session.expiresAt);
    run('UPDATE users SET last_active_at = ? WHERE id = ?', nowIso(), row.id);
    recordSecurityEvent({ userId: row.id, event: 'login', outcome: 'success', req });
    res.json({ user: publicUser(row.id) });
  }),
);

authRouter.post(
  '/logout',
  handler((req, res) => {
    const token = (req.cookies?.[SESSION_COOKIE] as string | undefined) ?? null;
    if (token) revokeSession(token);
    clearSessionCookie(res);
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/me',
  handler((req, res) => {
    if (!req.ctx) {
      res.json({ user: null, permissions: guestPermissions() });
      return;
    }
    const user = publicUser(req.ctx.user.id)!;
    const wallet = getSetting<Record<string, boolean>>('feature_config', {}).wallet_enabled === false
      ? null
      : getWallet(req.ctx.user.id);
    res.json({
      user,
      wallet,
      unreadNotifications: unreadCount(req.ctx.user.id),
      permissions: permissionsFor(req.ctx.user),
    });
  }),
);

const profileSchema = z.object({
  displayName: displayNameSchema,
  bio: z.string().trim().max(400, 'Keep your bio under 400 characters.').optional().default(''),
});

authRouter.patch(
  '/profile',
  handler((req, res) => {
    const user = currentUser(req);
    const body = parseBody(profileSchema, req.body);
    run('UPDATE users SET display_name = ?, bio = ?, updated_at = ? WHERE id = ?', body.displayName, body.bio, nowIso(), user.id);
    audit({ actor: user, action: 'user.profile_updated', targetType: 'user', targetId: user.id, ip: clientIp(req) });
    res.json({ user: publicUser(user.id) });
  }),
);

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: passwordSchema,
});

authRouter.post(
  '/password',
  handler((req, res) => {
    const user = currentUser(req);
    const body = parseBody(passwordChangeSchema, req.body);
    const row = get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', user.id)!;
    if (!verifyPassword(body.currentPassword, row.password_hash)) {
      recordSecurityEvent({ userId: user.id, event: 'password_change', outcome: 'failure', req });
      throw conflict('Your current password is incorrect.');
    }
    run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', hashPassword(body.newPassword), nowIso(), user.id);
    audit({ actor: user, action: 'user.password_changed', targetType: 'user', targetId: user.id, ip: clientIp(req) });
    recordSecurityEvent({ userId: user.id, event: 'password_change', outcome: 'success', req });
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/sessions',
  handler((req, res) => {
    const user = currentUser(req);
    const rows = all(
      `SELECT id, created_at, expires_at, last_used_at, ip, user_agent
         FROM sessions WHERE user_id = ? ORDER BY last_used_at DESC`,
      user.id,
    ).map((r) => ({ ...r, current: r.id === req.ctx?.sessionId }));
    res.json({ items: rows });
  }),
);

authRouter.delete(
  '/sessions/:id',
  handler((req, res) => {
    const user = currentUser(req);
    const result = run('DELETE FROM sessions WHERE id = ? AND user_id = ?', req.params.id, user.id);
    if (result.changes === 0) throw notFound('That session no longer exists.');
    res.json({ ok: true });
  }),
);

authRouter.post(
  '/achievements/evaluate',
  handler((req, res) => {
    const user = currentUser(req);
    res.json({ awarded: evaluateAchievements(user.id) });
  }),
);

// ------------------------------------------------------------------ helpers

export function publicUser(id: string) {
  const row = get<{
    id: string;
    email: string;
    username: string;
    display_name: string;
    role: string;
    account_status: string;
    bio: string;
    created_at: string;
  }>(
    `SELECT id, email, username, display_name, role, account_status, bio, created_at
       FROM users WHERE id = ?`,
    id,
  );
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    accountStatus: row.account_status,
    bio: row.bio,
    createdAt: row.created_at,
    isAdmin: row.role === 'admin',
    isCreator: row.role === 'creator' || row.role === 'admin',
  };
}

export function permissionsFor(user: SessionUser) {
  const features = getSetting<Record<string, boolean>>('feature_config', {});
  return {
    canCreate: user.role === 'creator' || user.role === 'admin',
    canModerate: user.role === 'admin',
    canManageUsers: user.role === 'admin',
    canManageQCoins: user.role === 'admin',
    canManageConfig: user.role === 'admin',
    canExportReports: user.role === 'admin',
    features,
  };
}

export function guestPermissions() {
  return {
    canCreate: false,
    canModerate: false,
    canManageUsers: false,
    canManageQCoins: false,
    canManageConfig: false,
    canExportReports: false,
    features: getSetting<Record<string, boolean>>('feature_config', {}),
  };
}

export function statsFor(userId: string) {
  return {
    quizzesCreated: count('SELECT COUNT(*) AS total FROM quizzes WHERE creator_id = ?', userId),
    quizzesPublished: count("SELECT COUNT(*) AS total FROM quizzes WHERE creator_id = ? AND status = 'approved'", userId),
    pollsPublished: count("SELECT COUNT(*) AS total FROM polls WHERE creator_id = ? AND status = 'published'", userId),
    attempts: count("SELECT COUNT(*) AS total FROM quiz_attempts WHERE user_id = ? AND status = 'submitted'", userId),
  };
}
