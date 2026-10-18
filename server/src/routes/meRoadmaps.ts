import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireValidObjectIdParam, validate } from '../middleware/validate.js';
import { Enrollment } from '../models/Enrollment.js';
import { Roadmap } from '../models/Roadmap.js';
import { TaskProgress } from '../models/TaskProgress.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { paginate, paginationSchema } from '../utils/pagination.js';
import { updateEnrollmentSchema } from '../validation/enrollment.js';
import { loadCurriculum } from '../services/curriculum.js';
import { computeOverallProgress, computeRoadmapProgress } from '../services/progress.js';
import { getEnrollmentContexts, serializeRoadmapCard } from '../services/userOverview.js';
import { recordActivity } from '../services/activity.js';
import { createNotification } from '../services/notifications.js';
import { taskFiltersSchema } from '../validation/tasks.js';

export const meRoadmapsRouter = Router();

meRoadmapsRouter.get(
  '/me/roadmaps',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.id).select('timezone');
    const timeZone = user?.timezone ?? 'UTC';
    const contexts = await getEnrollmentContexts(req.user!.id, timeZone);
    const cards = contexts.map(serializeRoadmapCard);
    const nonArchived = contexts.filter((context) => context.enrollment.status !== 'archived');
    const overall = computeOverallProgress(nonArchived);
    const counts = {
      active: cards.filter((c) => c.status === 'active').length,
      paused: cards.filter((c) => c.status === 'paused').length,
      completed: cards.filter((c) => c.status === 'completed').length,
      archived: cards.filter((c) => c.status === 'archived').length,
      total: cards.length,
    };
    res.json({ items: cards, overall, counts, generatedAt: new Date().toISOString() });
  }),
);

async function loadOwnedEnrollment(userId: string, enrollmentId: string) {
  const enrollment = await Enrollment.findOne({ _id: enrollmentId, userId });
  if (!enrollment) throw notFound('Enrollment not found');
  const roadmap = await Roadmap.findOne({ _id: enrollment.roadmapId, published: true, archivedAt: null });
  if (!roadmap) throw notFound('This roadmap is no longer available');
  return enrollment;
}

