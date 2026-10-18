import { Enrollment } from '../models/Enrollment.js';
import { TaskSubmission } from '../models/TaskSubmission.js';
import { TaskProgress } from '../models/TaskProgress.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { bumpDailyActivity, recordActivity } from './activity.js';
import { evaluateAchievements, awardRoadmapCompletion } from './achievements.js';
import { assertMutableEnrollment, getTaskContextForUser, type TaskContext } from './taskContext.js';
import { computeRoadmapProgress, type ProgressTask, type RoadmapProgress } from './progress.js';
import { localDateString } from '../utils/time.js';

export interface QuizResult {
  score: number;
  total: number;
  correct: boolean[];
  explanations: string[];
}

export interface ProgressSummary {
  roadmapPercent: number;
  completedTasks: number;
  totalTasks: number;
  moduleId: string;
  modulePercent: number;
  moduleCompleted: number;
  moduleTotal: number;
  topicId: string;
  topicPercent: number;
  topicCompleted: number;
  topicTotal: number;
  enrollmentStatus: string;
}

export interface MutationResult {
  alreadyCompleted: boolean;
  task: ProgressTask;
  summary: ProgressSummary;
  nextTask: ProgressTask | null;
  newlyEarned: { key: string; title: string; description: string }[];
  roadmapCompleted: boolean;
  quizResult: QuizResult | null;
}

function summarize(progress: RoadmapProgress, moduleId: string, topicId: string, enrollmentStatus: string): ProgressSummary {
  const module = progress.modules.find((item) => item.id === moduleId);
  const topic = progress.topics.find((item) => item.id === topicId);
  return {
    roadmapPercent: progress.percent,
    completedTasks: progress.completedTasks,
    totalTasks: progress.totalTasks,
    moduleId,
    modulePercent: module?.percent ?? 0,
    moduleCompleted: module?.completedTasks ?? 0,
    moduleTotal: module?.totalTasks ?? 0,
    topicId,
    topicPercent: topic?.percent ?? 0,
    topicCompleted: topic?.completedTasks ?? 0,
    topicTotal: topic?.totalTasks ?? 0,
    enrollmentStatus,
  };
}

export function evaluateQuiz(
  task: TaskContext['task'],
  answers: number[] | undefined,
): QuizResult | null {
  const questions = task.quizQuestions ?? [];
  if (questions.length === 0) return null;
  if (!answers) return null;
  if (answers.length !== questions.length) {
    throw badRequest(`This quiz has ${questions.length} question(s); ${answers.length} answer(s) were submitted.`);
  }
  const correct = questions.map((question, index) => answers[index] === question.correctOptionIndex);
  return {
    score: correct.filter(Boolean).length,
    total: questions.length,
    correct,
    explanations: questions.map((question) => question.explanation ?? ''),
  };
}

async function freshProgress(context: TaskContext, taskId: string) {
  const records = await TaskProgress.find({ userId: context.enrollment.userId, roadmapId: context.enrollment.roadmapId });
  const progress = computeRoadmapProgress(context.bundle, records, context.userTimezone);
  const task = progress.tasks.find((item) => item.id === taskId);
  if (!task) throw notFound('Task not found');
  return { progress, task };
}

