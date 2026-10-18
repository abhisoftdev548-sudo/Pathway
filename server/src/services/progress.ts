import type { Types } from 'mongoose';
import { Types as MongooseTypes } from 'mongoose';
import { TaskProgress, type TaskProgressDocument } from '../models/TaskProgress.js';
import type { EnrollmentDocument } from '../models/Enrollment.js';
import { PACE_MINUTES, type TaskType } from '../models/constants.js';
import { serializeTask, type CurriculumBundle } from './curriculum.js';
import type { TaskDocument } from '../models/Task.js';

export interface ProgressTask {
  id: string;
  roadmapId: string;
  moduleId: string;
  topicId: string;
  title: string;
  description: string;
  type: TaskType;
  difficulty: string;
  estimatedDuration: number;
  learningObjectives: string[];
  instructions: string;
  acceptanceCriteria: string[];
  resources: { title: string; url: string; type: string }[];
  order: number;
  moduleTitle: string;
  topicTitle: string;
  moduleOrder: number;
  topicOrder: number;
  status: 'not_started' | 'in_progress' | 'completed';
  locked: boolean;
  lockReason: string | null;
  prerequisiteIds: string[];
  completedAt: string | null;
  actualDuration: number;
  privateNotes: string;
  attemptCount: number;
  quizQuestions: { question: string; options: string[] }[];
  codingExercise: ReturnType<typeof serializeTask>['codingExercise'];
  hasCodingExercise: boolean;
}

export interface ModuleProgress {
  id: string;
  title: string;
  description: string;
  order: number;
  totalTasks: number;
  completedTasks: number;
  percent: number;
  estimatedMinutes: number;
  completedMinutes: number;
  topicCount: number;
  locked: boolean;
}

export interface TopicProgress {
  id: string;
  moduleId: string;
  title: string;
  description: string;
  order: number;
  totalTasks: number;
  completedTasks: number;
  percent: number;
  estimatedMinutes: number;
  locked: boolean;
}

export interface RoadmapProgress {
  roadmapId: string;
  totalTasks: number;
  completedTasks: number;
  percent: number;
  totalMinutes: number;
  completedMinutes: number;
  modules: ModuleProgress[];
  topics: TopicProgress[];
  tasks: ProgressTask[];
  nextTask: ProgressTask | null;
  completedToday: number;
}

const round1 = (value: number) => Math.round(value * 10) / 10;
const percent = (completed: number, total: number) => (total <= 0 ? 0 : round1((completed / total) * 100));

export function paceMinutes(enrollment: Pick<EnrollmentDocument, 'learningPace' | 'customDailyGoal'>): number {
  if (enrollment.learningPace === 'custom') return enrollment.customDailyGoal || 30;
  return PACE_MINUTES[enrollment.learningPace as keyof typeof PACE_MINUTES] ?? 45;
}

/** Orders curriculum tasks by module → topic → task order for stable sequencing. */
export function sortTasks(bundle: CurriculumBundle): TaskDocument[] {
  return [...bundle.tasks].sort((a, b) => {
    const am = bundle.moduleById.get(String(a.moduleId));
    const bm = bundle.moduleById.get(String(b.moduleId));
    const moduleDiff = (am?.order ?? 0) - (bm?.order ?? 0);
    if (moduleDiff !== 0) return moduleDiff;
    const at = bundle.topicById.get(String(a.topicId));
    const bt = bundle.topicById.get(String(b.topicId));
    const topicDiff = (at?.order ?? 0) - (bt?.order ?? 0);
    if (topicDiff !== 0) return topicDiff;
    return a.order - b.order;
  });
}

interface LockContext {
  bundle: CurriculumBundle;
  completedTaskIds: Set<string>;
  topicTotals: Map<string, { total: number; completed: number }>;
  moduleTotals: Map<string, { total: number; completed: number }>;
  visibleTaskIds: Set<string>;
  visibleTopicIds: Set<string>;
  visibleModuleIds: Set<string>;
}

