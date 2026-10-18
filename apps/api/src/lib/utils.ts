import { randomUUID } from 'node:crypto';

export const id = () => randomUUID();
export const now = () => new Date().toISOString();

export function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80) || 'quiz';
}
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export class ApiError extends Error {
  status: number; code: string; details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) { super(message); this.status = status; this.code = code; this.details = details; }
}
export const badRequest = (m: string, d?: unknown) => new ApiError(400, 'BAD_REQUEST', m, d);
export const unauthorized = (m = 'Authentication required') => new ApiError(401, 'UNAUTHORIZED', m);
export const forbidden = (m = 'You do not have permission to perform this action') => new ApiError(403, 'FORBIDDEN', m);
export const notFound = (m = 'Resource not found') => new ApiError(404, 'NOT_FOUND', m);
export const conflict = (m: string) => new ApiError(409, 'CONFLICT', m);

import { ZodError, type ZodSchema } from 'zod';
export function parse<T>(schema: ZodSchema<T>, data: unknown): T {
  try { return schema.parse(data); }
  catch (e) {
    if (e instanceof ZodError) throw new ApiError(400, 'VALIDATION_ERROR', 'Validation failed', e.flatten());
    throw e;
  }
}
export function paginate<T>(items: T[], page = 1, limit = 12) {
  const p = Math.max(1, page); const l = Math.min(60, Math.max(1, limit));
  const total = items.length; const pages = Math.max(1, Math.ceil(total / l));
  return { items: items.slice((p - 1) * l, p * l), pagination: { page: p, limit: l, total, pages } };
}
