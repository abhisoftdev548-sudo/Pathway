import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/errors.js';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
}

export function notFoundHandler(req: Request, res: Response): void {
  const body: ErrorBody = {
    error: { code: 'NOT_FOUND', message: `Endpoint ${req.method} ${req.originalUrl} does not exist` },
    requestId: req.requestId,
  };
  res.status(404).json(body);
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong on our side. Please try again.';
  let details: unknown;

  if (error instanceof AppError) {
    status = error.statusCode;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (error instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Some fields are invalid. Please review the highlighted values.';
    details = error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
  } else if (error instanceof mongoose.Error.ValidationError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'The submitted data is invalid.';
    details = Object.values(error.errors).map((issue) => ({ path: issue.path, message: issue.message }));
  } else if (error instanceof mongoose.Error.CastError) {
    status = 400;
    code = 'INVALID_IDENTIFIER';
    message = `Invalid value for ${error.path}`;
  } else if (typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000) {
    status = 409;
    code = 'DUPLICATE_RESOURCE';
    const keys = Object.keys((error as { keyValue?: Record<string, unknown> }).keyValue ?? {});
    message = keys.includes('email')
      ? 'An account with this email already exists.'
      : 'A record with these details already exists.';
    details = keys.length > 0 ? [{ path: keys.join(','), message: 'Must be unique' }] : undefined;
  } else if (error instanceof SyntaxError && 'body' in error) {
    status = 400;
    code = 'INVALID_JSON';
    message = 'The request body contains invalid JSON.';
  } else if (typeof error === 'object' && error !== null && (error as { name?: string }).name === 'TokenExpiredError') {
    status = 401;
    code = 'SESSION_EXPIRED';
    message = 'Your session has expired. Please sign in again.';
  } else if (typeof error === 'object' && error !== null && (error as { name?: string }).name === 'JsonWebTokenError') {
    status = 401;
    code = 'UNAUTHORIZED';
    message = 'Your session is invalid. Please sign in again.';
  }

  const logPayload = {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    status,
    code,
    userId: req.user?.id,
    err: error instanceof Error ? error : { message: String(error) },
  };
  if (status >= 500) logger.error(logPayload, 'Unhandled request error');
  else logger.warn(logPayload, 'Request failed');

  if (res.headersSent) return;
  const body: ErrorBody = {
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      ...(env.isProduction || status < 500 ? {} : { hint: 'Check the server logs for the request id.' }),
    },
    requestId: req.requestId,
  };
  res.status(status).json(body);
}
