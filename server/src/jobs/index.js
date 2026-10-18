import RefreshToken from '../models/RefreshToken.js';
import { abandonStaleAttempts } from '../services/attemptService.js';

/**
 * Lightweight maintenance jobs (interval-based; no external scheduler needed).
 *  - Remove expired refresh tokens (in case TTL index is unavailable).
 *  - Abandon stale in-progress quiz attempts past the time window.
 */

const HOUR_MS = 60 * 60 * 1000;
let timer = null;

export async function runMaintenance() {
  const results = { expiredTokens: 0, abandonedAttempts: 0 };
  try {
    const expired = await RefreshToken.deleteMany({ expiresAt: { $lt: new Date(Date.now() - 24 * HOUR_MS) } });
    results.expiredTokens = expired.deletedCount ?? 0;
    results.abandonedAttempts = await abandonStaleAttempts({ olderThanMinutes: 24 * 60 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[jobs] maintenance run failed:', err.message);
  }
  return results;
}

export function startJobs() {
  if (timer) return;
  timer = setInterval(runMaintenance, HOUR_MS);
  timer.unref?.();
}

export function stopJobs() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export default { startJobs, stopJobs, runMaintenance };
