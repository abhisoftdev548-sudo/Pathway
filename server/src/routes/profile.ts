import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateProfileSchema } from '../validation/profile.js';
import { User } from '../models/User.js';
import { Enrollment } from '../models/Enrollment.js';
import { TaskProgress } from '../models/TaskProgress.js';
import { Achievement } from '../models/Achievement.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { notFound } from '../utils/errors.js';
import { publicUser } from '../services/userService.js';
import { clearAuthCookies } from '../services/tokenService.js';
import { rebuildDailyActivity } from '../services/activity.js';
import { createNotification } from '../services/notifications.js';

export const profileRouter = Router();

profileRouter.get(
  '/me/profile',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.id);
    if (!user) throw notFound('Account not found');
    const [roadmaps, completedTasks, achievements] = await Promise.all([
      Enrollment.countDocuments({ userId: user._id, status: { $ne: 'archived' } }),
      TaskProgress.countDocuments({ userId: user._id, status: 'completed' }),
      Achievement.countDocuments({ userId: user._id }),
    ]);
    res.json({
      user: publicUser(user),
      stats: { roadmaps, completedTasks, achievements },
    });
  }),
);

profileRouter.patch(
  '/me/profile',
  requireAuth,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.id);
    if (!user) throw notFound('Account not found');
    const { name, avatar, bio, dailyGoalMinutes, timezone, preferences } = req.body;
    const previousTimezone = user.timezone;

    if (name !== undefined) user.name = name;
    if (avatar !== undefined) user.avatar = avatar;
    if (bio !== undefined) user.bio = bio;
    if (dailyGoalMinutes !== undefined) user.dailyGoalMinutes = dailyGoalMinutes;
    if (timezone !== undefined) user.timezone = timezone;
    if (preferences) {
      user.preferences = { ...(user.preferences ?? {}), ...preferences } as typeof user.preferences;
    }
    await user.save();

    let timezoneChanged = false;
    if (timezone && timezone !== previousTimezone) {
      timezoneChanged = true;
      await rebuildDailyActivity(String(user._id), timezone);
      await createNotification({
        userId: user._id,
        type: 'system',
        title: 'Timezone updated',
        message: `Your streaks and daily plan now follow ${timezone}. Recent activity was recalculated.`,
        link: '/profile',
      });
    }

    res.json({ user: publicUser(user), timezoneChanged });
  }),
);

profileRouter.post(
  '/me/logout-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    await User.updateOne({ _id: req.user!.id }, { $inc: { tokenVersion: 1 } });
    clearAuthCookies(res);
    res.json({ success: true, message: 'All sessions have been signed out.' });
  }),
);
