import Rating from '../models/Rating.js';
import Quiz from '../models/Quiz.js';
import Poll from '../models/Poll.js';
import QuizAttempt from '../models/QuizAttempt.js';
import PollVote from '../models/PollVote.js';
import { ApiError } from '../utils/ApiError.js';
import { aggregateRatings, ratingEligibility, creatorReputation } from '../utils/ratingMath.js';
import { notify } from './notificationService.js';
import { awardAchievement } from './achievementService.js';
import { NOTIFICATION_TYPES, RATING_TARGETS, ATTEMPT_STATUS, CONTENT_STATUS } from '../constants/index.js';

/**
 * Community ratings for quizzes and polls.
 * Eligibility rules (see ratingMath.ratingEligibility) are enforced here against
 * real activity — never client claims. Aggregation uses a Bayesian average.
 */

async function loadTarget(targetType, targetId) {
  if (targetType === RATING_TARGETS.QUIZ) {
    const quiz = await Quiz.findById(targetId).select('title slug creator status');
    return quiz ? { model: 'QUIZ', doc: quiz, creatorId: quiz.creator, title: quiz.title, slug: quiz.slug } : null;
  }
  const poll = await Poll.findById(targetId).select('title slug creator status');
  return poll ? { model: 'POLL', doc: poll, creatorId: poll.creator, title: poll.title, slug: poll.slug } : null;
}

export async function createRating({ user, targetType, targetId, score, review }) {
  const target = await loadTarget(targetType, targetId);
  if (!target) throw ApiError.notFound('Content not found');
  if (target.doc.status !== CONTENT_STATUS.APPROVED) {
    throw ApiError.badRequest('Only published content can be rated', 'NOT_PUBLISHED');
  }

  const existingRating = await Rating.findOne({ user: user._id, targetType, targetId }).lean();

  let hasAttempted = false;
  let hasVoted = false;
  if (targetType === RATING_TARGETS.QUIZ) {
    hasAttempted = (await QuizAttempt.countDocuments({
      quiz: targetId,
      user: user._id,
      status: { $in: [ATTEMPT_STATUS.SUBMITTED, ATTEMPT_STATUS.COMPLETED, ATTEMPT_STATUS.REVIEW_PENDING] },
    })) > 0;
  } else {
    hasVoted = (await PollVote.countDocuments({ poll: targetId, user: user._id })) > 0;
  }

  const eligibility = ratingEligibility({
    user: { id: String(user._id), status: user.status },
    creatorId: target.creatorId,
    targetType,
    existingRating: Boolean(existingRating),
    hasAttempted,
    hasVoted,
  });
  if (!eligibility.allowed) {
    throw ApiError.forbidden(eligibility.reason, eligibility.reason);
  }

  const rating = await Rating.create({
    user: user._id,
    targetType,
    targetId,
    score,
    review,
  });

  await recomputeTargetRatings(targetType, targetId);
  await awardAchievement(user._id, 'FIRST_RATING');

  await notify({
    userId: target.creatorId,
    type: NOTIFICATION_TYPES.RATING_RECEIVED,
    title: `New ${score}-star rating on "${target.title}"`,
    body: review ? review.slice(0, 200) : 'A participant rated your content.',
    link: targetType === RATING_TARGETS.QUIZ ? `/quizzes/${target.slug}` : `/polls/${target.slug}`,
  });

  return rating;
}

export async function recomputeTargetRatings(targetType, targetId) {
  const rows = await Rating.find({ targetType, targetId, hidden: false }).select('score').lean();
  const agg = aggregateRatings(rows.map((r) => r.score));
  const Model = targetType === RATING_TARGETS.QUIZ ? Quiz : Poll;
  await Model.updateOne(
    { _id: targetId },
    {
      $set: {
        'stats.ratingCount': agg.count,
        'stats.ratingRawAvg': agg.rawAvg,
        'stats.ratingBayes': agg.bayesian,
      },
    }
  );
  return agg;
}

export async function listTargetRatings({ targetType, targetId, page = 1, limit = 20, user }) {
  const target = await loadTarget(targetType, targetId);
  const isOwner =
    user && target && (String(target.creatorId) === String(user._id) || user.role === 'ADMIN');

  const filter = { targetType, targetId, hidden: false };
  const [items, total] = await Promise.all([
    Rating.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name avatar')
      .lean(),
    Rating.countDocuments(filter),
  ]);

  const rows = await Rating.find({ targetType, targetId, hidden: false }).select('score').lean();
  const agg = aggregateRatings(rows.map((r) => r.score));

  return { items, total, summary: agg, isOwnerView: isOwner };
}

export async function listMyRatings({ user, page = 1, limit = 20 }) {
  const filter = { user: user._id };
  const [items, total] = await Promise.all([
    Rating.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Rating.countDocuments(filter),
  ]);
  return { items, total };
}

/** Ratings received on a creator's content (feedback workspace). */
export async function listCreatorFeedback({ user, page = 1, limit = 20 }) {
  const [quizzes, polls] = await Promise.all([
    Quiz.find({ creator: user._id }).select('_id title slug').lean(),
    Poll.find({ creator: user._id }).select('_id title slug').lean(),
  ]);
  const quizIds = quizzes.map((q) => q._id);
  const pollIds = polls.map((p) => p._id);

  const filter = {
    $or: [
      { targetType: RATING_TARGETS.QUIZ, targetId: { $in: quizIds } },
      { targetType: RATING_TARGETS.POLL, targetId: { $in: pollIds } },
    ],
  };

  const [items, total] = await Promise.all([
    Rating.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name avatar')
      .lean(),
    Rating.countDocuments(filter),
  ]);

  // Attach lightweight target labels for display.
  const labelMap = new Map();
  for (const q of quizzes) labelMap.set(String(q._id), { title: q.title, slug: q.slug });
  for (const p of polls) labelMap.set(String(p._id), { title: p.title, slug: p.slug });
  const decorated = items.map((r) => ({
    ...r,
    target: labelMap.get(String(r.targetId)) ?? null,
  }));

  return { items: decorated, total };
}

/** Creator reputation from eligible feedback only (real ratings). */
export async function getCreatorReputation(userId) {
  const [quizzes, polls, quizRatings, pollRatings, adminReviews] = await Promise.all([
    Quiz.countDocuments({ creator: userId, status: CONTENT_STATUS.APPROVED }),
    Poll.countDocuments({ creator: userId, status: CONTENT_STATUS.APPROVED }),
    Rating.find({
      targetType: RATING_TARGETS.QUIZ,
      hidden: false,
      targetId: { $in: (await Quiz.find({ creator: userId }).select('_id')).map((q) => q._id) },
    })
      .select('score')
      .lean(),
    Rating.find({
      targetType: RATING_TARGETS.POLL,
      hidden: false,
      targetId: { $in: (await Poll.find({ creator: userId }).select('_id')).map((p) => p._id) },
    })
      .select('score')
      .lean(),
    Quiz.find({ creator: userId, 'moderation.adminQualityRating': { $ne: null } })
      .select('moderation.adminQualityRating')
      .lean(),
  ]);

  return creatorReputation({
    communityRatings: [...quizRatings, ...pollRatings].map((r) => r.score),
    adminQualityRatings: adminReviews
      .map((q) => q.moderation?.adminQualityRating)
      .filter((v) => Number.isFinite(v)),
    publishedCount: quizzes + polls,
  });
}

export default {
  createRating,
  listTargetRatings,
  listMyRatings,
  listCreatorFeedback,
  getCreatorReputation,
  recomputeTargetRatings,
};
