import { Achievement } from '../models/Achievement.js';
import { DailyActivity } from '../models/DailyActivity.js';
import { Enrollment } from '../models/Enrollment.js';
import { TaskProgress } from '../models/TaskProgress.js';
import { User } from '../models/User.js';
import { getStreakStats } from './streak.js';
import { notifyAchievement } from './notifications.js';

export interface AchievementStats {
  completedTasks: number;
  totalMinutes: number;
  longestStreak: number;
  currentStreak: number;
  completedRoadmaps: number;
  enrolledRoadmaps: number;
  dailyGoalDays: number;
  activeDays: number;
}

interface AchievementDefinition {
  key: string;
  title: string;
  description: string;
  icon: string;
  category: 'milestone' | 'streak' | 'consistency' | 'completion';
  target: number;
  unit: string;
  progress: (stats: AchievementStats) => number;
}

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    key: 'first_task',
    title: 'First Steps',
    description: 'Completed your first learning task on PathForge.',
    icon: 'footprints',
    category: 'milestone',
    target: 1,
    unit: 'task',
    progress: (s) => s.completedTasks,
  },
  {
    key: 'tasks_10',
    title: 'Momentum',
    description: 'Completed 10 learning tasks.',
    icon: 'zap',
    category: 'milestone',
    target: 10,
    unit: 'tasks',
    progress: (s) => s.completedTasks,
  },
  {
    key: 'tasks_25',
    title: 'Deep Diver',
    description: 'Completed 25 learning tasks.',
    icon: 'waves',
    category: 'milestone',
    target: 25,
    unit: 'tasks',
    progress: (s) => s.completedTasks,
  },
  {
    key: 'tasks_50',
    title: 'Half Century',
    description: 'Completed 50 learning tasks.',
    icon: 'trophy',
    category: 'milestone',
    target: 50,
    unit: 'tasks',
    progress: (s) => s.completedTasks,
  },
  {
    key: 'tasks_100',
    title: 'Centurion',
    description: 'Completed 100 learning tasks.',
    icon: 'medal',
    category: 'milestone',
    target: 100,
    unit: 'tasks',
    progress: (s) => s.completedTasks,
  },
  {
    key: 'streak_3',
    title: 'Warming Up',
    description: 'Learned on 3 consecutive days.',
    icon: 'flame',
    category: 'streak',
    target: 3,
    unit: 'days',
    progress: (s) => s.longestStreak,
  },
  {
    key: 'streak_7',
    title: 'Week of Focus',
    description: 'Maintained a 7-day learning streak.',
    icon: 'calendar-check',
    category: 'streak',
    target: 7,
    unit: 'days',
    progress: (s) => s.longestStreak,
  },
  {
    key: 'streak_30',
    title: 'Habit Formed',
    description: 'Maintained a 30-day learning streak.',
    icon: 'calendar-heart',
    category: 'streak',
    target: 30,
    unit: 'days',
    progress: (s) => s.longestStreak,
  },
  {
    key: 'hours_10',
    title: 'Ten Hours In',
    description: 'Recorded 10 hours of focused learning.',
    icon: 'clock',
    category: 'consistency',
    target: 600,
    unit: 'minutes',
    progress: (s) => s.totalMinutes,
  },
  {
    key: 'daily_goal_5',
    title: 'Goal Getter',
    description: 'Met your daily learning goal on 5 different days.',
    icon: 'target',
    category: 'consistency',
    target: 5,
    unit: 'days',
    progress: (s) => s.dailyGoalDays,
  },
  {
    key: 'first_roadmap',
    title: 'Roadmap Complete',
    description: 'Finished every task in a roadmap.',
    icon: 'flag',
    category: 'completion',
    target: 1,
    unit: 'roadmap',
    progress: (s) => s.completedRoadmaps,
  },
  {
    key: 'roadmaps_3',
    title: 'Versatile Learner',
    description: 'Completed 3 full roadmaps.',
    icon: 'layers',
    category: 'completion',
    target: 3,
    unit: 'roadmaps',
    progress: (s) => s.completedRoadmaps,
  },
  {
    key: 'explorer',
    title: 'Explorer',
    description: 'Enrolled in 3 or more roadmaps.',
    icon: 'compass',
    category: 'milestone',
    target: 3,
    unit: 'roadmaps',
    progress: (s) => s.enrolledRoadmaps,
  },
];

