import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { requireValidObjectIdParam, validate } from '../middleware/validate.js';
import { Achievement } from '../models/Achievement.js';
import { Enrollment } from '../models/Enrollment.js';
import { Notification } from '../models/Notification.js';
import { Roadmap } from '../models/Roadmap.js';
import { Task } from '../models/Task.js';
import { TaskProgress } from '../models/TaskProgress.js';
import { Topic } from '../models/Topic.js';
import { User } from '../models/User.js';
import { ModuleModel } from '../models/Module.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { paginate, paginationSchema } from '../utils/pagination.js';
import { slugify } from '../utils/slug.js';
import { adminEnrollmentAnalyticsSchema, adminListSchema, adminUsersQuerySchema, roadmapCreateSchema, roadmapUpdateSchema } from '../validation/admin.js';
import { escapeRegex, getRoadmapStats } from '../services/roadmapStats.js';
import { countPublishedContent, validateAllContent } from '../services/adminContent.js';
import { ActivityLog } from '../models/ActivityLog.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86_400_000);

    const [
      totalUsers,
      newUsers,
      totalRoadmaps,
      publishedRoadmaps,
      totalEnrollments,
      activeEnrollments,
      completedTasks,
      unreadNotifications,
      activeLearnersAgg,
      completionLogs,
      validation,
      recentEnrollments,
      recentUsers,
      roadmapDocs,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ createdAt: { $gte: weekAgo } }),
      Roadmap.countDocuments({ archivedAt: null }),
      Roadmap.countDocuments({ published: true, archivedAt: null }),
      Enrollment.countDocuments({}),
      Enrollment.countDocuments({ status: 'active' }),
      TaskProgress.countDocuments({ status: 'completed' }),
      Notification.countDocuments({ readAt: null }),
      ActivityLog.aggregate([
        { $match: { timestamp: { $gte: weekAgo } } },
        { $group: { _id: '$userId' } },
      ]),
      ActivityLog.find({ activityType: 'task_completed', timestamp: { $gte: twoWeeksAgo } }).select('localDate timestamp').lean(),
      validateAllContent(),
      Enrollment.find({}).sort({ enrolledAt: -1 }).limit(8).lean(),
      User.find({}).sort({ createdAt: -1 }).limit(5).select('name email role createdAt').lean(),
      Roadmap.find({ archivedAt: null }).select('title slug category published version').lean(),
    ]);

    const roadmapIds = roadmapDocs.map((roadmap) => String(roadmap._id));
    const [statsMap, enrollmentCounts] = await Promise.all([
      getRoadmapStats(roadmapIds),
      Enrollment.aggregate([{ $group: { _id: '$roadmapId', count: { $sum: 1 } } }]),
    ]);
    const enrollmentCountByRoadmap = new Map(enrollmentCounts.map((item) => [String(item._id), item.count]));
    const topRoadmaps = roadmapDocs
      .map((roadmap) => ({
        id: String(roadmap._id),
        title: roadmap.title,
        slug: roadmap.slug,
        category: roadmap.category,
        published: roadmap.published,
        version: roadmap.version,
        stats: statsMap.get(String(roadmap._id)),
        enrollmentCount: enrollmentCountByRoadmap.get(String(roadmap._id)) ?? 0,
      }))
      .sort((a, b) => b.enrollmentCount - a.enrollmentCount)
      .slice(0, 6);

    const userLookup = await User.find({ _id: { $in: recentEnrollments.map((e) => e.userId) } }).select('name email').lean();
    const userById = new Map(userLookup.map((user) => [String(user._id), user]));
    const roadmapById = new Map(roadmapDocs.map((roadmap) => [String(roadmap._id), roadmap]));

    const trendDates = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(now.getTime() - (13 - index) * 86_400_000);
      return date.toISOString().slice(0, 10);
    });
    const completionByDate = new Map<string, number>();
    for (const log of completionLogs) {
      const key = log.localDate || new Date(log.timestamp as Date).toISOString().slice(0, 10);
      completionByDate.set(key, (completionByDate.get(key) ?? 0) + 1);
    }

    res.json({
      metrics: {
        totalUsers,
        newUsers,
        totalRoadmaps,
        publishedRoadmaps,
        totalEnrollments,
        activeEnrollments,
        completedTasks,
        activeLearners: activeLearnersAgg.length,
        unreadNotifications,
        contentErrors: validation.summary.errors,
        contentWarnings: validation.summary.warnings,
      },
      contentValidation: validation.summary,
      completionTrend: trendDates.map((date) => ({ date, completions: completionByDate.get(date) ?? 0 })),
      topRoadmaps,
      recentEnrollments: recentEnrollments.map((enrollment) => ({
        id: String(enrollment._id),
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt,
        user: userById.get(String(enrollment.userId))
          ? { name: userById.get(String(enrollment.userId))!.name, email: userById.get(String(enrollment.userId))!.email }
          : null,
        roadmap: roadmapById.get(String(enrollment.roadmapId))
          ? { title: roadmapById.get(String(enrollment.roadmapId))!.title, slug: roadmapById.get(String(enrollment.roadmapId))!.slug }
          : null,
      })),
      recentUsers,
    });
  }),
);

