import mongoose from 'mongoose';
import Quiz from '../models/Quiz.js';
import QuizVersion from '../models/QuizVersion.js';
import QuizAttempt from '../models/QuizAttempt.js';
import Rating from '../models/Rating.js';
import { ApiError } from '../utils/ApiError.js';
import { scoreAttempt, toParticipantQuestion, toSolutionQuestion } from '../utils/scoring.js';
import { quizRewardEligibility } from '../utils/walletRules.js';
import { chargeEntryFee, payReward } from './walletService.js';
import { awardAchievement } from './achievementService.js';
import { notify } from './notificationService.js';
import {
  ACTIVITY_TYPES,
  ATTEMPT_STATUS,
  CONTENT_STATUS,
  NOTIFICATION_TYPES,
} from '../constants/index.js';

/**
 * Quiz attempt lifecycle:
 *  START → charge entry fee (idempotent) → IN_PROGRESS
 *  SUBMIT (single atomic transition) → score server-side → rewards → results
 *
 * Duplicate submission protection: only an IN_PROGRESS attempt can transition to
 * SUBMITTED (atomic findOneAndUpdate guard), and the per-quiz attemptsAllowed
 * limit is checked at start time.
 */

export async function startAttempt({ quizId, user }) {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) throw ApiError.notFound('Quiz not found');
  if (quiz.status !== CONTENT_STATUS.APPROVED) {
    throw ApiError.badRequest('This quiz is not open for attempts', 'NOT_PUBLISHED');
  }

  const completedCount = await QuizAttempt.countDocuments({
    quiz: quiz._id,
    user: user._id,
    status: { $in: [ATTEMPT_STATUS.SUBMITTED, ATTEMPT_STATUS.COMPLETED, ATTEMPT_STATUS.REVIEW_PENDING] },
  });
  if (completedCount >= (quiz.attemptsAllowed ?? 1)) {
    throw ApiError.badRequest('You have used all attempts for this quiz', 'NO_ATTEMPTS_LEFT');
  }

  const inProgress = await QuizAttempt.findOne({ quiz: quiz._id, user: user._id, status: ATTEMPT_STATUS.IN_PROGRESS });
  if (inProgress) return hydrateAttempt(inProgress);

  const version = quiz.currentVersion
    ? await QuizVersion.findById(quiz.currentVersion).lean()
    : null;
  const questionsSource = version?.snapshot?.questions ?? quiz.questions;

  const attempt = await QuizAttempt.create({
    quiz: quiz._id,
    quizVersion: version?._id ?? quiz.currentVersion ?? quiz._id,
    versionNumber: version?.versionNumber ?? quiz.versionNumber,
    user: user._id,
    presentedQuestions: questionsSource.map(toParticipantQuestion),
    status: ATTEMPT_STATUS.IN_PROGRESS,
  });

  // Entry fee (if any) — idempotent per attempt.
  if (quiz.entryFee > 0) {
    await chargeEntryFee({
      userId: user._id,
      fee: quiz.entryFee,
      activityType: ACTIVITY_TYPES.QUIZ_ATTEMPT,
      activityId: attempt._id,
      idempotencyKey: `entry-fee:attempt:${attempt._id}`,
      metadata: { quizId: String(quiz._id), title: quiz.title },
    });
    attempt.entryFeeCharged = quiz.entryFee;
    attempt.entryFeeTxId = `entry-fee:attempt:${attempt._id}`;
    await attempt.save();
  }

  await Quiz.updateOne({ _id: quiz._id }, { $inc: { 'stats.attemptsCount': 1 } });
  await awardAchievement(user._id, 'FIRST_ATTEMPT');

  return hydrateAttempt(attempt);
}

async function hydrateAttempt(attempt) {
  return {
    id: String(attempt._id),
    quiz: String(attempt.quiz),
    status: attempt.status,
    startedAt: attempt.startedAt,
    questions: attempt.presentedQuestions ?? [],
    entryFeeCharged: attempt.entryFeeCharged ?? 0,
  };
}

