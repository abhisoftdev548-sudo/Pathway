import mongoose from 'mongoose';
import config from './env.js';

/**
 * Connect to MongoDB (Atlas in production; local MongoDB or FerretDB in dev).
 */
export async function connectDb(uri = config.mongodbUri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000,
    autoIndex: true,
  });
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}

export default connectDb;
