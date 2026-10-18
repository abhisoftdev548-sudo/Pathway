import { z } from 'zod';
import { clamp } from './http.js';

export const pagingSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export interface Paging {
  page: number;
  pageSize: number;
  offset: number;
}

export function paging(input: { page?: number; pageSize?: number }, defaultPageSize = 20): Paging {
  const page = clamp(input.page ?? 1, 1, 10_000);
  const pageSize = clamp(input.pageSize ?? defaultPageSize, 1, 100);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export function pageResult<T>(items: T[], total: number, p: Paging): Page<T> {
  const totalPages = Math.max(1, Math.ceil(total / p.pageSize));
  return {
    items,
    page: p.page,
    pageSize: p.pageSize,
    total,
    totalPages,
    hasMore: p.page < totalPages,
  };
}

/** Builds a WHERE clause from a list of optional conditions. */
export class Where {
  clauses: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  add(sql: string, ...params: any[]): this {
    this.clauses.push(sql);
    this.params.push(...params);
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addIf(condition: unknown, sql: string, ...params: any[]): this {
    if (condition === undefined || condition === null || condition === '') return this;
    return this.add(sql, ...params);
  }

  build(prefix = 'WHERE'): string {
    if (!this.clauses.length) return '';
    return `${prefix} ${this.clauses.join(' AND ')}`;
  }
}

export function dateRangeTo(from?: string, to?: string): { from: string; to: string } {
  const now = new Date();
  const toDate = to ? new Date(to) : now;
  const fromDate = from ? new Date(from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const safeTo = Number.isNaN(toDate.getTime()) ? now : toDate;
  const safeFrom = Number.isNaN(fromDate.getTime()) ? new Date(now.getTime() - 30 * 86400000) : fromDate;
  return { from: safeFrom.toISOString(), to: safeTo.toISOString() };
}

export function dayKey(iso: string): string {
  return iso.slice(0, 10);
}
