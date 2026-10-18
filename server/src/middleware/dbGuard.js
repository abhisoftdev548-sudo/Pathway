/**
 * Database availability guard.
 *
 * Requests that need persistence fail fast with a clear 503 envelope when
 * MongoDB is unreachable — instead of hanging on Mongoose buffering timeouts.
 * The health endpoint stays available to report the true state.
 */
import mongoose from 'mongoose';

const ALWAYS_AVAILABLE = ['/health', '/wallet/policy'];

export function dbGuard(req, res, next) {
  const path = req.path.replace(/\/$/, '') || '/';
  if (ALWAYS_AVAILABLE.some((p) => path === p || path.endsWith(p))) return next();
  if (mongoose.connection.readyState === 1) return next();
  return res.status(503).json({
    success: false,
    error: {
      code: 'DB_UNAVAILABLE',
      message: 'Database connection is not ready. Set MONGODB_URI and try again shortly.',
    },
  });
}

export default dbGuard;
