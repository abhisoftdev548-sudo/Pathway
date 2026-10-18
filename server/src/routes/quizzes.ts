import { Router } from 'express';
import { z } from 'zod';
import { all, count, get, newId, nowIso, run, tx } from '../db/index.js';
import { conflict, forbidden, notFound, unavailable, validationError } from '../lib/errors.js';
import { handler, parseBody, parseQuery } from '../lib/http.js';
import { auditFromRequest, audit } from '../lib/audit.js';
import { currentUser, requireAuth } from '../lib/auth.js';
import { pageResult, paging, Where } from '../lib/paging.js';
import { getSetting, isFeatureEnabled } from '../lib/settings.js';
import { saveQuizVersion, ratingSummary, moderationHistory } from '../lib/content.js';
import { notify } from '../lib/notify.js';

export const quizzesRouter = Router();

// ------------------------------------------------------------------ schemas

const optionSchema = z.object({
  body: z.string().trim().min(1, 'Option text is required.').max(400),
  isCorrect: z.boolean(),
});

const questionSchema = z.object({
  prompt: z.string().trim().min(3, 'Question text must be at least 3 characters.').max(1000),
  type: z.enum(['single', 'multiple', 'true_false']).default('single'),
  points: z.number().int().min(1).max(20).default(1),
  explanation: z.string().trim().max(1000).default(''),
  options: z.array(optionSchema).min(2, 'Provide at least two options.').max(6, 'Provide at most six options.'),
});

const quizInputSchema = z.object({
  title: z.string().trim().min(5, 'Give your quiz a title of at least 5 characters.').max(120),
  summary: z.string().trim().max(200).default(''),
  description: z.string().trim().max(4000).default(''),
  categoryId: z.string().trim().nullable().optional(),
  difficultyId: z.string().trim().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(8).default([]),
  entryFee: z.number().int().min(0).default(0),
  rewardCoins: z.number().int().min(0).default(0),
  passingScore: z.number().int().min(0).max(100).default(60),
  timeLimitMinutes: z.number().int().min(1).nullable().optional(),
  maxAttempts: z.number().int().min(1).default(1),
  shuffleQuestions: z.boolean().default(false),
  showExplanations: z.boolean().default(true),
  visibility: z.enum(['public', 'unlisted']).default('public'),
  questions: z.array(questionSchema).min(1),
});

function validateAgainstRules(body: z.infer<typeof quizInputSchema>) {
  const rules = getSetting<{
    min_questions: number;
    max_questions: number;
    min_options_per_question: number;
    max_options_per_question: number;
    max_entry_fee: number;
    max_reward_coins: number;
    max_time_limit_minutes: number;
    max_attempts_per_quiz: number;
  }>('quiz_rules', {
    min_questions: 3,
    max_questions: 50,
    min_options_per_question: 2,
    max_options_per_question: 6,
    max_entry_fee: 100,
    max_reward_coins: 500,
    max_time_limit_minutes: 120,
    max_attempts_per_quiz: 5,
  });

  const errors: Record<string, string> = {};
  if (body.questions.length < rules.min_questions) {
    errors.questions = `A quiz needs at least ${rules.min_questions} questions.`;
  }
  if (body.questions.length > rules.max_questions) {
    errors.questions = `A quiz can have at most ${rules.max_questions} questions.`;
  }
  if (body.entryFee > rules.max_entry_fee) {
    errors.entryFee = `Entry fee cannot exceed ${rules.max_entry_fee} QCoin.`;
  }
  if (body.rewardCoins > rules.max_reward_coins) {
    errors.rewardCoins = `Reward cannot exceed ${rules.max_reward_coins} QCoin.`;
  }
  if (body.maxAttempts > rules.max_attempts_per_quiz) {
    errors.maxAttempts = `At most ${rules.max_attempts_per_quiz} attempts are allowed.`;
  }
  if (body.timeLimitMinutes && body.timeLimitMinutes > rules.max_time_limit_minutes) {
    errors.timeLimitMinutes = `Time limit cannot exceed ${rules.max_time_limit_minutes} minutes.`;
  }
  body.questions.forEach((q, index) => {
    const correct = q.options.filter((o) => o.isCorrect).length;
    if (q.type !== 'multiple' && correct !== 1) {
      errors[`questions.${index}.options`] = 'Single-answer questions need exactly one correct option.';
    }
    if (q.type === 'multiple' && correct < 1) {
      errors[`questions.${index}.options`] = 'Mark at least one option as correct.';
    }
    if (q.options.length < rules.min_options_per_question) {
      errors[`questions.${index}.options`] = `At least ${rules.min_options_per_question} options are required.`;
    }
    if (q.options.length > rules.max_options_per_question) {
      errors[`questions.${index}.options`] = `At most ${rules.max_options_per_question} options are allowed.`;
    }
  });
  if (Object.keys(errors).length) throw validationError('Please correct the highlighted fields.', errors);
}

