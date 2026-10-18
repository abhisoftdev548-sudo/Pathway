import * as notificationService from '../services/notificationService.js';
import { sendSuccess, parsePagination, paginationMeta } from '../utils/responses.js';
import { asyncHandler, ApiError } from '../utils/ApiError.js';

export const list = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const unreadOnly = (req.validatedQuery?.unread ?? req.query.unread) === 'true';
  const result = await notificationService.listNotifications({
    userId: req.user._id,
    page,
    limit,
    unreadOnly,
  });
  return sendSuccess(
    res,
    { items: result.items, unreadCount: result.unreadCount },
    paginationMeta({ page, limit, total: result.total })
  );
});

export const markRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markRead(req.user._id, req.params.id);
  if (!notification) throw ApiError.notFound('Notification not found or already read');
  return sendSuccess(res, { notification });
});

export const markAllRead = asyncHandler(async (req, res) => {
  const count = await notificationService.markAllRead(req.user._id);
  return sendSuccess(res, { marked: count });
});
