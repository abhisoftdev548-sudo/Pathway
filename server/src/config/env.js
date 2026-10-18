import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Validate required server environment variables at startup.
 * Missing secrets fail fast — the API never boots with placeholder config.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(10, 'MONGODB_URI is required'),
  ACCESS_TOKEN_SECRET: z.string().min(24, 'ACCESS_TOKEN_SECRET must be at least 24 characters'),
  REFRESH_TOKEN_SECRET: z.string().min(24, 'REFRESH_TOKEN_SECRET must be at least 24 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().max(90).default(7),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  COOKIE_SECURE: z
    .union([z.boolean(), z.string()])
    .default(false)
    .transform((v) => v === true || v === 'true'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  BOOTSTRAP_FIRST_ADMIN: z
    .union([z.boolean(), z.string()])
    .default(false)
    .transform((v) => v === true || v === 'true'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error(`Invalid server environment configuration:\n${issues}`);
  process.exit(1);
}

const env = parsed.data;

export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  mongodbUri: env.MONGODB_URI,
  corsOrigins: env.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  clientUrl: env.CLIENT_URL,
  cookies: {
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
  },
  tokens: {
    accessSecret: env.ACCESS_TOKEN_SECRET,
    accessTtl: env.ACCESS_TOKEN_TTL,
    refreshSecret: env.REFRESH_TOKEN_SECRET,
    refreshTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
    passwordResetTtlMinutes: env.PASSWORD_RESET_TTL_MINUTES,
  },
  cloudinary: {
    configured: Boolean(
      env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
    ),
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
  },
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    authMax: env.AUTH_RATE_LIMIT_MAX,
  },
  bootstrapFirstAdmin: env.BOOTSTRAP_FIRST_ADMIN,
};

export default config;
