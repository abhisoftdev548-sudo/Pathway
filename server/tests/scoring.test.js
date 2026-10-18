import { describe, it, expect } from 'vitest';
import {
  evaluateAnswer,
  scoreAttempt,
  normalizeAnswer,
  toParticipantQuestion,
  toSolutionQuestion,
} from '../src/utils/scoring.js';
import { QUESTION_TYPES } from '../src/constants/index.js';

describe('normalizeAnswer', () => {
  it('trims, collapses whitespace and lowercases by default', () => {
    expect(normalizeAnswer('  Hello   World  ')).toBe('hello world');
  });
  it('strips trailing periods', () => {
    expect(normalizeAnswer('Paris.')).toBe('paris');
  });
  it('respects case sensitivity', () => {
    expect(normalizeAnswer('Paris', { caseSensitive: true })).toBe('Paris');
  });
  it('handles null/undefined safely', () => {
    expect(normalizeAnswer(null)).toBe('');
    expect(normalizeAnswer(undefined)).toBe('');
  });
});

describe('SINGLE_CHOICE evaluation', () => {
  const q = {
    id: 'q1',
    type: QUESTION_TYPES.SINGLE_CHOICE,
    points: 2,
    options: [
      { id: 'a', text: 'A', isCorrect: false },
      { id: 'b', text: 'B', isCorrect: true },
    ],
  };

  it('awards full points for the correct option', () => {
    const r = evaluateAnswer(q, 'b');
    expect(r.correct).toBe(true);
    expect(r.awardedPoints).toBe(2);
  });
  it('awards nothing for the wrong option', () => {
    const r = evaluateAnswer(q, 'a');
    expect(r.correct).toBe(false);
    expect(r.awardedPoints).toBe(0);
  });
  it('awards nothing for a missing answer', () => {
    const r = evaluateAnswer(q, undefined);
    expect(r.correct).toBe(false);
  });
});

describe('MULTIPLE_CHOICE evaluation', () => {
  const q = {
    id: 'q2',
    type: QUESTION_TYPES.MULTIPLE_CHOICE,
    points: 3,
    options: [
      { id: 'a', text: 'A', isCorrect: true },
      { id: 'b', text: 'B', isCorrect: true },
      { id: 'c', text: 'C', isCorrect: false },
    ],
  };

  it('requires the exact correct set', () => {
    expect(evaluateAnswer(q, ['b', 'a']).correct).toBe(true);
    expect(evaluateAnswer(q, ['a']).correct).toBe(false);
    expect(evaluateAnswer(q, ['a', 'b', 'c']).correct).toBe(false);
    expect(evaluateAnswer(q, []).correct).toBe(false);
    expect(evaluateAnswer(q, ['a', 'a', 'b']).correct).toBe(true); // duplicates collapse
  });
});

describe('TRUE_FALSE evaluation', () => {
  const q = { id: 'q3', type: QUESTION_TYPES.TRUE_FALSE, points: 1, correctBoolean: true };

  it('accepts boolean and string forms', () => {
    expect(evaluateAnswer(q, true).correct).toBe(true);
    expect(evaluateAnswer(q, 'true').correct).toBe(true);
    expect(evaluateAnswer(q, false).correct).toBe(false);
    expect(evaluateAnswer(q, 'banana').correct).toBe(false);
  });
});

describe('FILL_BLANK evaluation', () => {
  const q = {
    id: 'q4',
    type: QUESTION_TYPES.FILL_BLANK,
    points: 2,
    correctAnswers: ['Paris', 'City of Light'],
    evaluationRules: { caseSensitive: false },
  };

  it('matches any accepted answer, normalized', () => {
    expect(evaluateAnswer(q, '  paris ').correct).toBe(true);
    expect(evaluateAnswer(q, 'CITY OF LIGHT').correct).toBe(true);
    expect(evaluateAnswer(q, 'London').correct).toBe(false);
  });

  it('supports case sensitivity when configured', () => {
    const strict = { ...q, evaluationRules: { caseSensitive: true } };
    expect(evaluateAnswer(strict, 'Paris').correct).toBe(true);
    expect(evaluateAnswer(strict, 'paris').correct).toBe(false);
  });
});

