import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me-quizsphere-secret',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  seedOnBoot: (process.env.SEED_ON_BOOT ?? 'true') === 'true',
  dataFile: process.env.QS_DATA_FILE || '',
  cookieName: 'qs_token',
};
export const isProd = config.nodeEnv === 'production';
