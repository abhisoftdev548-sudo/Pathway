import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import { ApiError } from '../utils/ApiError.js';
import { issueRefreshToken, signAccessToken, sha256, randomToken } from '../utils/tokens.js';
import config from '../config/env.js';
import { grantSignupBonus } from './walletService.js';
import { ACCOUNT_STATUS, ECONOMY_LIMITS, NOTIFICATION_TYPES, ROLES } from '../constants/index.js';
import { notify } from './notificationService.js';

const SALT_ROUNDS = 12;

export function signAccessFor(user) {
  return signAccessToken(
    { sub: String(user._id), role: user.role, email: user.email },
    { secret: config.tokens.accessSecret, ttl: config.tokens.accessTtl }
  );
}

export function publicUser(user) {
  const u = typeof user.toObject === 'function' ? user.toObject() : { ...user };
  delete u.passwordHash;
  delete u.resetPasswordHash;
  delete u.resetPasswordExpiresAt;
  return u;
}

/**
 * Register a new user. Optionally bootstraps the first account as admin.
 */
export async function register({ name, email, password }, { userAgent, ip } = {}) {
  const existing = await User.findOne({ email });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const userCount = await User.estimatedDocumentCount();
  const role = config.bootstrapFirstAdmin && userCount === 0 ? ROLES.ADMIN : ROLES.USER;

  const user = await User.create({ name, email, passwordHash, role });

  if (ECONOMY_LIMITS.SIGNUP_BONUS > 0) {
    await grantSignupBonus(user._id, ECONOMY_LIMITS.SIGNUP_BONUS).catch(() => {});
  }

  await notify({
    userId: user._id,
    type: NOTIFICATION_TYPES.ACCOUNT,
    title: 'Welcome to QuizSphere',
    body:
      ECONOMY_LIMITS.SIGNUP_BONUS > 0
        ? `Your account is ready. We added ${ECONOMY_LIMITS.SIGNUP_BONUS} QCoins to your wallet to get you started.`
        : 'Your account is ready. Create quizzes and polls, or explore what others have published.',
    link: '/dashboard',
  });

  const tokens = await issueSession({ user, userAgent, ip });
  return { user: publicUser(user), ...tokens };
}

export async function login({ email, password }, { userAgent, ip } = {}) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');

  if (user.status === ACCOUNT_STATUS.SUSPENDED) {
    throw ApiError.forbidden('Your account has been suspended', 'ACCOUNT_SUSPENDED');
  }

  user.lastActiveAt = new Date();
  await user.save();

  const tokens = await issueSession({ user, userAgent, ip });
  return { user: publicUser(user), ...tokens };
}

/** Create an access token + a persisted (hashed) refresh token session. */
export async function issueSession({ user, userAgent, ip, familyId = crypto.randomUUID() }) {
  const accessToken = signAccessFor(user);
  const { value, record } = issueRefreshToken({
    userId: user._id,
    familyId,
    ttlDays: config.tokens.refreshTtlDays,
    userAgent,
    ip,
  });
  await RefreshToken.create(record);
  return { accessToken, refreshToken: value, familyId };
}

/**
 * Rotate a refresh token.
 *
 *  - Valid token → revoked and replaced with a new one in the same family.
 *  - Rotated token presented again (reuse) → the whole family is revoked
 *    (possible theft) and the user must log in again.
 */