async function buildWorkspace(userId: string, enrollmentId: string) {
  const enrollment = await loadOwnedEnrollment(userId, enrollmentId);
  const [bundle, user] = await Promise.all([
    loadCurriculum(enrollment.roadmapId),
    User.findById(userId).select('timezone').lean(),
  ]);
  if (!bundle) throw notFound('This roadmap is no longer available');
  const timeZone = user?.timezone ?? 'UTC';
  const records = await TaskProgress.find({ userId, roadmapId: enrollment.roadmapId });
  const progress = computeRoadmapProgress(bundle, records, timeZone);
  const modules = bundle.modules.map((module) => {
    const moduleProgress = progress.modules.find((item) => item.id === String(module._id));
    const topics = (bundle.topicsByModule.get(String(module._id)) ?? []).map((topic) => {
      const topicProgress = progress.topics.find((item) => item.id === String(topic._id));
      return {
        id: String(topic._id),
        moduleId: String(topic.moduleId),
        title: topic.title,
        description: topic.description,
        order: topic.order,
        estimatedDuration: topic.estimatedDuration,
        learningOutcomes: topic.learningOutcomes,
        resources: topic.resources,
        percent: topicProgress?.percent ?? 0,
        completedTasks: topicProgress?.completedTasks ?? 0,
        totalTasks: topicProgress?.totalTasks ?? 0,
        locked: topicProgress?.locked ?? false,
      };
    });
    return {
      id: String(module._id),
      title: module.title,
      description: module.description,
      order: module.order,
      learningOutcomes: module.learningOutcomes,
      prerequisiteModuleIds: module.prerequisiteModuleIds,
      percent: moduleProgress?.percent ?? 0,
      completedTasks: moduleProgress?.completedTasks ?? 0,
      totalTasks: moduleProgress?.totalTasks ?? 0,
      estimatedMinutes: moduleProgress?.estimatedMinutes ?? 0,
      locked: moduleProgress?.locked ?? false,
      topics,
    };
  });

  const card = {
    enrollmentId: String(enrollment._id),
    status: enrollment.status,
    learningPace: enrollment.learningPace,
    customDailyGoal: enrollment.customDailyGoal,
    enrolledAt: enrollment.enrolledAt,
    completedAt: enrollment.completedAt,
    lastActivityAt: enrollment.lastActivityAt,
    percent: progress.percent,
    completedTasks: progress.completedTasks,
    totalTasks: progress.totalTasks,
    completedMinutes: progress.completedMinutes,
    totalMinutes: progress.totalMinutes,
    completedToday: progress.completedToday,
    nextTask: progress.nextTask
      ? {
          id: progress.nextTask.id,
          title: progress.nextTask.title,
          estimatedDuration: progress.nextTask.estimatedDuration,
          topicTitle: progress.nextTask.topicTitle,
          moduleTitle: progress.nextTask.moduleTitle,
        }
      : null,
  };

  return {
    enrollment: card,
    roadmap: {
      id: String(bundle.roadmap._id),
      title: bundle.roadmap.title,
      slug: bundle.roadmap.slug,
      tagline: bundle.roadmap.tagline,
      description: bundle.roadmap.description,
      category: bundle.roadmap.category,
      difficulty: bundle.roadmap.difficulty,
      difficultyLabel: bundle.roadmap.difficultyLabel || bundle.roadmap.difficulty,
      estimatedDuration: bundle.roadmap.estimatedDuration,
      learningOutcomes: bundle.roadmap.learningOutcomes,
      skills: bundle.roadmap.skills,
      version: bundle.roadmap.version,
    },
    modules,
    tasks: progress.tasks,
    progress: {
      percent: progress.percent,
      completedTasks: progress.completedTasks,
      totalTasks: progress.totalTasks,
      completedMinutes: progress.completedMinutes,
      totalMinutes: progress.totalMinutes,
      nextTask: progress.nextTask,
    },
  };
}

meRoadmapsRouter.get(
  '/me/roadmaps/:enrollmentId',
  requireAuth,
  requireValidObjectIdParam('enrollmentId'),
  asyncHandler(async (req, res) => {
    const workspace = await buildWorkspace(req.user!.id, req.params.enrollmentId);
    res.json(workspace);
  }),
);

// Kept as a distinct endpoint because the API contract exposes it.
meRoadmapsRouter.get(
  '/me/roadmaps/:enrollmentId/tasks',
  requireAuth,
  requireValidObjectIdParam('enrollmentId'),
  validate(
    paginationSchema.extend({
      moduleId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
      topicId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
      difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
      status: z.enum(['not_started', 'in_progress', 'completed', 'locked']).optional(),
      type: z.enum(['learn', 'practice', 'code', 'quiz', 'project', 'revision', 'assessment']).optional(),
      search: z.string().trim().max(120).optional(),
    }),
    'query',
  ),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as z.infer<typeof taskFiltersSchema>;
    const workspace = await buildWorkspace(req.user!.id, req.params.enrollmentId);
    let tasks = workspace.tasks;
    if (query.moduleId) tasks = tasks.filter((task) => task.moduleId === query.moduleId);
    if (query.topicId) tasks = tasks.filter((task) => task.topicId === query.topicId);
    if (query.difficulty) tasks = tasks.filter((task) => task.difficulty === query.difficulty);
    if (query.type) tasks = tasks.filter((task) => task.type === query.type);
    if (query.status === 'locked') tasks = tasks.filter((task) => task.locked && task.status !== 'completed');
    else if (query.status) tasks = tasks.filter((task) => task.status === query.status);
    if (query.search) {
      const search = query.search.toLowerCase();
      tasks = tasks.filter(
        (task) =>
          task.title.toLowerCase().includes(search) ||
          task.description.toLowerCase().includes(search) ||
          task.topicTitle.toLowerCase().includes(search) ||
          task.moduleTitle.toLowerCase().includes(search),
      );
    }
    const total = tasks.length;
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;
    res.json({
      roadmap: workspace.roadmap,
      enrollment: workspace.enrollment,
      ...paginate(tasks.slice((page - 1) * limit, page * limit), total, page, limit),
    });
  }),
);

