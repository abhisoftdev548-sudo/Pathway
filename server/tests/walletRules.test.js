import { describe, it, expect } from 'vitest';
import {
  validateEconomyConfig,
  quizRewardEligibility,
  pollRewardEligibility,
  canRefund,
  applyTransaction,
} from '../src/utils/walletRules.js';
import { QUIZ_REWARD_MODES, POLL_REWARD_MODES, ACTIVITY_TYPES, ECONOMY_LIMITS } from '../src/constants/index.js';

describe('validateEconomyConfig — the four supported configurations', () => {
  it('1. free entry, no reward', () => {
    expect(validateEconomyConfig({ entryFee: 0, reward: 0 })).toEqual([]);
  });
  it('2. free entry, reward enabled', () => {
    expect(validateEconomyConfig({ entryFee: 0, reward: 50 })).toEqual([]);
  });
  it('3. paid entry, no reward', () => {
    expect(validateEconomyConfig({ entryFee: 25, reward: 0 })).toEqual([]);
  });
  it('4. paid entry, reward enabled', () => {
    expect(validateEconomyConfig({ entryFee: 25, reward: 50 })).toEqual([]);
  });

  it('rejects negative or non-integer amounts', () => {
    expect(validateEconomyConfig({ entryFee: -1, reward: 0 }).length).toBeGreaterThan(0);
    expect(validateEconomyConfig({ entryFee: 0, reward: 1.5 }).length).toBeGreaterThan(0);
  });

  it('enforces platform limits', () => {
    const problems = validateEconomyConfig({
      entryFee: ECONOMY_LIMITS.MAX_ENTRY_FEE + 1,
      reward: 0,
    });
    expect(problems[0]).toMatch(/Entry fee cannot exceed/);
  });

  it('rejects a reward pool above the platform cap', () => {
    const problems = validateEconomyConfig({
      entryFee: 0,
      reward: 5000,
      expectedParticipants: 100,
    });
    expect(problems[0]).toMatch(/Reward pool/);
  });
});

describe('quizRewardEligibility', () => {
  const base = { id: 'a1', passed: true, needsReview: false, suspicious: false };

  it('pays passers in ALL_PASSERS mode', () => {
    const r = quizRewardEligibility({ attempt: base, reward: 50, rewardMode: QUIZ_REWARD_MODES.ALL_PASSERS });
    expect(r.eligible).toBe(true);
  });

  it('never pays non-passers or unresolved attempts', () => {
    expect(quizRewardEligibility({ attempt: { ...base, passed: false }, reward: 50 }).eligible).toBe(false);
    expect(quizRewardEligibility({ attempt: { ...base, needsReview: true }, reward: 50 }).eligible).toBe(false);
    expect(quizRewardEligibility({ attempt: { ...base, suspicious: true }, reward: 50 }).eligible).toBe(false);
    expect(quizRewardEligibility({ attempt: base, reward: 0 }).eligible).toBe(false);
  });

  it('limits TOP_PERCENT rewards to the leading attempts (server-verified scores)', () => {
    const leaderboard = [
      { attemptId: 'a1', percentage: 95 },
      { attemptId: 'a2', percentage: 90 },
      { attemptId: 'a3', percentage: 80 },
      { attemptId: 'a4', percentage: 70 },
      { attemptId: 'a5', percentage: 60 },
    ];
    const inTop = quizRewardEligibility({
      attempt: { ...base, id: 'a1' },
      reward: 50,
      rewardMode: QUIZ_REWARD_MODES.TOP_PERCENT,
      topPercent: 20,
      leaderboard,
    });
    expect(inTop.eligible).toBe(true);

    const outside = quizRewardEligibility({
      attempt: { ...base, id: 'a5' },
      reward: 50,
      rewardMode: QUIZ_REWARD_MODES.TOP_PERCENT,
      topPercent: 20,
      leaderboard,
    });
    expect(outside.eligible).toBe(false);
  });
});