export async function submitAttempt({ attemptId, user, answers = [], timeSpentSec = 0 }) {
  const attempt = await QuizAttempt.findById(attemptId);
  if (!attempt) throw ApiError.notFound('Attempt not found');
  if (String(attempt.user) !== String(user._id)) throw ApiError.forbidden('Not your attempt');
  if (attempt.status !== ATTEMPT_STATUS.IN_PROGRESS) {
    throw ApiError.conflict('This attempt has already been submitted', 'ALREADY_SUBMITTED');
  }

  const quiz = await Quiz.findById(attempt.quiz);
  const version = await QuizVersion.findById(attempt.quizVersion).lean();
  const questionsSource = version?.snapshot?.questions ?? quiz?.questions ?? [];

  const answersByQuestionId = {};
  for (const a of answers) answersByQuestionId[a.questionId] = a.value;

  // Scoring is a pure function — compute first, then persist with one atomic transition.
  const result = scoreAttempt(questionsSource, answersByQuestionId, {
    passingScore: version?.snapshot?.passingScore ?? quiz?.passingScore ?? 50,
  });

  const finalStatus = result.needsReview ? ATTEMPT_STATUS.REVIEW_PENDING : ATTEMPT_STATUS.SUBMITTED;

  // Duplicate-submit protection: only an IN_PROGRESS attempt may transition.
  const submitting = await QuizAttempt.findOneAndUpdate(
    { _id: attempt._id, status: ATTEMPT_STATUS.IN_PROGRESS },
    {
      $set: {
        answers: answers.map((a) => ({ questionId: a.questionId, value: a.value })),
        submittedAt: new Date(),
        timeSpentSec,
        score: result.score,
        maxScore: result.maxScore,
        percentage: result.percentage,
        passed: result.passed,
        needsReview: result.needsReview,
        questionResults: result.questionResults,
        status: finalStatus,
      },
    },
    { new: true }
  );
  if (!submitting) {
    throw ApiError.conflict('This attempt has already been submitted', 'ALREADY_SUBMITTED');
  }

  // Update quiz stats (running counters; authoritative values still derive from attempts).
  if (quiz) {
    const completedCount = await QuizAttempt.countDocuments({
      quiz: quiz._id,
      status: { $in: [ATTEMPT_STATUS.SUBMITTED, ATTEMPT_STATUS.COMPLETED, ATTEMPT_STATUS.REVIEW_PENDING] },
    });
    const passesCount = await QuizAttempt.countDocuments({ quiz: quiz._id, passed: true });
    const avg = await QuizAttempt.aggregate([
      { $match: { quiz: new mongoose.Types.ObjectId(String(quiz._id)), status: { $in: ['SUBMITTED', 'COMPLETED'] } } },
      { $group: { _id: null, avgScore: { $avg: '$percentage' } } },
    ]);
    quiz.stats.completionsCount = completedCount;
    quiz.stats.passesCount = passesCount;
    quiz.stats.avgScore = avg[0]?.avgScore ? Math.round(avg[0].avgScore * 100) / 100 : 0;
    await quiz.save();
  }

  // Rewards (idempotent).
  let rewardResult = null;
  if (quiz && quiz.reward > 0 && finalStatus === ATTEMPT_STATUS.SUBMITTED) {
    rewardResult = await settleAttemptReward({ attempt: submitting, quiz });
  }

  if (result.passed && quiz) {
    await awardAchievement(user._id, 'FIRST_PASS');
    const userPassCount = await QuizAttempt.countDocuments({ user: user._id, passed: true });
    if (userPassCount >= 10) await awardAchievement(user._id, 'TEN_ATTEMPTS');
  }

  await notify({
    userId: user._id,
    type: NOTIFICATION_TYPES.ATTEMPT_RESULT,
    title: result.needsReview
      ? 'Your attempt needs manual review'
      : result.passed
        ? `You passed "${quiz?.title ?? 'the quiz'}"`
        : `Attempt submitted for "${quiz?.title ?? 'the quiz'}"`,
    body: result.needsReview
      ? 'Some answers are being reviewed. Your result will appear once reviewed.'
      : `Score: ${result.percentage}%`,
    link: `/attempts/${submitting._id}`,
  });

  return buildAttemptResult({ attempt: submitting, quiz, version, questionsSource, rewardResult, includeSolutions: true });
}

/**
 * Reward settlement for a quiz attempt. Eligibility is computed with pure rules
 * (`quizRewardEligibility`) and payout is idempotent per attempt.
 */
