import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { DailyActivity } from '../models/DailyActivity.js';
import { Achievement } from '../models/Achievement.js';
import { Notification } from '../models/Notification.js';
import { TaskProgress } from '../models/TaskProgress.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { notFound } from '../utils/errors.js';
import { todayString } from '../utils/time.js';
import { getEnrollmentContexts, serializeRoadmapCard } from '../services/userOverview.js';
import { computeOverallProgress } from '../services/progress.js';
import { buildDailyPlan } from '../services/schedule.js';
import { getStreakStats } from '../services/streak.js';
import { maybeSendDailyReminder } from '../services/dailyPlanService.js';

export const dashboardRouter = Router();

dashboardRouter.get(
  '/me/dashboard',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.id);
    if (!user) throw notFound('Account not found');
    const timeZone = user.timezone || 'UTC';
    const today = todayString(timeZone);

    const [contexts, daily, streak, recentAchievements, unreadNotifications] = await Promise.all([
      getEnrollmentContexts(req.user!.id, timeZone),
      DailyActivity.findOne({ userId: req.user!.id, date: today }).lean(),
      getStreakStats(req.user!.id, timeZone),
      Achievement.find({ userId: req.user!.id }).sort({ earnedAt: -1 }).limit(4).lean(),
      Notification.countDocuments({ userId: req.user!.id, readAt: null }),
    ]);

    const plan = buildDailyPlan({
      contexts,
      timeZone,
      today,
      budgetMinutes: user.dailyGoalMinutes ?? 45,
      spentMinutes: daily?.learningMinutes ?? 0,
    });
    await maybeSendDailyReminder(user, plan, today);

    const nonArchived = contexts.filter((context) => context.enrollment.status !== 'archived');
    const cards = contexts.map(serializeRoadmapCard);
    const overall = computeOverallProgress(nonArchived);

    const recentCompletions = nonArchived
      .flatMap((context) =>
        context.progress.tasks
          .filter((task) => task.completedAt)
          .map((task) => ({
            id: task.id,
            title: task.title,
            completedAt: task.completedAt,
            estimatedDuration: task.estimatedDuration,
            type: task.type,
            roadmapTitle: context.bundle.roadmap.title,
            roadmapSlug: context.bundle.roadmap.slug,
            enrollmentId: String(context.enrollment._id),
            topicTitle: task.topicTitle,
          })),
      )
      .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
      .slice(0, 6);

    const upcomingMilestones = nonArchived
      .filter((context) => context.enrollment.status === 'active' || context.enrollment.status === 'paused')
      .map((context) => {
        const nextModule = context.progress.modules.find((module) => module.completedTasks < module.totalTasks);
        return nextModule
          ? {
              roadmapTitle: context.bundle.roadmap.title,
              roadmapSlug: context.bundle.roadmap.slug,
              enrollmentId: String(context.enrollment._id),
              moduleId: nextModule.id,
              moduleTitle: nextModule.title,
              percent: nextModule.percent,
              completedTasks: nextModule.completedTasks,
              totalTasks: nextModule.totalTasks,
              remainingMinutes: nextModule.estimatedMinutes - nextModule.completedMinutes,
            }
          : null;
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .slice(0, 4);

    const activities = await DailyActivity.find({
      userId: req.user!.id,
      date: { $gte: addDays(today, -13) },
    })
      .sort({ date: 1 })
      .lean();
    const activityByDate = new Map(activities.map((record) => [record.date, record]));
    const learningTime = Array.from({ length: 14 }, (_, index) => {
      const date = addDays(today, index - 13);
      const record = activityByDate.get(date);
      return {
        date,
        minutes: record?.learningMinutes ?? 0,
        completedTasks: record?.completedTasks ?? 0,
      };
    });

    const recentlyCompletedToday = contexts.flatMap((context) =>
      context.progress.tasks
        .filter((task) => task.completedAt && task.completedAt.slice(0, 10) === today)
        .map((task) => ({ ...task, roadmapTitle: context.bundle.roadmap.title })),
    ).length;

    const continueContext = nonArchived
      .filter((context) => context.enrollment.status === 'active')
      .find((context) => context.progress.nextTask);

    res.json({
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        timezone: timeZone,
        dailyGoalMinutes: user.dailyGoalMinutes,
        preferences: user.preferences,
      },
      welcome: {
        message: greeting(user.name, timeZone),
        date: today,
        timezone: timeZone,
      },
      streak,
      plan,
      stats: {
        overallPercent: overall.percent,
        completedTasks: overall.completedTasks,
        totalTasks: overall.totalTasks,
        completedMinutes: overall.completedMinutes,
        totalMinutes: overall.totalMinutes,
        completedToday: recentlyCompletedToday,
        todayMinutes: daily?.learningMinutes ?? 0,
        activeRoadmaps: cards.filter((card) => card.status === 'active').length,
        enrolledRoadmaps: nonArchived.length,
        weeklyCompleted: streak.currentWeekCompleted,
        weeklyGoal: Number(user.preferences?.weeklyGoalTasks ?? 10),
        weeklyMinutes: streak.currentWeekMinutes,
        unreadNotifications,
        achievements: recentAchievements.length,
      },
      roadmaps: cards,
      recentCompletions,
      recentAchievements: recentAchievements.map((item) => ({
        key: item.key,
        title: item.title,
        description: item.description,
        icon: item.icon,
        earnedAt: item.earnedAt,
      })),
      upcomingMilestones,
      learningTime,
      heatmap: streak.heatmap,
      continueLearning: continueContext
        ? {
            enrollmentId: String(continueContext.enrollment._id),
            roadmapTitle: continueContext.bundle.roadmap.title,
            roadmapSlug: continueContext.bundle.roadmap.slug,
            nextTask: continueContext.progress.nextTask,
            percent: continueContext.progress.percent,
          }
        : null,
      generatedAt: new Date().toISOString(),
    });
  }),
);

function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function greeting(name: string, timeZone: string): string {
  let hour = new Date().getUTCHours();
  try {
    hour = Number(
      new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hour12: false }).format(new Date()),
    );
  } catch {
    // keep UTC fallback
  }
  const firstName = name.split(' ')[0];
  if (hour < 12) return `Good morning, ${firstName}`;
  if (hour < 18) return `Good afternoon, ${firstName}`;
  return `Good evening, ${firstName}`;
}
