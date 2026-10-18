import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Enrollment } from '../models/Enrollment.js';
import { Roadmap } from '../models/Roadmap.js';
import { Task } from '../models/Task.js';
import { Topic } from '../models/Topic.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { conflict, notFound } from '../utils/errors.js';
import { paginate, paginationSchema } from '../utils/pagination.js';
import { isValidObjectId } from '../utils/ids.js';
import { enrollSchema } from '../validation/enrollment.js';
import { escapeRegex, getRoadmapStats } from '../services/roadmapStats.js';
import { loadCurriculum } from '../services/curriculum.js';
import { TaskProgress } from '../models/TaskProgress.js';
import { computeRoadmapProgress, ensureProgressRecords } from '../services/progress.js';
import { paceMinutes } from '../services/progress.js';
import { createNotification } from '../services/notifications.js';
import { recordActivity } from '../services/activity.js';
import { evaluateAchievements } from '../services/achievements.js';

export const roadmapsRouter = Router();

const listSchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  category: z.string().trim().max(60).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  minWeeks: z.coerce.number().int().min(0).max(200).optional(),
  maxWeeks: z.coerce.number().int().min(0).max(200).optional(),
  beginnerFriendly: z.enum(['true', 'false']).optional(),
  enrolled: z.enum(['true', 'false']).optional(),
  sort: z.enum(['recommended', 'title', 'shortest', 'longest', 'newest']).default('recommended'),
});

roadmapsRouter.get(
  '/roadmaps',
  optionalAuth,
  validate(listSchema, 'query'),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as z.infer<typeof listSchema>;
    const filter: Record<string, unknown> = { published: true, archivedAt: null };
    if (query.search) {
      const regex = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ title: regex }, { description: regex }, { tags: regex }, { category: regex }, { skills: regex }];
    }
    if (query.category) filter.category = query.category;
    if (query.difficulty) filter.difficulty = query.difficulty;
    if (query.beginnerFriendly === 'true') filter.difficulty = 'beginner';
    if (query.maxWeeks !== undefined) filter['estimatedDuration.minWeeks'] = { $lte: query.maxWeeks };
    if (query.minWeeks !== undefined) filter['estimatedDuration.maxWeeks'] = { $gte: query.minWeeks };

    let enrollmentsByRoadmap = new Map<string, { status: string; id: string }>();
    if (req.user) {
      const enrollments = await Enrollment.find({ userId: req.user.id, status: { $ne: 'archived' } }).select('roadmapId status');
      enrollmentsByRoadmap = new Map(
        enrollments.map((enrollment) => [String(enrollment.roadmapId), { status: enrollment.status, id: String(enrollment._id) }]),
      );
      if (query.enrolled === 'true') {
        filter._id = { $in: [...enrollmentsByRoadmap.keys()] };
      } else if (query.enrolled === 'false') {
        filter._id = { $nin: [...enrollmentsByRoadmap.keys()] };
      }
    } else if (query.enrolled) {
      res.json(paginate([], 0, query.page, query.limit));
      return;
    }

    const sortMap: Record<string, Record<string, 1 | -1>> = {
      title: { title: 1 },
      shortest: { 'estimatedDuration.minWeeks': 1, title: 1 },
      longest: { 'estimatedDuration.maxWeeks': -1, title: 1 },
      newest: { publishedAt: -1, createdAt: -1 },
      recommended: { category: 1, difficulty: 1, title: 1 },
    };
    const [roadmaps, total] = await Promise.all([
      Roadmap.find(filter)
        .sort(sortMap[query.sort] ?? sortMap.recommended)
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      Roadmap.countDocuments(filter),
    ]);

    const stats = await getRoadmapStats(roadmaps.map((r) => String(r._id)));
    const items = roadmaps.map((roadmap) => {
      const roadmapStats = stats.get(String(roadmap._id)) ?? {
        moduleCount: 0,
        topicCount: 0,
        taskCount: 0,
        totalMinutes: 0,
        estimatedHours: 0,
      };
      const enrollment = enrollmentsByRoadmap.get(String(roadmap._id));
      return {
        id: String(roadmap._id),
        title: roadmap.title,
        slug: roadmap.slug,
        tagline: roadmap.tagline,
        description: roadmap.description,
        category: roadmap.category,
        difficulty: roadmap.difficulty,
        difficultyLabel: roadmap.difficultyLabel || roadmap.difficulty,
        estimatedDuration: roadmap.estimatedDuration,
        prerequisites: roadmap.prerequisites,
        learningOutcomes: roadmap.learningOutcomes,
        skills: roadmap.skills,
        tags: roadmap.tags,
        icon: roadmap.icon,
        version: roadmap.version,
        publishedAt: roadmap.publishedAt,
        stats: roadmapStats,
        enrollment: enrollment
          ? {
              id: enrollment.id,
              status: enrollment.status,
            }
          : null,
      };
    });
    res.json(paginate(items, total, query.page, query.limit));
  }),
);

