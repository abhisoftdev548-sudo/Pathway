import { describe, it, expect } from 'vitest';
import {
  bayesianAverage,
  aggregateRatings,
  creatorReputation,
  ratingEligibility,
} from '../src/utils/ratingMath.js';
import {
  buildPerformanceBoard,
  buildConsistencyBoard,
  buildCreatorBoard,
} from '../src/utils/leaderboardMath.js';

describe('bayesianAverage', () => {
  it('returns the prior mean when there are no ratings', () => {
    expect(bayesianAverage({ avg: 0, count: 0 })).toBe(3.5);
  });

  it('damps extreme averages from tiny samples', () => {
    const oneFiveStar = bayesianAverage({ avg: 5, count: 1 });
    expect(oneFiveStar).toBeLessThan(5);
    expect(oneFiveStar).toBeGreaterThan(3.5);

    // With many ratings the raw average dominates.
    const manyFiveStar = bayesianAverage({ avg: 5, count: 100 });
    expect(manyFiveStar).toBeGreaterThan(oneFiveStar);
  });
});

describe('aggregateRatings', () => {
  it('computes count, raw average, bayesian score and distribution', () => {
    const agg = aggregateRatings([5, 4, 4, 3, 5]);
    expect(agg.count).toBe(5);
    expect(agg.rawAvg).toBe(4.2);
    expect(agg.distribution[5]).toBe(2);
    expect(agg.bayesian).toBeGreaterThan(3.5);
    expect(agg.bayesian).toBeLessThanOrEqual(5);
  });

  it('ignores invalid scores', () => {
    const agg = aggregateRatings([5, 0, 9, null, 4]);
    expect(agg.count).toBe(2);
  });
});

describe('creatorReputation', () => {
  it('keeps admin quality ratings separate from community ratings', () => {
    const rep = creatorReputation({
      communityRatings: [4, 5, 4],
      adminQualityRatings: [5, 5],
      publishedCount: 2,
    });
    expect(rep.community.count).toBe(3);
    expect(rep.adminQuality.count).toBe(2);
    expect(rep.adminQuality.score).toBe(5);
    expect(rep.overallScore).toBe(rep.community.score);
    expect(rep.publishedCount).toBe(2);
  });
});

describe('ratingEligibility', () => {
  const creator = { id: 'u1', status: 'ACTIVE' };
  const otherUser = { id: 'u2', status: 'ACTIVE' };

  it('prevents creator self-rating', () => {
    const r = ratingEligibility({ user: creator, creatorId: 'u1', targetType: 'QUIZ', hasAttempted: true });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('CREATOR_CANNOT_RATE');
  });

  it('prevents duplicate ratings', () => {
    const r = ratingEligibility({ user: otherUser, creatorId: 'u1', targetType: 'QUIZ', hasAttempted: true, existingRating: true });
    expect(r.reason).toBe('ALREADY_RATED');
  });

  it('requires real participation first', () => {
    expect(
      ratingEligibility({ user: otherUser, creatorId: 'u1', targetType: 'QUIZ', hasAttempted: false }).reason
    ).toBe('MUST_ATTEMPT_FIRST');
    expect(
      ratingEligibility({ user: otherUser, creatorId: 'u1', targetType: 'POLL', hasVoted: false }).reason
    ).toBe('MUST_VOTE_FIRST');
    expect(
      ratingEligibility({ user: otherUser, creatorId: 'u1', targetType: 'POLL', hasVoted: true }).allowed
    ).toBe(true);
  });

  it('blocks suspended accounts and anonymous requests', () => {
    expect(ratingEligibility({ user: null, creatorId: 'u1', targetType: 'QUIZ', hasAttempted: true }).reason).toBe(
      'NOT_AUTHENTICATED'
    );
    expect(
      ratingEligibility({ user: { id: 'u2', status: 'SUSPENDED' }, creatorId: 'u1', targetType: 'QUIZ', hasAttempted: true })
        .reason
    ).toBe('ACCOUNT_SUSPENDED');
  });
});

describe('leaderboards (real rows only — empty input never fabricates entries)', () => {
  it('returns an empty board for empty input', () => {
    expect(buildPerformanceBoard([])).toEqual([]);
    expect(buildConsistencyBoard([])).toEqual([]);
    expect(buildCreatorBoard([])).toEqual([]);
  });

  it('performance board ranks by average passed score with a minimum-attempt threshold', () => {
    const board = buildPerformanceBoard(
      [
        { userId: 'a', name: 'A', percentages: [80, 90, 100], passedCount: 3, completedCount: 3 },
        { userId: 'b', name: 'B', percentages: [95], passedCount: 1, completedCount: 1 }, // below threshold
        { userId: 'c', name: 'C', percentages: [70, 75, 75], passedCount: 3, completedCount: 5 },
      ],
      { minAttempts: 3 }
    );
    expect(board.map((r) => r.userId)).toEqual(['a', 'c']);
    expect(board[0].rank).toBe(1);
    expect(board[0].avgScore).toBeCloseTo(90, 2);
  });

  it('consistency board rewards volume and stability', () => {
    const board = buildConsistencyBoard(
      [
        { userId: 'steady', name: 'Steady', percentages: [80, 82, 78, 81, 79, 80], completedCount: 6 },
        { userId: 'volatile', name: 'Volatile', percentages: [40, 100, 20, 90, 50, 60], completedCount: 6 },
        { userId: 'new', name: 'New', percentages: [90, 90], completedCount: 2 }, // below threshold
      ],
      { minAttempts: 5 }
    );
    expect(board.map((r) => r.userId)).toEqual(['steady', 'volatile']);
    expect(board[0].consistencyScore).toBeGreaterThan(board[1].consistencyScore);
  });

  it('creator board uses Bayesian ratings and requires published content', () => {
    const board = buildCreatorBoard(
      [
        { userId: 'x', name: 'X', publishedCount: 2, ratingCount: 10, rawAvg: 4.5 },
        { userId: 'y', name: 'Y', publishedCount: 1, ratingCount: 1, rawAvg: 5 },
        { userId: 'z', name: 'Z', publishedCount: 0, ratingCount: 20, rawAvg: 5 }, // nothing published
      ],
      { minRatings: 1, minPublished: 1 }
    );
    expect(board.map((r) => r.userId)).toEqual(['x', 'y']);
    expect(board[0].ratingScore).toBeGreaterThan(board[1].ratingScore);
    // Wallet balance is deliberately not part of the row shape.
    expect(board[0].walletBalance).toBeUndefined();
  });
});