// ------------------------------------------------------------------ queries

const LIST_COLUMNS = `
  q.id, q.title, q.summary, q.description, q.status, q.entry_fee, q.reward_coins, q.passing_score,
  q.time_limit_seconds, q.max_attempts, q.shuffle_questions, q.show_explanations, q.visibility,
  q.version, q.submitted_at, q.published_at, q.review_notes, q.quality_rating, q.total_attempts,
  q.category_id, q.difficulty_id, q.created_at, q.updated_at,
  c.name AS category_name, c.slug AS category_slug,
  d.name AS difficulty_name, d.slug AS difficulty_slug,
  u.id AS creator_id, u.username AS creator_username, u.display_name AS creator_name,
  (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS question_count,
  (SELECT COALESCE(SUM(points),0) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS total_points,
  (SELECT COUNT(*) FROM ratings r WHERE r.content_type='quiz' AND r.content_id=q.id AND r.status='published') AS rating_count,
  (SELECT ROUND(AVG(score),2) FROM ratings r WHERE r.content_type='quiz' AND r.content_id=q.id AND r.status='published') AS rating_average
`;

function loadTags(quizIds: string[]): Record<string, { id: string; name: string; slug: string }[]> {
  if (!quizIds.length) return {};
  const placeholders = quizIds.map(() => '?').join(',');
  const rows = all<{ quiz_id: string; id: string; name: string; slug: string }>(
    `SELECT qt.quiz_id, t.id, t.name, t.slug FROM quiz_tags qt JOIN tags t ON t.id = qt.tag_id
      WHERE qt.quiz_id IN (${placeholders}) ORDER BY t.name`,
    ...quizIds,
  );
  const map: Record<string, { id: string; name: string; slug: string }[]> = {};
  for (const row of rows) {
    (map[row.quiz_id] ??= []).push({ id: row.id, name: row.name, slug: row.slug });
  }
  return map;
}

function decorate(rows: any[]) {
  const tags = loadTags(rows.map((r) => r.id));
  return rows.map((r) => ({
    ...r,
    tags: tags[r.id] ?? [],
    shuffleQuestions: !!r.shuffle_questions,
    showExplanations: !!r.show_explanations,
  }));
}

const listQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().optional(),
  difficulty: z.string().trim().optional(),
  tag: z.string().trim().optional(),
  fee: z.enum(['any', 'free', 'paid']).optional(),
  sort: z.enum(['newest', 'popular', 'rating', 'reward']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(60).optional(),
});

