import { z } from 'zod';
import { difficultySchema, durationSchema, learningPaceSchema, objectIdSchema, resourceSchema, taskTypeSchema } from './common.js';

const stringList = z.array(z.string().trim().min(1).max(300)).max(50).default([]);

export const roadmapCreateSchema = z.object({
  title: z.string().trim().min(3).max(120),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase kebab-case').optional(),
  tagline: z.string().trim().max(180).default(''),
  description: z.string().trim().min(20).max(4000),
  category: z.string().trim().min(2).max(60),
  difficulty: difficultySchema,
  difficultyLabel: z.string().trim().max(80).default(''),
  estimatedDuration: durationSchema.default({ minWeeks: 4, maxWeeks: 8, totalHours: 0 }),
  prerequisites: stringList,
  learningOutcomes: stringList,
  skills: stringList,
  tags: stringList,
  icon: z.string().trim().max(40).default('route'),
  published: z.boolean().default(false),
});

export const roadmapUpdateSchema = z
  .object({
    title: z.string().trim().min(3).max(120).optional(),
    slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
    tagline: z.string().trim().max(180).optional(),
    description: z.string().trim().min(20).max(4000).optional(),
    category: z.string().trim().min(2).max(60).optional(),
    difficulty: difficultySchema.optional(),
    difficultyLabel: z.string().trim().max(80).optional(),
    estimatedDuration: durationSchema.optional(),
    prerequisites: stringList.optional(),
    learningOutcomes: stringList.optional(),
    skills: stringList.optional(),
    tags: stringList.optional(),
    icon: z.string().trim().max(40).optional(),
    published: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });

export const moduleCreateSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(2000).default(''),
  learningOutcomes: stringList,
  prerequisiteModuleIds: z.array(objectIdSchema).max(20).default([]),
  published: z.boolean().default(true),
});

export const moduleUpdateSchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    description: z.string().trim().max(2000).optional(),
    learningOutcomes: stringList.optional(),
    prerequisiteModuleIds: z.array(objectIdSchema).max(20).optional(),
    published: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });

export const topicCreateSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(3000).default(''),
  estimatedDuration: z.coerce.number().int().min(5).max(2000).default(60),
  learningOutcomes: stringList,
  prerequisites: z.array(objectIdSchema).max(30).default([]),
  resources: z.array(resourceSchema.omit({ verified: true }).extend({ verified: z.boolean().default(false) })).max(10).default([]),
  published: z.boolean().default(true),
});

export const topicUpdateSchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    description: z.string().trim().max(3000).optional(),
    estimatedDuration: z.coerce.number().int().min(5).max(2000).optional(),
    learningOutcomes: stringList.optional(),
    prerequisites: z.array(objectIdSchema).max(30).optional(),
    resources: z.array(resourceSchema.omit({ verified: true }).extend({ verified: z.boolean().default(false) })).max(10).optional(),
    published: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });

const quizQuestionSchema = z
  .object({
    question: z.string().trim().min(5).max(1000),
    options: z.array(z.string().trim().min(1).max(500)).min(2).max(10),
    correctOptionIndex: z.coerce.number().int().min(0).max(9),
    explanation: z.string().trim().max(1000).default(''),
  })
  .refine((question) => question.correctOptionIndex < question.options.length, {
    message: 'Correct option index must match an option',
    path: ['correctOptionIndex'],
  });

const codingExerciseSchema = z.object({
  problemStatement: z.string().trim().max(4000).default(''),
  examples: z
    .array(
      z.object({
        input: z.string().max(500).default(''),
        output: z.string().max(500).default(''),
        explanation: z.string().max(1000).default(''),
      }),
    )
    .max(10)
    .default([]),
  constraints: z.array(z.string().trim().max(300)).max(20).default([]),
  hints: z.array(z.string().trim().max(1000)).max(8).default([]),
  solutionExplanation: z.string().trim().max(4000).default(''),
  starterCode: z.string().max(8000).default(''),
  selfVerified: z.boolean().default(true),
});

export const taskCreateSchema = z.object({
  title: z.string().trim().min(4).max(200),
  description: z.string().trim().min(20).max(5000),
  type: taskTypeSchema,
  difficulty: difficultySchema,
  estimatedDuration: z.coerce.number().int().min(1).max(600),
  learningObjectives: stringList,
  instructions: z.string().trim().max(8000).default(''),
  acceptanceCriteria: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  resources: z
    .array(resourceSchema.omit({ verified: true }).extend({ verified: z.boolean().default(false) }))
    .max(10)
    .default([]),
  prerequisites: z.array(objectIdSchema).max(20).default([]),
  quizQuestions: z.array(quizQuestionSchema).max(10).default([]),
  codingExercise: codingExerciseSchema.nullable().default(null),
  published: z.boolean().default(true),
});

export const taskUpdateSchema = z
  .object({
    title: z.string().trim().min(4).max(200).optional(),
    description: z.string().trim().min(20).max(5000).optional(),
    type: taskTypeSchema.optional(),
    difficulty: difficultySchema.optional(),
    estimatedDuration: z.coerce.number().int().min(1).max(600).optional(),
    learningObjectives: stringList.optional(),
    instructions: z.string().trim().max(8000).optional(),
    acceptanceCriteria: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
    resources: z
      .array(resourceSchema.omit({ verified: true }).extend({ verified: z.boolean().default(false) }))
      .max(10)
      .optional(),
    prerequisites: z.array(objectIdSchema).max(20).optional(),
    quizQuestions: z.array(quizQuestionSchema).max(10).optional(),
    codingExercise: codingExerciseSchema.nullable().optional(),
    published: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });

export const moveSchema = z.object({ direction: z.enum(['up', 'down']) });

export const adminListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  includeArchived: z.enum(['true', 'false']).default('false'),
  published: z.enum(['true', 'false']).optional(),
});

export const adminUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  role: z.enum(['user', 'admin']).optional(),
});

export const adminEnrollmentAnalyticsSchema = z.object({
  roadmapId: objectIdSchema.optional(),
});

export const adminEnrollmentListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  roadmapId: objectIdSchema.optional(),
  status: z.enum(['active', 'paused', 'completed', 'archived']).optional(),
});

export const paceSchema = learningPaceSchema; // re-exported for integration with enrollment tooling
