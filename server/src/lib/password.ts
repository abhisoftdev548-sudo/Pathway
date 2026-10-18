import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(200, 'Password is too long.')
  .regex(/[a-zA-Z]/, 'Include at least one letter.')
  .regex(/[0-9]/, 'Include at least one number.');

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters.')
  .max(24, 'Username must be 24 characters or fewer.')
  .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers and underscores only.');

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address.');

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'Display name must be at least 2 characters.')
  .max(48, 'Display name must be 48 characters or fewer.');
