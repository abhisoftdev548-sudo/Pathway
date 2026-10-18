-- QuizSphere schema
-- Single authoritative store. All balances, scores and moderation decisions
-- are derived from these tables.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id                 TEXT PRIMARY KEY,
  email              TEXT NOT NULL UNIQUE,
  username           TEXT NOT NULL UNIQUE,
  display_name       TEXT NOT NULL,
  password_hash      TEXT NOT NULL,
  role               TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'creator', 'admin')),
  account_status     TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'pending_verification')),
  email_verified_at  TEXT,
  bio                TEXT NOT NULL DEFAULT '',
  suspended_at       TEXT,
  suspended_reason   TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  last_active_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(account_status);
CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at);

CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  last_used_at TEXT,
  ip           TEXT,
  user_agent   TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ---------------------------------------------------------------- taxonomy

CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  parent_id   TEXT REFERENCES categories(id) ON DELETE SET NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

CREATE TABLE IF NOT EXISTS tags (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS difficulty_levels (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------- quizzes

CREATE TABLE IF NOT EXISTS quizzes (
  id                  TEXT PRIMARY KEY,
  creator_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  summary             TEXT NOT NULL DEFAULT '',
  description         TEXT NOT NULL DEFAULT '',
  category_id         TEXT REFERENCES categories(id) ON DELETE SET NULL,
  difficulty_id       TEXT REFERENCES difficulty_levels(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','pending_review','changes_requested','approved','rejected','unpublished')),
  entry_fee           INTEGER NOT NULL DEFAULT 0 CHECK (entry_fee >= 0),
  reward_coins        INTEGER NOT NULL DEFAULT 0 CHECK (reward_coins >= 0),
  passing_score       INTEGER NOT NULL DEFAULT 60 CHECK (passing_score BETWEEN 0 AND 100),
  time_limit_seconds  INTEGER,
  max_attempts        INTEGER NOT NULL DEFAULT 1 CHECK (max_attempts >= 1),
  shuffle_questions   INTEGER NOT NULL DEFAULT 0,
  show_explanations   INTEGER NOT NULL DEFAULT 1,
  visibility          TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','unlisted')),
  version             INTEGER NOT NULL DEFAULT 1,
  submitted_at        TEXT,
  published_at        TEXT,
  reviewed_at         TEXT,
  reviewed_by         TEXT REFERENCES users(id) ON DELETE SET NULL,
  review_notes        TEXT,
  quality_rating      INTEGER,
  total_attempts      INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quizzes_creator ON quizzes(creator_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_status ON quizzes(status);
CREATE INDEX IF NOT EXISTS idx_quizzes_category ON quizzes(category_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_published ON quizzes(status, published_at);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id            TEXT PRIMARY KEY,
  quiz_id       TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL,
  prompt        TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'single' CHECK (question_type IN ('single','multiple','true_false')),
  points        INTEGER NOT NULL DEFAULT 1 CHECK (points >= 0),
  explanation   TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_questions_quiz ON quiz_questions(quiz_id, position);

CREATE TABLE IF NOT EXISTS quiz_options (
  id          TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  body        TEXT NOT NULL,
  is_correct  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_options_question ON quiz_options(question_id, position);

CREATE TABLE IF NOT EXISTS quiz_tags (
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  tag_id  TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (quiz_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_quiz_tags_tag ON quiz_tags(tag_id);

CREATE TABLE IF NOT EXISTS quiz_versions (
  id          TEXT PRIMARY KEY,
  quiz_id     TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  version     INTEGER NOT NULL,
  snapshot    TEXT NOT NULL,
  change_note TEXT NOT NULL DEFAULT '',
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL,
  UNIQUE (quiz_id, version)
);

-- ---------------------------------------------------------------- attempts

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id                TEXT PRIMARY KEY,
  quiz_id           TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted','abandoned')),
  started_at        TEXT NOT NULL,
  submitted_at      TEXT,
  time_spent_seconds INTEGER,
  question_count    INTEGER NOT NULL DEFAULT 0,
  correct_count     INTEGER NOT NULL DEFAULT 0,
  earned_points     INTEGER NOT NULL DEFAULT 0,
  possible_points   INTEGER NOT NULL DEFAULT 0,
  score_percent     INTEGER,
  passed            INTEGER,
  entry_fee_charged INTEGER NOT NULL DEFAULT 0,
  reward_paid       INTEGER NOT NULL DEFAULT 0,
  counts_on_leaderboard INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON quiz_attempts(user_id, submitted_at);
CREATE INDEX IF NOT EXISTS idx_attempts_quiz ON quiz_attempts(quiz_id, submitted_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_attempts_open ON quiz_attempts(quiz_id, user_id) WHERE status = 'in_progress';

CREATE TABLE IF NOT EXISTS attempt_answers (
  id             TEXT PRIMARY KEY,
  attempt_id     TEXT NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id    TEXT NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  selected_json  TEXT NOT NULL DEFAULT '[]',
  is_correct     INTEGER NOT NULL DEFAULT 0,
  points_awarded INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_answers_attempt ON attempt_answers(attempt_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_answers_unique ON attempt_answers(attempt_id, question_id);

-- ---------------------------------------------------------------- polls

CREATE TABLE IF NOT EXISTS polls (
  id            TEXT PRIMARY KEY,
  creator_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question      TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  category_id   TEXT REFERENCES categories(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','pending_review','changes_requested','published','rejected','unpublished')),
  allow_multiple INTEGER NOT NULL DEFAULT 0,
  is_anonymous  INTEGER NOT NULL DEFAULT 0,
  visibility    TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','unlisted')),
  closes_at     TEXT,
  version       INTEGER NOT NULL DEFAULT 1,
  submitted_at  TEXT,
  published_at  TEXT,
  reviewed_at   TEXT,
  reviewed_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  review_notes  TEXT,
  quality_rating INTEGER,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_polls_creator ON polls(creator_id);
CREATE INDEX IF NOT EXISTS idx_polls_status ON polls(status);
CREATE INDEX IF NOT EXISTS idx_polls_published ON polls(status, published_at);

CREATE TABLE IF NOT EXISTS poll_options (
  id       TEXT PRIMARY KEY,
  poll_id  TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  body     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_poll_options ON poll_options(poll_id, position);

CREATE TABLE IF NOT EXISTS poll_votes (
  id         TEXT PRIMARY KEY,
  poll_id    TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id  TEXT NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  UNIQUE (poll_id, option_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user ON poll_votes(user_id);

CREATE TABLE IF NOT EXISTS poll_versions (
  id          TEXT PRIMARY KEY,
  poll_id     TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  version     INTEGER NOT NULL,
  snapshot    TEXT NOT NULL,
  change_note TEXT NOT NULL DEFAULT '',
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL,
  UNIQUE (poll_id, version)
);

-- ---------------------------------------------------------------- wallet

CREATE TABLE IF NOT EXISTS wallet_accounts (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance     INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_earned INTEGER NOT NULL DEFAULT 0,
  lifetime_spent  INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wallet_balance ON wallet_accounts(balance);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount         INTEGER NOT NULL,
  balance_after  INTEGER NOT NULL,
  entry_type     TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  reference_type TEXT,
  reference_id   TEXT,
  actor_id       TEXT REFERENCES users(id) ON DELETE SET NULL,
  idempotency_key TEXT UNIQUE,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger_entries(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON ledger_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_ledger_reference ON ledger_entries(reference_type, reference_id);

-- ---------------------------------------------------------------- moderation

CREATE TABLE IF NOT EXISTS moderation_reviews (
  id             TEXT PRIMARY KEY,
  content_type   TEXT NOT NULL CHECK (content_type IN ('quiz','poll')),
  content_id     TEXT NOT NULL,
  version        INTEGER NOT NULL DEFAULT 1,
  reviewer_id    TEXT NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  decision       TEXT NOT NULL CHECK (decision IN ('approved','rejected','changes_requested','unpublished','resubmitted')),
  reason         TEXT,
  notes          TEXT NOT NULL DEFAULT '',
  quality_rating INTEGER,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mod_reviews_content ON moderation_reviews(content_type, content_id, created_at);
CREATE INDEX IF NOT EXISTS idx_mod_reviews_reviewer ON moderation_reviews(reviewer_id);

CREATE TABLE IF NOT EXISTS reports (
  id              TEXT PRIMARY KEY,
  reporter_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type     TEXT NOT NULL CHECK (target_type IN ('quiz','poll','review','user')),
  target_id       TEXT NOT NULL,
  reason          TEXT NOT NULL,
  details         TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewing','resolved','dismissed')),
  resolution      TEXT NOT NULL DEFAULT '',
  resolved_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  resolved_at     TEXT,
  created_at      TEXT NOT NULL,
  UNIQUE (reporter_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at);
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id);

CREATE TABLE IF NOT EXISTS appeals (
  id           TEXT PRIMARY KEY,
  content_type TEXT NOT NULL CHECK (content_type IN ('quiz','poll','review')),
  content_id   TEXT NOT NULL,
  submitted_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  resolution   TEXT NOT NULL DEFAULT '',
  resolved_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  resolved_at  TEXT,
  created_at   TEXT NOT NULL,
  UNIQUE (content_type, content_id, submitted_by, status)
);
CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(status, created_at);

-- ---------------------------------------------------------------- ratings

CREATE TABLE IF NOT EXISTS ratings (
  id           TEXT PRIMARY KEY,
  content_type TEXT NOT NULL CHECK (content_type IN ('quiz','poll')),
  content_id   TEXT NOT NULL,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score        INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  review_text  TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden')),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  UNIQUE (content_type, content_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_ratings_content ON ratings(content_type, content_id, status);
CREATE INDEX IF NOT EXISTS idx_ratings_user ON ratings(user_id);

CREATE TABLE IF NOT EXISTS rating_disputes (
  id           TEXT PRIMARY KEY,
  rating_id    TEXT NOT NULL REFERENCES ratings(id) ON DELETE CASCADE,
  raised_by    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','upheld','rejected')),
  resolution   TEXT NOT NULL DEFAULT '',
  resolved_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  resolved_at  TEXT,
  created_at   TEXT NOT NULL,
  UNIQUE (rating_id, raised_by)
);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON rating_disputes(status, created_at);

-- ---------------------------------------------------------------- money disputes

CREATE TABLE IF NOT EXISTS refund_requests (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempt_id    TEXT REFERENCES quiz_attempts(id) ON DELETE SET NULL,
  ledger_id     TEXT REFERENCES ledger_entries(id) ON DELETE SET NULL,
  amount        INTEGER NOT NULL,
  reason        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decision_note TEXT NOT NULL DEFAULT '',
  resolved_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  resolved_at   TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refund_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_refunds_user ON refund_requests(user_id);

CREATE TABLE IF NOT EXISTS reward_disputes (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempt_id    TEXT REFERENCES quiz_attempts(id) ON DELETE SET NULL,
  reason        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved','rejected')),
  resolution    TEXT NOT NULL DEFAULT '',
  resolved_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  resolved_at   TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reward_disputes_status ON reward_disputes(status, created_at);

-- ---------------------------------------------------------------- notifications / achievements

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  link       TEXT,
  read_at    TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at, read_at);

-- System-defined achievement definitions (schema-level reference data, not user content).
CREATE TABLE IF NOT EXISTS achievement_definitions (
  code         TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL,
  icon         TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_code TEXT NOT NULL REFERENCES achievement_definitions(code) ON DELETE CASCADE,
  earned_at     TEXT NOT NULL,
  PRIMARY KEY (user_id, achievement_code)
);
CREATE INDEX IF NOT EXISTS idx_user_achievements ON user_achievements(achievement_code);

-- ---------------------------------------------------------------- platform config

CREATE TABLE IF NOT EXISTS platform_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          TEXT PRIMARY KEY,
  actor_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_label TEXT NOT NULL DEFAULT '',
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  metadata    TEXT NOT NULL DEFAULT '{}',
  ip          TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs(target_type, target_id);

CREATE TABLE IF NOT EXISTS security_events (
  id         TEXT PRIMARY KEY,
  user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  event      TEXT NOT NULL,
  outcome    TEXT NOT NULL,
  ip         TEXT,
  user_agent TEXT,
  metadata   TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_security_events ON security_events(event, created_at);
CREATE INDEX IF NOT EXISTS idx_security_user ON security_events(user_id, created_at);

CREATE TABLE IF NOT EXISTS error_logs (
  id         TEXT PRIMARY KEY,
  method     TEXT NOT NULL DEFAULT '',
  path       TEXT NOT NULL DEFAULT '',
  status     INTEGER NOT NULL DEFAULT 0,
  message    TEXT NOT NULL,
  stack      TEXT NOT NULL DEFAULT '',
  user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_error_logs_time ON error_logs(created_at);

-- ---------------------------------------------------------------- background jobs

CREATE TABLE IF NOT EXISTS jobs (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL,
  payload      TEXT NOT NULL DEFAULT '{}',
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  attempts     INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error   TEXT,
  run_at       TEXT NOT NULL,
  started_at   TEXT,
  finished_at  TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status, run_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_dedupe ON jobs(type, payload) WHERE status IN ('pending','running');
