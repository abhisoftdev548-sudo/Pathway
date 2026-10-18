import * as authService from '../services/authService.js';
import * as attemptService from '../services/attemptService.js';
import * as ratingService from '../services/ratingService.js';
import * as achievementService from '../services/achievementService.js';
import * as walletService from '../services/walletService.js';
import * as notificationService from '../services/notificationService.js';
import * as cloudinaryService from '../services/cloudinaryService.js';
import Quiz from '../models/Quiz.js';
import Poll from '../models/Poll.js';
import User from '../models/User.js';
import { sendSuccess, parsePagination, paginationMeta } from '../utils/responses.js';
import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { destroyImage } from '../config/cloudinary.js';

export const getMe = asyncHandler(async (req, res) => {
  return sendSuccess(res, { user: authService.publicUser(req.user) });
});

export const updateMe = asyncHandler(async (req, res) => {
  const { name, bio, avatar, settings } = req.body;
  const user = await User.findById(req.user._id);

  if (name !== undefined) user.name = name;
  if (bio !== undefined) user.bio = bio;
  if (settings) Object.assign(user.settings, settings);
  if (avatar !== undefined) {
    // Replace avatar: remove the previous Cloudinary asset when safe.
    if (user.avatar?.publicId && avatar?.publicId !== user.avatar.publicId) {
      await destroyImage(user.avatar.publicId);
    }
    user.avatar = avatar ?? {};
  }

  await user.save();
  return sendSuccess(res, { user: authService.publicUser(user) });
});

/** Server-generated signed upload params for the current user's avatar. */
export const avatarUploadParams = asyncHandler(async (_req, res) => {
  const params = cloudinaryService.getSignedUpload({ purpose: 'avatar' });
  return sendSuccess(res, params);
});

export const getPublicProfile = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id })
    .select('name bio avatar createdAt role')
    .lean();
  if (!user) throw ApiError.notFound('User not found');

  const [quizzes, polls, reputation] = await Promise.all([
    Quiz.countDocuments({ creator: user._id, status: 'APPROVED' }),
    Poll.countDocuments({ creator: user._id, status: 'APPROVED' }),
    ratingService.getCreatorReputation(user._id),
  ]);

  const publishedQuizzes = await Quiz.find({ creator: user._id, status: 'APPROVED' })
    .select('title slug difficulty stats tags')
    .sort({ publishedAt: -1 })
    .limit(9)
    .lean();

  return sendSuccess(res, {
    profile: {
      id: String(user._id),
      name: user.name,
      bio: user.bio,
      avatar: user.avatar,
      joinedAt: user.createdAt,
      role: user.role,
    },
    stats: { publishedQuizzes: quizzes, publishedPolls: polls },
    reputation,
    publishedQuizzes,
  });
});

export const myStats = asyncHandler(async (req, res) => {
  const [attempts, quizzes, polls, wallet, unread] = await Promise.all([
    attemptService.listMyAttempts({ user: req.user, page: 1, limit: 5 }),
    Quiz.countDocuments({ creator: req.user._id }),
    Poll.countDocuments({ creator: req.user._id }),
    walletService.getTransactions({ userId: req.user._id, page: 1, limit: 5 }),
    notificationService.listNotifications({ userId: req.user._id, page: 1, limit: 1 }),
  ]);

  const passedCount = await Quiz.countDocuments({}); // placeholder avoided — real counts below
  const myPassed = await attemptService
    .listMyAttempts({ user: req.user, page: 1, limit: 100 })
    .then((r) => r.items.filter((a) => a.passed).length);

  return sendSuccess(res, {
    recentAttempts: attempts.items,
    counts: {
      quizzesCreated: quizzes,
      pollsCreated: polls,
      attempts: attempts.total,
      passedAttempts: myPassed,
      notificationsUnread: unread.unreadCount,
    },
    wallet: req.user.wallet,
    recentTransactions: wallet.items,
  });
});

export const myAchievements = asyncHandler(async (req, res) => {
  const catalog = await achievementService.achievementCatalog(req.user._id);
  return sendSuccess(res, { items: catalog });
});

export const myRatings = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const result = await ratingService.listMyRatings({ user: req.user, page, limit });
  return sendSuccess(res, { items: result.items }, paginationMeta({ page, limit, total: result.total }));
});

export const myAttempts = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const result = await attemptService.listMyAttempts({ user: req.user, page, limit });
  return sendSuccess(res, { items: result.items }, paginationMeta({ page, limit, total: result.total }));
});

export const mySessions = asyncHandler(async (req, res) => {
  const { default: authService } = await import('../services/authService.js');
  const items = await authService.listSessions(req.user._id);
  return sendSuccess(res, { items });
});
