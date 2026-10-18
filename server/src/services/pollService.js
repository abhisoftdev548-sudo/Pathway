import Poll from '../models/Poll.js';
import PollVote from '../models/PollVote.js';
import Rating from '../models/Rating.js';
import { ApiError } from '../utils/ApiError.js';
import { uniqueSlug } from '../utils/crypto.js';
import { validateEconomyConfig, pollRewardEligibility } from '../utils/walletRules.js';
import { chargeEntryFee, payReward, refundEntryFee } from './walletService.js';
import { notifyMany, notify } from './notificationService.js';
import { awardAchievement } from './achievementService.js';
import { destroyImage } from '../config/cloudinary.js';
import {
  ACTIVITY_TYPES,
  CONTENT_STATUS,
  NOTIFICATION_TYPES,
  POLL_REWARD_MODES,
  RESULTS_VISIBILITY,
  VOTING_TYPE,
} from '../constants/index.js';

function assertEconomy(input) {
  const problems = validateEconomyConfig({
    entryFee: input.entryFee ?? 0,
    reward: input.reward ?? 0,
    rewardMode: input.rewardMode,
    maxRewardRecipients: input.maxRewardRecipients > 0 ? input.maxRewardRecipients : undefined,
  });
  if (problems.length > 0) throw ApiError.badRequest(problems[0], 'ECONOMY_CONFIG_INVALID', problems);
}

export async function createPoll({ creator, input }) {
  assertEconomy(input);
  return Poll.create({
    ...input,
    slug: uniqueSlug(input.title),
    creator,
    status: CONTENT_STATUS.DRAFT,
    revisionHistory: [{ note: 'Draft created', changedAt: new Date(), changedBy: creator }],
  });
}

export async function updatePoll({ pollId, user, input }) {
  const poll = await Poll.findById(pollId);
  if (!poll) throw ApiError.notFound('Poll not found');
  if (String(poll.creator) !== String(user._id) && user.role !== 'ADMIN') {
    throw ApiError.forbidden('Not your poll');
  }
  if (
    ![CONTENT_STATUS.DRAFT, CONTENT_STATUS.CHANGES_REQUESTED].includes(poll.status) &&
    user.role !== 'ADMIN'
  ) {
    throw ApiError.badRequest(`Cannot edit a poll in ${poll.status} status`, 'NOT_EDITABLE');
  }
  if (input.entryFee !== undefined || input.reward !== undefined) {
    assertEconomy({
      entryFee: input.entryFee ?? poll.entryFee,
      reward: input.reward ?? poll.reward,
      rewardMode: input.rewardMode ?? poll.rewardMode,
      maxRewardRecipients: input.maxRewardRecipients ?? poll.maxRewardRecipients,
    });
  }

  Object.assign(poll, input);
  poll.revisionHistory.push({ note: 'Draft updated', changedAt: new Date(), changedBy: user._id });
  await poll.save();
  return poll;
}

export async function submitPollForReview({ pollId, user, changeNote = '' }) {
  const poll = await Poll.findById(pollId);
  if (!poll) throw ApiError.notFound('Poll not found');
  if (String(poll.creator) !== String(user._id) && user.role !== 'ADMIN') {
    throw ApiError.forbidden('Not your poll');
  }
  if (![CONTENT_STATUS.DRAFT, CONTENT_STATUS.CHANGES_REQUESTED].includes(poll.status)) {
    throw ApiError.badRequest(`Cannot submit a poll in ${poll.status} status`, 'INVALID_STATUS');
  }
  if (poll.options.length < 2) {
    throw ApiError.badRequest('A poll needs at least two options', 'NO_OPTIONS');
  }
  if (poll.endsAt <= new Date()) {
    throw ApiError.badRequest('Poll end time must be in the future', 'INVALID_END_DATE');
  }
  assertEconomy(poll);

  poll.status = CONTENT_STATUS.PENDING_REVIEW;
  poll.moderation.changesRequestedNote = '';
  poll.revisionHistory.push({ note: changeNote || 'Submitted for review', changedAt: new Date(), changedBy: user._id });
  await poll.save();
  return poll;
}