export async function settleAttemptReward({ attempt, quiz }) {
  // Build a real leaderboard slice of verified scores for TOP_PERCENT mode.
  let leaderboard = null;
  if (quiz.rewardMode === 'TOP_PERCENT') {
    const rows = await QuizAttempt.find({
      quiz: quiz._id,
      status: { $in: [ATTEMPT_STATUS.SUBMITTED, ATTEMPT_STATUS.COMPLETED] },
      needsReview: false,
    })
      .sort({ percentage: -1 })
      .select('percentage')
      .lean();
    leaderboard = rows.map((r) => ({ attemptId: String(r._id), percentage: r.percentage }));
  }

  const eligibility = quizRewardEligibility({
    attempt: {
      id: String(attempt._id),
      passed: attempt.passed,
      needsReview: attempt.needsReview,
      suspicious: attempt.suspicious,
    },
    reward: quiz.reward,
    rewardMode: quiz.rewardMode,
    topPercent: quiz.topPercent,
    leaderboard,
  });

  if (!eligibility.eligible) return { ...eligibility, paid: 0 };

  if (quiz.maxRewardRecipients > 0) {
    const paidCount = await QuizAttempt.countDocuments({ quiz: quiz._id, rewardPaid: { $gt: 0 } });
    if (paidCount >= quiz.maxRewardRecipients) return { eligible: false, reason: 'REWARD_POOL_EXHAUSTED', paid: 0 };
  }

  const { alreadyApplied } = await payReward({
    userId: attempt.user,
    amount: quiz.reward,
    activityType: ACTIVITY_TYPES.QUIZ_ATTEMPT,
    activityId: attempt._id,
    idempotencyKey: `reward:attempt:${attempt._id}`,
    metadata: { quizId: String(quiz._id), title: quiz.title, reason: eligibility.reason },
  });

  if (!alreadyApplied) {
    attempt.rewardPaid = quiz.reward;
    attempt.rewardTxId = `reward:attempt:${attempt._id}`;
    await attempt.save();
    await Quiz.updateOne({ _id: quiz._id }, { $inc: { 'stats.totalRewardsPaid': quiz.reward } });
    await notify({
      userId: attempt.user,
      type: NOTIFICATION_TYPES.REWARD_CREDITED,
      title: `You earned ${quiz.reward} QCoins`,
      body: `Reward for completing "${quiz.title}".`,
      link: '/wallet',
    });
  }

  return { ...eligibility, paid: quiz.reward, alreadyApplied };
}

export function buildAttemptResult({ attempt, quiz, version, questionsSource, rewardResult = null, includeSolutions = true }) {
  return {
    id: String(attempt._id),
    quiz: quiz
      ? { id: String(quiz._id), title: quiz.title, slug: quiz.slug, passingScore: quiz.passingScore }
      : null,
    versionNumber: attempt.versionNumber,
    status: attempt.status,
    score: attempt.score,
    maxScore: attempt.maxScore,
    percentage: attempt.percentage,
    passed: attempt.passed,
    needsReview: attempt.needsReview,
    timeSpentSec: attempt.timeSpentSec,
    submittedAt: attempt.submittedAt,
    entryFeeCharged: attempt.entryFeeCharged ?? 0,
    rewardPaid: attempt.rewardPaid ?? 0,
    rewardInfo: rewardResult,
    questions: includeSolutions
      ? (questionsSource ?? []).map((q) => {
          const res = attempt.questionResults?.find((r) => r.questionId === q.id);
          return {
            ...toSolutionQuestion(q),
            yourAnswer: attempt.answers?.find((a) => a.questionId === q.id)?.value ?? null,
            awardedPoints: res?.awardedPoints ?? 0,
            correct: res?.correct ?? false,
            needsReview: res?.needsReview ?? false,
          };
        })
      : attempt.presentedQuestions ?? [],
  };
}

export async function getAttemptResult({ attemptId, user }) {
  const attempt = await QuizAttempt.findById(attemptId);
  if (!attempt) throw ApiError.notFound('Attempt not found');
  const isOwner = String(attempt.user) === String(user._id);
  if (!isOwner && user.role !== 'ADMIN') throw ApiError.forbidden('Not your attempt');
  if (attempt.status === ATTEMPT_STATUS.IN_PROGRESS) {
    throw ApiError.badRequest('Attempt is still in progress', 'IN_PROGRESS');
  }

  const quiz = await Quiz.findById(attempt.quiz).select('title slug passingScore reward');
  const version = await QuizVersion.findById(attempt.quizVersion).lean();
  const questionsSource = version?.snapshot?.questions ?? [];
  return buildAttemptResult({ attempt, quiz, version, questionsSource, includeSolutions: isOwner });
}

export async function listMyAttempts({ user, page = 1, limit = 20 }) {
  const filter = { user: user._id, status: { $ne: ATTEMPT_STATUS.IN_PROGRESS } };
  const [items, total] = await Promise.all([
    QuizAttempt.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-questionResults -presentedQuestions -answers')
      .populate('quiz', 'title slug difficulty')
      .lean(),
    QuizAttempt.countDocuments(filter),
  ]);
  return { items, total };
}

/** Drop stale in-progress attempts past the time limit (called by jobs). */
export async function abandonStaleAttempts({ olderThanMinutes = 24 * 60 } = {}) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
  const result = await QuizAttempt.updateMany(
    { status: ATTEMPT_STATUS.IN_PROGRESS, startedAt: { $lt: cutoff } },
    { $set: { status: ATTEMPT_STATUS.ABANDONED } }
  );
  return result.modifiedCount ?? 0;
}

export default {
  startAttempt,
  submitAttempt,
  getAttemptResult,
  listMyAttempts,
  settleAttemptReward,
  abandonStaleAttempts,
};