adminRouter.get(
  '/roadmaps',
  validate(adminListSchema, 'query'),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as z.infer<typeof adminListSchema>;
    const filter: Record<string, unknown> = {};
    if (query.includeArchived !== 'true') filter.archivedAt = null;
    if (query.published) filter.published = query.published === 'true';
    if (query.search) {
      const regex = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ title: regex }, { slug: regex }, { category: regex }];
    }
    const [roadmaps, total] = await Promise.all([
      Roadmap.find(filter).sort({ updatedAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit),
      Roadmap.countDocuments(filter),
    ]);
    const stats = await getRoadmapStats(roadmaps.map((roadmap) => String(roadmap._id)));
    const enrollmentCounts = await Enrollment.aggregate([
      { $match: { roadmapId: { $in: roadmaps.map((r) => r._id) } } },
      { $group: { _id: '$roadmapId', count: { $sum: 1 } } },
    ]);
    const enrollmentMap = new Map(enrollmentCounts.map((item) => [String(item._id), item.count]));
    res.json(
      paginate(
        roadmaps.map((roadmap) => ({
          ...roadmap.toObject(),
          id: String(roadmap._id),
          stats: stats.get(String(roadmap._id)),
          enrollmentCount: enrollmentMap.get(String(roadmap._id)) ?? 0,
        })),
        total,
        query.page,
        query.limit,
      ),
    );
  }),
);

adminRouter.post(
  '/roadmaps',
  validate(roadmapCreateSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof roadmapCreateSchema>;
    const slug = body.slug ?? slugify(body.title);
    const existing = await Roadmap.findOne({ slug });
    if (existing) throw conflict('A roadmap with this slug already exists', [{ path: 'slug', message: 'Slug already in use' }]);
    const roadmap = await Roadmap.create({
      ...body,
      slug,
      published: false,
      version: 1,
      createdBy: req.user!.id,
    });
    res.status(201).json({ roadmap: roadmap.toObject(), message: 'Draft roadmap created. Add modules, topics and tasks, then publish.' });
  }),
);

adminRouter.patch(
  '/roadmaps/:id',
  requireValidObjectIdParam(),
  validate(roadmapUpdateSchema),
  asyncHandler(async (req, res) => {
    const roadmap = await Roadmap.findById(req.params.id);
    if (!roadmap) throw notFound('Roadmap not found');
    const body = req.body as z.infer<typeof roadmapUpdateSchema>;
    if (body.slug && body.slug !== roadmap.slug) {
      const clash = await Roadmap.findOne({ slug: body.slug, _id: { $ne: roadmap._id } });
      if (clash) throw conflict('A roadmap with this slug already exists', [{ path: 'slug', message: 'Slug already in use' }]);
    }
    Object.assign(roadmap, body);
    roadmap.version += 1;
    await roadmap.save();
    res.json({ roadmap: roadmap.toObject(), message: 'Roadmap updated' });
  }),
);

adminRouter.post(
  '/roadmaps/:id/publish',
  requireValidObjectIdParam(),
  asyncHandler(async (req, res) => {
    const roadmap = await Roadmap.findById(req.params.id);
    if (!roadmap) throw notFound('Roadmap not found');
    if (roadmap.archivedAt) throw badRequest('Restore the roadmap before publishing it');
    const counts = await countPublishedContent(String(roadmap._id));
    if (counts.modules === 0 || counts.topics === 0 || counts.tasks === 0) {
      throw badRequest('This roadmap needs at least one published module, topic and task before publishing.', [
        { path: 'curriculum', message: `Published content: ${counts.modules} modules, ${counts.topics} topics, ${counts.tasks} tasks.` },
      ]);
    }
    roadmap.published = true;
    roadmap.publishedAt = roadmap.publishedAt ?? new Date();
    roadmap.version += 1;
    await roadmap.save();
    res.json({ roadmap: roadmap.toObject(), message: 'Roadmap published. It is now visible in the explorer.' });
  }),
);

adminRouter.post(
  '/roadmaps/:id/unpublish',
  requireValidObjectIdParam(),
  asyncHandler(async (req, res) => {
    const roadmap = await Roadmap.findById(req.params.id);
    if (!roadmap) throw notFound('Roadmap not found');
    roadmap.published = false;
    roadmap.version += 1;
    await roadmap.save();
    res.json({ roadmap: roadmap.toObject(), message: 'Roadmap unpublished. Learner progress is preserved.' });
  }),
);