export async function deletePoll({ pollId, user }) {
  const poll = await Poll.findById(pollId);
  if (!poll) throw ApiError.notFound('Poll not found');
  if (String(poll.creator) !== String(user._id) && user.role !== 'ADMIN') {
    throw ApiError.forbidden('Not your poll');
  }

  const hasVotes = (await PollVote.countDocuments({ poll: poll._id })) > 0;
  if (hasVotes && user.role !== 'ADMIN') {
    poll.status = CONTENT_STATUS.ARCHIVED;
    poll.unpublishedAt = new Date();
    await poll.save();
    return { archived: true };
  }

  if (poll.cover?.publicId) await destroyImage(poll.cover.publicId);
  await Promise.all([
    PollVote.deleteMany({ poll: poll._id }),
    Rating.deleteMany({ targetType: 'POLL', targetId: poll._id }),
    Poll.deleteOne({ _id: poll._id }),
  ]);
  return { archived: false };
}

export async function listPublishedPolls({ page = 1, limit = 20, search, category, tag, sort = 'newest' }) {
  const filter = { status: CONTENT_STATUS.APPROVED };
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { question: { $regex: search, $options: 'i' } },
      { tags: { $regex: search, $options: 'i' } },
    ];
  }
  if (category) filter.$or = [{ category }, { subcategory: category }];
  if (tag) filter.tags = tag;

  const sortMap = {
    newest: { publishedAt: -1 },
    endingSoon: { endsAt: 1 },
    popular: { 'stats.uniqueVoters': -1, publishedAt: -1 },
  };

  const [items, total] = await Promise.all([
    Poll.find(filter)
      .sort(sortMap[sort] ?? sortMap.newest)
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-revisionHistory')
      .populate('category', 'name slug')
      .populate('creator', 'name avatar')
      .lean(),
    Poll.countDocuments(filter),
  ]);
  return { items, total };
}

export async function listMyPolls({ user, page = 1, limit = 20, status }) {
  const filter = { creator: user._id };
  if (status) filter.status = status;
  const [items, total] = await Promise.all([
    Poll.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Poll.countDocuments(filter),
  ]);
  return { items, total };
}

/**
 * Poll detail with tallied results. Anonymous polls never expose voter identity.
 * Result visibility is enforced server-side per the poll's settings.
 */
export async function getPollDetail({ slugOrId, user }) {
  const or = [{ slug: String(slugOrId).toLowerCase() }];
  if (/^[0-9a-fA-F]{24}$/.test(String(slugOrId))) or.push({ _id: slugOrId });

  const poll = await Poll.findOne({ $or: or })
    .populate('category', 'name slug')
    .populate('creator', 'name avatar bio')
    .lean();
  if (!poll) throw ApiError.notFound('Poll not found');

  const isOwner = user && (String(poll.creator?._id ?? poll.creator) === String(user._id) || user.role === 'ADMIN');
  if (!isOwner && poll.status !== CONTENT_STATUS.APPROVED) {
    throw ApiError.notFound('Poll is not published');
  }

  const now = new Date();
  const isClosed = poll.endsAt <= now || Boolean(poll.cancelledAt);

  const myVote = user
    ? await PollVote.findOne({ poll: poll._id, user: user._id }).select('optionIds votedAt').lean()
    : null;

  // Tallies — real counts from vote documents.
  const tally = Object.fromEntries(poll.options.map((o) => [o.id, 0]));
  let totalSelections = 0;
  const votes = await PollVote.find({ poll: poll._id }).select('optionIds user').lean();
  for (const vote of votes) {
    for (const optionId of vote.optionIds ?? []) {
      if (optionId in tally) {
        tally[optionId] += 1;
        totalSelections += 1;
      }
    }
  }

  const canSeeResults =
    isOwner ||
    poll.resultsVisibility === RESULTS_VISIBILITY.PUBLIC ||
    (poll.resultsVisibility === RESULTS_VISIBILITY.AFTER_VOTE && Boolean(myVote)) ||
    (poll.resultsVisibility === RESULTS_VISIBILITY.AFTER_END && isClosed);

  // Anonymous polls never reveal voter identity; non-anonymous polls expose
  // voters only to the poll creator (for accountability), never publicly.
  let voters = [];
  if (isOwner && !poll.anonymous) {
    const voterDocs = await PollVote.find({ poll: poll._id })
      .select('user optionIds votedAt')
      .populate('user', 'name avatar')
      .lean();
    voters = voterDocs.map((v) => ({
      user: v.user,
      optionIds: v.optionIds,
      votedAt: v.votedAt,
    }));
  }

  return {
    poll,
    isClosed,
    hasVoted: Boolean(myVote),
    myVote: myVote ? { optionIds: myVote.optionIds, votedAt: myVote.votedAt } : null,
    voterCount: votes.length,
    results: canSeeResults ? { tally, totalSelections, options: poll.options } : null,
    voters: poll.anonymous ? [] : voters,
  };
}

