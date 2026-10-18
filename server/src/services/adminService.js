import mongoose from 'mongoose';
import User from '../models/User.js';
import Quiz from '../models/Quiz.js';
import QuizVersion from '../models/QuizVersion.js';
import QuizAttempt from '../models/QuizAttempt.js';
import Poll from '../models/Poll.js';
import PollVote from '../models/PollVote.js';
import Rating from '../models/Rating.js';
import Report from '../models/Report.js';
import AdminReview from '../models/AdminReview.js';
import QCoinLedger from '../models/QCoinLedger.js';
import AuditLog from '../models/AuditLog.js';
import PlatformSetting, { SETTING_KEYS } from '../models/PlatformSetting.js';
import { ApiError } from '../utils/ApiError.js';
import { adminAdjust, payReward, refundEntryFee, reconcileWallet } from './walletService.js';
import { recomputeTargetRatings } from './ratingService.js';
import { refundPollFees } from './pollService.js';
import { audit } from './auditService.js';
import { notify } from './notificationService.js';
import {
  ACCOUNT_STATUS,
  ACTIVITY_TYPES,
  ADMIN_ACTIONS,
  CONTENT_STATUS,
  ECONOMY_LIMITS,
  NOTIFICATION_TYPES,
  REPORT_STATUS,
  ROLES,
  RATING_TARGETS,
  TX_TYPE,
} from '../constants/index.js';

/**
 * Admin workspace services: moderation, user management, QCoin administration,
 * platform configuration. Every sensitive action writes an audit-log entry and
 * never mutates historical ledger entries.
 */

// ── Overview metrics ─────────────────────────────────────────────────────────

export async function getOverviewMetrics() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    registeredUsers,
    activeUsers7d,
    approvedQuizzes,
    approvedPolls,
    pendingQuizzes,
    pendingPolls,
    openReports,
    ledgerTotals,
    pendingRefunds,
    recentReviews,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ lastActiveAt: { $gte: since7d } }),
    Quiz.countDocuments({ status: CONTENT_STATUS.APPROVED }),
    Poll.countDocuments({ status: CONTENT_STATUS.APPROVED }),
    Quiz.countDocuments({ status: CONTENT_STATUS.PENDING_REVIEW }),
    Poll.countDocuments({ status: CONTENT_STATUS.PENDING_REVIEW }),
    Report.countDocuments({ status: { $in: [REPORT_STATUS.OPEN, REPORT_STATUS.UNDER_REVIEW] } }),
    QCoinLedger.aggregate([
      {
        $group: {
          _id: null,
          issued: { $sum: { $cond: [{ $gt: ['$amount', 0] }, '$amount', 0] } },
          spent: { $sum: { $cond: [{ $lt: ['$amount', 0] }, { $abs: '$amount' }, 0] } },
          count: { $sum: 1 },
        },
      },
    ]),
    // Refunds are pending when a fee was charged and no refund exists for
    // abandoned attempts or cancelled content.
    QuizAttempt.countDocuments({
      entryFeeCharged: { $gt: 0 },
      refundTxId: null,
      status: 'ABANDONED',
    }),
    AdminReview.find({}).sort({ createdAt: -1 }).limit(8).populate('reviewer', 'name').lean(),
  ]);

  const totals = ledgerTotals[0] ?? { issued: 0, spent: 0, count: 0 };
  const attemptsLast24h = await QuizAttempt.countDocuments({ createdAt: { $gte: since24h } });
  const votesLast24h = await PollVote.countDocuments({ createdAt: { $gte: since24h } });

  return {
    users: {
      registered: registeredUsers,
      activeLast7Days: activeUsers7d,
    },
    content: {
      approvedQuizzes,
      approvedPolls,
      pendingQuizzes,
      pendingPolls,
    },
    moderation: {
      openReports,
      pendingRefunds,
    },
    qcoins: {
      totalIssued: totals.issued,
      totalSpent: totals.spent,
      transactionCount: totals.count,
    },
    activity24h: {
      attempts: attemptsLast24h,
      votes: votesLast24h,
    },
    recentModerationActions: recentReviews.map((r) => ({
      id: String(r._id),
      action: r.action,
      targetType: r.targetType,
      targetId: String(r.targetId),
      reviewer: r.reviewer?.name ?? 'Unknown',
      createdAt: r.createdAt,
      qualityRating: r.qualityRating,
    })),
  };
}

