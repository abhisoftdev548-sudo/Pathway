import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { notFound } from '../utils/errors.js';
import { getAchievementCatalog } from '../services/achievements.js';
import { getEnrollmentContexts } from '../services/userOverview.js';

export const achievementsRouter = Router();

achievementsRouter.get(
  '/me/achievements',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.id);
    if (!user) throw notFound('Account not found');
    const catalog = await getAchievementCatalog(req.user!.id, user.timezone || 'UTC');
    res.json(catalog);
  }),
);

achievementsRouter.get(
  '/me/certificates',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.id);
    if (!user) throw notFound('Account not found');
    const contexts = await getEnrollmentContexts(req.user!.id, user.timezone || 'UTC');
    const completed = contexts.filter((context) => context.enrollment.status === 'completed');
    res.json({
      learner: { name: user.name, email: user.email },
      certificates: completed.map((context) => {
        const enrollmentId = String(context.enrollment._id);
        return {
          certificateId: `PF-${enrollmentId.slice(-8).toUpperCase()}`,
          enrollmentId,
          roadmap: {
            id: String(context.bundle.roadmap._id),
            title: context.bundle.roadmap.title,
            slug: context.bundle.roadmap.slug,
            category: context.bundle.roadmap.category,
            difficulty: context.bundle.roadmap.difficulty,
          },
          completedAt: context.enrollment.completedAt,
          completedTasks: context.progress.completedTasks,
          totalTasks: context.progress.totalTasks,
          totalMinutes: context.progress.totalMinutes,
          moduleCount: context.bundle.modules.length,
          topicCount: context.bundle.topics.length,
          skills: context.bundle.roadmap.skills,
          learningOutcomes: context.bundle.roadmap.learningOutcomes,
        };
      }),
    });
  }),
);