roadmapsRouter.get(
  '/roadmaps/facets',
  asyncHandler(async (_req, res) => {
    const roadmaps = await Roadmap.find({ published: true, archivedAt: null }).select(
      'category difficulty estimatedDuration difficultyLabel',
    ).lean();
    const categories = new Map<string, number>();
    const difficulties = new Map<string, number>();
    for (const roadmap of roadmaps) {
      categories.set(roadmap.category, (categories.get(roadmap.category) ?? 0) + 1);
      difficulties.set(roadmap.difficulty, (difficulties.get(roadmap.difficulty) ?? 0) + 1);
    }
    res.json({
      categories: [...categories.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)),
      difficulties: [...difficulties.entries()].map(([name, count]) => ({ name, count })),
      totals: { roadmaps: roadmaps.length },
    });
  }),
);

roadmapsRouter.get(
  '/roadmaps/:slug',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const identifier = req.params.slug;
    const roadmap = await Roadmap.findOne(
      isValidObjectId(identifier) && identifier.length === 24
        ? { _id: identifier, published: true, archivedAt: null }
        : { slug: identifier.toLowerCase(), published: true, archivedAt: null },
    );
    if (!roadmap) throw notFound('Roadmap not found or not published');

    const bundle = await loadCurriculum(roadmap._id);
    if (!bundle) throw notFound('Roadmap not found or not published');
    const stats = (await getRoadmapStats([String(roadmap._id)])).get(String(roadmap._id))!;

    let enrollmentCard = null;
    if (req.user) {
      const enrollment = await Enrollment.findOne({ userId: req.user.id, roadmapId: roadmap._id });
      if (enrollment) {
        const user = await User.findById(req.user.id).select('timezone').lean();
        const progressRecords = await TaskProgress.find({ userId: req.user.id, roadmapId: roadmap._id });
        const progress = computeRoadmapProgress(bundle, progressRecords, user?.timezone ?? 'UTC');
        enrollmentCard = {
          id: String(enrollment._id),
          status: enrollment.status,
          learningPace: enrollment.learningPace,
          percent: progress.percent,
          completedTasks: progress.completedTasks,
          totalTasks: progress.totalTasks,
          nextTask: progress.nextTask
            ? {
                id: progress.nextTask.id,
                title: progress.nextTask.title,
                moduleTitle: progress.nextTask.moduleTitle,
                estimatedDuration: progress.nextTask.estimatedDuration,
              }
            : null,
        };
      }
    }

    const modules = bundle.modules.map((module) => {
      const topics = bundle.topicsByModule.get(String(module._id)) ?? [];
      const moduleTasks = bundle.tasksByModule.get(String(module._id)) ?? [];
      return {
        id: String(module._id),
        title: module.title,
        description: module.description,
        order: module.order,
        learningOutcomes: module.learningOutcomes,
        topicCount: topics.length,
        taskCount: moduleTasks.length,
        estimatedMinutes: moduleTasks.reduce((sum, task) => sum + task.estimatedDuration, 0),
        topics: topics.map((topic) => {
          const topicTasks = bundle.tasksByTopic.get(String(topic._id)) ?? [];
          return {
            id: String(topic._id),
            title: topic.title,
            description: topic.description,
            order: topic.order,
            estimatedDuration: topic.estimatedDuration,
            taskCount: topicTasks.length,
            resources: topic.resources,
          };
        }),
      };
    });

    const related = await Roadmap.find({
      _id: { $ne: roadmap._id },
      published: true,
      archivedAt: null,
      category: roadmap.category,
    })
      .limit(3)
      .lean();
    const relatedStats = await getRoadmapStats(related.map((r) => String(r._id)));

    res.json({
      roadmap: {
        id: String(roadmap._id),
        title: roadmap.title,
        slug: roadmap.slug,
        tagline: roadmap.tagline,
        description: roadmap.description,
        category: roadmap.category,
        difficulty: roadmap.difficulty,
        difficultyLabel: roadmap.difficultyLabel || roadmap.difficulty,
        estimatedDuration: roadmap.estimatedDuration,
        prerequisites: roadmap.prerequisites,
        learningOutcomes: roadmap.learningOutcomes,
        skills: roadmap.skills,
        tags: roadmap.tags,
        icon: roadmap.icon,
        version: roadmap.version,
        publishedAt: roadmap.publishedAt,
        stats,
      },
      modules,
      enrollment: enrollmentCard,
      relatedRoadmaps: related.map((item) => ({
        id: String(item._id),
        title: item.title,
        slug: item.slug,
        category: item.category,
        difficulty: item.difficulty,
        estimatedDuration: item.estimatedDuration,
        stats: relatedStats.get(String(item._id)),
      })),
    });
  }),
);