describe('SHORT_ANSWER evaluation', () => {
  const q = {
    id: 'q5',
    type: QUESTION_TYPES.SHORT_ANSWER,
    points: 4,
    evaluationRules: {
      mode: 'KEYWORDS',
      keywords: [
        { text: 'photosynthesis', weight: 2 },
        { text: 'sunlight', weight: 1 },
        { text: 'chlorophyll', weight: 1 },
      ],
      minMatches: 2,
      passRatio: 0.7,
    },
  };

  it('awards full points when the matched weight ratio meets the pass ratio', () => {
    const r = evaluateAnswer(q, 'Photosynthesis uses sunlight in plants');
    expect(r.correct).toBe(true);
    expect(r.awardedPoints).toBe(4);
    expect(r.matchedKeywords).toContain('photosynthesis');
  });

  it('fails below pass ratio or min matches', () => {
    expect(evaluateAnswer(q, 'sunlight only').correct).toBe(false);
    expect(evaluateAnswer(q, 'completely unrelated').correct).toBe(false);
  });

  it('flags MANUAL mode for review without auto-awarding', () => {
    const manual = { ...q, evaluationRules: { mode: 'MANUAL', keywords: [] } };
    const r = evaluateAnswer(manual, 'any answer');
    expect(r.needsReview).toBe(true);
    expect(r.awardedPoints).toBe(0);
  });

  it('flags for review when no keyword rules exist rather than guessing', () => {
    const empty = { ...q, evaluationRules: { mode: 'KEYWORDS', keywords: [] } };
    const r = evaluateAnswer(empty, 'anything');
    expect(r.needsReview).toBe(true);
  });
});

describe('scoreAttempt', () => {
  const questions = [
    {
      id: 'q1',
      type: QUESTION_TYPES.SINGLE_CHOICE,
      points: 2,
      options: [
        { id: 'a', text: 'A', isCorrect: true },
        { id: 'b', text: 'B', isCorrect: false },
      ],
    },
    {
      id: 'q2',
      type: QUESTION_TYPES.TRUE_FALSE,
      points: 2,
      correctBoolean: false,
    },
    {
      id: 'q3',
      type: QUESTION_TYPES.FILL_BLANK,
      points: 2,
      correctAnswers: ['4'],
    },
  ];

  it('computes score, percentage and pass/fail against the passing score', () => {
    const result = scoreAttempt(questions, { q1: 'a', q2: false, q3: '4' }, { passingScore: 70 });
    expect(result.score).toBe(6);
    expect(result.maxScore).toBe(6);
    expect(result.percentage).toBe(100);
    expect(result.passed).toBe(true);
  });

  it('fails when below passing score', () => {
    const result = scoreAttempt(questions, { q1: 'a', q2: true, q3: '5' }, { passingScore: 70 });
    expect(result.score).toBe(2);
    expect(result.percentage).toBeCloseTo(33.33, 1);
    expect(result.passed).toBe(false);
  });

  it('blocks pass while manual review is pending', () => {
    const withManual = [
      ...questions,
      {
        id: 'q4',
        type: QUESTION_TYPES.SHORT_ANSWER,
        points: 2,
        evaluationRules: { mode: 'MANUAL', keywords: [] },
      },
    ];
    const result = scoreAttempt(withManual, { q1: 'a', q2: false, q3: '4', q4: 'essay' }, { passingScore: 50 });
    expect(result.needsReview).toBe(true);
    expect(result.passed).toBe(false);
  });

  it('never leaks correctness into participant questions', () => {
    const p = toParticipantQuestion(questions[0]);
    expect(p.options[0].isCorrect).toBeUndefined();
    const s = toSolutionQuestion(questions[0]);
    expect(s.isCorrectOptionIds).toEqual(['a']);
  });
});
