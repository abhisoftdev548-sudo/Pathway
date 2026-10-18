import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/tokens.js';
import config from '../config/env.js';
import User from '../models/User.js';
import { ACCOUNT_STATUS, ROLES } from '../constants/index.js';

/**
 * Authenticate requests carrying `Authorization: Bearer <access token>`.
 * Access tokens are short-lived and verified for issuer/expiry/signature;
 * password changes after issuance invalidate them.
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Missing or malformed access token', 'MISSING_TOKEN');
  }

  let payload;
  try {
    payload = verifyAccessToken(token, { secret: config.tokens.accessSecret });
  } catch (err) {
    const code = err?.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
    throw ApiError.unauthorized('Invalid or expired access token', code);
  }

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('Account no longer exists', 'USER_NOT_FOUND');
  if (user.status === ACCOUNT_STATUS.SUSPENDED) {
    throw ApiError.forbidden('Account suspended', 'ACCOUNT_SUSPENDED');
  }
  if (user.changedPasswordAfter(payload.iat)) {
    throw ApiError.unauthorized('Password changed — please log in again', 'TOKEN_STALE');
  }

  req.user = user;
  req.tokenPayload = payload;
  next();
});

/**
 * Optional authentication — attaches `req.user` when a valid token is present,
 * but never rejects the request (used by public discovery endpoints).
 */
export const optionalAuthenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) {
    try {
      const payload = verifyAccessToken(token, { secret: config.tokens.accessSecret });
      const user = await User.findById(payload.sub);
      if (user && user.status === ACCOUNT_STATUS.ACTIVE && !user.changedPasswordAfter(payload.iat)) {
        req.user = user;
        req.tokenPayload = payload;
      }
    } catch {
      /* ignore — public route continues anonymously */
    }
  }
  next();
});

/** Role-based authorization. Always paired with `authenticate`. */
export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (roles.length > 0 && !roles.includes(req.user.role)) {
    return next(ApiError.forbidden('Insufficient permissions', 'FORBIDDEN_ROLE'));
  }
  return next();
};

export const isAdmin = (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role !== ROLES.ADMIN) {
    return next(ApiError.forbidden('Admin access required', 'FORBIDDEN_ROLE'));
  }
  return next();
};
