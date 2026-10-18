import { z } from 'zod';
import type { Question, VersionMeta } from '../types.js';

export const questionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['single_choice', 'multiple_choice', 'True_false', 'fill_blank', 'short_answer']),
  text: z.string().max(2000).default(''),
  options: z.array(z.object({ id: z.string().min(1), text: z.string().max(500).default('') })).max(8).default([]),
  correctOptionIds: z.array(z.string()).max(8).default([]),
  acceptedAnswers: z.array(z.string().max(300)).max(10).default([]),
  caseInsensitive: z.boolean().default(true),
  explanation: z.string().max(4000).default(''),
  hint: z.string().max(1000).optional().default(''),
  imageUrl: z.string().max(1000).optional().default(''),
  codeSnippet: z.object({ code: z.string().max(8000), language: z.string().max(40).optional() }).nullable().optional().default(null),
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).default('Beginner'),
  marks: z.number().min(0).max(100).default(1),
  topicTag: z.string().max(80).optional().default(''),
  order: z.number().int().min(0).default(0),
  allowPartialCredit: z.boolean().optional().default(false),
});

export const settingsSchema = z.object({
  explanationMode: z.enum(['after_submission', 'immediate', 'after_manual_review']).default('after_submission'),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  showScoreImmediately: z.boolean().default(true),
}).default({ explanationMode: 'after_submission', shuffleQuestions: false, shuffleOptions: false, showScoreImmediately: true });

export const quizPayloadSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(160),
  description: z.string().trim().max(4000).default(''),
  coverImage: z.string().max(1000).optional().default(''),
  categoryId: z.string().min(1, 'Category is required'),
  subcategoryId: z.string().nullable().optional().default(null),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).default('Beginner'),
  language: z.string().trim().min(2).max(60).default('English'),
  estimatedDuration: z.number().int().min(1).max(600).default(10),
  timeLimit: z.number().int().min(1).max(600).nullable().optional().default(null),
  settings: settingsSchema,
  questions: z.array(questionSchema).max(200).default([]),
});
export type QuizPayload = z.infer<typeof quizPayloadSchema>;

/** Full rule set enforced before a quiz can enter PENDING_REVIEW.
 *  Drafts may be incomplete; submissions may not. */
export function validateForSubmission(meta: VersionMeta, questions: Question[], categoryExists: boolean): string[] {
  const errors: string[] = [];
  if (!meta.title || meta.title.trim().length < 3) errors.push('Title must be at least 3 characters.');
  if (!meta.description || meta.description.trim().length < 10) errors.push('Description must be at least 10 characters so learners know what to expect.');
  if (!meta.categoryId || !categoryExists) errors.push('A valid, active category is required.');
  if (!meta.language?.trim()) errors.push('Language is required.');
  if (!questions.length) errors.push('Add at least one question before submitting.');

  questions.forEach((q, i) => {
    const label = `Question ${i + 1}`;
    if (!q.text?.trim()) errors.push(`${label}: question text is required.`);
    if (!q.explanation?.trim()) errors.push(`${label}: an explanation is required before submission.`);
    if (!(q.marks > 0)) errors.push(`${label}: marks must be greater than 0.`);
    const optionIds = new Set((q.options || []).map(o => o.id));
    if (q.type === 'single_choice') {
      if ((q.options || []).length < 2) errors.push(`${label}: single-choice questions need at least 2 options.`);
      if (q.correctOptionIds.length !== 1) errors.push(`${label}: exactly one correct option is required.`);
    }
    if (q.type === 'multiple_choice') {
      if ((q.options || []).length < 2) errors.push(`${label}: multiple-choice questions need at least 2 options.`);
      if (q.correctOptionIds.length < 1) errors.push(`${label}: mark at least one correct option.`);
    }
    if (q.type === 'True_false') {
      if ((q.options || []).length !== 2) errors.push(`${label}: True/false questions need exactly 2 options (True and False).`);
      if (q.correctOptionIds.length !== 1) errors.push(`${label}: exactly one correct answer is required.`);
    }
    if (['single_choice', 'multiple_choice', 'True_false'].includes(q.type)) {
      if ((q.options || []).some(o => !o.text?.trim())) errors.push(`${label}: every option needs text.`);
      if (q.correctOptionIds.some(cid => !optionIds.has(cid))) errors.push(`${label}: a correct answer refers to a missing option.`);
    }
    if (q.type === 'fill_blank') {
      if (!(q.acceptedAnswers || []).some(a => a.trim())) errors.push(`${label}: add at least one accepted answer for automatic checking.`);
    }
    if (q.type === 'short_answer' && !(q.acceptedAnswers || []).length && !q.explanation?.trim()) {
      errors.push(`${label}: short-answer questions need an explanation / model answer for self-assessment.`);
    }
  });
  return errors;
}
export function totalPoints(questions: Question[]) { return questions.reduce((s, q) => s + (Number(q.marks) || 0), 0); }