meRoadmapsRouter.patch(
  '/me/roadmaps/:enrollmentId',
  requireAuth,
  requireValidObjectIdParam('enrollmentId'),
  validate(updateEnrollmentSchema),
  asyncHandler(async (req, res) => {
    const enrollment = await loadOwnedEnrollment(req.user!.id, req.params.enrollmentId);
    const user = await User.findById(req.user!.id);
    if (!user) throw notFound('Account not found');
    const { status, learningPace, customDailyGoal } = req.body as z.infer<typeof updateEnrollmentSchema>;
    const now = new Date();
    let activityType: 'enrollment_paused' | 'enrollment_resumed' | 'enrollment_archived' | null = null;

    if (status && status !== enrollment.status) {
      if (status === 'completed') {
        throw badRequest('Roadmaps are completed automatically when every published task is done.');
      }
      if (enrollment.status === 'completed' && status !== 'archived') {
        throw conflict('This roadmap is complete. Reopen a task to resume learning.');
      }
      if (status === 'active') {
        if (enrollment.status === 'paused' || enrollment.status === 'archived') {
          activityType = 'enrollment_resumed';
        }
      } else if (status === 'paused') {
        if (enrollment.status !== 'active') throw badRequest('Only an active enrollment can be paused');
        activityType = 'enrollment_paused';
        enrollment.pausedAt = now;
      } else if (status === 'archived') {
        activityType = 'enrollment_archived';
        enrollment.archivedAt = now;
      }
      enrollment.status = status;
      if (status === 'active') {
        enrollment.archivedAt = null;
        enrollment.pausedAt = null;
      }
    }

    if (learningPace) {
      enrollment.learningPace = learningPace;
      if (learningPace !== 'custom') enrollment.customDailyGoal = null;
    }
    if (customDailyGoal !== undefined) enrollment.customDailyGoal = customDailyGoal;
    if (enrollment.learningPace === 'custom' && !enrollment.customDailyGoal) {
      throw badRequest('Custom pace requires a daily minute goal');
    }
    await enrollment.save();

    if (activityType) {
      await recordActivity({
        userId: req.user!.id,
        enrollmentId: enrollment._id,
        roadmapId: enrollment.roadmapId,
        activityType,
        timeZone: user.timezone,
        timestamp: now,
      });
    }
    res.json({
      enrollment: {
        id: String(enrollment._id),
        status: enrollment.status,
        learningPace: enrollment.learningPace,
        customDailyGoal: enrollment.customDailyGoal,
      },
      message: 'Enrollment updated',
    });
  }),
);

meRoadmapsRouter.delete(
  '/me/roadmaps/:enrollmentId',
  requireAuth,
  requireValidObjectIdParam('enrollmentId'),
  asyncHandler(async (req, res) => {
    const enrollment = await loadOwnedEnrollment(req.user!.id, req.params.enrollmentId);
    if (enrollment.status !== 'archived') {
      enrollment.status = 'archived';
      enrollment.archivedAt = new Date();
      await enrollment.save();
      const user = await User.findById(req.user!.id).select('timezone').lean();
      await recordActivity({
        userId: req.user!.id,
        enrollmentId: enrollment._id,
        roadmapId: enrollment.roadmapId,
        activityType: 'enrollment_archived',
        timeZone: user?.timezone ?? 'UTC',
      });
      await createNotification({
        userId: req.user!.id,
        type: 'system',
        title: 'Roadmap archived',
        message: 'Your progress is preserved. Restore this roadmap any time from My Roadmaps.',
        link: '/my-roadmaps',
      });
    }
    res.json({ success: true, archived: true, message: 'Roadmap archived. Your progress is preserved.' });
  }),
);
