import { Router } from 'express';
import { z } from 'zod';
import { all, count, get, newId, nowIso, run, tx } from '../db/index.js';
import { conflict, forbidden, notFound, unavailable } from '../lib/errors.js';
import { handler, parseBody, parseQuery } from '../lib/http.js';
import { auditFromRequest } from '../lib/audit.js';
import { currentUser, requireAuth } from '../lib/auth.js';
import { pageResult, paging, Where } from '../lib/paging.js';
import { getSetting, isFeatureEnabled } from '../lib/settings.js';
import { credit, debit, getBalance } from '../lib/wallet.js';
import { notify } from '../lib/notify.js';
import { evaluate } from '../lib/achievements.js';

export const attemptsRouter = Router();

// ------------------------------------------------------------------ start

attemptsRouter.post(
  '/',
  requireAuth,
  handler((req, res) => {
    if (!isFeatureEnabled('quizzes_enabled')) throw unavailable('Quizzes are currently switched off.');
    const user = currentUser(req);
    const body = parseBody(z.object({ quizId: z.string().min(1) }), req.body);

    const quiz = get<{
      id: string;
      status: string;
      entry_fee: number;
      reward_coins: number;
      max_attempts: number;
      time_limit_seconds: number | null;
      title: string;
      shuffle_questions: number;
    }>(
      `SELECT id, status, entry_fee, reward_coins, max_attempts, time_limit_seconds, title, shuffle_questions
         FROM quizzes WHERE id = ?`,
      body.quizId,
    );
    if (!quiz) throw notFound('That quiz does not exist.');
    if (quiz.status !== 'approved') throw conflict('This quiz is not open for attempts.');

    const used = count(
      "SELECT COUNT(*) AS total FROM quiz_attempts WHERE quiz_id = ? AND user_id = ? AND status = 'submitted'",
      quiz.id,
      user.id,
    );
    if (used >= quiz.max_attempts) {
      throw conflict(`You have used all ${quiz.max_attempts} permitted attempts for this quiz.`);
    }
    const open = get<{ id: string }>(
      "SELECT id FROM quiz_attempts WHERE quiz_id = ? AND user_id = ? AND status = 'in_progress'",
      quiz.id,
      user.id,
    );
    if (open) return res.status(200).json({ attemptId: open.id, resumed: true });

    const questions = all<{ id: string; position: number }>(
      'SELECT id, position FROM quiz_questions WHERE quiz_id = ? ORDER BY position',
      quiz.id,
    );
    if (!questions.length) throw conflict('This quiz has no questions yet.');

    const attemptId = newId();
    tx(() => {
      run(
        `INSERT INTO quiz_attempts (id, quiz_id, user_id, status, started_at, question_count, entry_fee_charged)
         VALUES (?,?,?, 'in_progress', ?, ?, ?)`,
        attemptId,
        quiz.id,
        user.id,
        nowIso(),
        questions.length,
        quiz.entry_fee,
      );
      if (quiz.entry_fee > 0) {
        debit({
          userId: user.id,
          amount: quiz.entry_fee,
          entryType: 'entry_fee',
          description: `Entry fee for "${quiz.title}"`,
          referenceType: 'attempt',
          referenceId: attemptId,
          idempotencyKey: `entry_fee:${attemptId}`,
        });
      }
    });

    res.status(201).json({ attemptId, resumed: false });
  }),
);

// ------------------------------------------------------------------ in-flight

function loadAttempt(id: string, userId: string) {
  const attempt = get<any>(
    `SELECT a.*, q.title AS quiz_title, q.passing_score, q.reward_coins, q.entry_fee, q.show_explanations,
            q.shuffle_questions, q.time_limit_seconds, q.status AS quiz_status, q.creator_id
       FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id
      WHERE a.id = ?`,
    id,
  );
  if (!attempt) throw notFound('That attempt does not exist.');
  if (attempt.user_id !== userId) throw forbidden('That attempt belongs to another account.');
  return attempt;
}

attemptsRouter.get(
  '/:id',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const attempt = loadAttempt(req.params.id, user.id);

    const questions = all<any>(
      `SELECT id, position, prompt, question_type AS type, points, explanation FROM quiz_questions
        WHERE quiz_id = ? ORDER BY position`,
      attempt.quiz_id,
    ).map((q) => ({
      id: q.id,
      position: q.position,
      prompt: q.prompt,
      type: q.type,
      points: q.points,
      explanation: attempt.status !== 'submitted' ? '' : q.explanation,
      options: all<{ id: string; position: number; body: string; is_correct: number }>(
        'SELECT id, position, body, is_correct FROM quiz_options WHERE question_id = ? ORDER BY position',
        q.id,
      ).map((o) => ({
        id: o.id,
        position: o.position,
        body: o.body,
        isCorrect: attempt.status === 'submitted' ? !!o.is_correct : undefined,
      })),
    }));

    const answers: Record<string, string[]> = {};
    for (const row of all<{ question_id: string; selected_json: string }>(
      'SELECT question_id, selected_json FROM attempt_answers WHERE attempt_id = ?',
      attempt.id,
    )) {
      answers[row.question_id] = safeParseArray(row.selected_json);
    }

    res.json({ attempt: shapeAttempt(attempt), questions, answers });
  }),
);