export async function rotateRefreshToken(rawToken, { userAgent, ip } = {}) {
  if (!rawToken) throw ApiError.unauthorized('Missing refresh token', 'MISSING_REFRESH');

  const tokenHash = sha256(rawToken);
  const record = await RefreshToken.findOne({ tokenHash });
  if (!record) throw ApiError.unauthorized('Invalid refresh token', 'INVALID_REFRESH');

  if (record.reusedAt || record.replacedByHash) {
    // Reuse of a rotated token → revoke the entire session family.
    record.reusedAt = new Date();
    await record.save();
    await RefreshToken.updateMany({ familyId: record.familyId, revokedAt: null }, { $set: { revokedAt: new Date() } });
    throw ApiError.unauthorized('Session revoked due to token reuse', 'REFRESH_REUSED');
  }

  if (record.revokedAt) {
    await RefreshToken.updateMany({ familyId: record.familyId, revokedAt: null }, { $set: { revokedAt: new Date() } });
    throw ApiError.unauthorized('Session has been revoked', 'REFRESH_REVOKED');
  }

  if (record.expiresAt.getTime() < Date.now()) {
    record.revokedAt = new Date();
    await record.save();
    throw ApiError.unauthorized('Session expired — please log in again', 'REFRESH_EXPIRED');
  }

  const user = await User.findById(record.user);
  if (!user || user.status === ACCOUNT_STATUS.SUSPENDED) {
    await RefreshToken.updateMany({ familyId: record.familyId, revokedAt: null }, { $set: { revokedAt: new Date() } });
    throw ApiError.forbidden('Account unavailable', 'ACCOUNT_SUSPENDED');
  }

  const { value: newValue, record: newRecord } = issueRefreshToken({
    userId: user._id,
    familyId: record.familyId,
    ttlDays: config.tokens.refreshTtlDays,
    userAgent,
    ip,
  });

  const created = await RefreshToken.create(newRecord);
  record.revokedAt = new Date();
  record.replacedByHash = created.tokenHash;
  await record.save();

  return {
    user: publicUser(user),
    accessToken: signAccessFor(user),
    refreshToken: newValue,
  };
}

/** Revoke the presented refresh token (its whole chain stays consistent). */
export async function revokeSession(rawToken) {
  if (!rawToken) return;
  const tokenHash = sha256(rawToken);
  await RefreshToken.updateOne({ tokenHash, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

/** Revoke every session of a user (e.g. password change / admin action). */
export async function revokeAllSessions(userId) {
  const result = await RefreshToken.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  return result.modifiedCount ?? 0;
}

export async function listSessions(userId) {
  return RefreshToken.find({ user: userId, revokedAt: null, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .select('familyId createdAt expiresAt userAgent ip')
    .lean();
}

/** Start password reset: always succeeds silently to avoid email enumeration. */
export async function forgotPassword({ email }) {
  const user = await User.findOne({ email });
  if (!user) return { issued: false };

  const raw = randomToken(32);
  const resetTokenHash = sha256(raw);
  user.resetPasswordHash = resetTokenHash;
  user.resetPasswordExpiresAt = new Date(Date.now() + config.tokens.passwordResetTtlMinutes * 60 * 1000);
  await user.save();

  // In production a delivery service would send this link. The token is surfaced
  // only in non-production so developers can exercise the flow end-to-end.
  const resetUrl = `${config.clientUrl}/reset-password?token=${raw}`;
  return {
    issued: true,
    ...(config.isProduction ? {} : { devResetToken: raw, devResetUrl: resetUrl }),
  };
}

export async function resetPassword({ token, password }) {
  const user = await User.findOne({ resetPasswordHash: sha256(token) }).select('+resetPasswordHash +resetPasswordExpiresAt');
  if (!user || !user.resetPasswordExpiresAt || user.resetPasswordExpiresAt.getTime() < Date.now()) {
    throw ApiError.badRequest('Reset link is invalid or expired', 'INVALID_RESET_TOKEN');
  }

  user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  user.passwordChangedAt = new Date();
  user.resetPasswordHash = undefined;
  user.resetPasswordExpiresAt = undefined;
  await user.save();

  await revokeAllSessions(user._id);
  await notify({
    userId: user._id,
    type: NOTIFICATION_TYPES.ACCOUNT,
    title: 'Password updated',
    body: 'Your password was changed and all active sessions were signed out.',
    link: '/settings',
  });

  return { success: true };
}

export async function changePassword({ user, currentPassword, newPassword }) {
  const full = await User.findById(user._id).select('+passwordHash');
  const ok = await bcrypt.compare(currentPassword, full.passwordHash);
  if (!ok) throw ApiError.badRequest('Current password is incorrect', 'INVALID_CREDENTIALS');

  full.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  full.passwordChangedAt = new Date();
  await full.save();

  await revokeAllSessions(user._id);
  return { success: true };
}

export default {
  register,
  login,
  rotateRefreshToken,
  revokeSession,
  revokeAllSessions,
  listSessions,
  forgotPassword,
  resetPassword,
  changePassword,
  publicUser,
};
