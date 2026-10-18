import type { UserDocument } from '../models/User.js';

export function publicUser(user: UserDocument | Record<string, any>) {
  const raw = typeof (user as UserDocument).toObject === 'function' ? (user as UserDocument).toObject() : user;
  return {
    id: String(raw.id ?? raw._id),
    name: raw.name,
    email: raw.email,
    role: raw.role,
    avatar: raw.avatar ?? '',
    bio: raw.bio ?? '',
    dailyGoalMinutes: raw.dailyGoalMinutes ?? 45,
    timezone: raw.timezone ?? 'UTC',
    preferences: {
      emailNotifications: false,
      inAppReminders: true,
      reminderTime: '19:00',
      weekStartsOn: 1,
      showCompletedTasks: true,
      reduceMotion: false,
      weeklyGoalTasks: 10,
      ...(raw.preferences ?? {}),
    },
    lastLoginAt: raw.lastLoginAt ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}
