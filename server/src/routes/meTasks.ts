import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireValidObjectIdParam, validate } from '../middleware/validate.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { Roadmap } from '../models/Roadmap.js';
import { Task } from '../models/Task.js';
import { TaskProgress } from '../models/TaskProgress.js';
import { TaskSubmission } from '../models/TaskSubmission.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { paginate, paginationSchema } from '../utils/pagination.js';
import { completeTaskSchema, quizAttemptSchema, submissionSchema, taskFiltersSchema } from '../validation/tasks.js';
import { getDailyPlanForUser } from '../services/dailyPlanService.js';
import { getEnrollmentContexts } from '../services/userOverview.js';
import { assertMutableEnrollment, getTaskContextForUser } from '../services/taskContext.js';
import { completeTaskForUser, evaluateQuiz, reopenTaskForUser, updateTaskProgressForUser } from '../services/taskLifecycle.js';
import { recordActivity } from '../services/activity.js';

export const meTasksRouter = Router();

meTasksRouter.get(
  '/me/tasks/today',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await getDailyPlanForUser(req.user!.id);
    res.json(result);
  }),
);

meTasksRouter.get(
  '/me/tasks/history',
  requireAuth,
  validate(
    paginationSchema.extend({
      activityType: z
        .enum(['task_completed', 'task_reopened', 'roadmap_completed', 'time_logged', 'achievement_unlocked'])
        .optional(),
    }),
    'query',
  ),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as { page: number; limit: number; activityType?: string };
    const filter: Record<string, unknown> = {
      userId: req.user!.id,
      activityType: query.activityType ?? { $in: ['task_completed', 'task_reopened', 'roadmap_completed'] },
    };
    const [logs, total] = await Promise.all([
      ActivityLog.find(filter)
        .sort({ timestamp: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      ActivityLog.countDocuments(filter),
    ]);
    const taskIds = [...new Set(logs.filter((log) => log.taskId).map((log) => String(log.taskId)))];
    const roadmapIds = [...new Set(logs.filter((log) => log.roadmapId).map((log) => String(log.roadmapId)))];
    const [tasks, roadmaps] = await Promise.all([
      Task.find({ _id: { $in: taskIds } }).select('title type difficulty').lean(),
      Roadmap.find({ _id: { $in: roadmapIds } }).select('title slug').lean(),
    ]);
    const taskById = new Map(tasks.map((task) => [String(task._id), task]));
    const roadmapById = new Map(roadmaps.map((roadmap) => [String(roadmap._id), roadmap]));
    const items = logs.map((log) => {
      const task = log.taskId ? taskById.get(String(log.taskId)) : undefined;
      const roadmap = log.roadmapId ? roadmapById.get(String(log.roadmapId)) : undefined;
      return {
        id: String(log._id),
        activityType: log.activityType,
        timestamp: log.timestamp,
        localDate: log.localDate,
        minutes: log.minutes,
        task: task ? { id: String(log.taskId), title: task.title, type: task.type, difficulty: task.difficulty } : null,
        roadmap: roadmap ? { id: String(log.roadmapId), title: roadmap.title, slug: roadmap.slug } : null,
        metadata: log.metadata,
      };
    });
    res.json(paginate(items, total, query.page, query.limit));
  }),
);

