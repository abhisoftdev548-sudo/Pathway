import { z } from 'zod';
import { timezoneSchema } from './common.js';

const reminderTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time such as 19:30');

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    avatar: z.union([z.string().url().max(500), z.literal('')]).optional(),
    bio: z.string().max(280).optional(),
    dailyGoalMinutes: z.coerce.number().int().min(5).max(480).optional(),
    timezone: timezoneSchema.optional(),
    preferences: z
      .object({
        emailNotifications: z.boolean().optional(),
        inAppReminders: z.boolean().optional(),
        reminderTime: reminderTimeSchema.optional(),
        weekStartsOn: z.union([z.literal(0), z.literal(1)]).optional(),
        showCompletedTasks: z.boolean().optional(),
        reduceMotion: z.boolean().optional(),
        weeklyGoalTasks: z.coerce.number().int().min(1).max(200).optional(),
      })
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });

export const notificationReadSchema = z.object({
  read: z.boolean().default(true),
});
