import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Response } from 'express';
import { cookieNames, env } from '../config/env.js';
import { unacceptableToken } from './tokenErrors.js';

export interface TokenPayload {
  sub: string;
  role: 'user' | 'admin';
  ver: number;
  typ: 'access' | 'refresh';
}

const ISSUER = 'pathforge-api';

function sign(payload: Omit<TokenPayload, 'typ'>, type: TokenPayload['typ'], secret: string, ttl: string): string {
  return jwt.sign({ ...payload, typ: type }, secret, {
    expiresIn: ttl as SignOptions['expiresIn'],
    issuer: ISSUER,
    audience: 'pathforge-web',
  });
}

export function signAccessToken(user: { _id: unknown; role: 'user' | 'admin'; tokenVersion?: number | null }): string {
  return sign(
    { sub: String(user._id), role: user.role, ver: user.tokenVersion ?? 0 },
    'access',
    env.accessSecret,
    env.accessTokenTtl,
  );
}

export function signRefreshToken(user: { _id: unknown; role: 'user' | 'admin'; tokenVersion?: number | null }): string {
  return sign(
    { sub: String(user._id), role: user.role, ver: user.tokenVersion ?? 0 },
    'refresh',
    env.refreshSecret,
    env.refreshTokenTtl,
  );
}

export function verifyAccessToken(token: string): TokenPayload {
  const payload = jwt.verify(token, env.accessSecret, { issuer: ISSUER, audience: 'pathforge-web' }) as TokenPayload;
  if (payload.typ !== 'access') throw unacceptableToken();
  return payload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  const payload = jwt.verify(token, env.refreshSecret, { issuer: ISSUER, audience: 'pathforge-web' }) as TokenPayload;
  if (payload.typ !== 'refresh') throw unacceptableToken();
  return payload;
}

export function generateCsrfToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

function requestIsHttps(res: Response): boolean {
  const forwarded = res.req?.headers['x-forwarded-proto'];
  const proto = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return Boolean(res.req?.secure || proto === 'https');
}

/**
 * Local HTTP keeps Lax cookies. An HTTPS preview embedded in another site can only
 * store cookies with SameSite=None; Secure (partitioned so they stay first-party to the preview).
 */
function cookieFlags(res: Response): { secure: boolean; sameSite: 'lax' | 'strict' | 'none'; partitioned?: boolean } {
  if (!env.isProduction && requestIsHttps(res)) {
    return { secure: true, sameSite: 'none', partitioned: true };
  }
  return { secure: env.cookieSecure, sameSite: env.cookieSameSite };
}

function cookieBase(res: Response) {
  return {
    httpOnly: true,
    domain: env.cookieDomain,
    ...cookieFlags(res),
  };
}

/** Parses simple TTL strings such as 15m, 12h or 7d. */
export function ttlToMs(ttl: string, fallbackMs: number): number {
  const match = /^(\d+)\s*(s|m|h|d)$/i.exec(ttl.trim());
  if (!match) return fallbackMs;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return value * multiplier;
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(cookieNames.access, accessToken, {
    ...cookieBase(res),
    path: '/',
    maxAge: ttlToMs(env.accessTokenTtl, 15 * 60 * 1000),
  });
  res.cookie(cookieNames.refresh, refreshToken, {
    ...cookieBase(res),
    path: '/api/auth',
    maxAge: ttlToMs(env.refreshTokenTtl, 7 * 24 * 60 * 60 * 1000),
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(cookieNames.access, { ...cookieBase(res), path: '/' });
  res.clearCookie(cookieNames.refresh, { ...cookieBase(res), path: '/api/auth' });
}

export function setCsrfCookie(res: Response, token: string): void {
  const flags = cookieFlags(res);
  res.cookie(cookieNames.csrf, token, {
    httpOnly: false,
    secure: flags.secure,
    sameSite: flags.sameSite,
    partitioned: flags.partitioned,
    domain: env.cookieDomain,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

/** Time in ms until the access token expires, useful for the client to refresh proactively. */
export function accessTokenMaxAgeMs(): number {
  return ttlToMs(env.accessTokenTtl, 15 * 60 * 1000);
}