export async function castVote({ pollId, user, optionIds }) {
  const poll = await Poll.findById(pollId);
  if (!poll) throw ApiError.notFound('Poll not found');
  if (poll.status !== CONTENT_STATUS.APPROVED) {
    throw ApiError.badRequest('This poll is not open for voting', 'NOT_PUBLISHED');
  }

  const now = new Date();
  if (poll.startsAt && poll.startsAt > now) {
    throw ApiError.badRequest('Voting has not started yet', 'POLL_NOT_STARTED');
  }
  if (poll.endsAt <= now) {
    throw ApiError.badRequest('Voting has ended', 'POLL_ENDED');
  }
  if (poll.cancelledAt) {
    throw ApiError.badRequest('This poll was cancelled', 'POLL_CANCELLED');
  }

  const validIds = new Set(poll.options.map((o) => o.id));
  for (const id of optionIds) {
    if (!validIds.has(id)) throw ApiError.badRequest('Invalid poll option', 'INVALID_OPTION');
  }
  if (poll.votingType === VOTING_TYPE.SINGLE && optionIds.length !== 1) {
    throw ApiError.badRequest('This poll accepts exactly one option', 'SINGLE_CHOICE_ONLY');
  }

  // Duplicate voting protection: unique index + explicit check.
  const existing = await PollVote.findOne({ poll: poll._id, user: user._id });
  if (existing) throw ApiError.conflict('You have already voted in this poll', 'ALREADY_VOTED');

  let vote;
  try {
    vote = await PollVote.create({
      poll: poll._id,
      user: user._id,
      optionIds,
    });
  } catch (err) {
    if (err?.code === 11000) throw ApiError.conflict('You have already voted in this poll', 'ALREADY_VOTED');
    throw err;
  }

  // Entry fee (idempotent).
  if (poll.entryFee > 0) {
    await chargeEntryFee({
      userId: user._id,
      fee: poll.entryFee,
      activityType: ACTIVITY_TYPES.POLL_VOTE,
      activityId: vote._id,
      idempotencyKey: `entry-fee:vote:${vote._id}`,
      metadata: { pollId: String(poll._id), title: poll.title },
    });
    vote.entryFeeCharged = poll.entryFee;
    vote.entryFeeTxId = `entry-fee:vote:${vote._id}`;
    await vote.save();
  }

  // Rewards are participation-based (never option-based — opinion polls have no correct answer).
  let rewardResult = null;
  if (poll.reward > 0) {
    rewardResult = await settleVoteReward({ vote, poll });
  }

  await Poll.updateOne(
    { _id: poll._id },
    { $inc: { 'stats.votesCount': 1, 'stats.uniqueVoters': 1, 'stats.totalSelections': optionIds.length } }
  );

  await awardAchievement(user._id, 'FIRST_VOTE');

  return {
    voteId: String(vote._id),
    optionIds: vote.optionIds,
    rewardInfo: rewardResult,
  };
}

export async function settleVoteReward({ vote, poll }) {
  // Arrival order among voters for FIRST_N mode.
  const priorCount = await PollVote.countDocuments({ poll: poll._id, createdAt: { $lt: vote.createdAt ?? new Date() } });

  const eligibility = pollRewardEligibility({
    vote: { id: String(vote._id), suspicious: vote.suspicious },
    reward: poll.reward,
    rewardMode: poll.rewardMode,
    maxRewardRecipients: poll.maxRewardRecipients > 0 ? poll.maxRewardRecipients : null,
    participantRank: priorCount,
    // RANDOM_DRAW settles when the poll ends (see settlePollDraw) — not at vote time.
    drawWinners: poll.rewardMode === POLL_REWARD_MODES.RANDOM_DRAW ? new Set() : null,
  });

  if (!eligibility.eligible) return { ...eligibility, paid: 0 };

  const { alreadyApplied } = await payReward({
    userId: vote.user,
    amount: poll.reward,
    activityType: ACTIVITY_TYPES.POLL_VOTE,
    activityId: vote._id,
    idempotencyKey: `reward:vote:${vote._id}`,
    metadata: { pollId: String(poll._id), title: poll.title, reason: eligibility.reason },
  });

  if (!alreadyApplied) {
    vote.rewardPaid = poll.reward;
    vote.rewardTxId = `reward:vote:${vote._id}`;
    await vote.save();
    await Poll.updateOne({ _id: poll._id }, { $inc: { 'stats.totalRewardsPaid': poll.reward } });
    await notify({
      userId: vote.user,
      type: NOTIFICATION_TYPES.REWARD_CREDITED,
      title: `You earned ${poll.reward} QCoins`,
      body: `Reward for participating in "${poll.title}".`,
      link: '/wallet',
    });
  }

  return { ...eligibility, paid: poll.reward, alreadyApplied };
}

