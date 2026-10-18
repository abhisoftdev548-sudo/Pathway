import type { EnrollmentContext } from './userOverview.js';
import { paceMinutes, type ProgressTask } from './progress.js';
import { PACE_MINUTES } from '../models/constants.js';

export interface ScheduledTask extends ProgressTask {
  enrollmentId: string;
  enrollmentStatus: string;
  learningPace: string;
  paceMinutes: number;
  roadmapTitle: string;
  roadmapSlug: string;
  roadmapCategory: string;
  exceedsDailyBudget: boolean;
}

export interface DailyPlan {
  date: string;
  timezone: string;
  algorithm: string;
  budgetMinutes: number;
  spentMinutes: number;
  remainingBudgetMinutes: number;
  totalRecommendedMinutes: number;
  recommendations: ScheduledTask[];
  completedToday: ScheduledTask[];
  upcoming: ScheduledTask[];
  activeRoadmaps: {
    enrollmentId: string;
    roadmapId: string;
    title: string;
    slug: string;
    category: string;
    pace: string;
    paceMinutes: number;
    percent: number;
    completedTasks: number;
    totalTasks: number;
  }[];
  warnings: string[];
  counts: { recommended: number; completedToday: number; remainingUnlocked: number };
}

interface BuildDailyPlanOptions {
  contexts: EnrollmentContext[];
  timeZone: string;
  today: string;
  budgetMinutes: number;
  spentMinutes: number;
}

/**
 * Transparent, deterministic scheduling algorithm (no AI involved):
 *
 * 1. Only active enrollments contribute, and only published, unlocked, incomplete tasks.
 * 2. Tasks are taken in curriculum order; each roadmap is capped at the learner's pace
 *    (relaxed 20 / standard 45 / intensive 90 / custom minutes). The first task of a
 *    roadmap is always allowed so oversized first steps can still be recommended.
 * 3. Roadmaps are served round-robin, always picking the roadmap with the fewest
 *    planned minutes, so no single roadmap monopolizes the day.
 * 4. Tasks are added only while the next estimate fits the remaining daily budget
 *    (daily goal minus learning minutes already recorded today).
 * 5. If nothing fits but work is available, the shortest unlocked task is scheduled
 *    with an explicit warning instead of silently returning an empty plan.
 * 6. Completing tasks ahead of schedule simply reduces what is recommended tomorrow.
 */
