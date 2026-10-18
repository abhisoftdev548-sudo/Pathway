import Category from '../models/Category.js';
import Tag from '../models/Tag.js';
import Quiz from '../models/Quiz.js';
import Poll from '../models/Poll.js';
import User from '../models/User.js';
import { sendSuccess } from '../utils/responses.js';
import { asyncHandler } from '../utils/ApiError.js';

/** Public categories (active only) for filters and builders. */
export const getCategories = asyncHandler(async (_req, res) => {
  const categories = await Category.find({ isActive: true }).sort({ name: 1 }).lean();
  return sendSuccess(res, { items: categories });
});

/** Public popular tags for filters. */
export const getTags = asyncHandler(async (_req, res) => {
  const tags = await Tag.find({ isActive: true, usageCount: { $gt: 0 } })
    .sort({ usageCount: -1 })
    .limit(40)
    .select('name slug usageCount')
    .lean();
  return sendSuccess(res, { items: tags });
});

/**
 * Landing-page statistics — STRICT no-fake-data policy.
 *
 * Only metrics that are real, non-zero, and meaningful are returned.
 * Zero/empty values are OMITTED from the response entirely so the landing page
 * can hide entire sections instead of showing "0" vanity numbers.
 */
export const getPublicStats = asyncHandler(async (_req, res) => {
  const [approvedQuizzes, approvedPolls, registeredUsers, answeredAttempts] = await Promise.all([
    Quiz.countDocuments({ status: 'APPROVED' }),
    Poll.countDocuments({ status: 'APPROVED' }),
    User.countDocuments({}),
    Quiz.countDocuments({ 'stats.completionsCount': { $gt: 0 } }),
  ]);

  const stats = {};
  if (registeredUsers > 0) stats.registeredUsers = registeredUsers;
  if (approvedQuizzes > 0) stats.publishedQuizzes = approvedQuizzes;
  if (approvedPolls > 0) stats.publishedPolls = approvedPolls;
  if (answeredAttempts > 0) stats.quizzesTaken = answeredAttempts;

  return sendSuccess(res, { stats });
});

/** Landing-page content previews — returns only real, published items. */
export const getPublicHighlights = asyncHandler(async (_req, res) => {
  const [quizzes, polls] = await Promise.all([
    Quiz.find({ status: 'APPROVED' })
      .sort({ publishedAt: -1 })
      .limit(6)
      .select('title slug description difficulty tags stats.attemptsCount stats.ratingBayes stats.ratingCount cover category')
      .populate('category', 'name slug')
      .populate('creator', 'name avatar')
      .lean(),
    Poll.find({ status: 'APPROVED', endsAt: { $gt: new Date() } })
      .sort({ endsAt: 1 })
      .limit(4)
      .select('title question slug endsAt votingType stats.uniqueVoters tags category')
      .populate('category', 'name slug')
      .populate('creator', 'name avatar')
      .lean(),
  ]);

  // Omit empty sections entirely — the client hides them when absent.
  return sendSuccess(res, {
    ...(quizzes.length > 0 ? { quizzes } : {}),
    ...(polls.length > 0 ? { polls } : {}),
  });
});

/** Health check used by deployment platforms and diagnostics. */
export const health = asyncHandler(async (_req, res) => {
  return sendSuccess(res, {
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});
