import { all, count, get, nowIso, run } from '../db/index.js';
import { notify } from './notify.js';
import { getSetting } from './settings.js';

export interface AchievementDefinition {
  code: string;
  name: string;
  description: string;
  icon: string;
  sort_order: number;
}

export function listDefinitions(): AchievementDefinition[] {
  return all<AchievementDefinition>(
    'SELECT code, name, description, icon, sort_order FROM achievement_definitions ORDER BY sort_order, name',
  );
}

export function earnedCodes(userId: string): Set<string> {
  const rows = all<{ achievement_code: string }>(
    'SELECT achievement_code FROM user_achievements WHERE user_id = ?',
    userId,
  );
  return new Set(rows.map((r) => r.achievement_code));
}

/**
 * Grants an achievement if the user qualifies and has not already earned it.
 * Returns the codes newly awarded.
 */
export function grant(userId: string, codes: string[]): string[] {
  if (!getSetting<Record<string, boolean>>('feature_config', {}).achievements_enabled) return [];
  if (!codes.length) return [];
  return txSafe(() => {
    const owned = earnedCodes(userId);
    const awarded: string[] = [];
    for (const code of codes) {
      if (owned.has(code)) continue;
      const def = get<AchievementDefinition>(
        'SELECT code, name, description, icon, sort_order FROM achievement_definitions WHERE code = ?',
        code,
      );
      if (!def) continue;
      run(
        'INSERT OR IGNORE INTO user_achievements (user_id, achievement_code, earned_at) VALUES (?,?,?)',
        userId,
        code,
        nowIso(),
      );
      awarded.push(code);
      notify({
        userId,
        kind: 'achievement',
        title: `Achievement unlocked: ${def.name}`,
        body: def.description,
        link: '/app/achievements',
      });
    }
    return awarded;
  });
}

function txSafe<T>(fn: () => T): T {
  // Achievements are non-critical side effects; never let them break a
  // primary write path.
  try {
    return fn();
  } catch {
    return [] as unknown as T;
  }
}

/** Re-evaluates every deterministic achievement for a user. */
export function evaluate(userId: string): string[] {
  const codes: string[] = [];

  const submittedQuizzes = count(
    "SELECT COUNT(*) AS total FROM quizzes WHERE creator_id = ? AND status <> 'draft'",
    userId,
  );
  if (submittedQuizzes > 0) codes.push('first_quiz');

  if (count("SELECT COUNT(*) AS total FROM quizzes WHERE creator_id = ? AND status = 'approved'", userId) > 0) {
    codes.push('first_publish');
  }

  const attempts = count(
    "SELECT COUNT(*) AS total FROM quiz_attempts WHERE user_id = ? AND status = 'submitted'",
    userId,
  );
  if (attempts > 0) codes.push('first_attempt');
  if (attempts >= 5) codes.push('five_attempts');

  if (count("SELECT COUNT(*) AS total FROM quiz_attempts WHERE user_id = ? AND score_percent = 100", userId) > 0) {
    codes.push('perfect_score');
  }

  if (count("SELECT COUNT(*) AS total FROM polls WHERE creator_id = ? AND status = 'published'", userId) > 0) {
    codes.push('first_poll');
  }

  if (count('SELECT COUNT(*) AS total FROM poll_votes WHERE user_id = ?', userId) > 0) {
    codes.push('first_vote');
  }

  if (count('SELECT COUNT(*) AS total FROM ratings WHERE user_id = ?', userId) > 0) {
    codes.push('first_review');
  }

  if (inTopTen(userId)) codes.push('top_ten');

  return grant(userId, codes);
}

/**
 * A user is "top ten" when they hold one of the ten best scores on any
 * published quiz that has at least ten distinct participants.
 */
export function inTopTen(userId: string): boolean {
  const rows = all<{ quiz_id: string }>(
    `SELECT DISTINCT quiz_id FROM quiz_attempts
      WHERE user_id = ? AND status = 'submitted' AND counts_on_leaderboard = 1`,
    userId,
  );
  for (const { quiz_id } of rows) {
    const rank = get<{ rn: number }>(
      `SELECT COUNT(*) + 1 AS rn FROM (
         SELECT user_id, MAX(score_percent) AS best, MAX(submitted_at) AS at
           FROM quiz_attempts
          WHERE quiz_id = ? AND status = 'submitted' AND counts_on_leaderboard = 1
          GROUP BY user_id
       ) other
       WHERE other.best > (
         SELECT COALESCE(MAX(score_percent), 0) FROM quiz_attempts
          WHERE quiz_id = ? AND user_id = ? AND status = 'submitted' AND counts_on_leaderboard = 1
       )
          OR (other.best = (
                SELECT COALESCE(MAX(score_percent), 0) FROM quiz_attempts
                 WHERE quiz_id = ? AND user_id = ? AND status = 'submitted' AND counts_on_leaderboard = 1
              ) AND other.at < (
                SELECT COALESCE(MAX(submitted_at), '') FROM quiz_attempts
                 WHERE quiz_id = ? AND user_id = ? AND status = 'submitted' AND counts_on_leaderboard = 1
              ))`,
      quiz_id,
      quiz_id,
      userId,
      quiz_id,
      userId,
      quiz_id,
      userId,
    );
    const participants = count(
      `SELECT COUNT(DISTINCT user_id) AS total FROM quiz_attempts
        WHERE quiz_id = ? AND status = 'submitted' AND counts_on_leaderboard = 1`,
      quiz_id,
    );
    if (rank && rank.rn <= 10 && participants >= 10) return true;
  }
  return false;
}