quizzesRouter.get(
  '/',
  handler((req, res) => {
    const query = parseQuery(listQuerySchema, req.query);
    const p = paging({ page: query.page, pageSize: query.pageSize ?? 12 });
    const where = new Where().add("q.status = 'approved'").add("q.visibility = 'public'");

    where.addIf(query.q, '(q.title LIKE ? OR q.summary LIKE ? OR q.description LIKE ?)', ...like(query.q));
    where.addIf(query.category, 'c.slug = ?', query.category);
    where.addIf(query.difficulty, 'd.slug = ?', query.difficulty);
    if (query.fee === 'free') where.add('q.entry_fee = 0');
    if (query.fee === 'paid') where.add('q.entry_fee > 0');
    if (query.tag) {
      where.add('EXISTS (SELECT 1 FROM quiz_tags qt JOIN tags t ON t.id = qt.tag_id WHERE qt.quiz_id = q.id AND t.slug = ?)', query.tag);
    }

    const order = {
      newest: 'q.published_at DESC',
      popular: 'q.total_attempts DESC, q.published_at DESC',
      rating: 'rating_average DESC NULLS LAST, rating_count DESC, q.published_at DESC',
      reward: 'q.reward_coins DESC, q.published_at DESC',
    }[query.sort ?? 'newest'];

    const rows = all(
      `SELECT ${LIST_COLUMNS} FROM quizzes q
         LEFT JOIN categories c ON c.id = q.category_id
         LEFT JOIN difficulty_levels d ON d.id = q.difficulty_id
         JOIN users u ON u.id = q.creator_id
         ${where.build()}
        ORDER BY ${order} LIMIT ? OFFSET ?`,
      ...where.params,
      p.pageSize,
      p.offset,
    );
    const total = count(
      `SELECT COUNT(*) AS total FROM quizzes q
         LEFT JOIN categories c ON c.id = q.category_id
         LEFT JOIN difficulty_levels d ON d.id = q.difficulty_id
         ${where.build()}`,
      ...where.params,
    );
    res.json(pageResult(decorate(rows), total, p));
  }),
);

function like(term?: string): string[] {
  const v = `%${term ?? ''}%`;
  return [v, v, v];
}

// ------------------------------------------------------------------ detail

function quizDetail(id: string, viewerId: string | null) {
  const row = get<any>(
    `SELECT ${LIST_COLUMNS} FROM quizzes q
       LEFT JOIN categories c ON c.id = q.category_id
       LEFT JOIN difficulty_levels d ON d.id = q.difficulty_id
       JOIN users u ON u.id = q.creator_id
      WHERE q.id = ?`,
    id,
  );
  if (!row) throw notFound('That quiz does not exist.');
  const [quiz] = decorate([row]);
  const questions = all<any>(
    `SELECT id, position, prompt, question_type AS type, points, explanation FROM quiz_questions
      WHERE quiz_id = ? ORDER BY position`,
    id,
  ).map((q) => ({
    id: q.id,
    position: q.position,
    prompt: q.prompt,
    type: q.type,
    points: q.points,
    explanation: q.explanation,
    options: all<{ id: string; position: number; body: string; is_correct: number }>(
      'SELECT id, position, body, is_correct FROM quiz_options WHERE question_id = ? ORDER BY position',
      q.id,
    ).map((o) => ({ id: o.id, position: o.position, body: o.body, isCorrect: !!o.is_correct })),
  }));

  const myAttempts = viewerId
    ? count("SELECT COUNT(*) AS total FROM quiz_attempts WHERE quiz_id = ? AND user_id = ? AND status = 'submitted'", id, viewerId)
    : 0;
  const inProgress = viewerId
    ? get<{ id: string }>("SELECT id FROM quiz_attempts WHERE quiz_id = ? AND user_id = ? AND status = 'in_progress'", id, viewerId)
    : undefined;
  const myRating = viewerId
    ? get('SELECT id, score, review_text, status FROM ratings WHERE content_type = ? AND content_id = ? AND user_id = ?', 'quiz', id, viewerId)
    : undefined;

  return {
    ...quiz,
    questions,
    rating: ratingSummary('quiz', id),
    myAttempts,
    inProgressAttemptId: inProgress?.id ?? null,
    myRating: myRating ?? null,
    moderationHistory:
      viewerId && (quiz.creator_id === viewerId || isAdminId(viewerId)) ? moderationHistory('quiz', id) : null,
  };
}

