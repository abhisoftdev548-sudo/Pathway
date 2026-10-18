import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { cookieNames } from '../config/env.js';
import { User } from '../models/User.js';
import { forbidden, unauthorized } from '../utils/errors.js';
import { verifyAccessToken } from '../services/tokenService.js';

async function loadUserFromAccessToken(req: Request): Promise<void> {
  const token = req.cookies?.[cookieNames.access] as string | undefined;
  if (!token) return;

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) return;
    throw error;
  }

  const user = await User.findById(payload.sub).select('name email role tokenVersion isActive');
  if (!user || !user.isActive) return;
  if (user.tokenVersion !== payload.ver) return;

  req.user = {
    id: String(user._id),
    role: user.role as 'user' | 'admin',
    name: user.name,
    email: user.email,
    tokenVersion: user.tokenVersion ?? 0,
  };
}

/** Requires a valid, unexpired access cookie. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    await loadUserFromAccessToken(req);
    if (!req.user) throw unauthorized('Please sign in to continue');
    next();
  } catch (error) {
    next(error);
  }
}

/** Attaches req.user when a valid session exists, but never blocks. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    await loadUserFromAccessToken(req);
    next();
  } catch (error) {
    next(error);
  }
}

/** Must be used after requireAuth. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(unauthorized('Please sign in to continue'));
  if (req.user.role !== 'admin') return next(forbidden('Administrator access required'));
  next();
}