export function buildDailyPlan(options: BuildDailyPlanOptions): DailyPlan {
  const { contexts, timeZone, today, budgetMinutes, spentMinutes } = options;
  const active = contexts.filter((context) => context.enrollment.status === 'active');
  const remainingBudget = Math.max(0, budgetMinutes - spentMinutes);

  const completedToday: ScheduledTask[] = [];
  const candidateQueues = new Map<string, ScheduledTask[]>();
  const activeRoadmaps: DailyPlan['activeRoadmaps'] = [];
  const warnings: string[] = [];
  let remainingUnlocked = 0;

  for (const context of contexts) {
    const { enrollment, bundle, progress } = context;
    const decorated: ScheduledTask[] = progress.tasks.map((task) => ({
      ...task,
      enrollmentId: String(enrollment._id),
      enrollmentStatus: enrollment.status,
      learningPace: enrollment.learningPace,
      paceMinutes: paceMinutes(enrollment),
      roadmapTitle: bundle.roadmap.title,
      roadmapSlug: bundle.roadmap.slug,
      roadmapCategory: bundle.roadmap.category,
      exceedsDailyBudget: task.estimatedDuration > budgetMinutes,
    }));

    for (const task of decorated) {
      if (task.completedAt && task.completedAt.slice(0, 10) === today) completedToday.push(task);
    }
    if (enrollment.status !== 'active') continue;

    const queue = decorated.filter((task) => task.status !== 'completed' && !task.locked);
    remainingUnlocked += queue.length;
    candidateQueues.set(String(enrollment._id), queue);
    activeRoadmaps.push({
      enrollmentId: String(enrollment._id),
      roadmapId: String(bundle.roadmap._id),
      title: bundle.roadmap.title,
      slug: bundle.roadmap.slug,
      category: bundle.roadmap.category,
      pace: enrollment.learningPace,
      paceMinutes: paceMinutes(enrollment),
      percent: progress.percent,
      completedTasks: progress.completedTasks,
      totalTasks: progress.totalTasks,
    });
  }

  if (active.length > 1) {
    const totalPace = active.reduce((sum, context) => sum + paceMinutes(context.enrollment), 0);
    if (totalPace > budgetMinutes) {
      warnings.push(
        `Your roadmap paces add up to ${totalPace} minutes per day, above your ${budgetMinutes}-minute daily goal. Today's plan is balanced across your ${active.length} active roadmaps instead of following every pace in full.`,
      );
    }
  }

  const selected: ScheduledTask[] = [];
  const selectedIds = new Set<string>();
  const plannedMinutes = new Map<string, number>();
  const perRoadmapCount = new Map<string, number>();

  const nextTaskFor = (enrollmentId: string): ScheduledTask | undefined => {
    const queue = candidateQueues.get(enrollmentId) ?? [];
    return queue.find((task) => !selectedIds.has(task.id));
  };

  while (selected.length < 12) {
    let best: { task: ScheduledTask; enrollmentId: string; planned: number } | null = null;

    for (const context of active) {
      const enrollmentId = String(context.enrollment._id);
      const planned = plannedMinutes.get(enrollmentId) ?? 0;
      const pace = paceMinutes(context.enrollment);
      const count = perRoadmapCount.get(enrollmentId) ?? 0;

      const task = nextTaskFor(enrollmentId);
      if (!task) continue;
      // Goal already met: do not invent optional work. The warning below explains why.
      if (remainingBudget <= 0) continue;
      // The first task of a roadmap can exceed the pace so learners are never stuck.
      if (count > 0 && planned >= pace) continue;
      if (count > 0 && planned + task.estimatedDuration > pace) continue;

      const projectedTotal = selected.reduce((sum, item) => sum + item.estimatedDuration, 0);
      if (selected.length > 0 && projectedTotal + task.estimatedDuration > remainingBudget) continue;

      const isBetter = !best || planned < best.planned || (planned === best.planned && task.estimatedDuration < best.task.estimatedDuration);
      if (isBetter) best = { task, enrollmentId, planned };
    }

    if (!best) break;
    selected.push(best.task);
    selectedIds.add(best.task.id);
    plannedMinutes.set(best.enrollmentId, best.planned + best.task.estimatedDuration);
    perRoadmapCount.set(best.enrollmentId, (perRoadmapCount.get(best.enrollmentId) ?? 0) + 1);
  }

  if (selected.length === 0 && remainingBudget > 0) {
    let smallest: ScheduledTask | null = null;
    for (const queue of candidateQueues.values()) {
      for (const task of queue) {
        if (!selectedIds.has(task.id) && (!smallest || task.estimatedDuration < smallest.estimatedDuration)) {
          smallest = task;
        }
      }
    }
    if (smallest) {
      selected.push(smallest);
      selectedIds.add(smallest.id);
      if (smallest.estimatedDuration > remainingBudget) {
        warnings.push(
          `Your next task is ${smallest.estimatedDuration} minutes, longer than the ${remainingBudget} minutes left in today's goal.`,
        );
      }
    }
  }

  if (remainingBudget <= 0 && active.length > 0) {
    warnings.push("You've reached today's learning goal. Any extra work is optional and your streak is already counted.");
  }

  const upcoming: ScheduledTask[] = [];
  for (const queue of candidateQueues.values()) {
    for (const task of queue) {
      if (!selectedIds.has(task.id)) upcoming.push(task);
    }
  }
  upcoming.sort((a, b) => a.moduleOrder - b.moduleOrder || a.topicOrder - b.topicOrder || a.order - b.order);

  const totalRecommendedMinutes = selected.reduce((sum, task) => sum + task.estimatedDuration, 0);
  if (selected.length > 0 && totalRecommendedMinutes > remainingBudget && remainingBudget > 0) {
    warnings.push(
      `Today's plan takes ${totalRecommendedMinutes} minutes, more than the ${remainingBudget} minutes left in your goal, because the next unlocked task is longer than the remaining budget.`,
    );
  }
  if (selected.some((task) => task.estimatedDuration > budgetMinutes)) {
    warnings.push('One recommended task is longer than your entire daily goal. Feel free to split it into smaller sessions.');
  }
  if (remainingBudget > 0 && active.length > 0 && selected.length === 0 && remainingUnlocked === 0) {
    warnings.push('Everything unlocked in your active roadmaps is complete. Enroll in another roadmap or check back when new content is published.');
  }

  return {
    date: today,
    timezone: timeZone,
    algorithm:
      'Published, unlocked tasks in curriculum order, capped per roadmap by your chosen pace, balanced round-robin across active roadmaps, and limited to your remaining daily minute budget.',
    budgetMinutes,
    spentMinutes,
    remainingBudgetMinutes: remainingBudget,
    totalRecommendedMinutes,
    recommendations: selected,
    completedToday,
    upcoming: upcoming.slice(0, 8),
    activeRoadmaps,
    warnings,
    counts: { recommended: selected.length, completedToday: completedToday.length, remainingUnlocked },
  };
}

export function defaultPaceMinutes(pace: string, custom?: number | null): number {
  if (pace === 'custom') return custom ?? 30;
  return PACE_MINUTES[pace as keyof typeof PACE_MINUTES] ?? 45;
}
