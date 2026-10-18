import { z } from 'zod';
import { ENROLLMENT_STATUSES, LEARNING_PACES } from '../models/constants.js';

export const enrollSchema = z
  .object({
    learningPace: z.enum(LEARNING_PACES).default('standard'),
    customDailyGoal: z.coerce.number().int().min(5).max(300).nullable().optional(),
  })
  .refine((value) => value.learningPace !== 'custom' || (value.customDailyGoal ?? 0) >= 5, {
    message: 'Set a custom daily goal of at least 5 minutes',
    path: ['customDailyGoal'],
  });

export const updateEnrollmentSchema = z
  .object({
    status: z.enum(ENROLLMENT_STATUSES).optional(),
    learningPace: z.enum(LEARNING_PACES).optional(),
    customDailyGoal: z.coerce.number().int().min(5).max(300).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' })
  .refine((value) => value.learningPace !== 'custom' || value.customDailyGoal != null, {
    message: 'Set a custom daily goal',
    path: ['customDailyGoal'],
  });