/**
 * Settle RANDOM_DRAW poll rewards when a poll ends. Winners are picked from real
 * vote documents with crypto-random selection; payouts stay idempotent.
 */
export async function settlePollDraw(poll) {
  if (poll.reward <= 0 || poll.rewardMode !== POLL_REWARD_MODES.RANDOM_DRAW) return { winners: 0 };
  const votes = await PollVote.find({ poll: poll._id }).select('_id').lean();
  if (votes.length === 0) return { winners: 0 };

  const cap = poll.maxRewardRecipients > 0 ? poll.maxRewardRecipients : Math.min(votes.length, 10);
  const shuffled = [...votes].sort(() => Math.random() - 0.5);
  const winners = shuffled.slice(0, Math.min(cap, votes.length));

  let paid = 0;
  for (const winner of winners) {
    const vote = await PollVote.findById(winner._id);
    if (!vote) continue;
    const { alreadyApplied } = await payReward({
      userId: vote.user,
      amount: poll.reward,
      activityType: ACTIVITY_TYPES.POLL_VOTE,
      activityId: vote._id,
      idempotencyKey: `reward:vote:${vote._id}`,
      metadata: { pollId: String(poll._id), title: poll.title, reason: 'RANDOM_DRAW' },
    });
    if (!alreadyApplied) {
      vote.rewardPaid = poll.reward;
      vote.rewardTxId = `reward:vote:${vote._id}`;
      await vote.save();
      paid += 1;
    }
  }
  return { winners: paid };
}

/**
 * Refund all entry fees of a cancelled poll (admin/creator action).
 * Idempotent per vote; documented refund rule.
 */
export async function refundPollFees(pollId, { reason = 'Poll cancelled', initiatedBy = null } = {}) {
  const votes = await PollVote.find({ poll: pollId, entryFeeCharged: { $gt: 0 }, refundTxId: null });
  let refunded = 0;
  for (const vote of votes) {
    await refundEntryFee({
      userId: vote.user,
      fee: vote.entryFeeCharged,
      activityType: ACTIVITY_TYPES.POLL_VOTE,
      activityId: vote._id,
      idempotencyKey: `refund:vote:${vote._id}`,
      reason,
      metadata: { initiatedBy: initiatedBy ? String(initiatedBy) : null },
    });
    vote.refundTxId = `refund:vote:${vote._id}`;
    await vote.save();
    refunded += 1;
    await notify({
      userId: vote.user,
      type: NOTIFICATION_TYPES.REFUND_PROCESSED,
      title: `Refund: ${vote.entryFeeCharged} QCoins`,
      body: reason,
      link: '/wallet',
    });
  }
  return { refunded };
}

/** Notify voters that a poll has ended (real participants only). */
export async function announcePollEnded(poll) {
  const votes = await PollVote.find({ poll: poll._id }).select('user').lean();
  await notifyMany(
    votes.map((v) => v.user),
    {
      type: NOTIFICATION_TYPES.POLL_ENDED,
      title: `"${poll.title}" has ended`,
      body: 'Results are available.',
      link: `/polls/${poll.slug}`,
    }
  );
  return votes.length;
}

export default {
  createPoll,
  updatePoll,
  submitPollForReview,
  deletePoll,
  listPublishedPolls,
  listMyPolls,
  getPollDetail,
  castVote,
  settlePollDraw,
  refundPollFees,
  announcePollEnded,
};
