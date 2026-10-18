import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

let connectionPromise: Promise<typeof mongoose> | null = null;

export async function connectDatabase(uri = env.mongoUri): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (connectionPromise) return connectionPromise;

  mongoose.set('strictQuery', true);
  connectionPromise = mongoose
    .connect(uri, {
      serverSelectionTimeoutMS: 15000,
      maxPoolSize: 10,
      autoIndex: env.nodeEnv !== 'production',
    })
    .then((m) => {
      logger.info({ db: mongoose.connection.name }, 'MongoDB connected');
      return m;
    })
    .catch((error) => {
      connectionPromise = null;
      logger.error({ err: error }, 'MongoDB connection failed');
      throw error;
    });

  return connectionPromise;
}

export async function disconnectDatabase(): Promise<void> {
  connectionPromise = null;
  await mongoose.disconnect();
}
