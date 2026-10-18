import type { Types } from 'mongoose';
import { Notification } from '../models/Notification.js';
import type { NotificationType } from '../models/constants.js';

export async function createNotification(input: {
  userId: string | Types.ObjectId;
  type?: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
}) {
  return Notification.create({
    userId: input.userId,
    type: input.type ?? 'system',
    title: input.title,
    message: input.message,
    link: input.link ?? '',
    metadata: input.metadata ?? {},
  });
}

export async function notifyAchievement(
  userId: string | Types.ObjectId,
  achievement: { key: string; title: string; description: string },
) {
  await createNotification({
    userId,
    type: 'achievement',
    title: `Achievement unlocked: ${achievement.title}`,
    message: achievement.description,
    link: '/achievements',
    metadata: { achievementKey: achievement.key },
  });
}