export async function getPlatformAnalytics() {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [usersByDay, attemptsByDay, votesByDay, txByDay, quizStatuses, pollStatuses] = await Promise.all([
    User.aggregate([
      { $match: { createdAt: { $gte: since30d } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    QuizAttempt.aggregate([
      { $match: { createdAt: { $gte: since30d } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 }, avgScore: { $avg: '$percentage' } } },
      { $sort: { _id: 1 } },
    ]),
    PollVote.aggregate([
      { $match: { createdAt: { $gte: since30d } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    QCoinLedger.aggregate([
      { $match: { createdAt: { $gte: since30d } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          credits: { $sum: { $cond: [{ $gt: ['$amount', 0] }, '$amount', 0] } },
          debits: { $sum: { $cond: [{ $lt: ['$amount', 0] }, { $abs: '$amount' }, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Quiz.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Poll.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  return {
    timeseries: { users: usersByDay, attempts: attemptsByDay, votes: votesByDay, transactions: txByDay },
    quizStatuses,
    pollStatuses,
  };
}

// ── Moderation ───────────────────────────────────────────────────────────────

export async function moderateContent({ targetType, targetId, action, notes, qualityRating, admin, req }) {
  const Model = targetType === RATING_TARGETS.QUIZ ? Quiz : Poll;
  const doc = await Model.findById(targetId);
  if (!doc) throw ApiError.notFound('Content not found');

  const now = new Date();
  let newStatus = doc.status;

  switch (action) {
    case ADMIN_ACTIONS.APPROVE:
      newStatus = CONTENT_STATUS.APPROVED;
      doc.publishedAt = doc.publishedAt ?? now;
      doc.unpublishedAt = undefined;
      break;
    case ADMIN_ACTIONS.REJECT:
      newStatus = CONTENT_STATUS.REJECTED;
      break;
    case ADMIN_ACTIONS.REQUEST_CHANGES:
      newStatus = CONTENT_STATUS.CHANGES_REQUESTED;
      doc.moderation.changesRequestedNote = notes ?? '';
      break;
    case ADMIN_ACTIONS.UNPUBLISH:
      newStatus = CONTENT_STATUS.UNPUBLISHED;
      doc.unpublishedAt = now;
      break;
    case ADMIN_ACTIONS.RESTORE:
      newStatus = CONTENT_STATUS.APPROVED;
      doc.publishedAt = doc.publishedAt ?? now;
      doc.unpublishedAt = undefined;
      break;
    case ADMIN_ACTIONS.QUALITY_RATE:
      break;
    default:
      throw ApiError.badRequest('Unknown moderation action', 'INVALID_ACTION');
  }

  if (action !== ADMIN_ACTIONS.QUALITY_RATE) doc.status = newStatus;
  doc.moderation.lastDecision = action;
  doc.moderation.lastNotes = notes ?? '';
  doc.moderation.lastReviewedAt = now;
  doc.moderation.lastReviewedBy = admin._id;
  if (qualityRating) doc.moderation.adminQualityRating = qualityRating;
  await doc.save();

  await AdminReview.create({
    reviewer: admin._id,
    targetType,
    targetId,
    versionNumber: doc.versionNumber ?? 1,
    action,
    notes: notes ?? '',
    qualityRating: qualityRating ?? null,
  });

  await audit({
    actor: admin._id,
    action: `MODERATION_${action}`,
    targetType,
    targetId,
    details: { notes, qualityRating, newStatus },
    req,
  });

  // Creator notifications for real outcomes.
  const notificationByAction = {
    [ADMIN_ACTIONS.APPROVE]: {
      type: NOTIFICATION_TYPES.CONTENT_APPROVED,
      title: `"${doc.title}" is now published`,
      body: notes || 'Your content was approved by a moderator.',
    },
    [ADMIN_ACTIONS.REJECT]: {
      type: NOTIFICATION_TYPES.CONTENT_REJECTED,
      title: `"${doc.title}" was rejected`,
      body: notes || 'A moderator rejected this submission.',
    },
    [ADMIN_ACTIONS.REQUEST_CHANGES]: {
      type: NOTIFICATION_TYPES.CHANGES_REQUESTED,
      title: `Changes requested for "${doc.title}"`,
      body: notes || 'A moderator requested changes before this can be published.',
    },
    [ADMIN_ACTIONS.UNPUBLISH]: {
      type: NOTIFICATION_TYPES.CONTENT_UNPUBLISHED,
      title: `"${doc.title}" was unpublished`,
      body: notes || 'A moderator unpublished this content.',
    },
    [ADMIN_ACTIONS.RESTORE]: {
      type: NOTIFICATION_TYPES.CONTENT_APPROVED,
      title: `"${doc.title}" was restored`,
      body: notes || 'A moderator restored this content.',
    },
    [ADMIN_ACTIONS.QUALITY_RATE]: null,
  };
  const n = notificationByAction[action];
  if (n) {
    await notify({
      userId: doc.creator,
      ...n,
      link: targetType === RATING_TARGETS.QUIZ ? `/quizzes/${doc.slug}` : `/polls/${doc.slug}`,
    });
  }

  // Refund entry fees when content is rejected/unpublished after fees were charged.
  if (action === ADMIN_ACTIONS.REJECT || action === ADMIN_ACTIONS.UNPUBLISH) {
    if (targetType === RATING_TARGETS.POLL) {
      await refundPollFees(doc._id, { reason: `Poll ${action.toLowerCase()} — entry fees refunded`, initiatedBy: admin._id });
    } else {
      const attempts = await QuizAttempt.find({ quiz: doc._id, entryFeeCharged: { $gt: 0 }, refundTxId: null });
      for (const attempt of attempts) {
        await refundEntryFee({
          userId: attempt.user,
          fee: attempt.entryFeeCharged,
          activityType: ACTIVITY_TYPES.QUIZ_ATTEMPT,
          activityId: attempt._id,
          idempotencyKey: `refund:attempt:${attempt._id}`,
          reason: `Content ${action.toLowerCase()} — entry fee refunded`,
          metadata: { admin: String(admin._id) },
        });
        attempt.refundTxId = `refund:attempt:${attempt._id}`;
        await attempt.save();
        await notify({
          userId: attempt.user,
          type: NOTIFICATION_TYPES.REFUND_PROCESSED,
          title: `Refund: ${attempt.entryFeeCharged} QCoins`,
          body: `Entry fee refunded because "${doc.title}" was ${action.toLowerCase()}.`,
          link: '/wallet',
        });
      }
    }
  }

  return doc;
}

export async function listModerationHistory({ page = 1, limit = 20, targetType }) {
  const filter = targetType ? { targetType } : {};
  const [items, total] = await Promise.all([
    AdminReview.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('reviewer', 'name email')
      .lean(),
    AdminReview.countDocuments(filter),
  ]);
  return { items, total };
}

export async function listQualityRatings({ page = 1, limit = 20 }) {
  const filter = { 'moderation.adminQualityRating': { $ne: null } };
  const [quizzes, polls, quizCount, pollCount] = await Promise.all([
    Quiz.find(filter)
      .select('title slug creator moderation.adminQualityRating moderation.lastReviewedAt')
      .populate('creator', 'name')
      .sort({ 'moderation.lastReviewedAt': -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Poll.find(filter)
      .select('title slug creator moderation.adminQualityRating moderation.lastReviewedAt')
      .populate('creator', 'name')
      .sort({ 'moderation.lastReviewedAt': -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Quiz.countDocuments(filter),
    Poll.countDocuments(filter),
  ]);

  const items = [
    ...quizzes.map((q) => ({ targetType: 'QUIZ', ...q })),
    ...polls.map((p) => ({ targetType: 'POLL', ...p })),
  ].sort((a, b) => new Date(b.moderation?.lastReviewedAt ?? 0) - new Date(a.moderation?.lastReviewedAt ?? 0));

  return { items: items.slice(0, limit), total: quizCount + pollCount };
}

// ── User management ──────────────────────────────────────────────────────────

export async function listUsers({ page = 1, limit = 20, search, role, status, sort = 'newest' }) {
  const filter = {};
  if (search) {
    filter.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
  }
  if (role) filter.role = role;
  if (status) filter.status = status;

  const sortMap = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    active: { lastActiveAt: -1 },
    balance: { 'wallet.balance': -1 },
  };

  const [items, total] = await Promise.all([
    User.find(filter)
      .sort(sortMap[sort] ?? sortMap.newest)
      .skip((page - 1) * limit)
      .limit(limit)
      .select('name email role status avatar wallet createdAt lastActiveAt suspendedAt suspendedReason')
      .lean(),
    User.countDocuments(filter),
  ]);
  return { items, total };
}

export async function getUserDetail(userId) {
  const user = await User.findById(userId).select('-passwordHash');
  if (!user) throw ApiError.notFound('User not found');

  const [quizzes, polls, attempts, votes, reports, transactions, reconciliation] = await Promise.all([
    Quiz.countDocuments({ creator: user._id }),
    Poll.countDocuments({ creator: user._id }),
    QuizAttempt.countDocuments({ user: user._id }),
    PollVote.countDocuments({ user: user._id }),
    Report.find({ $or: [{ reporter: user._id }, { targetType: 'USER', targetId: user._id }] })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    QCoinLedger.find({ user: user._id }).sort({ createdAt: -1 }).limit(20).lean(),
    reconcileWallet(user._id),
  ]);

  return {
    user,
    activity: { quizzes, polls, attempts, votes },
    reports,
    recentTransactions: transactions,
    reconciliation,
  };
}

export async function manageUser({ admin, targetUserId, action, role, reason, amount, req }) {
  const user = await User.findById(targetUserId);
  if (!user) throw ApiError.notFound('User not found');

  let details = {};
  switch (action) {
    case 'SUSPEND': {
      if (String(user._id) === String(admin._id)) throw ApiError.badRequest('You cannot suspend yourself', 'SELF_ACTION');
      if (user.role === ROLES.ADMIN) throw ApiError.forbidden('Cannot suspend another admin', 'PROTECTED_USER');
      user.status = ACCOUNT_STATUS.SUSPENDED;
      user.suspendedAt = new Date();
      user.suspendedReason = reason ?? '';
      await user.save();
      details = { status: user.status, reason };
      await notify({
        userId: user._id,
        type: NOTIFICATION_TYPES.ACCOUNT,
        title: 'Your account was suspended',
        body: reason || 'Contact support for more information.',
        link: '/help',
      });
      break;
    }
    case 'RESTORE': {
      user.status = ACCOUNT_STATUS.ACTIVE;
      user.suspendedAt = undefined;
      user.suspendedReason = '';
      await user.save();
      details = { status: user.status };
      await notify({
        userId: user._id,
        type: NOTIFICATION_TYPES.ACCOUNT,
        title: 'Your account was restored',
        body: 'You can sign in and use QuizSphere again.',
        link: '/dashboard',
      });
      break;
    }
    case 'SET_ROLE': {
      if (!role) throw ApiError.badRequest('Role is required', 'VALIDATION_ERROR');
      if (String(user._id) === String(admin._id) && role !== ROLES.ADMIN) {
        throw ApiError.badRequest('You cannot demote yourself', 'SELF_ACTION');
      }
      user.role = role;
      await user.save();
      details = { role };
      break;
    }
    case 'ADJUST_COINS': {
      if (!Number.isInteger(amount) || amount === 0) {
        throw ApiError.badRequest('A non-zero integer amount is required', 'INVALID_AMOUNT');
      }
      if (!reason || reason.trim().length < 3) {
        throw ApiError.badRequest('An adjustment reason is mandatory', 'REASON_REQUIRED');
      }
      const result = await adminAdjust({
        userId: user._id,
        amount,
        reason,
        performedBy: admin._id,
        idempotencyKey: `adjustment:${user._id}:${Date.now()}`,
      });
      details = { amount, reason, txId: result.ledger?.txId, balance: result.balance };
      await notify({
        userId: user._id,
        type: NOTIFICATION_TYPES.ACCOUNT,
        title: `QCoin adjustment: ${amount > 0 ? '+' : ''}${amount}`,
        body: reason,
        link: '/wallet',
      });
      break;
    }
    default:
      throw ApiError.badRequest('Unknown action', 'INVALID_ACTION');
  }

  await audit({
    actor: admin._id,
    action: `USER_${action}`,
    targetType: 'USER',
    targetId: user._id,
    details,
    req,
  });

  return { user: await User.findById(user._id).select('-passwordHash'), details };
}

// ── QCoin administration ─────────────────────────────────────────────────────

export async function listLedger({ page = 1, limit = 20, userId, type, minAmount }) {
  const filter = {};
  if (userId) filter.user = userId;
  if (type) filter.type = type;
  if (Number.isFinite(minAmount)) filter.amount = { $gte: minAmount };

  const [items, total] = await Promise.all([
    QCoinLedger.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name email')
      .populate('performedBy', 'name email')
      .lean(),
    QCoinLedger.countDocuments(filter),
  ]);
  return { items, total };
}

/**
 * Suspicious-transaction heuristics — flagging only; every flagged row is a
 * real ledger entry, and nothing is modified automatically.
 */
export async function findSuspiciousTransactions({ page = 1, limit = 20 }) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // 1) Many reward claims in a short window (possible reward farming).
  const farming = await QCoinLedger.aggregate([
    { $match: { type: TX_TYPE.REWARD, createdAt: { $gte: since24h } } },
    { $group: { _id: '$user', rewardCount: { $sum: 1 }, total: { $sum: '$amount' } } },
    { $match: { rewardCount: { $gte: 5 } } },
    { $sort: { rewardCount: -1 } },
    { $skip: (page - 1) * limit },
    { $limit: limit },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    { $project: { 'user.name': 1, 'user.email': 1, rewardCount: 1, total: 1 } },
  ]);

  // 2) Large absolute adjustments (manual interventions worth reviewing).
  const largeAdjustments = await QCoinLedger.find({
    type: TX_TYPE.ADJUSTMENT,
    $or: [{ amount: { $gte: 500 } }, { amount: { $lte: -500 } }],
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('user', 'name email')
    .populate('performedBy', 'name email')
    .lean();

  const total = farming.length + largeAdjustments.length;
  return {
    items: {
      rewardFarming: farming.map((f) => ({
        user: f.user ? { name: f.user.name, email: f.user.email } : null,
        rewardCount: f.rewardCount,
        totalRewarded: f.total,
        window: '24h',
      })),
      largeAdjustments: largeAdjustments.map((t) => ({
        txId: t.txId,
        user: t.user ? { name: t.user.name, email: t.user.email } : null,
        amount: t.amount,
        reason: t.reason,
        performedBy: t.performedBy ? { name: t.performedBy.name, email: t.performedBy.email } : null,
        createdAt: t.createdAt,
      })),
    },
    total,
  };
}

/** Refund requests: abandoned attempts and cancelled content with charged fees. */
export async function listRefundRequests({ page = 1, limit = 20 }) {
  const abandoned = await QuizAttempt.find({
    entryFeeCharged: { $gt: 0 },
    refundTxId: null,
    status: 'ABANDONED',
  })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('user', 'name email')
    .populate('quiz', 'title slug')
    .lean();

  const cancelledPollVotes = await PollVote.find({
    entryFeeCharged: { $gt: 0 },
    refundTxId: null,
    poll: {
      $in: (await Poll.find({ cancelledAt: { $ne: null } }).select('_id')).map((p) => p._id),
    },
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('user', 'name email')
    .populate('poll', 'title slug')
    .lean();

  const total =
    (await QuizAttempt.countDocuments({ entryFeeCharged: { $gt: 0 }, refundTxId: null, status: 'ABANDONED' })) +
    cancelledPollVotes.length;

  return {
    items: [
      ...abandoned.map((a) => ({
        kind: 'QUIZ_ATTEMPT',
        id: String(a._id),
        user: a.user,
        activity: a.quiz ? { title: a.quiz.title, slug: a.quiz.slug } : null,
        amount: a.entryFeeCharged,
        reason: 'Attempt abandoned before submission',
        createdAt: a.createdAt,
      })),
      ...cancelledPollVotes.map((v) => ({
        kind: 'POLL_VOTE',
        id: String(v._id),
        user: v.user,
        activity: v.poll ? { title: v.poll.title, slug: v.poll.slug } : null,
        amount: v.entryFeeCharged,
        reason: 'Poll cancelled',
        createdAt: v.createdAt,
      })),
    ],
    total,
  };
}

export async function processRefund({ admin, kind, id, approve, reason, req }) {
  if (kind === 'QUIZ_ATTEMPT') {
    const attempt = await QuizAttempt.findById(id);
    if (!attempt) throw ApiError.notFound('Attempt not found');
    if (!attempt.entryFeeCharged || attempt.refundTxId) {
      throw ApiError.badRequest('This attempt has no refundable entry fee', 'NOT_REFUNDABLE');
    }
    if (approve) {
      await refundEntryFee({
        userId: attempt.user,
        fee: attempt.entryFeeCharged,
        activityType: ACTIVITY_TYPES.QUIZ_ATTEMPT,
        activityId: attempt._id,
        idempotencyKey: `refund:attempt:${attempt._id}`,
        reason,
        metadata: { admin: String(admin._id) },
      });
      attempt.refundTxId = `refund:attempt:${attempt._id}`;
      await attempt.save();
      await notify({
        userId: attempt.user,
        type: NOTIFICATION_TYPES.REFUND_PROCESSED,
        title: `Refund: ${attempt.entryFeeCharged} QCoins`,
        body: reason,
        link: '/wallet',
      });
    }
    await audit({
      actor: admin._id,
      action: approve ? 'REFUND_APPROVED' : 'REFUND_DENIED',
      targetType: 'QUIZ_ATTEMPT',
      targetId: attempt._id,
      details: { reason, amount: attempt.entryFeeCharged },
      req,
    });
    return { approved: approve, attemptId: String(attempt._id) };
  }

  if (kind === 'POLL_VOTE') {
    const vote = await PollVote.findById(id);
    if (!vote) throw ApiError.notFound('Vote not found');
    if (!vote.entryFeeCharged || vote.refundTxId) {
      throw ApiError.badRequest('This vote has no refundable entry fee', 'NOT_REFUNDABLE');
    }
    if (approve) {
      await refundEntryFee({
        userId: vote.user,
        fee: vote.entryFeeCharged,
        activityType: ACTIVITY_TYPES.POLL_VOTE,
        activityId: vote._id,
        idempotencyKey: `refund:vote:${vote._id}`,
        reason,
        metadata: { admin: String(admin._id) },
      });
      vote.refundTxId = `refund:vote:${vote._id}`;
      await vote.save();
      await notify({
        userId: vote.user,
        type: NOTIFICATION_TYPES.REFUND_PROCESSED,
        title: `Refund: ${vote.entryFeeCharged} QCoins`,
        body: reason,
        link: '/wallet',
      });
    }
    await audit({
      actor: admin._id,
      action: approve ? 'REFUND_APPROVED' : 'REFUND_DENIED',
      targetType: 'POLL_VOTE',
      targetId: vote._id,
      details: { reason, amount: vote.entryFeeCharged },
      req,
    });
    return { approved: approve, voteId: String(vote._id) };
  }

  throw ApiError.badRequest('Unknown refund kind', 'INVALID_KIND');
}

// ── Reports ──────────────────────────────────────────────────────────────────

export async function listReports({ page = 1, limit = 20, status, targetType }) {
  const filter = {};
  if (status) filter.status = status;
  if (targetType) filter.targetType = targetType;

  const [items, total] = await Promise.all([
    Report.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('reporter', 'name email')
      .populate('handledBy', 'name')
      .lean(),
    Report.countDocuments(filter),
  ]);
  return { items, total };
}

export async function resolveReport({ admin, reportId, status, resolution, req }) {
  const report = await Report.findById(reportId);
  if (!report) throw ApiError.notFound('Report not found');
  report.status = status;
  report.resolution = resolution ?? '';
  report.handledBy = admin._id;
  report.handledAt = new Date();
  await report.save();

  await audit({
    actor: admin._id,
    action: 'REPORT_RESOLVED',
    targetType: report.targetType,
    targetId: report.targetId,
    details: { reportId: String(report._id), status, resolution },
    req,
  });

  await notify({
    userId: report.reporter,
    type: NOTIFICATION_TYPES.REPORT_UPDATE,
    title: 'Your report was reviewed',
    body: resolution || `Status: ${status}`,
    link: '/help',
  });

  return report;
}

// ── Platform settings ────────────────────────────────────────────────────────

export async function getSetting(key, fallback = null) {
  const doc = await PlatformSetting.findOne({ key }).lean();
  return doc ? doc.value : fallback;
}

export async function upsertSetting({ admin, key, value, description = '', req }) {
  const doc = await PlatformSetting.findOneAndUpdate(
    { key },
    { $set: { value, description, updatedBy: admin._id } },
    { new: true, upsert: true }
  );
  await audit({
    actor: admin._id,
    action: 'SETTING_UPDATED',
    targetType: 'PLATFORM_SETTING',
    targetId: key,
    details: { value },
    req,
  });
  return doc;
}

export async function listSettings() {
  const docs = await PlatformSetting.find({}).sort({ key: 1 }).lean();
  return {
    items: docs,
    defaults: {
      [SETTING_KEYS.ECONOMY_LIMITS]: ECONOMY_LIMITS,
    },
    keys: SETTING_KEYS,
  };
}

/** System diagnostics: connectivity + collection counts (real values only). */
export async function getDiagnostics() {
  const connection = mongoose.connection;
  const collections = await connection.db?.collections?.().catch?.(() => []) ?? [];
  const counts = {};
  for (const coll of collections) {
    try {
      counts[coll.collectionName] = await coll.countDocuments();
    } catch {
      counts[coll.collectionName] = null;
    }
  }
  return {
    database: {
      readyState: connection.readyState,
      name: connection.name,
      host: connection.host,
    },
    node: {
      version: process.version,
      uptimeSec: Math.round(process.uptime()),
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
    collections: counts,
  };
}

export default {
  getOverviewMetrics,
  getPlatformAnalytics,
  moderateContent,
  listModerationHistory,
  listQualityRatings,
  listUsers,
  getUserDetail,
  manageUser,
  listLedger,
  findSuspiciousTransactions,
  listRefundRequests,
  processRefund,
  listReports,
  resolveReport,
  getSetting,
  upsertSetting,
  listSettings,
  getDiagnostics,
};