function isAdminId(userId: string): boolean {
  return get<{ role: string }>('SELECT role FROM users WHERE id = ?', userId)?.role === 'admin';
}

quizzesRouter.get(
  '/:id',
  handler((req, res) => {
    const viewer = req.ctx?.user.id ?? null;
    const quiz = quizDetail(req.params.id, viewer);
    const isOwner = viewer === quiz.creator_id;
    if (quiz.status !== 'approved' && !isOwner && !isAdminId(viewer ?? '')) {
      throw notFound('That quiz is not published.');
    }
    // Correct answers are never exposed before an attempt is submitted.
    if (!isOwner && !isAdminId(viewer ?? '')) {
      // Explanations quote the right answer, so they stay hidden until the
      // viewer has finished an attempt of their own.
      const hasSubmitted =
        viewer !== null &&
        count(
          "SELECT COUNT(*) AS t FROM quiz_attempts WHERE quiz_id = ? AND user_id = ? AND status = 'submitted'",
          req.params.id,
          viewer,
        ) > 0;
      quiz.questions = quiz.questions.map((q: any) => ({
        ...q,
        explanation: hasSubmitted ? q.explanation : '',
        options: q.options.map((o: any) => ({ id: o.id, position: o.position, body: o.body })),
      }));
    }
    res.json({ quiz });
  }),
);

// ------------------------------------------------------------------ mutations

function writeQuiz(quizId: string, body: z.infer<typeof quizInputSchema>): void {
  const timeLimitSeconds = body.timeLimitMinutes ? body.timeLimitMinutes * 60 : null;
  run(
    `UPDATE quizzes SET title=?, summary=?, description=?, category_id=?, difficulty_id=?, entry_fee=?, reward_coins=?,
            passing_score=?, time_limit_seconds=?, max_attempts=?, shuffle_questions=?, show_explanations=?,
            visibility=?, updated_at=?
      WHERE id=?`,
    body.title,
    body.summary,
    body.description,
    body.categoryId ?? null,
    body.difficultyId ?? null,
    body.entryFee,
    body.rewardCoins,
    body.passingScore,
    timeLimitSeconds,
    body.maxAttempts,
    body.shuffleQuestions,
    body.showExplanations,
    body.visibility,
    nowIso(),
    quizId,
  );

  run('DELETE FROM quiz_questions WHERE quiz_id = ?', quizId);
  body.questions.forEach((q, qi) => {
    const qid = newId();
    run(
      'INSERT INTO quiz_questions (id, quiz_id, position, prompt, question_type, points, explanation) VALUES (?,?,?,?,?,?,?)',
      qid,
      quizId,
      qi + 1,
      q.prompt,
      q.type,
      q.points,
      q.explanation,
    );
    q.options.forEach((o, oi) => {
      run(
        'INSERT INTO quiz_options (id, question_id, position, body, is_correct) VALUES (?,?,?,?,?)',
        newId(),
        qid,
        oi + 1,
        o.body,
        o.isCorrect,
      );
    });
  });

  run('DELETE FROM quiz_tags WHERE quiz_id = ?', quizId);
  for (const tagId of body.tags) {
    run('INSERT OR IGNORE INTO quiz_tags (quiz_id, tag_id) VALUES (?,?)', quizId, tagId);
  }
}

quizzesRouter.post(
  '/',
  requireAuth,
  handler((req, res) => {
    if (!isFeatureEnabled('quizzes_enabled')) throw unavailable('Quiz creation is currently switched off.');
    const user = currentUser(req);
    const body = parseBody(quizInputSchema, req.body);
    validateAgainstRules(body);

    const id = newId();
    const now = nowIso();
    tx(() => {
      run(
        `INSERT INTO quizzes (id, creator_id, title, summary, description, status, created_at, updated_at)
         VALUES (?,?,?,?,?, 'draft', ?, ?)`,
        id,
        user.id,
        body.title,
        body.summary,
        body.description,
        now,
        now,
      );
      writeQuiz(id, body);
      promoteToCreator(user.id);
    });

    auditFromRequest(req, 'quiz.created', 'quiz', id, { title: body.title });
    res.status(201).json({ id, quiz: quizDetail(id, user.id) });
  }),
);

