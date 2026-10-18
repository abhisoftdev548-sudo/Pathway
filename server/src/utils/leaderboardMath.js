/**
 * Leaderboard construction — pure functions over real rows only.
 * Never fabricates entries: empty input produces an empty board.
 *
 *  - Performance:   average percentage across server-verified PASSED attempts
 *                   (minimum attempt threshold reduces one-hit noise).
 *  - Consistency:   completed attempts volume + score stability (lower stdev is better),
 *                   rewarding regular, reliable participation.
 *  - Creators:      Bayesian community rating over their approved, rated content
 *                   plus published-content count (never wallet balance).
 */

import { bayesianAverage } from './ratingMath.js';

function stdev(values) {
  if (!Array.isArray(values) || values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * @param {Array<{userId: string, name: string, avatarUrl?: string|null, percentages: number[], passedCount: number, completedCount: number}>} rows
 * @param {{minAttempts?: number}} opts
 */
export function buildPerformanceBoard(rows = [], { minAttempts = 3 } = {}) {
  const eligible = rows
    .map((r) => {
      const passed = r.percentages ?? [];
      const avg = passed.length > 0 ? passed.reduce((a, b) => a + b, 0) / passed.length : 0;
      return {
        userId: r.userId,
        name: r.name,
        avatarUrl: r.avatarUrl ?? null,
        avgScore: Math.round(avg * 100) / 100,
        passedCount: r.passedCount ?? passed.length,
        completedCount: r.completedCount ?? passed.length,
      };
    })
    .filter((r) => r.passedCount >= minAttempts && r.avgScore > 0)
    .sort((a, b) => b.avgScore - a.avgScore || b.passedCount - a.passedCount)
    .slice(0, 100);

  return eligible.map((row, index) => ({ rank: index + 1, ...row }));
}

/**
 * Consistency score: completed volume scaled by stability.
 * score = completedCount * (1 / (1 + stdev/25)) — rounded for display.
 */
export function buildConsistencyBoard(rows = [], { minAttempts = 5 } = {}) {
  const eligible = rows
    .map((r) => {
      const scores = r.percentages ?? [];
      const sd = stdev(scores);
      const volume = r.completedCount ?? scores.length;
      const stability = 1 / (1 + sd / 25);
      return {
        userId: r.userId,
        name: r.name,
        avatarUrl: r.avatarUrl ?? null,
        completedCount: volume,
        scoreStdev: Math.round(sd * 100) / 100,
        consistencyScore: Math.round(volume * stability * 100) / 100,
      };
    })
    .filter((r) => r.completedCount >= minAttempts)
    .sort((a, b) => b.consistencyScore - a.consistencyScore || b.completedCount - a.completedCount)
    .slice(0, 100);

  return eligible.map((row, index) => ({ rank: index + 1, ...row }));
}

/**
 * Creator board uses Bayesian community ratings (small-sample damping) with a
 * published-content floor. Wallet balance is deliberately not a ranking input.
 */
export function buildCreatorBoard(rows = [], { minRatings = 1, minPublished = 1 } = {}) {
  const eligible = rows
    .map((r) => ({
      userId: r.userId,
      name: r.name,
      avatarUrl: r.avatarUrl ?? null,
      publishedCount: r.publishedCount ?? 0,
      ratingCount: r.ratingCount ?? 0,
      rawAvg: r.rawAvg ?? 0,
      ratingScore: bayesianAverage({ avg: r.rawAvg ?? 0, count: r.ratingCount ?? 0 }),
    }))
    .filter((r) => r.ratingCount >= minRatings && r.publishedCount >= minPublished)
    .sort(
      (a, b) =>
        b.ratingScore - a.ratingScore ||
        b.ratingCount - a.ratingCount ||
        b.publishedCount - a.publishedCount
    )
    .slice(0, 100);

  return eligible.map((row, index) => ({ rank: index + 1, ...row }));
}
