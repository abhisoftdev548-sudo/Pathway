import type { Types } from 'mongoose';
import { ActivityLog } from '../models/ActivityLog.js';
import { DailyActivity } from '../models/DailyActivity.js';
import type { ActivityType } from '../models/constants.js';
import { localDateString } from '../utils/time.js';

interface RecordActivityInput {
  userId: string | Types.ObjectId;
  activityType: ActivityType;
  timeZone: string;
  enrollmentId?: string | Types.ObjectId | null;
  roadmapId?: string | Types.ObjectId | null;
  taskId?: string | Types.ObjectId | null;
  minutes?: number;
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}

export async function recordActivity(input: RecordActivityInput): Promise<void> {
  const timestamp = input.timestamp ?? new Date();
  await ActivityLog.create({
    userId: input.userId,
    enrollmentId: input.enrollmentId ?? null,
    roadmapId: input.roadmapId ?? null,
    taskId: input.taskId ?? null,
    activityType: input.activityType,
    timestamp,
    localDate: localDateString(timestamp, input.timeZone),
    minutes: input.minutes ?? 0,
    metadata: input.metadata ?? {},
  });
}

export async function bumpDailyActivity(options: {
  userId: string | Types.ObjectId;
  timeZone: string;
  date?: string;
  completedTasksDelta?: number;
  learningMinutesDelta?: number;
  roadmapId?: string | Types.ObjectId | null;
}): Promise<void> {
  const date = options.date ?? localDateString(new Date(), options.timeZone);
  const update: Record<string, unknown> = {
    $setOnInsert: { userId: options.userId, date, timezone: options.timeZone },
  };
  const increment: Record<string, number> = {};
  if (options.completedTasksDelta) increment.completedTasks = options.completedTasksDelta;
  if (options.learningMinutesDelta && options.learningMinutesDelta !== 0) {
    increment.learningMinutes = options.learningMinutesDelta;
  }
  if (Object.keys(increment).length > 0) update.$inc = increment;
  if (options.roadmapId) update.$addToSet = { activeRoadmaps: options.roadmapId };

  await DailyActivity.findOneAndUpdate({ userId: options.userId, date }, update, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });
}

/** Rebinds DailyActivity onto the user's current timezone for recent activity. */
export async function rebuildDailyActivity(userId: string, timeZone: string, days = 120): Promise<void> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const logs = await ActivityLog.find({ userId, timestamp: { $gte: since }, activityType: { $in: ['task_completed', 'time_logged'] } });
  const buckets = new Map<
    string,
    { completedTasks: number; learningMinutes: number; roadmaps: Set<string> }
  >();
  for (const log of logs) {
    const date = localDateString(new Date(log.timestamp), timeZone);
    const bucket = buckets.get(date) ?? { completedTasks: 0, learningMinutes: 0, roadmaps: new Set<string>() };
    if (log.activityType === 'task_completed') bucket.completedTasks += 1;
    bucket.learningMinutes += log.minutes ?? 0;
    if (log.roadmapId) bucket.roadmaps.add(String(log.roadmapId));
    buckets.set(date, bucket);
  }
  for (const [date, bucket] of buckets) {
    await DailyActivity.findOneAndUpdate(
      { userId, date },
      {
        $set: {
          timezone: timeZone,
          completedTasks: bucket.completedTasks,
          learningMinutes: bucket.learningMinutes,
          activeRoadmaps: [...bucket.roadmaps],
        },
        $setOnInsert: { userId, date },
      },
      { upsert: true },
    );
  }
}
