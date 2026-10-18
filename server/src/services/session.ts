import type { Response } from 'express';
import type { UserDocument } from '../models/User.js';
import {
  generateCsrfToken,
  setAuthCookies,
  setCsrfCookie,
  signAccessToken,
  signRefreshToken,
} from './tokenService.js';

export function issueSession(res: Response, user: UserDocument): string {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  setAuthCookies(res, accessToken, refreshToken);
  const csrfToken = generateCsrfToken();
  setCsrfCookie(res, csrfToken);
  return csrfToken;
}
