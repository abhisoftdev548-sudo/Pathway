import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { requireValidObjectIdParam } from '../middleware/validate.js';
import { Notification } from '../models/Notification.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { notFound } from '../utils/errors.js';
import { paginate, paginationSchema } from '../utils/pagination.js';

export const notificationsRouter = Router();

const listSchema = paginationSchema.extend({
  unreadOnly: z.enum(['true', 'false']).optional(),
});

notificationsRouter.get(
  '/me/notifications',
  requireAuth,
  validate(listSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { page, limit, unreadOnly } = req.validatedQuery as { page: number; limit: number; unreadOnly?: string };
    const filter: Record<string, unknown> = { userId: req.user!.id };
    if (unreadOnly === 'true') filter.readAt = null;
    const [items, total, unread] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId: req.user!.id, readAt: null }),
    ]);
    res.json({
      ...paginate(
        items.map((item) => ({
          id: String(item._id),
          type: item.type,
          title: item.title,
          message: item.message,
          link: item.link,
          read: Boolean(item.readAt),
          createdAt: item.createdAt,
        })),
        total,
        page,
        limit,
      ),
      unreadCount: unread,
    });
  }),
);

notificationsRouter.patch(
  '/me/notifications/:id/read',
  requireAuth,
  requireValidObjectIdParam(),
  asyncHandler(async (req, res) => {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id },
      { $set: { readAt: new Date() } },
      { new: true },
    );
    if (!notification) throw notFound('Notification not found');
    res.json({ notification });
  }),
);

notificationsRouter.post(
  '/me/notifications/read-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await Notification.updateMany(
      { userId: req.user!.id, readAt: null },
      { $set: { readAt: new Date() } },
    );
    res.json({ updated: result.modifiedCount });
  }),
);

notificationsRouter.delete(
  '/me/notifications/:id',
  requireAuth,
  requireValidObjectIdParam(),
  asyncHandler(async (req, res) => {
    const result = await Notification.deleteOne({ _id: req.params.id, userId: req.user!.id });
    if (result.deletedCount === 0) throw notFound('Notification not found');
    res.json({ success: true });
  }),
);