meTasksRouter.get(
  '/me/tasks',
  requireAuth,
  validate(
    taskFiltersSchema.extend({
      enrollmentId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
      includeArchived: z.enum(['true', 'false']).optional(),
      sort: z.enum(['curriculum', 'difficulty', 'duration']).default('curriculum'),
    }),
    'query',
  ),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as z.infer<typeof taskFiltersSchema> & {
      enrollmentId?: string;
      includeArchived?: string;
      sort: 'curriculum' | 'difficulty' | 'duration';
    };
    const user = await User.findById(req.user!.id).select('timezone');
    const contexts = await getEnrollmentContexts(req.user!.id, user?.timezone ?? 'UTC');
    const allowed = contexts.filter(
      (context) =>
        (context.enrollment.status !== 'archived' || query.includeArchived === 'true') &&
        (!query.enrollmentId || String(context.enrollment._id) === query.enrollmentId) &&
        (!query.roadmapId || String(context.bundle.roadmap._id) === query.roadmapId),
    );

    let items = allowed.flatMap((context) =>
      context.progress.tasks.map((task) => ({
        ...task,
        enrollmentId: String(context.enrollment._id),
        enrollmentStatus: context.enrollment.status,
        learningPace: context.enrollment.learningPace,
        roadmapTitle: context.bundle.roadmap.title,
        roadmapSlug: context.bundle.roadmap.slug,
        roadmapCategory: context.bundle.roadmap.category,
      })),
    );

    const counts = {
      total: items.length,
      completed: items.filter((task) => task.status === 'completed').length,
      available: items.filter((task) => task.status !== 'completed' && !task.locked).length,
      locked: items.filter((task) => task.locked && task.status !== 'completed').length,
    };

    if (query.moduleId) items = items.filter((task) => task.moduleId === query.moduleId);
    if (query.topicId) items = items.filter((task) => task.topicId === query.topicId);
    if (query.difficulty) items = items.filter((task) => task.difficulty === query.difficulty);
    if (query.type) items = items.filter((task) => task.type === query.type);
    if (query.status === 'locked') items = items.filter((task) => task.locked && task.status !== 'completed');
    else if (query.status) items = items.filter((task) => task.status === query.status);
    if (query.search) {
      const search = query.search.toLowerCase();
      items = items.filter(
        (task) =>
          task.title.toLowerCase().includes(search) ||
          task.description.toLowerCase().includes(search) ||
          task.topicTitle.toLowerCase().includes(search) ||
          task.moduleTitle.toLowerCase().includes(search) ||
          task.roadmapTitle.toLowerCase().includes(search),
      );
    }

    if (query.sort === 'difficulty') {
      const rank: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 };
      items.sort((a, b) => rank[a.difficulty] - rank[b.difficulty] || a.order - b.order);
    } else if (query.sort === 'duration') {
      items.sort((a, b) => a.estimatedDuration - b.estimatedDuration);
    } else {
      items.sort(
        (a, b) =>
          (a.status === 'completed' ? 1 : 0) - (b.status === 'completed' ? 1 : 0) ||
          a.moduleOrder - b.moduleOrder ||
          a.topicOrder - b.topicOrder ||
          a.order - b.order,
      );
    }

    const total = items.length;
    const pageItems = items.slice((query.page - 1) * query.limit, query.page * query.limit);
    res.json({ ...paginate(pageItems, total, query.page, query.limit), counts });
  }),
);