export async function completeTaskForUser(options: {
  userId: string;
  taskId: string;
  actualDuration?: number;
  quizAnswers?: number[];
}): Promise<MutationResult> {
  const { userId, taskId } = options;
  const context = await getTaskContextForUser(userId, taskId);
  assertMutableEnrollment(context.enrollment);
  const { task, enrollment, progressTask, bundle, userTimezone } = context;
  const now = new Date();

  const quizResult = evaluateQuiz(task, options.quizAnswers);
  if (quizResult) {
    await TaskSubmission.create({
      userId,
      enrollmentId: enrollment._id,
      taskId: task._id,
      kind: 'quiz',
      language: 'quiz',
      content: JSON.stringify({ answers: options.quizAnswers, score: quizResult.score, total: quizResult.total }),
      selfVerified: true,
    });
  }

  if (progressTask.status === 'completed') {
    return {
      alreadyCompleted: true,
      task: progressTask,
      summary: summarize(context.progress, progressTask.moduleId, progressTask.topicId, enrollment.status),
      nextTask: context.progress.nextTask,
      newlyEarned: [],
      roadmapCompleted: enrollment.status === 'completed',
      quizResult,
    };
  }
  if (progressTask.locked) {
    throw conflict(progressTask.lockReason ?? 'Complete the prerequisite tasks first', [
      { path: 'prerequisites', message: progressTask.lockReason ?? 'This task is locked' },
    ]);
  }

  const existing = await TaskProgress.findOne({ userId, taskId: task._id });
  const providedMinutes = Math.max(0, options.actualDuration ?? 0);
  const previouslyLogged = existing?.actualDuration ?? 0;
  const creditedMinutes =
    providedMinutes > 0 ? providedMinutes : Math.max(task.estimatedDuration - previouslyLogged, 0);

  const update: Record<string, unknown> = {
    $set: {
      enrollmentId: enrollment._id,
      roadmapId: task.roadmapId,
      status: 'completed',
      completedAt: now,
      lastInteractionAt: now,
      ...(existing?.firstCompletedAt ? {} : { firstCompletedAt: now }),
    },
    $inc: { attemptCount: 1 },
    $setOnInsert: { userId, taskId: task._id, privateNotes: '' },
  };
  if (providedMinutes > 0) {
    (update.$inc as Record<string, number>).actualDuration = providedMinutes;
  }
  await TaskProgress.findOneAndUpdate({ userId, taskId: task._id }, update, {
    upsert: true,
    new: true,
  });

  await bumpDailyActivity({
    userId,
    timeZone: userTimezone,
    date: localDateString(now, userTimezone),
    completedTasksDelta: 1,
    learningMinutesDelta: creditedMinutes,
    roadmapId: task.roadmapId,
  });
  await recordActivity({
    userId,
    enrollmentId: enrollment._id,
    roadmapId: task.roadmapId,
    taskId: task._id,
    activityType: 'task_completed',
    timeZone: userTimezone,
    minutes: creditedMinutes,
    timestamp: now,
    metadata: {
      taskTitle: task.title,
      estimatedDuration: task.estimatedDuration,
      actualDuration: providedMinutes || null,
      quizScore: quizResult ? `${quizResult.score}/${quizResult.total}` : null,
    },
  });

  const { progress, task: updatedTask } = await freshProgress(context, taskId);
  let roadmapCompleted = false;
  const allComplete = progress.totalTasks > 0 && progress.completedTasks === progress.totalTasks;

  if (allComplete) {
    if (enrollment.status !== 'completed') {
      enrollment.status = 'completed';
      enrollment.completedAt = now;
      enrollment.lastActivityAt = now;
      if (!enrollment.startedAt) enrollment.startedAt = enrollment.enrolledAt ?? now;
      await enrollment.save();
      await awardRoadmapCompletion(userId, { _id: bundle.roadmap._id, title: bundle.roadmap.title });
      await recordActivity({
        userId,
        enrollmentId: enrollment._id,
        roadmapId: task.roadmapId,
        activityType: 'roadmap_completed',
        timeZone: userTimezone,
        timestamp: now,
        metadata: { roadmapTitle: bundle.roadmap.title },
      });
    }
    roadmapCompleted = true;
  } else {
    enrollment.lastActivityAt = now;
    if (!enrollment.startedAt) enrollment.startedAt = enrollment.enrolledAt ?? now;
    if (enrollment.status === 'completed') {
      // A task was reopened previously and the roadmap is no longer complete.
      enrollment.status = 'active';
      enrollment.completedAt = null;
    }
    await enrollment.save();
  }

  const newlyEarned = await evaluateAchievements(userId, userTimezone);
  return {
    alreadyCompleted: false,
    task: updatedTask,
    summary: summarize(progress, updatedTask.moduleId, updatedTask.topicId, enrollment.status),
    nextTask: progress.nextTask,
    newlyEarned,
    roadmapCompleted,
    quizResult,
  };
}

