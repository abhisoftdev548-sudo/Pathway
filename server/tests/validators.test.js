import { describe, it, expect } from 'vitest';
import { quizInput, questionInput } from '../src/validators/quiz.js';
import { pollInput, pollVoteSchema } from '../src/validators/poll.js';
import { registerSchema, loginSchema, resetPasswordSchema } from '../src/validators/auth.js';
import { ratingSchema, reportSchema } from '../src/validators/social.js';
import { slugify, sha256, transactionId, safeEqual } from '../src/utils/crypto.js';

describe('auth validators', () => {
  it('accepts a valid registration', () => {
    const r = registerSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'secret123',
    });
    expect(r.success).toBe(true);
  });

  it('rejects weak passwords and bad emails', () => {
    expect(registerSchema.safeParse({ name: 'A', email: 'x', password: 'short' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token: 'abc', password: 'secret123' }).success).toBe(false);
  });
});

describe('quiz validators', () => {
  const baseQuestion = {
    id: 'q1',
    type: 'SINGLE_CHOICE',
    text: 'What is 2+2?',
    options: [
      { id: 'a', text: '3', isCorrect: false },
      { id: 'b', text: '4', isCorrect: true },
    ],
  };

  it('accepts a well-formed quiz', () => {
    const r = quizInput.safeParse({
      title: 'Math basics',
      questions: [baseQuestion],
    });
    expect(r.success).toBe(true);
  });

  it('requires exactly one correct option for single-choice', () => {
    const bad = {
      ...baseQuestion,
      options: [
        { id: 'a', text: '3', isCorrect: true },
        { id: 'b', text: '4', isCorrect: true },
      ],
    };
    expect(questionInput.safeParse(bad).success).toBe(false);
  });

  it('requires accepted answers for fill-in questions', () => {
    expect(
      questionInput.safeParse({ id: 'q', type: 'FILL_BLANK', text: 'Capital of France?', correctAnswers: [] }).success
    ).toBe(false);
    expect(
      questionInput.safeParse({ id: 'q', type: 'FILL_BLANK', text: 'Capital of France?', correctAnswers: ['Paris'] }).success
    ).toBe(true);
  });

  it('requires evaluation rules for short-answer questions', () => {
    expect(questionInput.safeParse({ id: 'q', type: 'SHORT_ANSWER', text: 'Explain gravity' }).success).toBe(false);
    expect(
      questionInput.safeParse({
        id: 'q',
        type: 'SHORT_ANSWER',
        text: 'Explain gravity',
        evaluationRules: { mode: 'KEYWORDS', keywords: [{ text: 'mass', weight: 1 }] },
      }).success
    ).toBe(true);
  });

  it('accepts all four economy configurations', () => {
    for (const [entryFee, reward] of [[0, 0], [0, 50], [25, 0], [25, 50]]) {
      const r = quizInput.safeParse({ title: 'Economy test', entryFee, reward, questions: [baseQuestion] });
      expect(r.success).toBe(true);
    }
  });

  it('rejects negative fees or oversized rewards', () => {
    expect(quizInput.safeParse({ title: 'Bad', entryFee: -5 }).success).toBe(false);
    expect(quizInput.safeParse({ title: 'Bad', reward: 100000 }).success).toBe(false);
  });
});

describe('poll validators', () => {
  const basePoll = {
    title: 'Favorite language',
    question: 'Which language do you prefer?',
    options: [
      { id: 'a', text: 'TypeScript' },
      { id: 'b', text: 'Python' },
    ],
    endsAt: new Date(Date.now() + 86400000).toISOString(),
  };

  it('accepts a valid poll', () => {
    expect(pollInput.safeParse(basePoll).success).toBe(true);
  });

  it('requires at least two unique options', () => {
    expect(pollInput.safeParse({ ...basePoll, options: [{ id: 'a', text: 'Only one' }] }).success).toBe(false);
    expect(
      pollInput.safeParse({
        ...basePoll,
        options: [
          { id: 'a', text: 'X' },
          { id: 'a', text: 'Y' },
        ],
      }).success
    ).toBe(false);
  });

  it('rejects endsAt before startsAt', () => {
    expect(
      pollInput.safeParse({
        ...basePoll,
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        endsAt: new Date().toISOString(),
      }).success
    ).toBe(false);
  });

  it('rejects duplicate vote selections', () => {
    expect(pollVoteSchema.safeParse({ optionIds: ['a', 'a'] }).success).toBe(false);
    expect(pollVoteSchema.safeParse({ optionIds: ['a', 'b'] }).success).toBe(true);
  });
});

describe('rating & report validators', () => {
  it('enforces 1-5 integer scores', () => {
    expect(ratingSchema.safeParse({ targetType: 'QUIZ', targetId: 'a'.repeat(24), score: 3 }).success).toBe(true);
    expect(ratingSchema.safeParse({ targetType: 'QUIZ', targetId: 'a'.repeat(24), score: 6 }).success).toBe(false);
    expect(ratingSchema.safeParse({ targetType: 'QUIZ', targetId: 'a'.repeat(24), score: 2.5 }).success).toBe(false);
  });

  it('requires a known report reason', () => {
    expect(reportSchema.safeParse({ targetType: 'POLL', targetId: 'a'.repeat(24), reason: 'SPAM' }).success).toBe(true);
    expect(reportSchema.safeParse({ targetType: 'POLL', targetId: 'a'.repeat(24), reason: 'MEH' }).success).toBe(false);
  });
});

describe('crypto utils', () => {
  it('slugifies titles', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
    expect(slugify('  Tricky   Spaces  ')).toBe('tricky-spaces');
  });

  it('hashes deterministically and compares safely', () => {
    const h = sha256('token-value');
    expect(h).toBe(sha256('token-value'));
    expect(h).not.toBe(sha256('other'));
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });

  it('generates unique transaction ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => transactionId()));
    expect(ids.size).toBe(50);
  });
});
