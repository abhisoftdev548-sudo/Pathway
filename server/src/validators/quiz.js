import { z } from 'zod';
import { DIFFICULTY, QUESTION_TYPES, QUIZ_REWARD_MODES } from '../constants/index.js';
import { imageInput, objectId, paginationQuery } from './common.js';

const optionInput = z.object({
  id: z.string().min(1).max(40),
  text: z.string().trim().min(1).max(500),
  isCorrect: z.boolean().optional().default(false),
});

const keywordInput = z.object({
  text: z.string().trim().min(1).max(120),
  weight: z.number().min(0).max(100).optional().default(1),
});

const evaluationRulesInput = z.object({
  mode: z.enum(['KEYWORDS', 'MANUAL']).optional().default('KEYWORDS'),
  keywords: z.array(keywordInput).max(50).optional().default([]),
  minMatches: z.number().int().min(0).max(50).optional().default(1),
  passRatio: z.number().min(0).max(1).optional().default(0.7),
  caseSensitive: z.boolean().optional().default(false),
  flagForReviewOnFail: z.boolean().optional().default(false),
});

export const questionInput = z
  .object({
    id: z.string().min(1).max(40),
    type: z.enum(Object.values(QUESTION_TYPES)),
    text: z.string().trim().min(1).max(2000),
    hint: z.string().trim().max(500).optional().default(''),
    explanation: z.string().trim().max(2000).optional().default(''),
    points: z.number().int().min(1).max(100).optional().default(1),
    options: z.array(optionInput).max(10).optional().default([]),
    correctBoolean: z.boolean().nullable().optional(),
    correctAnswers: z.array(z.string().trim().min(1).max(500)).max(10).optional().default([]),
    evaluationRules: evaluationRulesInput.optional(),
  })
  .superRefine((q, ctx) => {
    const T = QUESTION_TYPES;
    if (q.type === T.SINGLE_CHOICE || q.type === T.MULTIPLE_CHOICE) {
      if (q.options.length < 2) {
        ctx.addIssue({ code: 'custom', message: 'Choice questions need at least 2 options', path: ['options'] });
      }
      const correctCount = q.options.filter((o) => o.isCorrect).length;
      if (q.type === T.SINGLE_CHOICE && correctCount !== 1) {
        ctx.addIssue({ code: 'custom', message: 'Single-choice questions need exactly 1 correct option', path: ['options'] });
      }
      if (q.type === T.MULTIPLE_CHOICE && correctCount < 1) {
        ctx.addIssue({ code: 'custom', message: 'Multiple-choice questions need at least 1 correct option', path: ['options'] });
      }
    }
    if (q.type === T.TRUE_FALSE && q.correctBoolean === undefined) {
      ctx.addIssue({ code: 'custom', message: 'True/false questions need correctBoolean', path: ['correctBoolean'] });
    }
    if (q.type === T.FILL_BLANK && q.correctAnswers.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'Fill-in questions need accepted answers', path: ['correctAnswers'] });
    }
    if (q.type === T.SHORT_ANSWER) {
      const rules = q.evaluationRules;
      if (!rules || (rules.mode === 'KEYWORDS' && rules.keywords.length === 0)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Short-answer questions need keyword evaluation rules (or MANUAL mode)',
          path: ['evaluationRules'],
        });
      }
    }
  });

export const quizInput = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(4000).optional().default(''),
  category: objectId.nullable().optional(),
  subcategory: objectId.nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(15).optional().default([]),
  difficulty: z.enum(Object.values(DIFFICULTY)).optional().default(DIFFICULTY.MEDIUM),
  language: z.string().trim().min(2).max(20).optional().default('en'),
  cover: imageInput,
  timeLimitMinutes: z.number().int().min(0).max(600).optional().default(0),
  passingScore: z.number().min(0).max(100).optional().default(50),
  entryFee: z.number().int().min(0).max(1000).optional().default(0),
  reward: z.number().int().min(0).max(5000).optional().default(0),
  rewardMode: z.enum(Object.values(QUIZ_REWARD_MODES)).optional().default(QUIZ_REWARD_MODES.ALL_PASSERS),
  topPercent: z.number().int().min(1).max(100).optional().default(20),
  maxRewardRecipients: z.number().int().min(0).max(100000).optional().default(0),
  attemptsAllowed: z.number().int().min(1).max(20).optional().default(1),
  questions: z.array(questionInput).max(100).optional().default([]),
});

export const quizUpdateSchema = quizInput.partial().extend({
  changeNote: z.string().trim().max(500).optional().default(''),
});

export const submitQuizSchema = z.object({
  changeNote: z.string().trim().max(500).optional().default(''),
});

export const quizListQuery = paginationQuery.extend({
  search: z.string().trim().max(120).optional(),
  category: objectId.optional(),
  difficulty: z.enum(Object.values(DIFFICULTY)).optional(),
  tag: z.string().trim().max(40).optional(),
  sort: z.enum(['newest', 'popular', 'topRated', 'difficulty']).optional().default('newest'),
  status: z.string().optional(), // creator workspace filter
});

export const attemptStartSchema = z.object({});

export const attemptSubmitSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1).max(40),
        value: z.any(),
      })
    )
    .max(200)
    .optional()
    .default([]),
  timeSpentSec: z.number().int().min(0).max(86400).optional().default(0),
});

export const attemptActionParam = z.object({ attemptId: objectId });
