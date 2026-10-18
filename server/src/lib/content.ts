import { all, get, newId, nowIso, run } from '../db/index.js';

export type ContentType = 'quiz' | 'poll';

export interface QuizSnapshot {
  title: string;
  summary: string;
  description: string;
  categoryId: string | null;
  difficultyId: string | null;
  tags: string[];
  entryFee: number;
  rewardCoins: number;
  passingScore: number;
  timeLimitSeconds: number | null;
  maxAttempts: number;
  shuffleQuestions: boolean;
  showExplanations: boolean;
  visibility: string;
  questions: {
    prompt: string;
    type: string;
    points: number;
    explanation: string;
    options: { body: string; isCorrect: boolean }[];
  }[];
}

export function snapshotQuiz(quizId: string): QuizSnapshot {
  const quiz = get<any>('SELECT * FROM quizzes WHERE id = ?', quizId);
  if (!quiz) throw new Error('quiz not found');
  const tags = all<{ tag_id: string }>('SELECT tag_id FROM quiz_tags WHERE quiz_id = ?', quizId).map((t) => t.tag_id);
  const questions = all<any>(
    'SELECT id, position, prompt, question_type AS type, points, explanation FROM quiz_questions WHERE quiz_id = ? ORDER BY position',
    quizId,
  ).map((q) => ({
    prompt: q.prompt,
    type: q.type,
    points: q.points,
    explanation: q.explanation,
    options: all<{ body: string; is_correct: number }>(
      'SELECT body, is_correct FROM quiz_options WHERE question_id = ? ORDER BY position',
      q.id,
    ).map((o) => ({ body: o.body, isCorrect: !!o.is_correct })),
  }));
  return {
    title: quiz.title,
    summary: quiz.summary,
    description: quiz.description,
    categoryId: quiz.category_id,
    difficultyId: quiz.difficulty_id,
    tags,
    entryFee: quiz.entry_fee,
    rewardCoins: quiz.reward_coins,
    passingScore: quiz.passing_score,
    timeLimitSeconds: quiz.time_limit_seconds,
    maxAttempts: quiz.max_attempts,
    shuffleQuestions: !!quiz.shuffle_questions,
    showExplanations: !!quiz.show_explanations,
    visibility: quiz.visibility,
    questions,
  };
}

export function saveQuizVersion(quizId: string, note: string, actorId: string | null): void {
  const row = get<{ version: number }>('SELECT version FROM quizzes WHERE id = ?', quizId);
  if (!row) return;
  run(
    'INSERT OR REPLACE INTO quiz_versions (id, quiz_id, version, snapshot, change_note, created_by, created_at) VALUES (?,?,?,?,?,?,?)',
    newId(),
    quizId,
    row.version,
    JSON.stringify(snapshotQuiz(quizId)),
    note,
    actorId,
    nowIso(),
  );
}

export interface PollSnapshot {
  question: string;
  description: string;
  categoryId: string | null;
  allowMultiple: boolean;
  isAnonymous: boolean;
  visibility: string;
  closesAt: string | null;
  options: string[];
}

export function snapshotPoll(pollId: string): PollSnapshot {
  const poll = get<any>('SELECT * FROM polls WHERE id = ?', pollId);
  if (!poll) throw new Error('poll not found');
  return {
    question: poll.question,
    description: poll.description,
    categoryId: poll.category_id,
    allowMultiple: !!poll.allow_multiple,
    isAnonymous: !!poll.is_anonymous,
    visibility: poll.visibility,
    closesAt: poll.closes_at,
    options: all<{ body: string }>('SELECT body FROM poll_options WHERE poll_id = ? ORDER BY position', pollId).map(
      (o) => o.body,
    ),
  };
}

export function savePollVersion(pollId: string, note: string, actorId: string | null): void {
  const row = get<{ version: number }>('SELECT version FROM polls WHERE id = ?', pollId);
  if (!row) return;
  run(
    'INSERT OR REPLACE INTO poll_versions (id, poll_id, version, snapshot, change_note, created_by, created_at) VALUES (?,?,?,?,?,?,?)',
    newId(),
    pollId,
    row.version,
    JSON.stringify(snapshotPoll(pollId)),
    note,
    actorId,
    nowIso(),
  );
}

export function moderationHistory(contentType: ContentType, contentId: string) {
  return all(
    `SELECT m.id, m.decision, m.reason, m.notes, m.quality_rating, m.version, m.created_at,
            u.display_name AS reviewer_name, u.username AS reviewer_username
       FROM moderation_reviews m
       LEFT JOIN users u ON u.id = m.reviewer_id
      WHERE m.content_type = ? AND m.content_id = ?
      ORDER BY m.created_at DESC, m.rowid DESC`,
    contentType,
    contentId,
  );
}

export function recordReview(input: {
  contentType: ContentType;
  contentId: string;
  version: number;
  reviewerId: string;
  decision: 'approved' | 'rejected' | 'changes_requested' | 'unpublished' | 'resubmitted';
  reason?: string | null;
  notes?: string;
  qualityRating?: number | null;
}): void {
  run(
    `INSERT INTO moderation_reviews (id, content_type, content_id, version, reviewer_id, decision, reason, notes, quality_rating, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    newId(),
    input.contentType,
    input.contentId,
    input.version,
    input.reviewerId,
    input.decision,
    input.reason ?? null,
    input.notes ?? '',
    input.qualityRating ?? null,
    nowIso(),
  );
}

export function contentOwner(contentType: ContentType, contentId: string): string | null {
  const row =
    contentType === 'quiz'
      ? get<{ creator_id: string }>('SELECT creator_id FROM quizzes WHERE id = ?', contentId)
      : get<{ creator_id: string }>('SELECT creator_id FROM polls WHERE id = ?', contentId);
  return row?.creator_id ?? null;
}

/** Aggregate rating summary for a piece of content. */
export function ratingSummary(contentType: ContentType, contentId: string) {
  const row = get<{ n: number; avg: number | null }>(
    `SELECT COUNT(*) AS n, AVG(score) AS avg FROM ratings
      WHERE content_type = ? AND content_id = ? AND status = 'published'`,
    contentType,
    contentId,
  );
  return { count: row?.n ?? 0, average: row?.avg ?? null };
}
