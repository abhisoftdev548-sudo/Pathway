/**
 * Rating aggregation — pure math, unit-tested.
 *
 * Community ratings use a Bayesian (weighted) average so a single 5★ review
 * cannot dominate a brand-new listing. Admin quality ratings are tracked
 * separately and never mixed into community scores.
 */

import { RATING_PRIOR } from '../constants/index.js';

/**
 * Bayesian average: (priorWeight * priorMean + count * rawAvg) / (priorWeight + count)
 */
export function bayesianAverage({ avg = 0, count = 0 } = {}, prior = RATING_PRIOR) {
  const c = Number.isFinite(count) && count > 0 ? count : 0;
  const raw = Number.isFinite(avg) ? avg : 0;
  const weight = Number.isFinite(prior.weight) && prior.weight > 0 ? prior.weight : RATING_PRIOR.weight;
  const mean = Number.isFinite(prior.mean) ? prior.mean : RATING_PRIOR.mean;
  if (c === 0) return Math.round(mean * 100) / 100;
  return Math.round(((weight * mean + c * raw) / (weight + c)) * 100) / 100;
}

/**
 * Aggregate a list of individual community ratings into stored summary fields.
 * @param {number[]} scores — 1..5 values
 */
export function aggregateRatings(scores = [], prior = RATING_PRIOR) {
  const valid = scores.filter((s) => Number.isFinite(s) && s >= 1 && s <= 5);
  const count = valid.length;
  const rawAvg = count > 0 ? valid.reduce((a, b) => a + b, 0) / count : 0;
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const s of valid) distribution[Math.round(s)] += 1;

  return {
    count,
    rawAvg: Math.round(rawAvg * 100) / 100,
    bayesian: bayesianAverage({ avg: rawAvg, count }, prior),
    distribution,
  };
}

/**
 * Overall creator reputation from eligible feedback only.
 * Admin quality ratings are returned separately — never blended into community scores.
 */
export function creatorReputation({ communityRatings = [], adminQualityRatings = [], publishedCount = 0 }) {
  const community = aggregateRatings(communityRatings);
  const adminCount = adminQualityRatings.length;
  const adminAvg =
    adminCount > 0
      ? Math.round((adminQualityRatings.reduce((a, b) => a + b, 0) / adminCount) * 100) / 100
      : null;

  return {
    community: {
      count: community.count,
      rawAvg: community.rawAvg,
      score: community.bayesian,
      distribution: community.distribution,
    },
    adminQuality: {
      count: adminCount,
      score: adminAvg,
    },
    publishedCount,
    // Primary reputation score shown for creators: Bayesian community score.
    overallScore: community.bayesian,
  };
}

/**
 * Rating eligibility (documented rules):
 *  - creator may not rate their own content
 *  - one rating per user per target
 *  - quiz ratings require a completed attempt on that quiz
 *  - poll ratings require a vote on that poll
 *  - suspended users cannot rate
 */
export function ratingEligibility({
  user,
  creatorId,
  targetType,
  existingRating = false,
  hasAttempted = false,
  hasVoted = false,
}) {
  if (!user) return { allowed: false, reason: 'NOT_AUTHENTICATED' };
  if (user.status === 'SUSPENDED') return { allowed: false, reason: 'ACCOUNT_SUSPENDED' };
  if (String(creatorId) === String(user.id)) return { allowed: false, reason: 'CREATOR_CANNOT_RATE' };
  if (existingRating) return { allowed: false, reason: 'ALREADY_RATED' };
  if (targetType === 'QUIZ' && !hasAttempted) return { allowed: false, reason: 'MUST_ATTEMPT_FIRST' };
  if (targetType === 'POLL' && !hasVoted) return { allowed: false, reason: 'MUST_VOTE_FIRST' };
  return { allowed: true, reason: 'ELIGIBLE' };
}