quizzesRouter.patch(
  '/:id',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const existing = get<{ creator_id: string; status: string }>('SELECT creator_id, status FROM quizzes WHERE id = ?', req.params.id);
    if (!existing) throw notFound('That quiz does not exist.');
    if (existing.creator_id !== user.id && user.role !== 'admin') {
      throw forbidden('You can only edit your own quizzes.');
    }
    if (!['draft', 'changes_requested', 'rejected'].includes(existing.status) && user.role !== 'admin') {
      throw conflict('This quiz is locked while it is under review or published.');
    }

    const body = parseBody(quizInputSchema, req.body);
    validateAgainstRules(body);

    tx(() => {
      writeQuiz(req.params.id, body);
      run("UPDATE quizzes SET status = CASE WHEN status = 'changes_requested' THEN 'draft' ELSE status END WHERE id = ?", req.params.id);
    });

    auditFromRequest(req, 'quiz.updated', 'quiz', req.params.id, { title: body.title });
    res.json({ quiz: quizDetail(req.params.id, user.id) });
  }),
);

quizzesRouter.post(
  '/:id/submit',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const quiz = get<{ id: string; creator_id: string; status: string; title: string; version: number }>(
      'SELECT id, creator_id, status, title, version FROM quizzes WHERE id = ?',
      req.params.id,
    );
    if (!quiz) throw notFound('That quiz does not exist.');
    if (quiz.creator_id !== user.id && user.role !== 'admin') throw forbidden('You can only submit your own quizzes.');
    if (!['draft', 'changes_requested', 'rejected'].includes(quiz.status)) {
      throw conflict('This quiz has already been submitted for review.');
    }
    const body = parseBody(z.object({ changeNote: z.string().trim().max(400).optional().default('') }), req.body ?? {});

    tx(() => {
      const nextVersion = quiz.version + 1;
      run(
        `UPDATE quizzes SET status='pending_review', submitted_at=?, version=?, updated_at=?, review_notes=NULL
          WHERE id=?`,
        nowIso(),
        nextVersion,
        nowIso(),
        quiz.id,
      );
      saveQuizVersion(quiz.id, body.changeNote || `Version ${nextVersion} submitted for review`, user.id);
      recordResubmission('quiz', quiz.id, nextVersion, user.id);
    });

    auditFromRequest(req, 'quiz.submitted', 'quiz', quiz.id, { title: quiz.title });
    notifyAdminsOfPending('quiz', quiz.id, quiz.title);
    res.json({ quiz: quizDetail(quiz.id, user.id) });
  }),
);

quizzesRouter.post(
  '/:id/unpublish',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const quiz = get<{ creator_id: string; status: string; title: string }>(
      'SELECT creator_id, status, title FROM quizzes WHERE id = ?',
      req.params.id,
    );
    if (!quiz) throw notFound('That quiz does not exist.');
    if (quiz.creator_id !== user.id && user.role !== 'admin') throw forbidden('You can only unpublish your own quizzes.');
    if (quiz.status !== 'approved') throw conflict('Only published quizzes can be unpublished.');
    run("UPDATE quizzes SET status='unpublished', updated_at=? WHERE id=?", nowIso(), req.params.id);
    auditFromRequest(req, 'quiz.unpublished', 'quiz', req.params.id, { title: quiz.title });
    res.json({ ok: true });
  }),
);

