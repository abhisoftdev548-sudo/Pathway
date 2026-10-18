import { createApp } from './app.js';
import { connectDb, disconnectDb } from './config/db.js';
import { configureCloudinary } from './config/cloudinary.js';
import config from './config/env.js';
import { startJobs, stopJobs } from './jobs/index.js';
import mongoose from 'mongoose';

const mongooseReady = () => mongoose.connection.readyState === 1;

/**
 * QuizSphere API entrypoint.
 * Validates environment (via config import), connects to MongoDB, starts jobs,
 * and only then begins accepting HTTP traffic.
 */
async function main() {
  configureCloudinary();

  // eslint-disable-next-line no-console
  console.info('[quizsphere] Connecting to MongoDB…');
  try {
    await connectDb();
    // eslint-disable-next-line no-console
    console.info('[quizsphere] MongoDB connected');
  } catch (err) {
    // Degraded mode is EXPLICIT and development-only: the API still boots but
    // dbGuard answers every persistence route with 503 (never fake data).
    const allowDegraded = process.env.ALLOW_DB_DEGRADED === '1' && config.env !== 'production';
    if (!allowDegraded) throw err;
    // eslint-disable-next-line no-console
    console.warn(
      `[quizsphere] MongoDB unavailable (${err.message}) — starting in DEGRADED mode ` +
        '(all data routes return 503 DB_UNAVAILABLE). Set MONGODB_URI for full functionality.'
    );
  }

  const app = createApp();
  if (mongooseReady()) startJobs();

  const server = app.listen(config.port, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.info(`[quizsphere] API listening on port ${config.port} (${config.env})`);
  });

  const shutdown = async (signal) => {
    // eslint-disable-next-line no-console
    console.info(`[quizsphere] ${signal} received — shutting down`);
    stopJobs();
    server.close(async () => {
      await disconnectDb().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 8000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[quizsphere] Fatal startup error:', err.message);
  process.exit(1);
});
