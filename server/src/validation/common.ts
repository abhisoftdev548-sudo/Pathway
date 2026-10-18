import { z } from 'zod';
import { DIFFICULTIES, LEARNING_PACES, RESOURCE_TYPES, TASK_TYPES } from '../models/constants.js';
import { isValidTimeZone } from '../utils/time.js';

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128, 'Password must be at most 128 characters')
  .superRefine((value, ctx) => {
    if (!/[a-z]/.test(value)) ctx.addIssue({ code: 'custom', message: 'Add at least one lowercase letter' });
    if (!/[A-Z]/.test(value)) ctx.addIssue({ code: 'custom', message: 'Add at least one uppercase letter' });
    if (!/[0-9]/.test(value)) ctx.addIssue({ code: 'custom', message: 'Add at least one number' });
  });

export const timezoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(isValidTimeZone, 'Unknown timezone. Use an IANA timezone such as Asia/Kolkata.');

export const resourceSchema = z.object({
  title: z.string().trim().min(2).max(200),
  url: z.string().url().max(500),
  type: z.enum(RESOURCE_TYPES).default('suggestion'),
  verified: z.boolean().default(false),
});

export const difficultySchema = z.enum(DIFFICULTIES);
export const taskTypeSchema = z.enum(TASK_TYPES);
export const learningPaceSchema = z.enum(LEARNING_PACES);

export const durationSchema = z
  .object({
    minWeeks: z.number().int().min(0).max(104).default(4),
    maxWeeks: z.number().int().min(0).max(104).default(8),
    totalHours: z.number().min(0).max(5000).default(0),
  })
  .refine((value) => value.maxWeeks >= value.minWeeks, {
    message: 'Maximum duration must be greater than or equal to minimum duration',
  });