meTasksRouter.get(
  '/me/tasks/:taskId',
  requireAuth,
  requireValidObjectIdParam('taskId'),
  asyncHandler(async (req, res) => {
    const context = await getTaskContextForUser(req.user!.id, req.params.taskId);
    const submissions = await TaskSubmission.find({ userId: req.user!.id, taskId: req.params.taskId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    res.json({
      task: context.progressTask,
      enrollment: {
        id: String(context.enrollment._id),
        status: context.enrollment.status,
        learningPace: context.enrollment.learningPace,
      },
      roadmap: {
        id: String(context.bundle.roadmap._id),
        title: context.bundle.roadmap.title,
        slug: context.bundle.roadmap.slug,
      },
      module: { id: context.progressTask.moduleId, title: context.progressTask.moduleTitle },
      topic: { id: context.progressTask.topicId, title: context.progressTask.topicTitle },
      submissions: submissions.map(serializeSubmission),
    });
  }),
);

meTasksRouter.get(
  '/me/tasks/:taskId/solution',
  requireAuth,
  requireValidObjectIdParam('taskId'),
  asyncHandler(async (req, res) => {
    const context = await getTaskContextForUser(req.user!.id, req.params.taskId);
    const exercise = context.task.codingExercise;
    if (!exercise || !exercise.solutionExplanation) {
      throw notFound('This task does not have a stored solution explanation');
    }
    res.json({
      solutionExplanation: exercise.solutionExplanation,
      hints: exercise.hints,
      note: 'Solutions are shown only on request. Try the exercise and record a self-verified submission first.',
    });
  }),
);

meTasksRouter.post(
  '/me/tasks/:taskId/complete',
  requireAuth,
  requireValidObjectIdParam('taskId'),
  validate(completeTaskSchema),
  asyncHandler(async (req, res) => {
    const result = await completeTaskForUser({
      userId: req.user!.id,
      taskId: req.params.taskId,
      actualDuration: req.body.actualDuration,
      quizAnswers: req.body.quizAnswers,
    });
    res.json({
      message: result.alreadyCompleted ? 'This task is already completed.' : 'Task completed. Progress saved.',
      ...result,
    });
  }),
);

meTasksRouter.post(
  '/me/tasks/:taskId/reopen',
  requireAuth,
  requireValidObjectIdParam('taskId'),
  asyncHandler(async (req, res) => {
    const result = await reopenTaskForUser(req.user!.id, req.params.taskId);
    res.json({ message: 'Task reopened. Your completion history is kept for your records.', ...result });
  }),
);

meTasksRouter.patch(
  '/me/tasks/:taskId/progress',
  requireAuth,
  requireValidObjectIdParam('taskId'),
  validate(
    z
      .object({
        privateNotes: z.string().max(10000).optional(),
        actualDuration: z.coerce.number().int().min(0).max(1440).optional(),
        selfVerified: z.boolean().optional(),
      })
      .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' }),
  ),
  asyncHandler(async (req, res) => {
    const result = await updateTaskProgressForUser({
      userId: req.user!.id,
      taskId: req.params.taskId,
      privateNotes: req.body.privateNotes,
      actualDuration: req.body.actualDuration,
      selfVerified: req.body.selfVerified,
    });
    res.json({ message: 'Progress updated', ...result });
  }),
);

meTasksRouter.get(
  '/me/tasks/:taskId/submissions',
  requireAuth,
  requireValidObjectIdParam('taskId'),
  asyncHandler(async (req, res) => {
    const context = await getTaskContextForUser(req.user!.id, req.params.taskId);
    const submissions = await TaskSubmission.find({ userId: req.user!.id, taskId: context.task._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ items: submissions.map(serializeSubmission) });
  }),
);

meTasksRouter.post(
  '/me/tasks/:taskId/submissions',
  requireAuth,
  requireValidObjectIdParam('taskId'),
  validate(submissionSchema),
  asyncHandler(async (req, res) => {
    const context = await getTaskContextForUser(req.user!.id, req.params.taskId);
    assertMutableEnrollment(context.enrollment);
    if (context.progressTask.locked) throw conflict(context.progressTask.lockReason ?? 'This task is locked');
    const submission = await TaskSubmission.create({
      userId: req.user!.id,
      enrollmentId: context.enrollment._id,
      taskId: context.task._id,
      kind: 'code',
      language: req.body.language,
      content: req.body.content,
      notes: req.body.notes,
      selfVerified: req.body.selfVerified,
    });
    const submissionSet: Record<string, unknown> = { lastInteractionAt: new Date() };
    if (req.body.selfVerified) submissionSet.selfVerified = true;
    if (context.progressTask.status === 'not_started') submissionSet.status = 'in_progress';
    await TaskProgress.findOneAndUpdate(
      { userId: req.user!.id, taskId: context.task._id },
      {
        $set: submissionSet,
        $setOnInsert: {
          userId: req.user!.id,
          taskId: context.task._id,
          enrollmentId: context.enrollment._id,
          roadmapId: context.enrollment.roadmapId,
        },
      },
      { upsert: true, new: true },
    );
    await recordActivity({
      userId: req.user!.id,
      enrollmentId: context.enrollment._id,
      roadmapId: context.enrollment.roadmapId,
      taskId: context.task._id,
      activityType: 'task_submitted',
      timeZone: context.userTimezone,
      metadata: { taskTitle: context.task.title, language: req.body.language, selfVerified: req.body.selfVerified },
    });
    res.status(201).json({ submission: serializeSubmission(submission.toObject()), message: 'Solution saved to your submission history.' });
  }),
);

meTasksRouter.post(
  '/me/tasks/:taskId/quiz-attempt',
  requireAuth,
  requireValidObjectIdParam('taskId'),
  validate(quizAttemptSchema),
  asyncHandler(async (req, res) => {
    const context = await getTaskContextForUser(req.user!.id, req.params.taskId);
    assertMutableEnrollment(context.enrollment);
    if (context.progressTask.locked) throw conflict(context.progressTask.lockReason ?? 'This task is locked');
    const questions = context.task.quizQuestions ?? [];
    if (questions.length === 0) throw badRequest('This task has no quiz questions');
    const result = evaluateQuiz(context.task, req.body.answers);
    if (!result) throw badRequest('Submit an answer for every question');
    await TaskSubmission.create({
      userId: req.user!.id,
      enrollmentId: context.enrollment._id,
      taskId: context.task._id,
      kind: 'quiz',
      language: 'quiz',
      content: JSON.stringify({ answers: req.body.answers, score: result.score, total: result.total }),
      selfVerified: true,
    });
    const quizSet: Record<string, unknown> = { lastInteractionAt: new Date() };
    if (context.progressTask.status === 'not_started') quizSet.status = 'in_progress';
    await TaskProgress.updateOne({ userId: req.user!.id, taskId: context.task._id }, { $set: quizSet });
    await recordActivity({
      userId: req.user!.id,
      enrollmentId: context.enrollment._id,
      roadmapId: context.enrollment.roadmapId,
      taskId: context.task._id,
      activityType: 'task_submitted',
      timeZone: context.userTimezone,
      metadata: { taskTitle: context.task.title, kind: 'quiz', score: `${result.score}/${result.total}` },
    });
    res.json({
      score: result.score,
      total: result.total,
      review: questions.map((question, index) => ({
        question: question.question,
        options: question.options,
        selectedOptionIndex: req.body.answers[index],
        correctOptionIndex: question.correctOptionIndex,
        correct: result.correct[index],
        explanation: question.explanation,
      })),
      message: result.score === result.total ? 'Perfect score. Mark the task complete when ready.' : 'Attempt recorded. Review the explanations before completing the task.',
    });
  }),
);

function serializeSubmission(submission: Record<string, any>) {
  return {
    id: String(submission._id),
    taskId: String(submission.taskId),
    kind: submission.kind,
    language: submission.language,
    content: submission.content,
    notes: submission.notes,
    selfVerified: submission.selfVerified,
    createdAt: submission.createdAt,
  };
}
