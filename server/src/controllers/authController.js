import * as authService from '../services/authService.js';
import { sendSuccess } from '../utils/responses.js';
import { asyncHandler } from '../utils/ApiError.js';
import { issueCsrfCookie } from '../middleware/csrf.js';
import config from '../config/env.js';

const REFRESH_COOKIE = 'qs_refresh';

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: config.cookies.secure,
    sameSite: config.cookies.sameSite,
    path: '/api/v1/auth',
    maxAge: config.tokens.refreshTtlDays * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
}

export const register = asyncHandler(async (req, res) => {
  const { userAgent, ip } = { userAgent: req.headers['user-agent'], ip: req.ip };
  const result = await authService.register(req.body, { userAgent, ip });
  setRefreshCookie(res, result.refreshToken);
  issueCsrfCookie(res);
  return sendSuccess(
    res,
    { user: result.user, accessToken: result.accessToken },
    undefined,
    201
  );
});

export const login = asyncHandler(async (req, res) => {
  const { userAgent, ip } = { userAgent: req.headers['user-agent'], ip: req.ip };
  const result = await authService.login(req.body, { userAgent, ip });
  setRefreshCookie(res, result.refreshToken);
  issueCsrfCookie(res);
  return sendSuccess(res, { user: result.user, accessToken: result.accessToken });
});

export const refresh = asyncHandler(async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  const result = await authService.rotateRefreshToken(raw, {
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });
  setRefreshCookie(res, result.refreshToken);
  issueCsrfCookie(res);
  return sendSuccess(res, { user: result.user, accessToken: result.accessToken });
});

export const logout = asyncHandler(async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  await authService.revokeSession(raw);
  clearRefreshCookie(res);
  return sendSuccess(res, { loggedOut: true });
});

export const me = asyncHandler(async (req, res) => {
  return sendSuccess(res, { user: authService.publicUser(req.user) });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body);
  return sendSuccess(res, {
    issued: result.issued,
    // Surfaced in non-production only so the flow is testable without email delivery.
    ...(result.devResetToken ? { devResetToken: result.devResetToken, devResetUrl: result.devResetUrl } : {}),
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body);
  return sendSuccess(res, { reset: true });
});

export const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword({ user: req.user, ...req.body });
  return sendSuccess(res, { changed: true });
});

export const sessions = asyncHandler(async (req, res) => {
  const items = await authService.listSessions(req.user._id);
  return sendSuccess(res, { items });
});

export const revokeOtherSessions = asyncHandler(async (req, res) => {
  const count = await authService.revokeAllSessions(req.user._id);
  return sendSuccess(res, { revoked: count });
});
