/**
 * QCoin economy rules — pure functions (no I/O), unit-tested.
 *
 * The four supported funding configurations are expressed purely through
 * `entryFee` (0 = free) and `reward` (0 = no reward):
 *   1. Free entry, no reward.        entryFee=0, reward=0
 *   2. Free entry, reward enabled.   entryFee=0, reward>0
 *   3. Paid entry, no reward.        entryFee>0, reward=0
 *   4. Paid entry, reward enabled.   entryFee>0, reward>0
 *
 * QCoins are internal credits: no withdrawals, no user-to-user transfers.
 */

import {
  ACTIVITY_TYPES,
  ECONOMY_LIMITS,
  POLL_REWARD_MODES,
  QUIZ_REWARD_MODES,
} from '../constants/index.js';

/**
 * Validate an activity's fee/reward configuration against platform limits.
 * @returns {string[]} list of problems (empty when valid)
 */
export function validateEconomyConfig({
  entryFee = 0,
  reward = 0,
  rewardMode = QUIZ_REWARD_MODES.ALL_PASSERS,
  maxRewardRecipients = null,
  expectedParticipants = null,
  limits = ECONOMY_LIMITS,
} = {}) {
  const problems = [];

  if (!Number.isInteger(entryFee) || entryFee < 0) {
    problems.push('Entry fee must be a non-negative integer.');
  } else if (entryFee > limits.MAX_ENTRY_FEE) {
    problems.push(`Entry fee cannot exceed ${limits.MAX_ENTRY_FEE} QCoins.`);
  }

  if (!Number.isInteger(reward) || reward < 0) {
    problems.push('Reward must be a non-negative integer.');
  } else if (reward > limits.MAX_REWARD_PER_PARTICIPANT) {
    problems.push(`Reward per participant cannot exceed ${limits.MAX_REWARD_PER_PARTICIPANT} QCoins.`);
  }

  if (reward > 0) {
    const recipients =
      maxRewardRecipients ??
      (expectedParticipants && Number.isFinite(expectedParticipants) ? expectedParticipants : null);
    if (Number.isFinite(recipients) && recipients > 0) {
      const pool = reward * recipients;
      if (pool > limits.MAX_REWARD_POOL_PER_ACTIVITY) {
        problems.push(
          `Reward pool (${pool} QCoins) exceeds the platform limit of ${limits.MAX_REWARD_POOL_PER_ACTIVITY}.`
        );
      }
    }
  }

  const knownModes = [...Object.values(QUIZ_REWARD_MODES), ...Object.values(POLL_REWARD_MODES)];
  if (reward > 0 && !knownModes.includes(rewardMode)) {
    problems.push('Unknown reward mode.');
  }

  return problems;
}

/**
 * Decide whether an attempt earns the reward.
 * Reward eligibility never depends on a client-supplied score: pass/fail and
 * scoring must come from the server-side scoring engine.
 */
export function quizRewardEligibility({
  attempt,
  reward = 0,
  rewardMode = QUIZ_REWARD_MODES.ALL_PASSERS,
  topPercent = 20,
  leaderboard, // optional array of { attemptId, percentage } sorted desc, includes this attempt
}) {
  if (reward <= 0) return { eligible: false, reason: 'NO_REWARD_CONFIGURED' };
  if (attempt.needsReview) return { eligible: false, reason: 'PENDING_MANUAL_REVIEW' };
  if (attempt.suspicious) return { eligible: false, reason: 'FLAGGED_SUSPICIOUS' };
  if (!attempt.passed) return { eligible: false, reason: 'DID_NOT_PASS' };

  if (rewardMode === QUIZ_REWARD_MODES.ALL_PASSERS) {
    return { eligible: true, reason: 'PASSED' };
  }

  if (rewardMode === QUIZ_REWARD_MODES.TOP_PERCENT) {
    if (!Array.isArray(leaderboard) || leaderboard.length === 0) {
      return { eligible: true, reason: 'PASSED_NO_COMPETITION' };
    }
    const percentile = Number.isFinite(topPercent) && topPercent > 0 ? topPercent : 20;
    const cutoff = Math.max(1, Math.ceil((percentile / 100) * leaderboard.length));
    const rank = leaderboard.findIndex((row) => String(row.attemptId) === String(attempt.id));
    return rank > -1 && rank < cutoff
      ? { eligible: true, reason: 'TOP_PERCENT' }
      : { eligible: false, reason: 'OUTSIDE_TOP_PERCENT' };
  }

  return { eligible: false, reason: 'UNKNOWN_REWARD_MODE' };
}

