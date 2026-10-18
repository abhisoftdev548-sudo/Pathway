import { describe, expect, it } from 'vitest';
import { PACE_MINUTES } from '../src/models/constants.js';
import { buildDailyPlan } from '../src/services/schedule.js';
import { computeOverallProgress, overallPercentFromEnrollments, paceMinutes, type ProgressTask } from '../src/services/progress.js';
import { passwordStrengthIssues } from '../src/utils/password.js';
import { slugify } from '../src/utils/slug.js';
import { differenceInCalendarDays } from '../src/utils/time.js';

function task(overrides: Partial<ProgressTask> & Pick<ProgressTask, 'id' | 'estimatedDuration'>): ProgressTask {
  return {
    roadmapId: 'roadmap',
    moduleId: 'module',
    topicId: 'topic',
    title: overrides.id,
    description: 'Practice the idea on a tiny example before moving on.',
    type: 'learn',
    difficulty: 'beginner',
    learningObjectives: [],
    instructions: '',
    acceptanceCriteria: [],
    resources: [],
    order: 1,
    moduleTitle: 'Module',
    topicTitle: 'Topic',
    moduleOrder: 1,
    topicOrder: 1,
    status: 'not_started',
    locked: false,
    lockReason: null,
    prerequisiteIds: [],
    completedAt: null,
    actualDuration: 0,
    privateNotes: '',
    attemptCount: 0,
    quizQuestions: [],
    codingExercise: null,
    hasCodingExercise: false,
    ...overrides,
  };
}

function context(id: string, tasks: ProgressTask[], pace: 'relaxed' | 'standard' | 'intensive' | 'custom' = 'standard') {
  return {
    enrollment: { _id: id, status: 'active', learningPace: pace, customDailyGoal: pace === 'custom' ? 25 : null },
    bundle: { roadmap: { _id: `road-${id}`, title: `Road ${id}`, slug: id, category: 'Core' } },
    progress: { tasks, percent: 0, completedTasks: 0, totalTasks: tasks.length },
  };
}

describe('progress rules', () => {
  it('returns 0 when there is nothing to divide by', () => {
    expect(overallPercentFromEnrollments([])).toBe(0);
    expect(overallPercentFromEnrollments([{ percent: 100, estimatedMinutes: 0, completedMinutes: 0 }])).toBe(0);
    expect(
      computeOverallProgress([
        { progress: { totalMinutes: 0, completedMinutes: 0, totalTasks: 0, completedTasks: 0 } },
      ] as never).percent,
    ).toBe(0);
  });

  it('weights overall progress by estimated minutes, not by roadmap count', () => {
    const percent = overallPercentFromEnrollments([
      { percent: 100, estimatedMinutes: 20, completedMinutes: 20 },
      { percent: 0, estimatedMinutes: 180, completedMinutes: 0 },
    ]);
    expect(percent).toBe(10);
    const counted = computeOverallProgress([
      { progress: { totalMinutes: 30, completedMinutes: 10, totalTasks: 2, completedTasks: 1 } },
      { progress: { totalMinutes: 70, completedMinutes: 0, totalTasks: 1, completedTasks: 0 } },
    ] as never);
    expect(counted.percent).toBe(10);
    expect(counted.completedTasks).toBe(1);
    expect(counted.totalTasks).toBe(3);
  });

  it('maps every pace to a published minute budget', () => {
    expect(PACE_MINUTES).toEqual({ relaxed: 20, standard: 45, intensive: 90 });
    expect(paceMinutes({ learningPace: 'relaxed', customDailyGoal: null })).toBe(20);
    expect(paceMinutes({ learningPace: 'intensive', customDailyGoal: 10 })).toBe(90);
    expect(paceMinutes({ learningPace: 'custom', customDailyGoal: 25 })).toBe(25);
    expect(paceMinutes({ learningPace: 'custom', customDailyGoal: 0 })).toBe(30);
  });
});

describe('daily plan', () => {
  it('fills the day in curriculum order without exceeding the remaining budget', () => {
    const plan = buildDailyPlan({
      contexts: [
        context('one', [
          task({ id: 'a', estimatedDuration: 20, order: 1 }),
          task({ id: 'b', estimatedDuration: 20, order: 2 }),
          task({ id: 'locked', estimatedDuration: 5, order: 3, locked: true }),
          task({ id: 'done', estimatedDuration: 10, order: 4, status: 'completed', completedAt: '2026-10-18T04:00:00.000Z' }),
        ]) as never,
      ],
      timeZone: 'UTC',
      today: '2026-10-18',
      budgetMinutes: 45,
      spentMinutes: 0,
    });

    expect(plan.recommendations.map((item) => item.id)).toEqual(['a', 'b']);
    expect(plan.totalRecommendedMinutes).toBe(40);
    expect(plan.counts.remainingUnlocked).toBe(2);
    expect(plan.completedToday.map((item) => item.id)).toEqual(['done']);
    expect(plan.algorithm).toMatch(/pace/i);
  });

  it('does not invent work after the daily goal is already met', () => {
    const plan = buildDailyPlan({
      contexts: [context('one', [task({ id: 'a', estimatedDuration: 15 })]) as never],
      timeZone: 'UTC',
      today: '2026-10-18',
      budgetMinutes: 45,
      spentMinutes: 45,
    });
    expect(plan.recommendations).toEqual([]);
    expect(plan.remainingBudgetMinutes).toBe(0);
    expect(plan.warnings.some((warning) => /reached today's learning goal/i.test(warning))).toBe(true);
  });

  it('still recommends an oversized next task, with a warning, instead of an empty plan', () => {
    const plan = buildDailyPlan({
      contexts: [context('one', [task({ id: 'long', estimatedDuration: 50 })], 'relaxed') as never],
      timeZone: 'UTC',
      today: '2026-10-18',
      budgetMinutes: 20,
      spentMinutes: 0,
    });
    expect(plan.recommendations.map((item) => item.id)).toEqual(['long']);
    expect(plan.warnings.some((warning) => /longer than/i.test(warning))).toBe(true);
  });
});

describe('passwords and slugs', () => {
  it('rejects passwords that miss the published policy', () => {
    expect(passwordStrengthIssues('short')).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/10 characters/),
        expect.stringMatching(/uppercase/),
        expect.stringMatching(/number/),
      ]),
    );
    expect(passwordStrengthIssues('Admin_PathForge_123!')).toEqual([]);
  });

  it('slugifies titles into stable URL keys', () => {
    expect(slugify("  AI & Machine Learning! ")).toBe('ai-machine-learning');
    expect(differenceInCalendarDays('2026-10-18', '2026-10-16')).toBe(2);
  });
});
