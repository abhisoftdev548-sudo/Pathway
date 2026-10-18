import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { DailyActivity } from '../models/DailyActivity.js';
import { TaskProgress } from '../models/TaskProgress.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { notFound } from '../utils/errors.js';
import { todayString } from '../utils/time.js';
import { getEnrollmentContexts, serializeRoadmapCard } from '../services/userOverview.js';
import { computeOverallProgress } from '../services/progress.js';
import { getStreakStats } from '../services/streak.js';

export const analyticsRouter = Router();

analyticsRouter.get(
  '/me/analytics',
  requireAuth,
  validate(z.object({ days: z.coerce.number().int().min(7).max(365).default(30) }), 'query'),
  asyncHandler(async (req, res) => {
    const { days } = req.validatedQuery as { days: number };
    const user = await User.findById(req.user!.id);
    if (!user) throw notFound('Account not found');
    const timeZone = user.timezone || 'UTC';
    const today = todayString(timeZone);
    const startDate = addDays(today, -(days - 1));

    const [contexts, streak, dailyRecords, logs, allProgress] = await Promise.all([
      getEnrollmentContexts(req.user!.id, timeZone),
      getStreakStats(req.user!.id, timeZone),
      DailyActivity.find({ userId: req.user!.id, date: { $gte: startDate } }).sort({ date: 1 }).lean(),
      ActivityLog.find({
        userId: req.user!.id,
        activityType: { $in: ['task_completed', 'task_reopened'] },
        timestamp: { $gte: new Date(Date.now() - days * 86_400_000) },
      }).lean(),
      TaskProgress.find({ userId: req.user!.id }).select('roadmapId status actualDuration').lean(),
    ]);

    const dailyByDate = new Map(dailyRecords.map((record) => [record.date, record]));
    const series = Array.from({ length: days }, (_, index) => {
      const date = addDays(startDate, index);
      const record = dailyByDate.get(date);
      return {
        date,
        completedTasks: record?.completedTasks ?? 0,
        minutes: record?.learningMinutes ?? 0,
      };
    });

    const completionsByDate = new Map<string, number>();
    const reopensByDate = new Map<string, number>();
    for (const log of logs) {
      const bucket = log.activityType === 'task_completed' ? completionsByDate : reopensByDate;
      bucket.set(log.localDate, (bucket.get(log.localDate) ?? 0) + 1);
    }
    const trend = series.map((day) => ({
      ...day,
      completions: completionsByDate.get(day.date) ?? 0,
      reopens: reopensByDate.get(day.date) ?? 0,
    }));

    const nonArchived = contexts.filter((context) => context.enrollment.status !== 'archived');
    const overall = computeOverallProgress(nonArchived);
    const cards = contexts.map(serializeRoadmapCard);

    const completedTasks = nonArchived.flatMap((context) =>
      context.progress.tasks
        .filter((task) => task.status === 'completed')
        .map((task) => ({ ...task, roadmapTitle: context.bundle.roadmap.title })),
    );
    const byDifficulty = ['beginner', 'intermediate', 'advanced'].map((difficulty) => ({
      difficulty,
      count: completedTasks.filter((task) => task.difficulty === difficulty).length,
    }));
    const byType = ['learn', 'practice', 'code', 'quiz', 'project', 'revision', 'assessment'].map((type) => ({
      type,
      count: completedTasks.filter((task) => task.type === type).length,
    }));

    const recordedByRoadmap = new Map<string, number>();
    for (const progress of allProgress) {
      if (progress.status !== 'completed') continue;
      recordedByRoadmap.set(
        String(progress.roadmapId),
        (recordedByRoadmap.get(String(progress.roadmapId)) ?? 0) + (progress.actualDuration ?? 0),
      );
    }
    const timeByRoadmap = nonArchived.map((context) => ({
      roadmapTitle: context.bundle.roadmap.title,
      roadmapSlug: context.bundle.roadmap.slug,
      estimatedMinutes: context.progress.completedMinutes,
      recordedMinutes: recordedByRoadmap.get(String(context.bundle.roadmap._id)) ?? 0,
      remainingMinutes: context.progress.totalMinutes - context.progress.completedMinutes,
    }));

    const activeDays = series.filter((day) => day.completedTasks > 0).length;
    const avgDailyMinutes = Math.round((combinedMinutes(series) / Math.max(1, days)) * 10) / 10;
    const avgPerActiveDay = activeDays > 0 ? Math.round((combinedMinutes(series) / activeDays) * 10) / 10 : 0;
    const remainingMinutes = overall.totalMinutes - overall.completedMinutes;
    const recentAvgMinutes = averageLast(series, 14);
    const daysToFinish = recentAvgMinutes > 0 ? Math.ceil(remainingMinutes / recentAvgMinutes) : null;

    const modulesCompleted = nonArchived.reduce(
      (sum, context) => sum + context.progress.modules.filter((module) => module.totalTasks > 0 && module.completedTasks === module.totalTasks).length,
      0,
    );
    const modulesTotal = nonArchived.reduce((sum, context) => sum + context.progress.modules.length, 0);

    res.json({
      range: { days, startDate, endDate: today, timezone: timeZone },
      overall,
      streak,
      stats: {
        completedTasks: overall.completedTasks,
        totalTasks: overall.totalTasks,
        completedMinutes: overall.completedMinutes,
        remainingMinutes,
        recordedMinutes: dailyRecords.reduce((sum, day) => sum + day.learningMinutes, 0),
        activeDays,
        avgDailyMinutes,
        avgPerActiveDay,
        dailyGoalMinutes: user.dailyGoalMinutes,
        modulesCompleted,
        modulesTotal,
        daysToFinish,
        projectedCompletionDate:
          daysToFinish !== null ? addDays(today, daysToFinish) : null,
      },
      roadmaps: cards,
      modules: nonArchived.flatMap((context) =>
        context.progress.modules.map((module) => ({
          id: module.id,
          title: module.title,
          roadmapTitle: context.bundle.roadmap.title,
          roadmapSlug: context.bundle.roadmap.slug,
          percent: module.percent,
          completedTasks: module.completedTasks,
          totalTasks: module.totalTasks,
          estimatedMinutes: module.estimatedMinutes,
          remainingMinutes: module.estimatedMinutes - module.completedMinutes,
        })),
      ),
      activity: {
        series,
        trend,
        byDifficulty,
        byType,
        timeByRoadmap,
      },
      generatedAt: new Date().toISOString(),
    });
  }),
);

