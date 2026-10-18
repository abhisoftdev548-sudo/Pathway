/**
 * Consistent API response envelope + pagination helpers.
 *
 * Success:  { success: true, data, meta? }
 * Failure:  { success: false, error: { code, message, details? } }
 */

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants/index.js';

export function sendSuccess(res, data = null, meta = undefined, status = 200) {
  const body = { success: true, data };
  if (meta !== undefined) body.meta = meta;
  return res.status(status).json(body);
}

export function sendError(res, status, code, message, details = undefined) {
  const error = { code, message };
  if (details !== undefined) error.details = details;
  return res.status(status).json({ success: false, error });
}

/**
 * Parse pagination query params defensively.
 * @param {{page?: unknown, limit?: unknown}} query
 */
export function parsePagination(query = {}) {
  const rawPage = Number.parseInt(query.page, 10);
  const rawLimit = Number.parseInt(query.limit, 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
  return { page, limit, skip: (page - 1) * limit };
}

export function paginationMeta({ page, limit, total }) {
  return {
    page,
    limit,
    total,
    totalPages: total > 0 ? Math.ceil(total / limit) : 0,
    hasMore: page * limit < total,
  };
}
