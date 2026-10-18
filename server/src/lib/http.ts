import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type TypeOf, type ZodTypeAny } from 'zod';
import { AppError, validationError } from './errors.js';

export type ApiHandler = (req: Request, res: Response) => unknown | Promise<unknown>;

/** Wraps a handler so thrown AppErrors become clean JSON responses. */
export function handler(fn: ApiHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

export function parseBody<S extends ZodTypeAny>(schema: S, body: unknown): TypeOf<S> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.length ? issue.path.join('.') : '_';
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    throw validationError('Please correct the highlighted fields.', fieldErrors);
  }
  return result.data;
}

export function parseQuery<S extends ZodTypeAny>(schema: S, query: unknown): TypeOf<S> {
  const result = schema.safeParse(query ?? {});
  if (!result.success) {
    throw validationError(
      'One or more filter values are invalid.',
      result.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`),
    );
  }
  return result.data;
}

export function asInt(value: unknown, fallback: number): number {
  const n = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function isZodError(err: unknown): err is ZodError {
  return err instanceof ZodError;
}

export function errorResponse(err: unknown): { status: number; body: Record<string, unknown> } {
  if (err instanceof AppError) {
    return {
      status: err.status,
      body: { error: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    };
  }
  if (isZodError(err)) {
    return {
      status: 422,
      body: { error: 'validation_error', message: 'Please correct the highlighted fields.' },
    };
  }
  return { status: 500, body: { error: 'server_error', message: 'Something went wrong on our side.' } };
}

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, 'not_found', 'No API endpoint matches this request.'));
}

export function logUnexpected(err: unknown, req: Request): void {
  if (err instanceof AppError && err.status < 500) return;
  // eslint-disable-next-line no-console
  console.error(`[api] ${req.method} ${req.originalUrl}`, err);
}