analyticsRouter.get(
  '/me/streaks',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.id);
    if (!user) throw notFound('Account not found');
    const streak = await getStreakStats(req.user!.id, user.timezone || 'UTC');
    const weeklyGoal = Number(user.preferences?.weeklyGoalTasks ?? 10);
    res.json({
      ...streak,
      timezone: user.timezone,
      preferences: user.preferences,
      weeklyGoal: {
        target: weeklyGoal,
        completed: streak.currentWeekCompleted,
        percent: Math.min(100, Math.round((streak.currentWeekCompleted / Math.max(1, weeklyGoal)) * 100)),
      },
      dailyGoalMinutes: user.dailyGoalMinutes,
    });
  }),
);

analyticsRouter.get(
  '/me/activity',
  requireAuth,
  validate(
    z.object({
      days: z.coerce.number().int().min(7).max(365).default(30),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    }),
    'query',
  ),
  asyncHandler(async (req, res) => {
    const { days, limit } = req.validatedQuery as { days: number; limit: number };
    const user = await User.findById(req.user!.id);
    if (!user) throw notFound('Account not found');
    const timeZone = user.timezone || 'UTC';
    const today = todayString(timeZone);
    const startDate = addDays(today, -(days - 1));
    const [records, logs] = await Promise.all([
      DailyActivity.find({ userId: req.user!.id, date: { $gte: startDate } }).sort({ date: 1 }).lean(),
      ActivityLog.find({ userId: req.user!.id }).sort({ timestamp: -1 }).limit(limit).lean(),
    ]);
    const byDate = new Map(records.map((record) => [record.date, record]));
    const daily = Array.from({ length: days }, (_, index) => {
      const date = addDays(startDate, index);
      const record = byDate.get(date);
      return {
        date,
        completedTasks: record?.completedTasks ?? 0,
        learningMinutes: record?.learningMinutes ?? 0,
        activeRoadmaps: record?.activeRoadmaps ?? [],
      };
    });
    res.json({
      range: { days, startDate, endDate: today, timezone: timeZone },
      daily,
      logs: logs.map((log) => ({
        id: String(log._id),
        activityType: log.activityType,
        timestamp: log.timestamp,
        localDate: log.localDate,
        minutes: log.minutes,
        taskId: log.taskId,
        roadmapId: log.roadmapId,
        metadata: log.metadata,
      })),
    });
  }),
);

function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function combinedMinutes(records: { learningMinutes?: number; minutes?: number }[]): number {
  return records.reduce((sum, record) => sum + (record.learningMinutes ?? record.minutes ?? 0), 0);
}

function averageLast(series: { minutes: number }[], count: number): number {
  const slice = series.slice(-count);
  return slice.reduce((sum, day) => sum + day.minutes, 0) / Math.max(1, slice.length);
}
