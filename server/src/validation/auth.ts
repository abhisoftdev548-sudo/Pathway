import { z } from 'zod';
import { passwordSchema, timezoneSchema } from './common.js';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(254),
  password: passwordSchema,
  timezone: timezoneSchema.optional(),
  dailyGoalMinutes: z.coerce.number().int().min(5).max(480).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required').max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f\d]{64}$/i, 'Reset token is invalid'),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(128),
  newPassword: passwordSchema,
});