describe('pollRewardEligibility — opinion polls never reward a "correct" option', () => {
  const vote = { id: 'v1', suspicious: false };

  it('pays all participants in ALL_PARTICIPANTS mode regardless of choice', () => {
    expect(pollRewardEligibility({ vote, reward: 10, rewardMode: POLL_REWARD_MODES.ALL_PARTICIPANTS }).eligible).toBe(true);
  });

  it('caps FIRST_N rewards by arrival order only', () => {
    expect(
      pollRewardEligibility({ vote, reward: 10, rewardMode: POLL_REWARD_MODES.FIRST_N, maxRewardRecipients: 5, participantRank: 2 })
        .eligible
    ).toBe(true);
    expect(
      pollRewardEligibility({ vote, reward: 10, rewardMode: POLL_REWARD_MODES.FIRST_N, maxRewardRecipients: 5, participantRank: 7 })
        .eligible
    ).toBe(false);
  });

  it('pays random draw winners only after the draw is held', () => {
    expect(
      pollRewardEligibility({ vote, reward: 10, rewardMode: POLL_REWARD_MODES.RANDOM_DRAW, drawWinners: null }).eligible
    ).toBe(false);
    const winners = new Set(['v1']);
    expect(
      pollRewardEligibility({ vote, reward: 10, rewardMode: POLL_REWARD_MODES.RANDOM_DRAW, drawWinners: winners }).eligible
    ).toBe(true);
    expect(
      pollRewardEligibility({ vote: { id: 'v2' }, reward: 10, rewardMode: POLL_REWARD_MODES.RANDOM_DRAW, drawWinners: winners })
        .eligible
    ).toBe(false);
  });
});

describe('canRefund', () => {
  it('refunds abandoned attempts that paid a fee', () => {
    const r = canRefund({ activityType: ACTIVITY_TYPES.QUIZ_ATTEMPT, status: 'ABANDONED', feeCharged: 25 });
    expect(r.refundable).toBe(true);
  });
  it('does not refund completed attempts without an admin override', () => {
    expect(
      canRefund({ activityType: ACTIVITY_TYPES.QUIZ_ATTEMPT, status: 'SUBMITTED', feeCharged: 25 }).refundable
    ).toBe(false);
  });
  it('refunds platform-cancelled content', () => {
    expect(
      canRefund({ activityType: ACTIVITY_TYPES.POLL_VOTE, status: 'CANCELLED_BY_PLATFORM', feeCharged: 10 }).refundable
    ).toBe(true);
  });
  it('blocks suspicious activity refunds but honors admin override', () => {
    expect(
      canRefund({ activityType: ACTIVITY_TYPES.QUIZ_ATTEMPT, status: 'ABANDONED', feeCharged: 10, suspicious: true }).refundable
    ).toBe(false);
    expect(
      canRefund({
        activityType: ACTIVITY_TYPES.QUIZ_ATTEMPT,
        status: 'SUBMITTED',
        feeCharged: 10,
        suspicious: true,
        adminOverride: true,
      }).refundable
    ).toBe(true);
  });
});

describe('applyTransaction (wallet math)', () => {
  it('tracks balance, earned and spent correctly', () => {
    const afterDebit = applyTransaction({ balance: 100, totalEarned: 150, totalSpent: 50, amount: -30 });
    expect(afterDebit).toMatchObject({ balance: 70, totalEarned: 150, totalSpent: 80, direction: 'DEBIT' });

    const afterCredit = applyTransaction({ balance: 70, totalEarned: 150, totalSpent: 80, amount: 20 });
    expect(afterCredit).toMatchObject({ balance: 90, totalEarned: 170, totalSpent: 80, direction: 'CREDIT' });
  });

  it('refuses to go negative', () => {
    expect(() => applyTransaction({ balance: 10, totalEarned: 0, totalSpent: 0, amount: -20 })).toThrow(
      /Insufficient balance/
    );
  });

  it('rejects zero or fractional amounts', () => {
    expect(() => applyTransaction({ balance: 10, totalEarned: 0, totalSpent: 0, amount: 0 })).toThrow();
    expect(() => applyTransaction({ balance: 10, totalEarned: 0, totalSpent: 0, amount: 1.5 })).toThrow();
  });
});