export async function reopenTaskForUser(userId: string, taskId: string): Promise<MutationResult> {
  const context = await getTaskContextForUser(userId, taskId);
  assertMutableEnrollment(context.enrollment);
  const { enrollment, progressTask, userTimezone } = context;
  const now = new Date();

  if (progressTask.status !== 'completed') {
    return {
      alreadyCompleted: false,
      task: progressTask,
      summary: summarize(context.progress, progressTask.moduleId, progressTask.topicId, enrollment.status),
      nextTask: context.progress.nextTask,
      newlyEarned: [],
      roadmapCompleted: false,
      quizResult: null,
    };
  }

  await TaskProgress.findOneAndUpdate(
    { userId, taskId: progressTask.id },
    {
      $set: { status: 'in_progress', completedAt: null, lastInteractionAt: now },
    },
  );

  if (enrollment.status === 'completed') {
    enrollment.status = 'active';
    enrollment.completedAt = null;
  }
  enrollment.lastActivityAt = now;
  await enrollment.save();

  await recordActivity({
    userId,
    enrollmentId: enrollment._id,
    roadmapId: enrollment.roadmapId,
    taskId: progressTask.id,
    activityType: 'task_reopened',
    timeZone: userTimezone,
    timestamp: now,
    metadata: { taskTitle: progressTask.title },
  });

  const { progress, task } = await freshProgress(context, taskId);
  const newlyEarned = await evaluateAchievements(userId, userTimezone);
  return {
    alreadyCompleted: false,
    task,
    summary: summarize(progress, task.moduleId, task.topicId, enrollment.status),
    nextTask: progress.nextTask,
    newlyEarned,
    roadmapCompleted: false,
    quizResult: null,
  };
}

export async function updateTaskProgressForUser(options: {
  userId: string;
  taskId: string;
  privateNotes?: string;
  actualDuration?: number;
  selfVerified?: boolean;
}): Promise<{ task: ProgressTask; summary: ProgressSummary }> {
  const context = await getTaskContextForUser(options.userId, options.taskId);
  assertMutableEnrollment(context.enrollment);
  if (context.progressTask.locked) {
    throw conflict(context.progressTask.lockReason ?? 'This task is locked');
  }
  const { progressTask, enrollment, userTimezone } = context;
  const now = new Date();
  const existing = await TaskProgress.findOne({ userId: options.userId, taskId: progressTask.id });
  const previousDuration = existing?.actualDuration ?? 0;
  const nextDuration = options.actualDuration ?? previousDuration;
  const delta = Math.max(0, nextDuration - previousDuration);

  const set: Record<string, unknown> = { lastInteractionAt: now };
  if (options.privateNotes !== undefined) set.privateNotes = options.privateNotes;
  if (options.selfVerified !== undefined) set.selfVerified = options.selfVerified;
  if (nextDuration !== previousDuration) set.actualDuration = nextDuration;
  if (progressTask.status === 'not_started') set.status = 'in_progress';
  if (progressTask.status === 'completed' && options.privateNotes === undefined && options.actualDuration === undefined && options.selfVerified === undefined) {
    throw badRequest('Nothing to update');
  }

  const update: Record<string, unknown> = { $set: set };
  if (!existing) {
    update.$setOnInsert = {
      userId: options.userId,
      taskId: progressTask.id,
      enrollmentId: enrollment._id,
      roadmapId: enrollment.roadmapId,
    };
  }
  await TaskProgress.findOneAndUpdate({ userId: options.userId, taskId: progressTask.id }, update, {
    upsert: true,
    new: true,
  });

  if (delta > 0) {
    await bumpDailyActivity({
      userId: options.userId,
      timeZone: userTimezone,
      learningMinutesDelta: delta,
      roadmapId: enrollment.roadmapId,
    });
    await recordActivity({
      userId: options.userId,
      enrollmentId: enrollment._id,
      roadmapId: enrollment.roadmapId,
      taskId: progressTask.id,
      activityType: 'time_logged',
      timeZone: userTimezone,
      minutes: delta,
      timestamp: now,
      metadata: { taskTitle: progressTask.title, totalRecorded: nextDuration },
    });
  }
  if (options.privateNotes !== undefined) {
    await recordActivity({
      userId: options.userId,
      enrollmentId: enrollment._id,
      roadmapId: enrollment.roadmapId,
      taskId: progressTask.id,
      activityType: 'note_updated',
      timeZone: userTimezone,
      timestamp: now,
      metadata: { taskTitle: progressTask.title },
    });
  }

  const { progress, task } = await freshProgress(context, options.taskId);
  return { task, summary: summarize(progress, task.moduleId, task.topicId, enrollment.status) };
}
