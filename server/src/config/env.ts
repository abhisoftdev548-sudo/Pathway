import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// Load server/.env regardless of the process working directory.
loadDotenv({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

const rawEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/pathforge'),
  JWT_ACCESS_SECRET: z.string().min(16).optional(),
  JWT_REFRESH_SECRET: z.string().min(16).optional(),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).optional(),
  COOKIE_SECURE: z.string().optional(),
  COOKIE_DOMAIN: z.string().optional(),
  SEED_ADMIN_NAME: z.string().default('PathForge Admin'),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@pathforge.local'),
  SEED_ADMIN_PASSWORD: z.string().min(10).default('Admin_PathForge_123!'),
  SEED_DEMO_NAME: z.string().default('Demo Learner'),
  SEED_DEMO_EMAIL: z.string().email().default('demo@pathforge.dev'),
  SEED_DEMO_PASSWORD: z.string().min(10).default('Demo_PathForge_123!'),
  APP_URL: z.string().default('http://localhost:5173'),
  TRUST_PROXY: z.string().default('1'),
});

const parsed = rawEnvSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast with actionable messages; never echo secret values.
  const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Invalid environment configuration: ${issues}`);
}

const raw = parsed.data;
const isProduction = raw.NODE_ENV === 'production';
const isTest = raw.NODE_ENV === 'test';

const DEV_ACCESS_SECRET = 'pathforge-development-access-secret-do-not-use-in-production';
const DEV_REFRESH_SECRET = 'pathforge-development-refresh-secret-do-not-use-in-production';

for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
  if (isProduction && (!raw[key] || raw[key]!.includes('replace-with') || raw[key]!.length < 32)) {
    throw new Error(`${key} must be set to a strong, unique value (32+ chars) in production.`);
  }
}
if (isProduction && raw.JWT_ACCESS_SECRET === raw.JWT_REFRESH_SECRET) {
  throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values.');
}
if (isProduction && raw.CLIENT_ORIGIN.includes('localhost')) {
  // eslint-disable-next-line no-console
  console.warn('[config] CLIENT_ORIGIN still points at localhost in production. Set it to your deployed frontend origin.');
}

const sameSite = raw.COOKIE_SAMESITE ?? (isProduction ? 'none' : 'lax');
const secure = raw.COOKIE_SECURE ? raw.COOKIE_SECURE === 'true' : isProduction || sameSite === 'none';

export const env = {
  nodeEnv: raw.NODE_ENV,
  isProduction,
  isTest,
  isDevelopment: raw.NODE_ENV === 'development',
  port: raw.PORT,
  logLevel: isTest ? 'silent' : raw.LOG_LEVEL,
  mongoUri: isTest ? process.env.TEST_MONGODB_URI ?? raw.MONGODB_URI : raw.MONGODB_URI,
  accessSecret: raw.JWT_ACCESS_SECRET ?? DEV_ACCESS_SECRET,
  refreshSecret: raw.JWT_REFRESH_SECRET ?? DEV_REFRESH_SECRET,
  accessTokenTtl: raw.ACCESS_TOKEN_TTL,
  refreshTokenTtl: raw.REFRESH_TOKEN_TTL,
  clientOrigins: raw.CLIENT_ORIGIN.split(',').map((origin) => origin.trim().replace(/\/$/, '')).filter(Boolean),
  cookieSameSite: sameSite,
  cookieSecure: secure,
  cookieDomain: raw.COOKIE_DOMAIN,
  seedAdmin: {
    name: raw.SEED_ADMIN_NAME,
    email: raw.SEED_ADMIN_EMAIL,
    password: raw.SEED_ADMIN_PASSWORD,
  },
  seedDemo: {
    name: raw.SEED_DEMO_NAME,
    email: raw.SEED_DEMO_EMAIL,
    password: raw.SEED_DEMO_PASSWORD,
  },
  appUrl: raw.APP_URL.replace(/\/$/, ''),
  trustProxy: raw.TRUST_PROXY === 'true' || raw.TRUST_PROXY === '1',
} as const;

export const cookieNames = {
  access: 'pf_access',
  refresh: 'pf_refresh',
  csrf: 'pf_csrf',
} as const;