function safeParseArray(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

const answerSchema = z.object({
  answers: z
    .array(z.object({ questionId: z.string().min(1), selected: z.array(z.string().min(1)).max(6) }))
    .max(200),
});

attemptsRouter.put(
  '/:id/answers',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const attempt = loadAttempt(req.params.id, user.id);
    if (attempt.status !== 'in_progress') throw conflict('This attempt has already been submitted.');
    const body = parseBody(answerSchema, req.body);

    tx(() => {
      for (const answer of body.answers) {
        const exists = get('SELECT 1 FROM quiz_questions WHERE id = ? AND quiz_id = ?', answer.questionId, attempt.quiz_id);
        if (!exists) continue;
        run(
          `INSERT INTO attempt_answers (id, attempt_id, question_id, selected_json)
           VALUES (?,?,?,?)
           ON CONFLICT(attempt_id, question_id) DO UPDATE SET selected_json = excluded.selected_json`,
          newId(),
          attempt.id,
          answer.questionId,
          JSON.stringify(answer.selected),
        );
      }
    });
    res.json({ ok: true });
  }),
);

// ------------------------------------------------------------------ submit

attemptsRouter.post(
  '/:id/submit',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const attempt = loadAttempt(req.params.id, user.id);
    if (attempt.status !== 'in_progress') throw conflict('This attempt has already been submitted.');
    const body = parseBody(answerSchema, req.body);

    const graded = tx(() => {
      for (const answer of body.answers) {
        const exists = get('SELECT 1 FROM quiz_questions WHERE id = ? AND quiz_id = ?', answer.questionId, attempt.quiz_id);
        if (!exists) continue;
        run(
          `INSERT INTO attempt_answers (id, attempt_id, question_id, selected_json)
           VALUES (?,?,?,?)
           ON CONFLICT(attempt_id, question_id) DO UPDATE SET selected_json = excluded.selected_json`,
          newId(),
          attempt.id,
          answer.questionId,
          JSON.stringify(answer.selected),
        );
      }

      const questions = all<{ id: string; points: number; type: string }>(
        'SELECT id, points, question_type AS type FROM quiz_questions WHERE quiz_id = ?',
        attempt.quiz_id,
      );
      const correctByQuestion = new Map<string, Set<string>>();
      for (const q of questions) {
        const correct = all<{ id: string }>('SELECT id FROM quiz_options WHERE question_id = ? AND is_correct = 1', q.id);
        correctByQuestion.set(
          q.id,
          new Set(correct.map((o) => o.id)),
        );
      }

      const stored = all<{ question_id: string; selected_json: string }>(
        'SELECT question_id, selected_json FROM attempt_answers WHERE attempt_id = ?',
        attempt.id,
      );

      let earned = 0;
      let possible = 0;
      let correctCount = 0;
      for (const q of questions) {
        possible += q.points;
        const selected = new Set(safeParseArray(stored.find((s) => s.question_id === q.id)?.selected_json ?? '[]'));
        const correctSet = correctByQuestion.get(q.id) ?? new Set<string>();
        const isCorrect =
          selected.size === correctSet.size && [...selected].every((id) => correctSet.has(id)) && correctSet.size > 0;
        run(
          'UPDATE attempt_answers SET is_correct = ?, points_awarded = ? WHERE attempt_id = ? AND question_id = ?',
          isCorrect,
          isCorrect ? q.points : 0,
          attempt.id,
          q.id,
        );
        if (isCorrect) {
          earned += q.points;
          correctCount += 1;
        }
      }

      const scorePercent = possible > 0 ? Math.round((earned / possible) * 100) : 0;
      const passed = scorePercent >= attempt.passing_score ? 1 : 0;
      const started = new Date(attempt.started_at).getTime();
      const timeSpent = Math.max(0, Math.round((Date.now() - started) / 1000));

      run(
        `UPDATE quiz_attempts
            SET status='submitted', submitted_at=?, time_spent_seconds=?, correct_count=?, earned_points=?,
                possible_points=?, score_percent=?, passed=?
          WHERE id=?`,
        nowIso(),
        timeSpent,
        correctCount,
        earned,
        possible,
        scorePercent,
        passed,
        attempt.id,
      );
      run('UPDATE quizzes SET total_attempts = total_attempts + 1 WHERE id = ?', attempt.quiz_id);

      // Reward calculation (server-side, DB-backed).
      const limits = getSetting<{ reward_per_correct_answer: number; daily_quiz_reward_cap: number }>('reward_limits', {
        reward_per_correct_answer: 1,
        daily_quiz_reward_cap: 500,
      });
      const perCorrect = Math.max(0, Math.trunc(limits.reward_per_correct_answer ?? 0));
      const cap = Math.max(0, Math.trunc(limits.daily_quiz_reward_cap ?? 0));
      const intended = (passed ? attempt.reward_coins : 0) + perCorrect * correctCount;

      let paid = 0;
      if (intended > 0) {
        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);
        const earnedToday = count(
          `SELECT COALESCE(SUM(amount),0) AS total FROM ledger_entries
            WHERE user_id = ? AND entry_type = 'quiz_reward' AND created_at >= ?`,
          user.id,
          startOfDay.toISOString(),
        );
        paid = Math.max(0, Math.min(intended, Math.max(0, cap - earnedToday)));
        if (paid > 0) {
          credit({
            userId: user.id,
            amount: paid,
            entryType: 'quiz_reward',
            description: passed
              ? `Passed "${attempt.quiz_title}" with ${scorePercent}%`
              : `Completed "${attempt.quiz_title}"`,
            referenceType: 'attempt',
            referenceId: attempt.id,
            idempotencyKey: `quiz_reward:${attempt.id}`,
          });
        }
      }
      run('UPDATE quiz_attempts SET reward_paid = ? WHERE id = ?', paid, attempt.id);
      return { scorePercent, correctCount, possible, earned, passed: !!passed, paid, intended };
    });

    auditFromRequest(req, 'attempt.submitted', 'attempt', attempt.id, {
      quizId: attempt.quiz_id,
      score: graded.scorePercent,
    });

    if (attempt.creator_id !== user.id) {
      notify({
        userId: attempt.creator_id,
        kind: 'system',
        title: 'New attempt on your quiz',
        body: `${user.displayName} scored ${graded.scorePercent}% on "${attempt.quiz_title}".`,
        link: `/app/creator`,
      });
    }

    evaluate(user.id);

    res.json({ result: { ...graded, attemptId: attempt.id } });
  }),
);