roadmapsRouter.post(
  '/roadmaps/:id/enroll',
  requireAuth,
  validate(enrollSchema),
  asyncHandler(async (req, res) => {
    const { learningPace, customDailyGoal } = req.body as z.infer<typeof enrollSchema>;
    const identifier = req.params.id;
    const roadmap = await Roadmap.findOne(
      isValidObjectId(identifier)
        ? { _id: identifier, published: true, archivedAt: null }
        : { slug: identifier.toLowerCase(), published: true, archivedAt: null },
    );
    if (!roadmap) throw notFound('Roadmap not found or not published');

    const existing = await Enrollment.findOne({ userId: req.user!.id, roadmapId: roadmap._id });
    if (existing) {
      if (existing.status === 'archived') {
        existing.status = 'active';
        existing.archivedAt = null;
        existing.learningPace = learningPace;
        existing.customDailyGoal = customDailyGoal ?? null;
        existing.lastActivityAt = new Date();
        existing.curriculumVersion = roadmap.version;
        await existing.save();
        await recordActivity({
          userId: req.user!.id,
          enrollmentId: existing._id,
          roadmapId: roadmap._id,
          activityType: 'enrollment_resumed',
          timeZone: (await User.findById(req.user!.id).select('timezone').lean())?.timezone ?? 'UTC',
        });
        res.json({
          enrollmentId: String(existing._id),
          resumed: true,
          message: 'Enrollment restored',
          roadmap: { id: String(roadmap._id), slug: roadmap.slug, title: roadmap.title },
        });
        return;
      }
      throw conflict('You are already enrolled in this roadmap', [
        { path: 'roadmap', message: `Current status: ${existing.status}`, enrollmentId: String(existing._id) },
      ]);
    }

    let enrollment;
    try {
      enrollment = await Enrollment.create({
        userId: req.user!.id,
        roadmapId: roadmap._id,
        curriculumVersion: roadmap.version,
        learningPace,
        customDailyGoal: customDailyGoal ?? null,
        status: 'active',
        lastActivityAt: new Date(),
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw conflict('You are already enrolled in this roadmap');
      }
      throw error;
    }

    const bundle = await loadCurriculum(roadmap._id);
    if (bundle) await ensureProgressRecords(req.user!.id, enrollment, bundle.tasks);

    const user = await User.findById(req.user!.id).select('timezone').lean();
    const timeZone = user?.timezone ?? 'UTC';
    await recordActivity({
      userId: req.user!.id,
      enrollmentId: enrollment._id,
      roadmapId: roadmap._id,
      activityType: 'enrollment_created',
      timeZone,
      metadata: { learningPace, customDailyGoal: customDailyGoal ?? null },
    });
    await evaluateAchievements(req.user!.id, timeZone);
    await createNotification({
      userId: req.user!.id,
      type: 'enrollment',
      title: `Enrolled in ${roadmap.title}`,
      message: `Your daily plan will aim for about ${paceMinutes(enrollment)} minutes. First up: ${
        bundle?.tasks[0]?.title ?? 'your first topic'
      }.`,
      link: `/roadmaps/${roadmap.slug}`,
    });

    res.status(201).json({
      enrollmentId: String(enrollment._id),
      resumed: false,
      message: 'Enrolled successfully',
      roadmap: { id: String(roadmap._id), slug: roadmap.slug, title: roadmap.title },
      dailyPlanMinutes: paceMinutes(enrollment),
      curriculumTaskCount: bundle?.tasks.length ?? 0,
    });
  }),
);

roadmapsRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [roadmaps, tasks, topics, learners, completions] = await Promise.all([
      Roadmap.countDocuments({ published: true, archivedAt: null }),
      Task.countDocuments({ published: true, archivedAt: null }),
      Topic.countDocuments({ published: true, archivedAt: null }),
      User.countDocuments({ isActive: true }),
      TaskProgress.countDocuments({ status: 'completed' }),
    ]);
    res.json({ roadmaps, tasks, topics, learners, completions });
  }),
);
