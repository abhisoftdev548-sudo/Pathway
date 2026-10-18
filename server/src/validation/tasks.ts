import { z } from 'zod';
import { PROGRESS_STATUSES } from '../models/constants.js';
import { objectIdSchema } from './common.js';

export const taskFiltersSchema = z.object({
  roadmapId: objectIdSchema.optional(),
  moduleId: objectIdSchema.optional(),
  topicId: objectIdSchema.optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  status: z.enum(['not_started', 'in_progress', 'completed', 'locked']).optional(),
  type: z.enum(['learn', 'practice', 'code', 'quiz', 'project', 'revision', 'assessment']).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});

export const updateProgressSchema = z
  .object({
    privateNotes: z.string().max(10000).optional(),
    actualDuration: z.coerce.number().int().min(0).max(1440).optional(),
    selfVerified: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });

export const completeTaskSchema = z.object({
  actualDuration: z.coerce.number().int().min(0).max(1440).optional(),
  quizAnswers: z.array(z.number().int().min(0).max(20)).max(30).optional(),
});

export const submissionSchema = z.object({
  content: z.string().trim().min(1, 'Write your solution before saving').max(50000),
  language: z.string().trim().max(40).default('cpp'),
  notes: z.string().max(2000).default(''),
  selfVerified: z.boolean().default(false),
});

export const quizAttemptSchema = z.object({
  answers: z.array(z.number().int().min(0).max(20)).min(1).max(30),
});

export const statusFilterSchema = z.object({
  status: z.enum(PROGRESS_STATUSES).optional(),
});
