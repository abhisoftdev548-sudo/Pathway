import crypto from 'node:crypto';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { cookieNames, env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter, passwordResetLimiter } from '../middleware/rateLimit.js';
import { PasswordResetToken } from '../models/PasswordResetToken.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, conflict, notFound, unauthorized } from '../utils/errors.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { createNotification } from '../services/notifications.js';
import { issueSession } from '../services/session.js';
import { publicUser } from '../services/userService.js';
import {
  clearAuthCookies,
  generateCsrfToken,
  setAuthCookies,
  setCsrfCookie,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../services/tokenService.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '../validation/auth.js';

export const authRouter = Router();

authRouter.get('/csrf', (_req, res) => {
  const csrfToken = generateCsrfToken();
  setCsrfCookie(res, csrfToken);
  res.json({ csrfToken });
});

authRouter.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password, timezone, dailyGoalMinutes } = req.body;
    const existing = await User.findOne({ email });
    if (existing) throw conflict('An account with this email already exists', [{ path: 'email', message: 'Email already registered' }]);

    const passwordHash = await hashPassword(password);
    const user = await User.create({
      name,
      email,
      passwordHash,
      role: 'user', // role is never accepted from the client
      timezone: timezone ?? 'UTC',
      dailyGoalMinutes: dailyGoalMinutes ?? 45,
    });

    await createNotification({
      userId: user._id,
      type: 'system',
      title: 'Welcome to PathForge',
      message: 'Pick a roadmap, set a comfortable pace, and your daily plan will be waiting for you.',
      link: '/explore',
    });

    const csrfToken = issueSession(res, user);
    res.status(201).json({ user: publicUser(user), csrfToken });
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !user.isActive) throw unauthorized('Invalid email or password');
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) throw unauthorized('Invalid email or password');

    user.lastLoginAt = new Date();
    await user.save();
    const csrfToken = issueSession(res, user);
    res.json({ user: publicUser(user), csrfToken });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    // Revoking the token version invalidates every refresh cookie for this account.
    const refreshToken = req.cookies?.[cookieNames.refresh] as string | undefined;
    if (refreshToken) {
      try {
        const payload = verifyRefreshToken(refreshToken);
        await User.updateOne({ _id: payload.sub, tokenVersion: payload.ver }, { $inc: { tokenVersion: 1 } });
      } catch {
        // Expired/invalid refresh cookie: nothing to revoke.
      }
    }
    clearAuthCookies(res);
    res.json({ success: true });
  }),
);

authRouter.post(
  '/refresh',
  authLimiter,
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.[cookieNames.refresh] as string | undefined;
    if (!refreshToken) throw unauthorized('Session expired. Please sign in again.');
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
        throw unauthorized('Session expired. Please sign in again.');
      }
      throw error;
    }
    const user = await User.findById(payload.sub);
    if (!user || !user.isActive || (user.tokenVersion ?? 0) !== payload.ver) {
      throw unauthorized('Session expired. Please sign in again.');
    }
    const access = signAccessToken(user);
    const refresh = signRefreshToken(user);
    setAuthCookies(res, access, refresh);
    const csrfToken = generateCsrfToken();
    setCsrfCookie(res, csrfToken);
    res.json({ user: publicUser(user), csrfToken });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.id);
    if (!user) throw unauthorized('Account not found');
    const csrfToken = generateCsrfToken();
    setCsrfCookie(res, csrfToken);
    res.json({ user: publicUser(user), csrfToken });
  }),
);

authRouter.post(
  '/forgot-password',
  passwordResetLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    let devResetToken: string | undefined;
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await PasswordResetToken.create({
        userId: user._id,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });
      if (!env.isProduction) devResetToken = token;
    }
    res.json({
      message: 'If an account exists for that email, a password reset link has been created.',
      // Development only: no email provider is configured in the demo environment.
      ...(devResetToken ? { devResetToken, devResetUrl: `${env.appUrl}/reset-password?token=${devResetToken}` } : {}),
    });
  }),
);

authRouter.post(
  '/reset-password',
  passwordResetLimiter,
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const tokenHash = crypto.createHash('sha256').update(req.body.token).digest('hex');
    const record = await PasswordResetToken.findOne({ tokenHash, usedAt: null });
    if (!record || new Date(record.expiresAt).getTime() < Date.now()) {
      throw badRequest('This reset link is invalid or has expired. Request a new one.');
    }
    const user = await User.findById(record.userId);
    if (!user) throw notFound('Account not found');
    user.passwordHash = await hashPassword(req.body.password);
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();
    record.usedAt = new Date();
    await record.save();
    clearAuthCookies(res);
    res.json({ message: 'Password updated. Sign in with your new password.' });
  }),
);

authRouter.patch(
  '/password',
  requireAuth,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.id).select('+passwordHash');
    if (!user) throw notFound('Account not found');
    const valid = await verifyPassword(req.body.currentPassword, user.passwordHash);
    if (!valid) throw badRequest('Current password is incorrect');
    user.passwordHash = await hashPassword(req.body.newPassword);
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();
    const csrfToken = issueSession(res, user);
    res.json({ message: 'Password changed. Other sessions have been signed out.', csrfToken });
  }),
);