function buildLockContext(bundle: CurriculumBundle, completedTaskIds: Set<string>): LockContext {
  const topicTotals = new Map<string, { total: number; completed: number }>();
  const moduleTotals = new Map<string, { total: number; completed: number }>();
  for (const topic of bundle.topics) topicTotals.set(String(topic._id), { total: 0, completed: 0 });
  for (const module of bundle.modules) moduleTotals.set(String(module._id), { total: 0, completed: 0 });
  for (const task of bundle.tasks) {
    const topic = topicTotals.get(String(task.topicId));
    if (topic) {
      topic.total += 1;
      if (completedTaskIds.has(String(task._id))) topic.completed += 1;
    }
    const module = moduleTotals.get(String(task.moduleId));
    if (module) {
      module.total += 1;
      if (completedTaskIds.has(String(task._id))) module.completed += 1;
    }
  }
  return {
    bundle,
    completedTaskIds,
    topicTotals,
    moduleTotals,
    visibleTaskIds: new Set(bundle.tasks.map((t) => String(t._id))),
    visibleTopicIds: new Set(bundle.topics.map((t) => String(t._id))),
    visibleModuleIds: new Set(bundle.modules.map((m) => String(m._id))),
  };
}

/**
 * Locking rules:
 * - every published prerequisite task must be completed;
 * - every published prerequisite topic must be fully completed;
 * - every published prerequisite module must be fully completed.
 * Prerequisites pointing at unpublished/archived/missing content are ignored so
 * curriculum changes never permanently lock a learner out.
 * Already-completed tasks are never presented as locked.
 */
export function getTaskLock(
  task: TaskDocument,
  ctx: LockContext,
  completed: boolean,
): { locked: boolean; reason: string | null } {
  if (completed) return { locked: false, reason: null };

  for (const prereqId of task.prerequisites ?? []) {
    const id = String(prereqId);
    if (!ctx.visibleTaskIds.has(id)) continue;
    if (!ctx.completedTaskIds.has(id)) {
      const prereq = ctx.bundle.taskById.get(id);
      return { locked: true, reason: `Complete “${prereq?.title ?? 'the prerequisite task'}” first` };
    }
  }

  const topic = ctx.bundle.topicById.get(String(task.topicId));
  for (const prereqTopicId of topic?.prerequisites ?? []) {
    const id = String(prereqTopicId);
    if (!ctx.visibleTopicIds.has(id)) continue;
    const totals = ctx.topicTotals.get(id);
    if (totals && totals.total > 0 && totals.completed < totals.total) {
      const prereqTopic = ctx.bundle.topicById.get(id);
      return { locked: true, reason: `Finish the “${prereqTopic?.title ?? 'prerequisite'}” topic first` };
    }
  }

  const module = ctx.bundle.moduleById.get(String(task.moduleId));
  for (const prereqModuleId of module?.prerequisiteModuleIds ?? []) {
    const id = String(prereqModuleId);
    if (!ctx.visibleModuleIds.has(id)) continue;
    const totals = ctx.moduleTotals.get(id);
    if (totals && totals.total > 0 && totals.completed < totals.total) {
      const prereqModule = ctx.bundle.moduleById.get(id);
      return { locked: true, reason: `Complete the “${prereqModule?.title ?? 'prerequisite'}” module first` };
    }
  }

  return { locked: false, reason: null };
}