/**
 * Poll rewards never depend on which option a voter picked — an opinion poll has
 * no correct answer. Eligibility is participation-based only.
 */
export function pollRewardEligibility({
  vote,
  reward = 0,
  rewardMode = POLL_REWARD_MODES.ALL_PARTICIPANTS,
  maxRewardRecipients = null,
  participantRank = null, // 0-based arrival order among voters
  drawWinners = null, // set of vote ids selected by a random draw
}) {
  if (reward <= 0) return { eligible: false, reason: 'NO_REWARD_CONFIGURED' };
  if (vote.suspicious) return { eligible: false, reason: 'FLAGGED_SUSPICIOUS' };

  switch (rewardMode) {
    case POLL_REWARD_MODES.ALL_PARTICIPANTS:
      return { eligible: true, reason: 'PARTICIPATED' };
    case POLL_REWARD_MODES.FIRST_N: {
      const cap = Number.isFinite(maxRewardRecipients) ? maxRewardRecipients : null;
      if (cap === null) return { eligible: true, reason: 'PARTICIPATED' };
      return Number.isFinite(participantRank) && participantRank < cap
        ? { eligible: true, reason: 'WITHIN_FIRST_N' }
        : { eligible: false, reason: 'AFTER_REWARD_CAP' };
    }
    case POLL_REWARD_MODES.RANDOM_DRAW: {
      if (!drawWinners) return { eligible: false, reason: 'DRAW_NOT_HELD' };
      return drawWinners.has(String(vote.id))
        ? { eligible: true, reason: 'DRAW_WINNER' }
        : { eligible: false, reason: 'DRAW_NOT_SELECTED' };
    }
    default:
      return { eligible: false, reason: 'UNKNOWN_REWARD_MODE' };
  }
}

/**
 * Refund rules (documented in README):
 *  - Attempt abandoned before submission and fee charged → automatic refund eligible.
 *  - Admin unpublishes/rejects content after fees were charged → refund eligible.
 *  - Poll cancelled by admin/creator before end → refund eligible.
 *  - Completed attempt where the participant simply failed → not refundable.
 *  - Suspicious/fraudulent activity → not refundable (admin discretion).
 */
export function canRefund({ activityType, status, feeCharged, suspicious = false, adminOverride = false }) {
  if (adminOverride) return { refundable: true, reason: 'ADMIN_OVERRIDE' };
  if (!feeCharged) return { refundable: false, reason: 'NO_FEE_CHARGED' };
  if (suspicious) return { refundable: false, reason: 'FLAGGED_SUSPICIOUS' };

  if (activityType === ACTIVITY_TYPES.QUIZ_ATTEMPT) {
    if (status === 'ABANDONED') return { refundable: true, reason: 'ATTEMPT_ABANDONED' };
    if (status === 'CANCELLED_BY_PLATFORM') return { refundable: true, reason: 'CONTENT_CANCELLED' };
    return { refundable: false, reason: 'ATTEMPT_COMPLETED' };
  }

  if (activityType === ACTIVITY_TYPES.POLL_VOTE) {
    if (status === 'CANCELLED_BY_PLATFORM') return { refundable: true, reason: 'POLL_CANCELLED' };
    return { refundable: false, reason: 'POLL_ACTIVE_OR_COMPLETED' };
  }

  return { refundable: false, reason: 'UNKNOWN_ACTIVITY' };
}

/**
 * Pure wallet balance transition. The persistence layer applies the same numbers
 * atomically (conditional `$inc` + immutable ledger append with idempotency key).
 */
export function applyTransaction({ balance, totalEarned, totalSpent, amount }) {
  if (!Number.isInteger(amount) || amount === 0) {
    throw new Error('Transaction amount must be a non-zero integer.');
  }
  const nextBalance = balance + amount;
  if (nextBalance < 0) {
    throw new Error('Insufficient balance.');
  }
  return {
    balance: nextBalance,
    totalEarned: amount > 0 ? totalEarned + amount : totalEarned,
    totalSpent: amount < 0 ? totalSpent + -amount : totalSpent,
    direction: amount > 0 ? 'CREDIT' : 'DEBIT',
  };
}
