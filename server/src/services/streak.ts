import { DailyActivity } from '../models/DailyActivity.js';
import { addDaysToDateString, todayString } from '../utils/time.js';

export interface StreakStats {
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  todayCompleted: number;
  todayMinutes: number;
  lastActiveDate: string | null;
  weekly: { date: string; completedTasks: number; learningMinutes: number; active: boolean }[];
  heatmap: { date: string; completedTasks: number; learningMinutes: number }[];
  currentWeekCompleted: number;
  currentWeekMinutes: number;
}

export async function getStreakStats(userId: string, timeZone: string, now = new Date()): Promise<StreakStats> {
  const records = await DailyActivity.find({ userId }).sort({ date: 1 }).lean();
  const activeDates = new Set(records.filter((r) => r.completedTasks > 0).map((r) => r.date));
  const today = todayString(timeZone, now);

  // Current streak: consecutive active days ending today or yesterday
  // (a learner keeps their streak until the current day is over).
  let cursor = activeDates.has(today) ? today : addDaysToDateString(today, -1);
  let currentStreak = 0;
  while (activeDates.has(cursor)) {
    currentStreak += 1;
    cursor = addDaysToDateString(cursor, -1);
  }

  // Longest streak over recorded history.
  const sorted = [...activeDates].sort();
  let longestStreak = 0;
  let running = 0;
  let previous: string | null = null;
  for (const date of sorted) {
    if (previous && addDaysToDateString(previous, 1) === date) running += 1;
    else running = 1;
    longestStreak = Math.max(longestStreak, running);
    previous = date;
  }

  const byDate = new Map(records.map((r) => [r.date, r]));
  const weekly = Array.from({ length: 7 }, (_, index) => {
    const date = addDaysToDateString(today, index - 6);
    const record = byDate.get(date);
    return {
      date,
      completedTasks: record?.completedTasks ?? 0,
      learningMinutes: record?.learningMinutes ?? 0,
      active: (record?.completedTasks ?? 0) > 0,
    };
  });
  const heatmap = Array.from({ length: 84 }, (_, index) => {
    const date = addDaysToDateString(today, index - 83);
    const record = byDate.get(date);
    return { date, completedTasks: record?.completedTasks ?? 0, learningMinutes: record?.learningMinutes ?? 0 };
  });

  const todayRecord = byDate.get(today);
  const currentWeekCompleted = weekly.reduce((sum, day) => sum + day.completedTasks, 0);
  const currentWeekMinutes = weekly.reduce((sum, day) => sum + day.learningMinutes, 0);
  const lastActiveDate = sorted.length > 0 ? sorted[sorted.length - 1] : null;

  return {
    currentStreak,
    longestStreak,
    totalActiveDays: activeDates.size,
    todayCompleted: todayRecord?.completedTasks ?? 0,
    todayMinutes: todayRecord?.learningMinutes ?? 0,
    lastActiveDate,
    weekly,
    heatmap,
    currentWeekCompleted,
    currentWeekMinutes,
  };
}

/** Parses "HH:mm" into minutes since midnight; returns null for invalid values. */
export function parseReminderTime(value?: string | null): number | null {
  if (!value) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function minutesSinceMidnightForZone(timeZone: string, now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}
