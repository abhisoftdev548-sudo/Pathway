import { newId, nowIso, run, all, count, get } from '../db/index.js';
import { getSetting } from './settings.js';

export type NotificationKind =
  | 'quiz_review'
  | 'poll_review'
  | 'wallet'
  | 'moderation'
  | 'achievement'
  | 'system'
  | 'rating';

export interface NotifyInput {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  link?: string | null;
}

export function notify(input: NotifyInput): void {
  if (getSetting<Record<string, boolean>>('feature_config', {}).notifications_enabled === false) return;
  run(
    `INSERT INTO notifications (id, user_id, kind, title, body, link, created_at)
     VALUES (?,?,?,?,?,?,?)`,
    newId(),
    input.userId,
    input.kind,
    input.title,
    input.body ?? '',
    input.link ?? null,
    nowIso(),
  );
}

export function notifyMany(userIds: string[], input: Omit<NotifyInput, 'userId'>): void {
  for (const userId of new Set(userIds)) notify({ ...input, userId });
}

/** Renders a configured notification template, falling back to the raw text. */
export function renderTemplate(key: string, vars: Record<string, string | number>, fallback: string): string {
  const templates = getSetting<Record<string, string>>('notification_templates', {});
  const template = templates[key];
  if (!template) return fallback;
  return template.replace(/\{(\w+)\}/g, (_m, name: string) => String(vars[name] ?? ''));
}

export function unreadCount(userId: string): number {
  return count('SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND read_at IS NULL', userId);
}

export function listNotifications(
  userId: string,
  limit: number,
  offset: number,
  filter: 'all' | 'unread' = 'all',
) {
  const unreadOnly = filter === 'unread';
  const rows = all(
    `SELECT id, kind, title, body, link, read_at, created_at
       FROM notifications
      WHERE user_id = ? ${unreadOnly ? 'AND read_at IS NULL' : ''}
      ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?`,
    userId,
    limit,
    offset,
  );
  const total = count(
    `SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? ${unreadOnly ? 'AND read_at IS NULL' : ''}`,
    userId,
  );
  return { rows, total };
}

export function markRead(userId: string, id: string): boolean {
  const res = run(
    'UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL',
    nowIso(),
    id,
    userId,
  );
  return res.changes > 0;
}

export function markAllRead(userId: string): number {
  return run('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', nowIso(), userId).changes;
}

export function notifyAdmins(input: Omit<NotifyInput, 'userId'>): void {
  const admins = all<{ id: string }>("SELECT id FROM users WHERE role = 'admin' AND account_status = 'active'");
  notifyMany(
    admins.map((a) => a.id),
    input,
  );
}

export function notificationExists(userId: string, link: string): boolean {
  return !!get('SELECT id FROM notifications WHERE user_id = ? AND link = ? AND read_at IS NULL', userId, link);
}