quizzesRouter.delete(
  '/:id',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const quiz = get<{ creator_id: string; status: string; total_attempts: number }>(
      'SELECT creator_id, status, total_attempts FROM quizzes WHERE id = ?',
      req.params.id,
    );
    if (!quiz) throw notFound('That quiz does not exist.');
    if (quiz.creator_id !== user.id && user.role !== 'admin') throw forbidden('You can only delete your own quizzes.');
    if (quiz.status === 'approved' && user.role !== 'admin') {
      throw conflict('Published quizzes cannot be deleted. Unpublish it first.');
    }
    if (quiz.total_attempts > 0) {
      throw conflict('This quiz has attempts recorded against it and cannot be deleted.');
    }
    run('DELETE FROM quizzes WHERE id = ?', req.params.id);
    auditFromRequest(req, 'quiz.deleted', 'quiz', req.params.id, {});
    res.json({ ok: true });
  }),
);

// ------------------------------------------------------------------ mine

const mineQuerySchema = z.object({
  status: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(60).optional(),
});

quizzesRouter.get(
  '/mine/list',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const query = parseQuery(mineQuerySchema, req.query);
    const p = paging({ page: query.page, pageSize: query.pageSize ?? 20 });
    const where = new Where().add('q.creator_id = ?', user.id);
    where.addIf(query.status && query.status !== 'all', 'q.status = ?', query.status);

    const rows = all(
      `SELECT ${LIST_COLUMNS} FROM quizzes q
         LEFT JOIN categories c ON c.id = q.category_id
         LEFT JOIN difficulty_levels d ON d.id = q.difficulty_id
         JOIN users u ON u.id = q.creator_id
         ${where.build()}
        ORDER BY q.updated_at DESC LIMIT ? OFFSET ?`,
      ...where.params,
      p.pageSize,
      p.offset,
    );
    const total = count(
      `SELECT COUNT(*) AS total FROM quizzes q
         LEFT JOIN categories c ON c.id = q.category_id
         LEFT JOIN difficulty_levels d ON d.id = q.difficulty_id
         ${where.build()}`,
      ...where.params,
    );
    res.json(pageResult(decorate(rows), total, p));
  }),
);

quizzesRouter.get(
  '/:id/preview',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const quiz = quizDetail(req.params.id, user.id);
    res.json({ quiz });
  }),
);

// ------------------------------------------------------------------ shared helpers

export function promoteToCreator(userId: string): void {
  const row = get<{ role: string }>('SELECT role FROM users WHERE id = ?', userId);
  if (!row || row.role !== 'user') return;
  run('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', 'creator', nowIso(), userId);
  audit({
    actor: null,
    action: 'user.role_changed',
    targetType: 'user',
    targetId: userId,
    metadata: { from: 'user', to: 'creator', reason: 'first_content_submission' },
  });
  notify({
    userId,
    kind: 'system',
    title: 'Creator tools unlocked',
    body: 'You can now see creator analytics and submission tracking in the sidebar.',
    link: '/app/creator',
  });
}

export function recordResubmission(contentType: 'quiz' | 'poll', contentId: string, version: number, actorId: string): void {
  run(
    `INSERT INTO moderation_reviews (id, content_type, content_id, version, reviewer_id, decision, notes, created_at)
     VALUES (?,?,?,?,?, 'resubmitted', ?, ?)`,
    newId(),
    contentType,
    contentId,
    version,
    actorId,
    `Version ${version} submitted for review.`,
    nowIso(),
  );
}

export function notifyAdminsOfPending(contentType: 'quiz' | 'poll', id: string, title: string): void {
  const admins = all<{ id: string }>("SELECT id FROM users WHERE role='admin' AND account_status='active'");
  for (const admin of admins) {
    notify({
      userId: admin.id,
      kind: 'moderation',
      title: `New ${contentType} awaiting review`,
      body: title,
      link: contentType === 'quiz' ? `/admin/quizzes/${id}` : `/admin/polls/${id}`,
    });
  }
}

export { quizDetail, quizInputSchema as quizInput, validateAgainstRules };
