import mongoose from 'mongoose';
import User from '../models/User.js';
import Quiz from '../models/Quiz.js';
import QuizAttempt from '../models/QuizAttempt.js';
import Rating from '../models/Rating.js';
import { ATTEMPT_STATUS, CONTENT_STATUS } from '../constants/index.js';
import { buildCreatorBoard, buildConsistencyBoard, buildPerformanceBoard } from '../utils/leaderboardMath.js';

/**
 * Leaderboards computed from real attempts and ratings only.
 * Users who opted out of leaderboards (`settings.showOnLeaderboards === false`)
 * are excluded. Empty data yields an empty board — never fabricated rows.
 */

const SUBMITTED_STATES = [ATTEMPT_STATUS.SUBMITTED, ATTEMPT_STATUS.COMPLETED];

async function loadVisibleUsers() {
  const users = await User.find({ status: 'ACTIVE' })
    .select('name avatar settings.showOnLeaderboards')
    .lean();
  return users.filter((u) => u.settings?.showOnLeaderboards !== false);
}

/** Performance: average score across server-verified passed attempts. */
export async function getPerformanceLeaderboard({ limit = 20 } = {}) {
  const users = await loadVisibleUsers();
  const userIds = users.map((u) => u._id);

  const attempts = await QuizAttempt.find({
    user: { $in: userIds },
    status: { $in: SUBMITTED_STATES },
    needsReview: false,
  })
    .select('user percentage passed')
    .lean();

  const byUser = new Map(userIds.map((id) => [String(id), []]));
  for (const a of attempts) {
    const key = String(a.user);
    if (byUser.has(key)) byUser.get(key).push(a);
  }

  const rows = users.map((u) => {
    const list = byUser.get(String(u._id)) ?? [];
    const passed = list.filter((a) => a.passed);
    return {
      userId: String(u._id),
      name: u.name,
      avatarUrl: u.avatar?.url ?? null,
      percentages: passed.map((a) => a.percentage),
      passedCount: passed.length,
      completedCount: list.length,
    };
  });

  return buildPerformanceBoard(rows, { minAttempts: 3 }).slice(0, limit);
}

/** Consistency: completed volume with score stability. */
export async function getConsistencyLeaderboard({ limit = 20 } = {}) {
  const users = await loadVisibleUsers();
  const userIds = users.map((u) => u._id);

  const attempts = await QuizAttempt.find({
    user: { $in: userIds },
    status: { $in: SUBMITTED_STATES },
    needsReview: false,
  })
    .select('user percentage')
    .lean();

  const byUser = new Map(userIds.map((id) => [String(id), []]));
  for (const a of attempts) {
    const key = String(a.user);
    if (byUser.has(key)) byUser.get(key).push(a.percentage);
  }

  const rows = users.map((u) => {
    const percentages = byUser.get(String(u._id)) ?? [];
    return {
      userId: String(u._id),
      name: u.name,
      avatarUrl: u.avatar?.url ?? null,
      percentages,
      completedCount: percentages.length,
    };
  });

  return buildConsistencyBoard(rows, { minAttempts: 5 }).slice(0, limit);
}

/** Creators: Bayesian community rating over approved content. */
export async function getCreatorLeaderboard({ limit = 20 } = {}) {
  const users = await loadVisibleUsers();
  const userIds = users.map((u) => u._id);

  const [quizzes, polls] = await Promise.all([
    Quiz.find({ creator: { $in: userIds }, status: CONTENT_STATUS.APPROVED })
      .select('creator stats.ratingCount stats.ratingRawAvg')
      .lean(),
    Poll.find({ creator: { $in: userIds }, status: CONTENT_STATUS.APPROVED })
      .select('creator stats.ratingCount stats.ratingRawAvg')
      .lean(),
  ]);

  const byUser = new Map();
  for (const u of users) {
    byUser.set(String(u._id), {
      userId: String(u._id),
      name: u.name,
      avatarUrl: u.avatar?.url ?? null,
      publishedCount: 0,
      ratingCount: 0,
      ratingSum: 0,
    });
  }

  for (const doc of [...quizzes, ...polls]) {
    const row = byUser.get(String(doc.creator));
    if (!row) continue;
    row.publishedCount += 1;
    const count = doc.stats?.ratingCount ?? 0;
    row.ratingCount += count;
    row.ratingSum += (doc.stats?.ratingRawAvg ?? 0) * count;
  }

  const rows = [...byUser.values()].map((r) => ({
    ...r,
    rawAvg: r.ratingCount > 0 ? r.ratingSum / r.ratingCount : 0,
  }));

  return buildCreatorBoard(rows, { minRatings: 1, minPublished: 1 }).slice(0, limit);
}

export default {
  getPerformanceLeaderboard,
  getConsistencyLeaderboard,
  getCreatorLeaderboard,
};