export function computeRoadmapProgress(
  bundle: CurriculumBundle,
  progressRecords: TaskProgressDocument[],
  timeZone: string,
  now = new Date(),
): RoadmapProgress {
  const progressByTask = new Map(progressRecords.map((record) => [String(record.taskId), record]));
  const completedTaskIds = new Set(
    progressRecords.filter((record) => record.status === 'completed').map((record) => String(record.taskId)),
  );
  const ctx = buildLockContext(bundle, completedTaskIds);
  const ordered = sortTasks(bundle);
  const today = localDay(now, timeZone);

  const tasks: ProgressTask[] = ordered.map((task) => {
    const record = progressByTask.get(String(task._id));
    const completed = record?.status === 'completed';
    const lock = getTaskLock(task, ctx, completed);
    const module = bundle.moduleById.get(String(task.moduleId));
    const topic = bundle.topicById.get(String(task.topicId));
    const serialized = serializeTask(task);
    return {
      id: String(task._id),
      roadmapId: String(task.roadmapId),
      moduleId: String(task.moduleId),
      topicId: String(task.topicId),
      title: task.title,
      description: task.description,
      type: task.type as TaskType,
      difficulty: task.difficulty,
      estimatedDuration: task.estimatedDuration,
      learningObjectives: task.learningObjectives ?? [],
      instructions: task.instructions ?? '',
      acceptanceCriteria: task.acceptanceCriteria ?? [],
      resources: (task.resources ?? []) as { title: string; url: string; type: string }[],
      order: task.order,
      moduleTitle: module?.title ?? 'Module',
      topicTitle: topic?.title ?? 'Topic',
      moduleOrder: module?.order ?? 0,
      topicOrder: topic?.order ?? 0,
      status: (record?.status as ProgressTask['status']) ?? 'not_started',
      locked: lock.locked,
      lockReason: lock.reason,
      prerequisiteIds: (task.prerequisites ?? []).map(String),
      completedAt: record?.completedAt ? new Date(record.completedAt).toISOString() : null,
      actualDuration: record?.actualDuration ?? 0,
      privateNotes: record?.privateNotes ?? '',
      attemptCount: record?.attemptCount ?? 0,
      quizQuestions: serialized.quizQuestions,
      codingExercise: serialized.codingExercise,
      hasCodingExercise: serialized.hasCodingExercise,
    };
  });

  const moduleStats = new Map<string, { total: number; completed: number; minutes: number; completedMinutes: number }>();
  const topicStats = new Map<string, { total: number; completed: number; minutes: number }>();
  for (const task of tasks) {
    const mod = moduleStats.get(task.moduleId) ?? { total: 0, completed: 0, minutes: 0, completedMinutes: 0 };
    mod.total += 1;
    mod.minutes += task.estimatedDuration;
    if (task.status === 'completed') {
      mod.completed += 1;
      mod.completedMinutes += task.estimatedDuration;
    }
    moduleStats.set(task.moduleId, mod);

    const top = topicStats.get(task.topicId) ?? { total: 0, completed: 0, minutes: 0 };
    top.total += 1;
    top.minutes += task.estimatedDuration;
    if (task.status === 'completed') top.completed += 1;
    topicStats.set(task.topicId, top);
  }

  const modules: ModuleProgress[] = bundle.modules.map((module) => {
    const stats = moduleStats.get(String(module._id)) ?? { total: 0, completed: 0, minutes: 0, completedMinutes: 0 };
    const topicsInModule = (bundle.topicsByModule.get(String(module._id)) ?? []).length;
    return {
      id: String(module._id),
      title: module.title,
      description: module.description ?? '',
      order: module.order,
      totalTasks: stats.total,
      completedTasks: stats.completed,
      percent: percent(stats.completed, stats.total),
      estimatedMinutes: stats.minutes,
      completedMinutes: stats.completedMinutes,
      topicCount: topicsInModule,
      locked: stats.total > 0 && stats.completed === 0 && tasks.filter((t) => t.moduleId === String(module._id)).every((t) => t.locked),
    };
  });

  const topics: TopicProgress[] = bundle.topics.map((topic) => {
    const stats = topicStats.get(String(topic._id)) ?? { total: 0, completed: 0, minutes: 0 };
    return {
      id: String(topic._id),
      moduleId: String(topic.moduleId),
      title: topic.title,
      description: topic.description ?? '',
      order: topic.order,
      totalTasks: stats.total,
      completedTasks: stats.completed,
      percent: percent(stats.completed, stats.total),
      estimatedMinutes: stats.minutes,
      locked: stats.total > 0 && stats.completed === 0 && tasks.filter((t) => t.topicId === String(topic._id)).every((t) => t.locked),
    };
  });

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const completedMinutes = tasks.filter((t) => t.status === 'completed').reduce((sum, t) => sum + t.estimatedDuration, 0);
  const totalMinutes = tasks.reduce((sum, t) => sum + t.estimatedDuration, 0);
  const nextTask = tasks.find((t) => t.status !== 'completed' && !t.locked) ?? null;
  const completedToday = tasks.filter(
    (t) => t.completedAt && localDay(new Date(t.completedAt), timeZone) === today,
  ).length;

  return {
    roadmapId: String(bundle.roadmap._id),
    totalTasks,
    completedTasks,
    percent: percent(completedTasks, totalTasks),
    totalMinutes,
    completedMinutes,
    modules,
    topics,
    tasks,
    nextTask,
    completedToday,
  };
}

