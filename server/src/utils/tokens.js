import jwt from 'jsonwebtoken';
import { randomToken, sha256 } from './crypto.js';

/**
 * Token lifecycle utilities.
 *
 * Access tokens: short-lived JWTs sent in `Authorization: Bearer`, never stored
 * in persistent browser storage by the client (kept in memory).
 *
 * Refresh tokens: opaque random strings delivered in an HttpOnly cookie. Only a
 * SHA-256 hash is persisted server-side; each use rotates the token (reuse of a
 * rotated token revokes the whole session family).
 */

export function signAccessToken(payload, { secret, ttl }) {
  return jwt.sign(payload, secret, { expiresIn: ttl, issuer: 'quizsphere' });
}

export function verifyAccessToken(token, { secret }) {
  return jwt.verify(token, secret, { issuer: 'quizsphere' });
}

export function signRefreshJwt(payload, { secret, ttlDays }) {
  return jwt.sign(payload, secret, {
    expiresIn: `${ttlDays}d`,
    issuer: 'quizsphere',
  });
}

export function verifyRefreshJwt(token, { secret }) {
  return jwt.verify(token, secret, { issuer: 'quizsphere' });
}

/** Create a refresh token record payload (value returned to the client, hash stored). */
export function issueRefreshToken({ userId, familyId, ttlDays, userAgent, ip }) {
  const value = randomToken(48);
  return {
    value,
    record: {
      user: userId,
      familyId,
      tokenHash: sha256(value),
      expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
      userAgent: userAgent ?? null,
      ip: ip ?? null,
    },
  };
}

export { sha256, randomToken };
