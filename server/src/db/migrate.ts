import { exec, getDb, run, schemaSql } from './index.js';

/**
 * Applies the declarative schema and any idempotent data migrations.
 * Safe to run repeatedly.
 */
export function migrate(): void {
  const db = getDb();
  db.exec(schemaSql());
  seedSystemData();
}

/**
 * Reference data that the platform itself needs in order to function
 * (achievement definitions + default platform settings). These are
 * configuration records, not user content or sample data.
 */
export function seedSystemData(): void {
  exec(`
    INSERT OR IGNORE INTO achievement_definitions (code, name, description, icon, sort_order) VALUES
      ('first_quiz',      'First submission',     'Submitted your first quiz for review.',            'FileText', 10),
      ('first_publish',   'Published author',     'Had a quiz approved and published.',               'BadgeCheck', 20),
      ('first_attempt',   'Getting started',      'Completed your first quiz attempt.',               'Play', 30),
      ('perfect_score',   'Flawless',             'Scored 100% on a published quiz.',                 'Sparkles', 40),
      ('five_attempts',   'Regular player',       'Completed five quiz attempts.',                    'Repeat', 50),
      ('first_poll',      'Poll starter',         'Published your first poll.',                       'BarChart3', 60),
      ('first_vote',      'Voice heard',          'Cast your first vote in a poll.',                  'Vote', 70),
      ('first_review',    'Reviewer',             'Left your first rating and review.',               'Star', 80),
      ('top_ten',         'Top ten',              'Reached the top ten of a quiz leaderboard.',       'Trophy', 90);
  `);

  const defaults: Record<string, unknown> = {
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
    content_guidelines: {
      text: 'Submissions must be original, accurate and clearly written. Questions must have at least one correct answer and a helpful explanation. No hate speech, spam, personal data or misleading reward terms.',
    },
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
    notification_templates: {
      quiz_approved: 'Your quiz "{title}" was approved and is now published.',
      quiz_rejected: 'Your quiz "{title}" was rejected. Reason: {reason}',
      quiz_changes_requested: 'Changes were requested for your quiz "{title}". Reason: {reason}',
      poll_approved: 'Your poll "{title}" was approved and is now published.',
      poll_rejected: 'Your poll "{title}" was rejected. Reason: {reason}',
      poll_changes_requested: 'Changes were requested for your poll "{title}". Reason: {reason}',
      refund_approved: 'Your refund request for {amount} QCoin was approved.',
      refund_rejected: 'Your refund request for {amount} QCoin was declined. Reason: {reason}',
    },
    maintenance: { enabled: false, message: '' },
  };

  for (const [key, value] of Object.entries(defaults)) {
    run(
      'INSERT OR IGNORE INTO platform_settings (key, value, updated_at) VALUES (?, ?, ?)',
      key,
      JSON.stringify(value),
      new Date().toISOString(),
    );
  }
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  migrate();
  console.log('Migrations applied.');
}