adminRouter.post(
  '/roadmaps/:id/archive',
  requireValidObjectIdParam(),
  asyncHandler(async (req, res) => {
    const roadmap = await Roadmap.findById(req.params.id);
    if (!roadmap) throw notFound('Roadmap not found');
    roadmap.archivedAt = new Date();
    roadmap.published = false;
    roadmap.version += 1;
    await roadmap.save();
    res.json({ message: 'Roadmap archived. Existing enrollments and progress are preserved in the database.' });
  }),
);

adminRouter.post(
  '/roadmaps/:id/restore',
  requireValidObjectIdParam(),
  asyncHandler(async (req, res) => {
    const roadmap = await Roadmap.findById(req.params.id);
    if (!roadmap) throw notFound('Roadmap not found');
    roadmap.archivedAt = null;
    await roadmap.save();
    res.json({ roadmap: roadmap.toObject(), message: 'Roadmap restored as a draft. Publish it when ready.' });
  }),
);

adminRouter.delete(
  '/roadmaps/:id',
  requireValidObjectIdParam(),
  asyncHandler(async (req, res) => {
    const roadmap = await Roadmap.findById(req.params.id);
    if (!roadmap) throw notFound('Roadmap not found');
    roadmap.archivedAt = new Date();
    roadmap.published = false;
    roadmap.version += 1;
    await roadmap.save();
    const enrollmentCount = await Enrollment.countDocuments({ roadmapId: roadmap._id });
    res.json({
      message: 'Roadmap archived (safe delete). No enrollment or progress records were deleted.',
      preservedEnrollments: enrollmentCount,
    });
  }),
);

adminRouter.get(
  '/analytics/enrollments',
  validate(adminEnrollmentAnalyticsSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { roadmapId } = req.validatedQuery as z.infer<typeof adminEnrollmentAnalyticsSchema>;
    const roadmapFilter: Record<string, unknown> = { archivedAt: null };
    if (roadmapId) roadmapFilter._id = roadmapId;
    const roadmaps = await Roadmap.find(roadmapFilter).sort({ title: 1 }).lean();
    const roadmapIds = roadmaps.map((roadmap) => roadmap._id);
    const [enrollments, statsMap, users] = await Promise.all([
      Enrollment.find({ roadmapId: { $in: roadmapIds } }).lean(),
      getRoadmapStats(roadmapIds.map(String)),
      User.find({ _id: { $in: (await Enrollment.find({ roadmapId: { $in: roadmapIds } }).distinct('userId')) } })
        .select('name email')
        .lean(),
    ]);
    const userById = new Map(users.map((user) => [String(user._id), user]));
    const completedByEnrollment = await TaskProgress.aggregate([
      { $match: { status: 'completed', roadmapId: { $in: roadmapIds } } },
      { $group: { _id: '$enrollmentId', count: { $sum: 1 } } },
    ]);
    const completedMap = new Map(completedByEnrollment.map((item) => [String(item._id), item.count]));

    const byRoadmap = roadmaps.map((roadmap) => {
      const roadmapEnrollments = enrollments.filter((enrollment) => String(enrollment.roadmapId) === String(roadmap._id));
      const taskCount = statsMap.get(String(roadmap._id))?.taskCount ?? 0;
      const percentages = roadmapEnrollments.map((enrollment) => {
        const completed = completedMap.get(String(enrollment._id)) ?? 0;
        return taskCount > 0 ? Math.min(100, (completed / taskCount) * 100) : 0;
      });
      return {
        roadmapId: String(roadmap._id),
        title: roadmap.title,
        slug: roadmap.slug,
        category: roadmap.category,
        published: roadmap.published,
        taskCount,
        moduleCount: statsMap.get(String(roadmap._id))?.moduleCount ?? 0,
        enrollments: {
          total: roadmapEnrollments.length,
          active: roadmapEnrollments.filter((enrollment) => enrollment.status === 'active').length,
          paused: roadmapEnrollments.filter((enrollment) => enrollment.status === 'paused').length,
          completed: roadmapEnrollments.filter((enrollment) => enrollment.status === 'completed').length,
          archived: roadmapEnrollments.filter((enrollment) => enrollment.status === 'archived').length,
        },
        completionRate:
          roadmapEnrollments.length > 0
            ? Math.round(
                (roadmapEnrollments.filter((enrollment) => enrollment.status === 'completed').length /
                  roadmapEnrollments.length) *
                  1000,
              ) / 10
            : 0,
        averageProgress:
          percentages.length > 0
            ? Math.round((percentages.reduce((sum, value) => sum + value, 0) / percentages.length) * 10) / 10
            : 0,
      };
    });

    const recent = [...enrollments].sort((a, b) => new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime()).slice(0, 15);
    res.json({
      totals: {
        roadmaps: roadmaps.length,
        enrollments: enrollments.length,
        learners: new Set(enrollments.map((enrollment) => String(enrollment.userId))).size,
        completedEnrollments: enrollments.filter((enrollment) => enrollment.status === 'completed').length,
        activeEnrollments: enrollments.filter((enrollment) => enrollment.status === 'active').length,
      },
      byRoadmap,
      recentEnrollments: recent.map((enrollment) => {
        const roadmap = roadmaps.find((item) => String(item._id) === String(enrollment.roadmapId));
        const user = userById.get(String(enrollment.userId));
        return {
          id: String(enrollment._id),
          status: enrollment.status,
          learningPace: enrollment.learningPace,
          enrolledAt: enrollment.enrolledAt,
          roadmapTitle: roadmap?.title ?? 'Roadmap',
          roadmapSlug: roadmap?.slug ?? '',
          userName: user?.name ?? 'Learner',
          userEmail: user?.email ?? '',
        };
      }),
    });
  }),
);

