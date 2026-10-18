import { DailyActivity } from '../models/DailyActivity.js';
import { Notification } from '../models/Notification.js';
import { User, type UserDocument } from '../models/User.js';
import { notFound } from '../utils/errors.js';
import { todayString } from '../utils/time.js';
import { getEnrollmentContexts } from './userOverview.js';
import { buildDailyPlan, type DailyPlan } from './schedule.js';
import { getStreakStats, minutesSinceMidnightForZone, parseReminderTime, type StreakStats } from './streak.js';
import { createNotification } from './notifications.js';

export interface DailyPlanResult {
  plan: DailyPlan;
  streak: StreakStats;
  user: {
    id: string;
    name: string;
    timezone: string;
    dailyGoalMinutes: number;
    preferences: Record<string, unknown>;
  };
}

export async function getDailyPlanForUser(userId: string): Promise<DailyPlanResult> {
  const user = await User.findById(userId);
  if (!user) throw notFound('Account not found');
  const timeZone = user.timezone || 'UTC';
  const today = todayString(timeZone);
  const [contexts, daily, streak] = await Promise.all([
    getEnrollmentContexts(userId, timeZone),
    DailyActivity.findOne({ userId, date: today }).lean(),
    getStreakStats(userId, timeZone),
  ]);

  const plan = buildDailyPlan({
    contexts,
    timeZone,
    today,
    budgetMinutes: user.dailyGoalMinutes ?? 45,
    spentMinutes: daily?.learningMinutes ?? 0,
  });

  await maybeSendDailyReminder(user, plan, today);

  return {
    plan,
    streak,
    user: {
      id: String(user._id),
      name: user.name,
      timezone: timeZone,
      dailyGoalMinutes: user.dailyGoalMinutes ?? 45,
      preferences: (user.preferences ?? {}) as Record<string, unknown>,
    },
  };
}

/**
 * In-app reminder only (no background push/email infrastructure is claimed).
 * Created at most once per local day, when the learner opens the app after their
 * chosen reminder time and still has tasks recommended.
 */
export async function maybeSendDailyReminder(
  user: UserDocument,
  plan: DailyPlan,
  today: string,
): Promise<void> {
  if (!user) return;
  const preferences = user.preferences ?? { inAppReminders: true, reminderTime: '19:00' };
  if (!preferences.inAppReminders) return;
  const reminderMinutes = parseReminderTime(preferences.reminderTime ?? '19:00');
  if (reminderMinutes === null) return;
  if (minutesSinceMidnightForZone(user.timezone, new Date()) < reminderMinutes) return;
  if (plan.recommendations.length === 0) return;

  const existing = await Notification.findOne({
    userId: user._id,
    type: 'reminder',
    'metadata.localDate': today,
  }).lean();
  if (existing) return;

  await createNotification({
    userId: user._id,
    type: 'reminder',
    title: "Today's plan is waiting",
    message: `${plan.recommendations.length} task${plan.recommendations.length === 1 ? '' : 's'} · about ${plan.totalRecommendedMinutes} minutes. Keep your streak going.`,
    link: '/today',
    metadata: { localDate: today },
  });
}
