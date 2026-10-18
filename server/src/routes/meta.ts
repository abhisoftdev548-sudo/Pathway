import { Router } from 'express';
import { all, count } from '../db/index.js';
import { handler } from '../lib/http.js';
import { getSetting, maintenanceStatus } from '../lib/settings.js';

export const metaRouter = Router();

metaRouter.get(
  '/bootstrap',
  handler((_req, res) => {
    res.json({
      categories: all('SELECT id, name, slug, description, parent_id FROM categories WHERE is_active = 1 ORDER BY sort_order, name'),
      tags: all('SELECT id, name, slug FROM tags ORDER BY name LIMIT 200'),
      difficulties: all('SELECT id, name, slug FROM difficulty_levels ORDER BY sort_order'),
      features: getSetting<Record<string, boolean>>('feature_config', {}),
      maintenance: maintenanceStatus(),
      rules: {
        quiz: getSetting('quiz_rules', {}),
        poll: getSetting('poll_rules', {}),
        rewards: getSetting('reward_limits', {}),
        guidelines: getSetting<{ text: string }>('content_guidelines', { text: '' }).text,
      },
    });
  }),
);

/**
 * Public platform counts. These are real aggregates over the database —
 * if the database is empty every figure is zero.
 */
metaRouter.get(
  '/stats',
  handler((_req, res) => {
    res.json({
      registeredUsers: count('SELECT COUNT(*) AS t FROM users'),
      publishedQuizzes: count("SELECT COUNT(*) AS t FROM quizzes WHERE status = 'approved' AND visibility = 'public'"),
      publishedPolls: count("SELECT COUNT(*) AS t FROM polls WHERE status = 'published' AND visibility = 'public'"),
      completedAttempts: count("SELECT COUNT(*) AS t FROM quiz_attempts WHERE status = 'submitted'"),
      votesCast: count('SELECT COUNT(*) AS t FROM poll_votes'),
    });
  }),
);