adminRouter.get(
  '/users',
  validate(adminUsersQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as z.infer<typeof adminUsersQuerySchema>;
    const filter: Record<string, unknown> = {};
    if (query.role) filter.role = query.role;
    if (query.search) {
      const regex = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ name: regex }, { email: regex }];
    }
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
      User.countDocuments(filter),
    ]);
    const userIds = users.map((user) => user._id);
    const [enrollmentAgg, progressAgg] = await Promise.all([
      Enrollment.aggregate([
        { $match: { userId: { $in: userIds } } },
        { $group: { _id: '$userId', total: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } } } },
      ]),
      TaskProgress.aggregate([
        { $match: { userId: { $in: userIds }, status: 'completed' } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
      ]),
    ]);
    const enrollmentMap = new Map(enrollmentAgg.map((item) => [String(item._id), item]));
    const progressMap = new Map(progressAgg.map((item) => [String(item._id), item.count]));
    res.json(
      paginate(
        users.map((user) => ({
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: user.role,
          timezone: user.timezone,
          dailyGoalMinutes: user.dailyGoalMinutes,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          enrollments: enrollmentMap.get(String(user._id))?.total ?? 0,
          activeEnrollments: enrollmentMap.get(String(user._id))?.active ?? 0,
          completedTasks: progressMap.get(String(user._id)) ?? 0,
        })),
        total,
        query.page,
        query.limit,
      ),
    );
  }),
);

adminRouter.get(
  '/validation',
  asyncHandler(async (req, res) => {
    const roadmapId = typeof req.query.roadmapId === 'string' ? req.query.roadmapId : undefined;
    const includeInfo = req.query.includeInfo === 'true';
    const report = await validateAllContent({ roadmapId, includeInfo });
    res.json(report);
  }),
);

adminRouter.get(
  '/enrollments',
  validate(
    paginationSchema.extend({
      roadmapId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
      status: z.enum(['active', 'paused', 'completed', 'archived']).optional(),
    }),
    'query',
  ),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as { page: number; limit: number; roadmapId?: string; status?: string };
    const filter: Record<string, unknown> = {};
    if (query.roadmapId) filter.roadmapId = query.roadmapId;
    if (query.status) filter.status = query.status;
    const [enrollments, total] = await Promise.all([
      Enrollment.find(filter).sort({ enrolledAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
      Enrollment.countDocuments(filter),
    ]);
    const [users, roadmaps] = await Promise.all([
      User.find({ _id: { $in: enrollments.map((enrollment) => enrollment.userId) } }).select('name email').lean(),
      Roadmap.find({ _id: { $in: enrollments.map((enrollment) => enrollment.roadmapId) } }).select('title slug').lean(),
    ]);
    const userById = new Map(users.map((user) => [String(user._id), user]));
    const roadmapById = new Map(roadmaps.map((roadmap) => [String(roadmap._id), roadmap]));
    res.json(
      paginate(
        enrollments.map((enrollment) => ({
          id: String(enrollment._id),
          status: enrollment.status,
          learningPace: enrollment.learningPace,
          enrolledAt: enrollment.enrolledAt,
          completedAt: enrollment.completedAt,
          lastActivityAt: enrollment.lastActivityAt,
          user: userById.get(String(enrollment.userId))
            ? { id: String(enrollment.userId), name: userById.get(String(enrollment.userId))!.name, email: userById.get(String(enrollment.userId))!.email }
            : null,
          roadmap: roadmapById.get(String(enrollment.roadmapId))
            ? { id: String(enrollment.roadmapId), title: roadmapById.get(String(enrollment.roadmapId))!.title, slug: roadmapById.get(String(enrollment.roadmapId))!.slug }
            : null,
        })),
        total,
        query.page,
        query.limit,
      ),
    );
  }),
);
