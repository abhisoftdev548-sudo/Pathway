import { z } from 'zod';
import { REPORT_REASONS, REPORT_TARGETS, RATING_TARGETS } from '../constants/index.js';
import { objectId, paginationQuery } from './common.js';

export const ratingSchema = z.object({
  targetType: z.enum(Object.values(RATING_TARGETS)),
  targetId: objectId,
  score: z.number().int().min(1).max(5),
  review: z.string().trim().max(2000).optional().default(''),
});

export const reportSchema = z.object({
  targetType: z.enum(Object.values(REPORT_TARGETS)),
  targetId: objectId,
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(2000).optional().default(''),
});

export const notificationListQuery = paginationQuery.extend({
  unread: z.coerce.boolean().optional(),
});

export const walletQuery = paginationQuery.extend({
  type: z.string().trim().max(40).optional(),
});

export const leaderboardQuery = paginationQuery.extend({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  bio: z.string().trim().max(500).optional(),
  avatar: z
    .object({
      url: z.string().url().max(500),
      publicId: z.string().max(200).optional().default(''),
    })
    .nullable()
    .optional(),
  settings: z
    .object({
      emailNotifications: z.boolean().optional(),
      showOnLeaderboards: z.boolean().optional(),
      theme: z.enum(['system', 'light', 'dark']).optional(),
    })
    .optional(),
});

export const adminModerationSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'REQUEST_CHANGES', 'UNPUBLISH', 'RESTORE']),
  notes: z.string().trim().max(2000).optional().default(''),
  qualityRating: z.number().int().min(1).max(5).nullable().optional(),
});

export const adminUserActionSchema = z.object({
  action: z.enum(['SUSPEND', 'RESTORE', 'SET_ROLE', 'ADJUST_COINS']),
  role: z.enum(['USER', 'ADMIN']).optional(),
  reason: z.string().trim().min(3).max(500).optional(),
  amount: z.number().int().min(-100000).max(100000).optional(),
});

export const adminRefundSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  approve: z.boolean(),
});

export const adminSettingSchema = z.object({
  key: z.string().trim().min(2).max(80),
  value: z.any(),
  description: z.string().trim().max(300).optional().default(''),
});

export const adminQuery = paginationQuery.extend({
  search: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional(),
  role: z.string().trim().max(20).optional(),
  type: z.string().trim().max(40).optional(),
  sort: z.string().trim().max(40).optional(),
});