export async function computeAchievementStats(userId: string, timeZone: string): Promise<AchievementStats> {
  const [completedTasks, enrollments, streak, dailyRecords, user] = await Promise.all([
    TaskProgress.countDocuments({ userId, status: 'completed' }),
    Enrollment.find({ userId }).select('status').lean(),
    getStreakStats(userId, timeZone),
    DailyActivity.find({ userId }).select('learningMinutes completedTasks').lean(),
    User.findById(userId).select('dailyGoalMinutes').lean(),
  ]);
  const totalMinutes = dailyRecords.reduce((sum, record) => sum + (record.learningMinutes ?? 0), 0);
  const dailyGoalMinutes = user?.dailyGoalMinutes ?? 45;
  return {
    completedTasks,
    totalMinutes,
    longestStreak: streak.longestStreak,
    currentStreak: streak.currentStreak,
    completedRoadmaps: enrollments.filter((e) => e.status === 'completed').length,
    enrolledRoadmaps: enrollments.filter((e) => e.status !== 'archived').length,
    dailyGoalDays: dailyRecords.filter((record) => record.learningMinutes >= dailyGoalMinutes).length,
    activeDays: streak.totalActiveDays,
  };
}

/**
 * Awards all newly-earned achievements exactly once. The unique (userId, key)
 * index is the concurrency-safe guard against duplicates.
 */
export async function evaluateAchievements(
  userId: string,
  timeZone: string,
  stats?: AchievementStats,
): Promise<{ key: string; title: string; description: string }[]> {
  const resolvedStats = stats ?? (await computeAchievementStats(userId, timeZone));
  const newlyEarned: { key: string; title: string; description: string }[] = [];
  for (const definition of ACHIEVEMENT_DEFINITIONS) {
    if (definition.progress(resolvedStats) < definition.target) continue;
    try {
      const result = await Achievement.updateOne(
        { userId, key: definition.key },
        {
          $setOnInsert: {
            userId,
            key: definition.key,
            title: definition.title,
            description: definition.description,
            icon: definition.icon,
            category: definition.category,
            earnedAt: new Date(),
            metadata: { target: definition.target, unit: definition.unit },
          },
        },
        { upsert: true },
      );
      if (result.upsertedCount > 0) {
        newlyEarned.push(definition);
        await notifyAchievement(userId, definition);
      }
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
    }
  }
  return newlyEarned;
}

export async function awardRoadmapCompletion(
  userId: string,
  roadmap: { _id: unknown; title: string },
): Promise<boolean> {
  const key = `roadmap_completed:${String(roadmap._id)}`;
  try {
    const result = await Achievement.updateOne(
      { userId, key },
      {
        $setOnInsert: {
          userId,
          key,
          title: `${roadmap.title} completed`,
          description: `You completed every published task in ${roadmap.title}.`,
          icon: 'award',
          category: 'completion',
          earnedAt: new Date(),
          metadata: { roadmapId: String(roadmap._id) },
        },
      },
      { upsert: true },
    );
    if (result.upsertedCount > 0) {
      await notifyAchievement(userId, {
        key,
        title: `${roadmap.title} completed`,
        description: 'Your completion summary and certificate are ready on the Achievements page.',
      });
      return true;
    }
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
  }
  return false;
}

export async function getAchievementCatalog(userId: string, timeZone: string) {
  const [stats, earned] = await Promise.all([
    computeAchievementStats(userId, timeZone),
    Achievement.find({ userId }).sort({ earnedAt: -1 }).lean(),
  ]);
  const earnedByKey = new Map(earned.map((item) => [item.key, item]));
  const roadmapAchievements = earned.filter((item) => item.key.startsWith('roadmap_completed:'));
  const standard = ACHIEVEMENT_DEFINITIONS.map((definition) => {
    const record = earnedByKey.get(definition.key);
    const current = Math.min(definition.progress(stats), definition.target);
    return {
      key: definition.key,
      title: definition.title,
      description: definition.description,
      icon: definition.icon,
      category: definition.category,
      earned: Boolean(record),
      earnedAt: record?.earnedAt ?? null,
      progress: { current, target: definition.target, unit: definition.unit },
    };
  });
  return {
    stats,
    achievements: [...standard, ...roadmapAchievements.map(serializeRoadmapAchievement)],
    roadmapAchievements: roadmapAchievements.map(serializeRoadmapAchievement),
  };
}

function serializeRoadmapAchievement(item: {
  key: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  earnedAt?: Date | null;
}) {
  return {
    key: item.key,
    title: item.title,
    description: item.description,
    icon: item.icon,
    category: item.category,
    earned: true,
    earnedAt: item.earnedAt ?? null,
    progress: { current: 1, target: 1, unit: 'roadmap' },
  };
}

export type EarnedAchievement = { key: string; title: string; description: string };