function localDay(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export interface EnrolledRoadmapProgress {
  enrollment: EnrollmentDocument;
  bundle: CurriculumBundle;
  progress: RoadmapProgress;
}

/**
 * Overall learning progress is **time-weighted** across active, paused and completed
 * enrollments (archived enrollments are excluded):
 *
 *   overall % = Σ estimated minutes of completed published tasks
 *              ───────────────────────────────────────────────────── × 100
 *              Σ estimated minutes of all published eligible tasks
 *
 * This prevents a short roadmap from dominating the score and is documented in
 * docs/PROGRESS_RULES.md.
 */
export function computeOverallProgress(items: EnrolledRoadmapProgress[]): {
  percent: number;
  totalTasks: number;
  completedTasks: number;
  totalMinutes: number;
  completedMinutes: number;
} {
  let totalMinutes = 0;
  let completedMinutes = 0;
  let totalTasks = 0;
  let completedTasks = 0;
  for (const item of items) {
    totalMinutes += item.progress.totalMinutes;
    completedMinutes += item.progress.completedMinutes;
    totalTasks += item.progress.totalTasks;
    completedTasks += item.progress.completedTasks;
  }
  return {
    percent: percent(completedMinutes, totalMinutes),
    totalTasks,
    completedTasks,
    totalMinutes,
    completedMinutes,
  };
}

/** Idempotently creates progress rows for newly published tasks. */
export async function ensureProgressRecords(
  userId: string,
  enrollment: EnrollmentDocument,
  tasks: TaskDocument[],
): Promise<void> {
  if (tasks.length === 0) return;
  const taskIds = tasks.map((task) => task._id);
  const existing = await TaskProgress.find({ userId, taskId: { $in: taskIds } }).select('taskId');
  const existingIds = new Set(existing.map((record) => String(record.taskId)));
  const missing = tasks.filter((task) => !existingIds.has(String(task._id)));
  if (missing.length === 0) return;
  try {
    await TaskProgress.insertMany(
      missing.map((task) => ({
        userId: new MongooseTypes.ObjectId(userId),
        enrollmentId: enrollment._id,
        roadmapId: task.roadmapId,
        taskId: task._id,
        status: 'not_started',
      })),
      { ordered: false },
    );
  } catch (error) {
    // Concurrent initialization can race on the unique (userId, taskId) index;
    // duplicates are safe to ignore because the equivalent record already exists.
    if ((error as { code?: number }).code !== 11000 && !Array.isArray((error as { writeErrors?: unknown[] }).writeErrors)) {
      throw error;
    }
  }
}

export function overallPercentFromEnrollments(
  items: { percent: number; estimatedMinutes: number; completedMinutes: number }[],
): number {
  const total = items.reduce((sum, item) => sum + item.estimatedMinutes, 0);
  const completed = items.reduce((sum, item) => sum + item.completedMinutes, 0);
  return percent(completed, total);
}

export type ObjectIdLike = string | Types.ObjectId;
