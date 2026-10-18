import Notification from '../models/Notification.js';
import { NOTIFICATION_TYPES } from '../constants/index.js';

/** Create a notification for one user. */
export async function notify({ userId, type = NOTIFICATION_TYPES.SYSTEM, title, body = '', link = '', metadata = {} }) {
  if (!userId || !title) return null;
  return Notification.create({ user: userId, type, title, body, link, metadata });
}

/** Create notifications for many users (e.g. participants of a poll that ended). */
export async function notifyMany(userIds = [], payload = {}) {
  const unique = [...new Set(userIds.map(String))];
  if (unique.length === 0) return 0;
  const docs = unique.map((userId) => ({ user: userId, ...payload }));
  const result = await Notification.insertMany(docs);
  return result.length;
}

export async function listNotifications({ userId, page = 1, limit = 20, unreadOnly = false }) {
  const filter = { user: userId };
  if (unreadOnly) filter.readAt = null;
  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: userId, readAt: null }),
  ]);
  return { items, total, unreadCount };
}

export async function markRead(userId, notificationId) {
  return Notification.findOneAndUpdate(
    { _id: notificationId, user: userId, readAt: null },
    { $set: { readAt: new Date() } },
    { new: true }
  ).lean();
}

export async function markAllRead(userId) {
  const result = await Notification.updateMany({ user: userId, readAt: null }, { $set: { readAt: new Date() } });
  return result.modifiedCount ?? 0;
}

export default { notify, notifyMany, listNotifications, markRead, markAllRead };