attemptsRouter.post(
  '/:id/abandon',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const attempt = loadAttempt(req.params.id, user.id);
    if (attempt.status !== 'in_progress') throw conflict('This attempt is not in progress.');
    run("UPDATE quiz_attempts SET status='abandoned', submitted_at=?, time_spent_seconds=? WHERE id=?", nowIso(), 0, attempt.id);
    res.json({ ok: true });
  }),
);

// ------------------------------------------------------------------ history

const historySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(60).optional(),
  quizId: z.string().optional(),
});

attemptsRouter.get(
  '/',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const query = parseQuery(historySchema, req.query);
    const p = paging({ page: query.page, pageSize: query.pageSize ?? 20 });
    const where = new Where().add("a.user_id = ? AND a.status = 'submitted'", user.id);
    where.addIf(query.quizId, 'a.quiz_id = ?', query.quizId);

    const rows = all(
      `SELECT a.id, a.quiz_id, a.score_percent, a.correct_count, a.question_count, a.earned_points, a.possible_points,
              a.passed, a.time_spent_seconds, a.entry_fee_charged, a.reward_paid, a.submitted_at,
              q.title AS quiz_title, q.summary AS quiz_summary, q.passing_score,
              c.name AS category_name, d.name AS difficulty_name
         FROM quiz_attempts a
         JOIN quizzes q ON q.id = a.quiz_id
         LEFT JOIN categories c ON c.id = q.category_id
         LEFT JOIN difficulty_levels d ON d.id = q.difficulty_id
         ${where.build()}
        ORDER BY a.submitted_at DESC LIMIT ? OFFSET ?`,
      ...where.params,
      p.pageSize,
      p.offset,
    );
    const total = count(
      `SELECT COUNT(*) AS total FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id ${where.build()}`,
      ...where.params,
    );

    const summary = get<{ attempts: number; passes: number; average: number | null; earned: number; spent: number }>(
      `SELECT COUNT(*) AS attempts,
              COALESCE(SUM(a.passed),0) AS passes,
              ROUND(AVG(a.score_percent),1) AS average,
              COALESCE(SUM(a.reward_paid),0) AS earned,
              COALESCE(SUM(a.entry_fee_charged),0) AS spent
         FROM quiz_attempts a WHERE a.user_id = ? AND a.status = 'submitted'`,
      user.id,
    );

    res.json({
      ...pageResult(rows, total, p),
      summary: {
        attempts: summary?.attempts ?? 0,
        passes: summary?.passes ?? 0,
        averageScore: summary?.average ?? null,
        coinsEarned: summary?.earned ?? 0,
        coinsSpent: summary?.spent ?? 0,
      },
    });
  }),
);

// ------------------------------------------------------------------ helpers

function shapeAttempt(a: any) {
  return {
    id: a.id,
    quizId: a.quiz_id,
    quizTitle: a.quiz_title,
    status: a.status,
    startedAt: a.started_at,
    submittedAt: a.submitted_at,
    timeSpentSeconds: a.time_spent_seconds,
    questionCount: a.question_count,
    correctCount: a.correct_count,
    earnedPoints: a.earned_points,
    possiblePoints: a.possible_points,
    scorePercent: a.score_percent,
    passed: a.passed === null ? null : !!a.passed,
    entryFeeCharged: a.entry_fee_charged,
    rewardPaid: a.reward_paid,
    passingScore: a.passing_score,
    rewardCoins: a.reward_coins,
    showExplanations: !!a.show_explanations,
    timeLimitSeconds: a.time_limit_seconds,
  };
}

export { shapeAttempt, getBalance };
