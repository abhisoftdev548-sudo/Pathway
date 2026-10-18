import { Router } from 'express';
import { z } from 'zod';
import { get, nowIso } from '../../db/index.js';
import { conflict, notFound } from '../../lib/errors.js';
import { handler, parseBody } from '../../lib/http.js';
import { auditFromRequest } from '../../lib/audit.js';
import { currentUser } from '../../lib/auth.js';
import { allSettings, getSetting, invalidateSettingsCache, setSetting } from '../../lib/settings.js';

export const adminConfigRouter = Router();

const KEYS = [
  'quiz_rules',
  'poll_rules',
  'reward_limits',
  'content_guidelines',
  'feature_config',
  'notification_templates',
  'maintenance',
] as const;

type ConfigKey = (typeof KEYS)[number];

const DEFAULTS: Record<ConfigKey, Record<string, unknown>> = {
  quiz_rules: {
    min_questions: 3,
    max_questions: 50,
    min_options_per_question: 2,
    max_options_per_question: 6,
    max_title_length: 120,
    max_entry_fee: 100,
    max_reward_coins: 500,
    default_passing_score: 60,
    max_time_limit_minutes: 120,
    max_attempts_per_quiz: 5,
    require_approval: true,
  },
  poll_rules: {
    min_options: 2,
    max_options: 8,
    max_question_length: 160,
    max_duration_days: 90,
    allow_anonymous_by_default: false,
    require_approval: true,
  },
  reward_limits: {
    daily_quiz_reward_cap: 500,
    max_entry_fee: 100,
    max_reward_coins: 500,
    reward_per_correct_answer: 1,
    welcome_bonus: 50,
    refund_window_hours: 24,
    max_manual_adjustment: 1000,
  },
  content_guidelines: { text: '' },
  feature_config: {
    quizzes_enabled: true,
    polls_enabled: true,
    ratings_enabled: true,
    leaderboards_enabled: true,
    public_registration_enabled: true,
    wallet_enabled: true,
    achievements_enabled: true,
    notifications_enabled: true,
  },
  notification_templates: {},
  maintenance: { enabled: false, message: '' },
};

adminConfigRouter.get(
  '/',
  handler((_req, res) => {
    const stored = allSettings();
    const byKey = new Map(stored.map((s) => [s.key, s]));
    res.json({
      items: KEYS.map((key) => ({
        key,
        value: { ...DEFAULTS[key], ...(byKey.get(key)?.value ?? {}) },
        defaults: DEFAULTS[key],
        updatedAt: byKey.get(key)?.updated_at ?? null,
      })),
    });
  }),
);

adminConfigRouter.get(
  '/:key',
  handler((req, res) => {
    const key = req.params.key as ConfigKey;
    if (!KEYS.includes(key)) throw notFound('Unknown configuration key.');
    res.json({ key, value: { ...DEFAULTS[key], ...getSetting(key, DEFAULTS[key]) }, defaults: DEFAULTS[key] });
  }),
);

adminConfigRouter.put(
  '/:key',
  handler((req, res) => {
    const admin = currentUser(req);
    const key = req.params.key as ConfigKey;
    if (!KEYS.includes(key)) throw notFound('Unknown configuration key.');

    const body = parseBody(z.object({ value: z.record(z.unknown()) }), req.body);
    const current = { ...DEFAULTS[key], ...getSetting(key, DEFAULTS[key]) };
    const next = { ...current, ...body.value };

    if (key === 'reward_limits') {
      const nums = ['daily_quiz_reward_cap', 'max_entry_fee', 'max_reward_coins', 'reward_per_correct_answer', 'welcome_bonus', 'refund_window_hours', 'max_manual_adjustment'];
      for (const field of nums) {
        const v = (next as Record<string, unknown>)[field];
        if (v !== undefined && (!Number.isInteger(v) || (v as number) < 0)) {
          throw conflict(`${field} must be a whole number of zero or more.`);
        }
      }
    }
    if (key === 'quiz_rules' || key === 'poll_rules') {
      for (const [field, v] of Object.entries(next)) {
        if (typeof v === 'number' && (!Number.isInteger(v) || v < 0)) {
          throw conflict(`${field} must be a whole number of zero or more.`);
        }
      }
    }

    setSetting(key, next, admin.id);
    invalidateSettingsCache();

    const changed: Record<string, { from: unknown; to: unknown }> = {};
    for (const [field, value] of Object.entries(next)) {
      if (JSON.stringify((current as Record<string, unknown>)[field]) !== JSON.stringify(value)) {
        changed[field] = { from: (current as Record<string, unknown>)[field], to: value };
      }
    }
    auditFromRequest(req, 'config.updated', 'platform_setting', key, { changed });
    res.json({ key, value: next });
  }),
);

adminConfigRouter.post(
  '/:key/reset',
  handler((req, res) => {
    const admin = currentUser(req);
    const key = req.params.key as ConfigKey;
    if (!KEYS.includes(key)) throw notFound('Unknown configuration key.');
    setSetting(key, DEFAULTS[key], admin.id);
    invalidateSettingsCache();
    auditFromRequest(req, 'config.reset', 'platform_setting', key, {});
    res.json({ key, value: DEFAULTS[key] });
  }),
);

export { get, nowIso };
