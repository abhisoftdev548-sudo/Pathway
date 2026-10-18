import Achievement from '../models/Achievement.js';
import { ACHIEVEMENTS, NOTIFICATION_TYPES } from '../constants/index.js';
import { notify } from './notificationService.js';
import { payReward } from './walletService.js';
import { ACTIVITY_TYPES, TX_TYPE } from '../constants/index.js';

/**
 * Achievement engine — awards are granted only after real, server-verified
 * activity. Idempotent per (user, key).
 */
export async function awardAchievement(userId, key, { rewardCoins = 0 } = {}) {
  const definition = Object.values(ACHIEVEMENTS).find((a) => a.key === key);
  if (!definition) return null;

  try {
    const existing = await Achievement.findOne({ user: userId, key });
    if (existing) return existing;

    const achievement = await Achievement.create({
      user: userId,
      key: definition.key,
      title: definition.title,
      description: definition.description,
    });

    await notify({
      userId,
      type: NOTIFICATION_TYPES.ACHIEVEMENT,
      title: `Achievement unlocked: ${definition.title}`,
      body: definition.description,
      link: '/achievements',
    });

    if (rewardCoins > 0) {
      await payReward({
        userId,
        amount: rewardCoins,
        activityType: ACTIVITY_TYPES.ACHIEVEMENT,
        activityId: key,
        idempotencyKey: `achievement-reward:${userId}:${key}`,
        metadata: { achievement: key },
      }).catch(() => {
        // Reward payouts are best-effort here; the achievement itself stands.
      });
    }

    return achievement;
  } catch (err) {
    if (err?.code === 11000) return null; // concurrent award — fine
    throw err;
  }
}

export async function listAchievements(userId) {
  return Achievement.find({ user: userId }).sort({ awardedAt: -1 }).lean();
}

/** All defined achievements with earned flags for a user. */
export async function achievementCatalog(userId) {
  const earned = await Achievement.find({ user: userId }).lean();
  const earnedKeys = new Set(earned.map((a) => a.key));
  return Object.values(ACHIEVEMENTS).map((def) => ({
    ...def,
    earned: earnedKeys.has(def.key),
    awardedAt: earned.find((a) => a.key === def.key)?.awardedAt ?? null,
  }));
}

export default { awardAchievement, listAchievements, achievementCatalog };
