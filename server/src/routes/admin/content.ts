import { Router } from 'express';
import { z } from 'zod';
import { all, count, get, newId, nowIso, run, tx } from '../../db/index.js';
import { conflict, notFound, validationError } from '../../lib/errors.js';
import { handler, parseBody, parseQuery } from '../../lib/http.js';
import { auditFromRequest } from '../../lib/audit.js';
import { currentUser } from '../../lib/auth.js';
import { pageResult, paging, Where } from '../../lib/paging.js';
import { moderationHistory, recordReview, ratingSummary } from '../../lib/content.js';
import { notify, renderTemplate } from '../../lib/notify.js';

export const adminContentRouter = Router();

// ------------------------------------------------------------------ quiz list

const QUIZ_COLUMNS = `
  q.id, q.title, q.summary, q.status, q.entry_fee, q.reward_coins, q.passing_score, q.version,
  q.submitted_at, q.published_at, q.updated_at, q.created_at, q.review_notes, q.quality_rating, q.total_attempts,
  c.name AS category_name, d.name AS difficulty_name,
  u.id AS creator_id, u.username AS creator_username, u.display_name AS creator_name,
  (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS question_count,
  (SELECT COUNT(*) FROM moderation_reviews m WHERE m.content_type='quiz' AND m.content_id=q.id) AS review_count,
  (SELECT m.decision FROM moderation_reviews m WHERE m.content_type='quiz' AND m.content_id=q.id AND m.decision<>'resubmitted' ORDER BY m.created_at DESC LIMIT 1) AS previous_decision
`;

const listSchema = z.object({
  status: z.string().trim().optional(),
  q: z.string().trim().max(120).optional(),
  creator: z.string().trim().optional(),
  category: z.string().trim().optional(),
  sort: z.enum(['newest', 'oldest', 'attempts', 'title']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

adminContentRouter.get(
  '/quizzes',
  handler((req, res) => {
    const query = parseQuery(listSchema, req.query);
    const p = paging({ page: query.page, pageSize: query.pageSize ?? 25 });
    const where = new Where();
    where.addIf(query.status && query.status !== 'all', 'q.status = ?', query.status);
    where.addIf(query.q, '(q.title LIKE ? OR q.summary LIKE ?)', `%${query.q}%`, `%${query.q}%`);
    where.addIf(query.creator, '(u.username LIKE ? OR u.display_name LIKE ?)', `%${query.creator}%`, `%${query.creator}%`);
    where.addIf(query.category, 'c.slug = ?', query.category);

    const order = {
      newest: 'q.submitted_at DESC NULLS LAST, q.created_at DESC',
      oldest: 'q.submitted_at ASC NULLS FIRST, q.created_at ASC',
      attempts: 'q.total_attempts DESC',
      title: 'q.title ASC',
    }[query.sort ?? 'newest'];

    const rows = all(
      `SELECT ${QUIZ_COLUMNS} FROM quizzes q
         LEFT JOIN categories c ON c.id = q.category_id
         LEFT JOIN difficulty_levels d ON d.id = q.difficulty_id
         JOIN users u ON u.id = q.creator_id
         ${where.build()} ORDER BY ${order} LIMIT ? OFFSET ?`,
      ...where.params,
      p.pageSize,
      p.offset,
    );
    const total = count(
      `SELECT COUNT(*) AS total FROM quizzes q
         LEFT JOIN categories c ON c.id = q.category_id
         LEFT JOIN difficulty_levels d ON d.id = q.difficulty_id
         JOIN users u ON u.id = q.creator_id ${where.build()}`,
      ...where.params,
    );
    res.json(pageResult(rows, total, p));
  }),
);

// ------------------------------------------------------------------ poll list

const POLL_COLUMNS = `
  p.id, p.question AS title, p.description AS summary, p.status, p.closes_at, p.version,
  p.submitted_at, p.published_at, p.updated_at, p.created_at, p.review_notes, p.quality_rating,
  c.name AS category_name,
  u.id AS creator_id, u.username AS creator_username, u.display_name AS creator_name,
  (SELECT COUNT(*) FROM poll_options o WHERE o.poll_id = p.id) AS option_count,
  (SELECT COUNT(*) FROM poll_votes v WHERE v.poll_id = p.id) AS vote_count,
  (SELECT COUNT(*) FROM moderation_reviews m WHERE m.content_type='poll' AND m.content_id=p.id) AS review_count,
  (SELECT m.decision FROM moderation_reviews m WHERE m.content_type='poll' AND m.content_id=p.id AND m.decision<>'resubmitted' ORDER BY m.created_at DESC LIMIT 1) AS previous_decision
`;

adminContentRouter.get(
  '/polls',
  handler((req, res) => {
    const query = parseQuery(listSchema, req.query);
    const p = paging({ page: query.page, pageSize: query.pageSize ?? 25 });
    const where = new Where();
    where.addIf(query.status && query.status !== 'all', 'p.status = ?', query.status);
    where.addIf(query.q, '(p.question LIKE ? OR p.description LIKE ?)', `%${query.q}%`, `%${query.q}%`);
    where.addIf(query.creator, '(u.username LIKE ? OR u.display_name LIKE ?)', `%${query.creator}%`, `%${query.creator}%`);
    where.addIf(query.category, 'c.slug = ?', query.category);

    const order = {
      newest: 'p.submitted_at DESC NULLS LAST, p.created_at DESC',
      oldest: 'p.submitted_at ASC NULLS FIRST, p.created_at ASC',
      attempts: 'vote_count DESC',
      title: 'p.question ASC',
    }[query.sort ?? 'newest'];

    const rows = all(
      `SELECT ${POLL_COLUMNS} FROM polls p
         LEFT JOIN categories c ON c.id = p.category_id
         JOIN users u ON u.id = p.creator_id
         ${where.build()} ORDER BY ${order} LIMIT ? OFFSET ?`,
      ...where.params,
      p.pageSize,
      p.offset,
    );
    const total = count(
      `SELECT COUNT(*) AS total FROM polls p
         LEFT JOIN categories c ON c.id = p.category_id
         JOIN users u ON u.id = p.creator_id ${where.build()}`,
      ...where.params,
    );
    res.json(pageResult(rows, total, p));
  }),
);

// ------------------------------------------------------------------ combined queue

adminContentRouter.get(
  '/queue',
  handler((req, res) => {
    const query = parseQuery(
      z.object({
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(100).optional(),
        type: z.enum(['all', 'quiz', 'poll']).optional(),
      }),
      req.query,
    );
    const p = paging({ page: query.page, pageSize: query.pageSize ?? 25 });
    const includeQuiz = !query.type || query.type === 'all' || query.type === 'quiz';
    const includePoll = !query.type || query.type === 'all' || query.type === 'poll';

    const items: any[] = [];
    if (includeQuiz) {
      items.push(
        ...all(
          `SELECT 'quiz' AS content_type, ${QUIZ_COLUMNS} FROM quizzes q
             LEFT JOIN categories c ON c.id = q.category_id
             LEFT JOIN difficulty_levels d ON d.id = q.difficulty_id
             JOIN users u ON u.id = q.creator_id
            WHERE q.status IN ('pending_review','changes_requested')
            ORDER BY q.submitted_at ASC`,
        ),
      );
    }
    if (includePoll) {
      items.push(
        ...all(
          `SELECT 'poll' AS content_type, ${POLL_COLUMNS} FROM polls p
             LEFT JOIN categories c ON c.id = p.category_id
             JOIN users u ON u.id = p.creator_id
            WHERE p.status IN ('pending_review','changes_requested')
            ORDER BY p.submitted_at ASC`,
        ),
      );
    }
    items.sort((a, b) => String(a.submitted_at ?? '').localeCompare(String(b.submitted_at ?? '')));
    const slice = items.slice(p.offset, p.offset + p.pageSize);
    res.json(pageResult(slice, items.length, p));
  }),
);

// ------------------------------------------------------------------ detail

function quizFull(id: string) {
  const quiz = get<any>(
    `SELECT q.*, c.name AS category_name, d.name AS difficulty_name,
            u.id AS creator_id, u.username AS creator_username, u.display_name AS creator_name
       FROM quizzes q
       LEFT JOIN categories c ON c.id = q.category_id
       LEFT JOIN difficulty_levels d ON d.id = q.difficulty_id
       JOIN users u ON u.id = q.creator_id
      WHERE q.id = ?`,
    id,
  );
  if (!quiz) throw notFound('That quiz does not exist.');

  const questions = all<any>(
    'SELECT id, position, prompt, question_type AS type, points, explanation FROM quiz_questions WHERE quiz_id = ? ORDER BY position',
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

  return {
    contentType: 'quiz' as const,
    ...quiz,
    tags: all('SELECT t.id, t.name, t.slug FROM quiz_tags qt JOIN tags t ON t.id = qt.tag_id WHERE qt.quiz_id = ?', id),
    questions,
    rating: ratingSummary('quiz', id),
    history: moderationHistory('quiz', id),
    versions: all(
      `SELECT v.id, v.version, v.change_note, v.created_at, u.display_name AS created_by_name
         FROM quiz_versions v LEFT JOIN users u ON u.id = v.created_by
        WHERE v.quiz_id = ? ORDER BY v.version DESC`,
      id,
    ),
    attemptStats: get(
      `SELECT COUNT(*) AS attempts,
              SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) AS passes,
              ROUND(AVG(score_percent),1) AS average_score,
              SUM(entry_fee_charged) AS fees_collected,
              SUM(reward_paid) AS rewards_paid
         FROM quiz_attempts WHERE quiz_id = ? AND status = 'submitted'`,
      id,
    ) ?? { attempts: 0, passes: 0, average_score: null, fees_collected: 0, rewards_paid: 0 },
    reports: all(
      `SELECT r.id, r.reason, r.details, r.status, r.created_at, u.username AS reporter
         FROM reports r JOIN users u ON u.id = r.reporter_id
        WHERE r.target_type = 'quiz' AND r.target_id = ? ORDER BY r.created_at DESC`,
      id,
    ),
  };
}

function pollFull(id: string) {
  const poll = get<any>(
    `SELECT p.*, c.name AS category_name,
            u.id AS creator_id, u.username AS creator_username, u.display_name AS creator_name
       FROM polls p
       LEFT JOIN categories c ON c.id = p.category_id
       JOIN users u ON u.id = p.creator_id
      WHERE p.id = ?`,
    id,
  );
  if (!poll) throw notFound('That poll does not exist.');

  const options = all<any>(
    `SELECT o.id, o.position, o.body, (SELECT COUNT(*) FROM poll_votes v WHERE v.option_id = o.id) AS votes
       FROM poll_options o WHERE o.poll_id = ? ORDER BY o.position`,
    id,
  );
  const totalVotes = options.reduce((sum: number, o: any) => sum + o.votes, 0);

  return {
    contentType: 'poll' as const,
    ...poll,
    options: options.map((o: any) => ({ ...o, percent: totalVotes ? Math.round((o.votes / totalVotes) * 100) : 0 })),
    totalVotes,
    rating: ratingSummary('poll', id),
    history: moderationHistory('poll', id),
    versions: all(
      `SELECT v.id, v.version, v.change_note, v.created_at, u.display_name AS created_by_name
         FROM poll_versions v LEFT JOIN users u ON u.id = v.created_by
        WHERE v.poll_id = ? ORDER BY v.version DESC`,
      id,
    ),
    reports: all(
      `SELECT r.id, r.reason, r.details, r.status, r.created_at, u.username AS reporter
         FROM reports r JOIN users u ON u.id = r.reporter_id
        WHERE r.target_type = 'poll' AND r.target_id = ? ORDER BY r.created_at DESC`,
      id,
    ),
  };
}

adminContentRouter.get('/quizzes/:id', handler((req, res) => res.json({ item: quizFull(req.params.id) })));
adminContentRouter.get('/polls/:id', handler((req, res) => res.json({ item: pollFull(req.params.id) })));

adminContentRouter.get(
  '/versions/compare',
  handler((req, res) => {
    const query = parseQuery(
      z.object({
        contentType: z.enum(['quiz', 'poll']),
        contentId: z.string().min(1),
        from: z.coerce.number().int().min(1),
        to: z.coerce.number().int().min(1),
      }),
      req.query,
    );
    const table = query.contentType === 'quiz' ? 'quiz_versions' : 'poll_versions';
    const column = query.contentType === 'quiz' ? 'quiz_id' : 'poll_id';
    const a = get<{ version: number; snapshot: string; change_note: string; created_at: string }>(
      `SELECT version, snapshot, change_note, created_at FROM ${table} WHERE ${column} = ? AND version = ?`,
      query.contentId,
      query.from,
    );
    const b = get<{ version: number; snapshot: string; change_note: string; created_at: string }>(
      `SELECT version, snapshot, change_note, created_at FROM ${table} WHERE ${column} = ? AND version = ?`,
      query.contentId,
      query.to,
    );
    res.json({
      from: a ? { ...a, snapshot: JSON.parse(a.snapshot) } : null,
      to: b ? { ...b, snapshot: JSON.parse(b.snapshot) } : null,
    });
  }),
);

// ------------------------------------------------------------------ decisions

const decisionSchema = z.object({
  reason: z.string().trim().max(1000).default(''),
  notes: z.string().trim().max(2000).default(''),
  qualityRating: z.number().int().min(1).max(5).nullable().optional(),
});

function requireReason(body: z.infer<typeof decisionSchema>) {
  if (!body.reason || body.reason.trim().length < 5) {
    throw validationError('A reason is required for this decision.', { reason: 'Describe why you are taking this action.' });
  }
}

function decide(
  req: any,
  contentType: 'quiz' | 'poll',
  id: string,
  decision: 'approved' | 'rejected' | 'changes_requested' | 'unpublished',
  body: z.infer<typeof decisionSchema>,
) {
  const admin = currentUser(req);
  const table = contentType === 'quiz' ? 'quizzes' : 'polls';
  const publishedState = contentType === 'quiz' ? 'approved' : 'published';
  const titleColumn = contentType === 'quiz' ? 'title' : 'question';

  const row = get<{ id: string; creator_id: string; status: string; version: number }>(
    `SELECT id, creator_id, status, version FROM ${table} WHERE id = ?`,
    id,
  );
  if (!row) throw notFound('That content does not exist.');

  const nextStatus = {
    approved: publishedState,
    rejected: 'rejected',
    changes_requested: 'changes_requested',
    unpublished: 'unpublished',
  }[decision];

  if (decision === 'approved' && row.status === publishedState) throw conflict('This content is already published.');
  if (decision === 'unpublished' && row.status !== publishedState) throw conflict('Only published content can be unpublished.');

  tx(() => {
    if (decision === 'approved') {
      run(
        `UPDATE ${table} SET status=?, published_at=?, reviewed_at=?, reviewed_by=?, review_notes=?, quality_rating=?, updated_at=? WHERE id=?`,
        nextStatus,
        nowIso(),
        nowIso(),
        admin.id,
        body.notes || null,
        body.qualityRating ?? null,
        nowIso(),
        id,
      );
    } else {
      run(
        `UPDATE ${table} SET status=?, reviewed_at=?, reviewed_by=?, review_notes=?, quality_rating=?, updated_at=? WHERE id=?`,
        nextStatus,
        nowIso(),
        admin.id,
        body.notes || null,
        body.qualityRating ?? null,
        nowIso(),
        id,
      );
    }
    recordReview({
      contentType,
      contentId: id,
      version: row.version,
      reviewerId: admin.id,
      decision,
      reason: body.reason || null,
      notes: body.notes,
      qualityRating: body.qualityRating ?? null,
    });
  });

  const title =
    get<{ t: string }>(`SELECT ${titleColumn} AS t FROM ${table} WHERE id = ?`, id)?.t ?? 'your submission';

  const templateKey = `${contentType}_${
    decision === 'approved' ? 'approved' : decision === 'rejected' ? 'rejected' : 'changes_requested'
  }`;
  const fallback =
    decision === 'approved'
      ? `Your ${contentType} "${title}" was approved and is now published.`
      : decision === 'rejected'
        ? `Your ${contentType} "${title}" was rejected. Reason: ${body.reason}`
        : decision === 'changes_requested'
          ? `Changes were requested for your ${contentType} "${title}". Reason: ${body.reason}`
          : `Your ${contentType} "${title}" was unpublished. Reason: ${body.reason}`;

  notify({
    userId: row.creator_id,
    kind: contentType === 'quiz' ? 'quiz_review' : 'poll_review',
    title:
      decision === 'approved'
        ? `${contentType === 'quiz' ? 'Quiz' : 'Poll'} approved`
        : decision === 'rejected'
          ? `${contentType === 'quiz' ? 'Quiz' : 'Poll'} rejected`
          : decision === 'changes_requested'
            ? 'Changes requested'
            : `${contentType === 'quiz' ? 'Quiz' : 'Poll'} unpublished`,
    body: renderTemplate(templateKey, { title, reason: body.reason || '' }, fallback),
    link: contentType === 'quiz' ? `/app/quizzes/${id}` : `/app/polls/${id}`,
  });

  auditFromRequest(req, `moderation.${decision}`, contentType, id, {
    reason: body.reason,
    version: row.version,
    qualityRating: body.qualityRating ?? null,
  });
}

adminContentRouter.post(
  '/quizzes/:id/approve',
  handler((req, res) => {
    decide(req, 'quiz', req.params.id, 'approved', parseBody(decisionSchema, req.body));
    res.json({ ok: true });
  }),
);
adminContentRouter.post(
  '/quizzes/:id/reject',
  handler((req, res) => {
    const body = parseBody(decisionSchema, req.body);
    requireReason(body);
    decide(req, 'quiz', req.params.id, 'rejected', body);
    res.json({ ok: true });
  }),
);
adminContentRouter.post(
  '/quizzes/:id/request-changes',
  handler((req, res) => {
    const body = parseBody(decisionSchema, req.body);
    requireReason(body);
    decide(req, 'quiz', req.params.id, 'changes_requested', body);
    res.json({ ok: true });
  }),
);
adminContentRouter.post(
  '/quizzes/:id/unpublish',
  handler((req, res) => {
    const body = parseBody(decisionSchema, req.body);
    requireReason(body);
    decide(req, 'quiz', req.params.id, 'unpublished', body);
    res.json({ ok: true });
  }),
);

adminContentRouter.post(
  '/polls/:id/approve',
  handler((req, res) => {
    decide(req, 'poll', req.params.id, 'approved', parseBody(decisionSchema, req.body));
    res.json({ ok: true });
  }),
);
adminContentRouter.post(
  '/polls/:id/reject',
  handler((req, res) => {
    const body = parseBody(decisionSchema, req.body);
    requireReason(body);
    decide(req, 'poll', req.params.id, 'rejected', body);
    res.json({ ok: true });
  }),
);
adminContentRouter.post(
  '/polls/:id/request-changes',
  handler((req, res) => {
    const body = parseBody(decisionSchema, req.body);
    requireReason(body);
    decide(req, 'poll', req.params.id, 'changes_requested', body);
    res.json({ ok: true });
  }),
);
adminContentRouter.post(
  '/polls/:id/unpublish',
  handler((req, res) => {
    const body = parseBody(decisionSchema, req.body);
    requireReason(body);
    decide(req, 'poll', req.params.id, 'unpublished', body);
    res.json({ ok: true });
  }),
);

/** Internal note + quality rating that does not change the workflow state. */
const annotateSchema = z.object({
  notes: z.string().trim().max(2000).default(''),
  qualityRating: z.number().int().min(1).max(5).nullable().optional(),
});

for (const contentType of ['quizzes', 'polls'] as const) {
  adminContentRouter.post(
    `/${contentType}/:id/annotate`,
    handler((req, res) => {
      const admin = currentUser(req);
      const body = parseBody(annotateSchema, req.body);
      const type = contentType === 'quizzes' ? 'quiz' : 'poll';
      const table = contentType;
      const row = get<{ id: string; version: number }>(`SELECT id, version FROM ${table} WHERE id = ?`, req.params.id);
      if (!row) throw notFound('That content does not exist.');
      tx(() => {
        if (body.qualityRating !== undefined) {
          run(`UPDATE ${table} SET quality_rating = ?, updated_at = ? WHERE id = ?`, body.qualityRating, nowIso(), row.id);
        }
        recordReview({
          contentType: type,
          contentId: row.id,
          version: row.version,
          reviewerId: admin.id,
          decision: 'resubmitted',
          notes: body.notes || 'Internal review note',
          qualityRating: body.qualityRating ?? null,
        });
      });
      auditFromRequest(req, 'moderation.note', type, row.id, { qualityRating: body.qualityRating ?? null });
      res.json({ ok: true });
    }),
  );
}

// ------------------------------------------------------------------ taxonomy

adminContentRouter.get(
  '/categories',
  handler((_req, res) => {
    res.json({
      items: all(
        `SELECT c.id, c.name, c.slug, c.description, c.parent_id, c.sort_order, c.is_active, c.created_at,
                p.name AS parent_name,
                (SELECT COUNT(*) FROM quizzes q WHERE q.category_id = c.id) AS quiz_count,
                (SELECT COUNT(*) FROM polls p2 WHERE p2.category_id = c.id) AS poll_count
           FROM categories c LEFT JOIN categories p ON p.id = c.parent_id
          ORDER BY c.sort_order, c.name`,
      ),
    });
  }),
);

const categorySchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(60),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens only.'),
  description: z.string().trim().max(400).default(''),
  parentId: z.string().trim().nullable().optional(),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

adminContentRouter.post(
  '/categories',
  handler((req, res) => {
    const body = parseBody(categorySchema, req.body);
    if (get('SELECT 1 FROM categories WHERE slug = ?', body.slug)) {
      throw conflict('A category with that slug already exists.');
    }
    const id = newId();
    run(
      `INSERT INTO categories (id, name, slug, description, parent_id, sort_order, is_active, created_at)
       VALUES (?,?,?,?,?,?,1,?)`,
      id,
      body.name,
      body.slug,
      body.description,
      body.parentId ?? null,
      body.sortOrder,
      nowIso(),
    );
    auditFromRequest(req, 'content.category_created', 'category', id, { name: body.name });
    res.status(201).json({ id });
  }),
);

adminContentRouter.patch(
  '/categories/:id',
  handler((req, res) => {
    const body = parseBody(categorySchema.partial(), req.body);
    const existing = get<{ id: string }>('SELECT id FROM categories WHERE id = ?', req.params.id);
    if (!existing) throw notFound('That category does not exist.');
    if (body.slug && get('SELECT 1 FROM categories WHERE slug = ? AND id <> ?', body.slug, req.params.id)) {
      throw conflict('Another category already uses that slug.');
    }
    if (body.parentId === req.params.id) throw conflict('A category cannot be its own parent.');
    run(
      `UPDATE categories SET
         name = COALESCE(?, name), slug = COALESCE(?, slug), description = COALESCE(?, description),
         parent_id = CASE WHEN ? IS NULL THEN parent_id ELSE ? END,
         sort_order = COALESCE(?, sort_order)
       WHERE id = ?`,
      body.name ?? null,
      body.slug ?? null,
      body.description ?? null,
      body.parentId === undefined ? null : body.parentId,
      body.parentId ?? null,
      body.sortOrder ?? null,
      req.params.id,
    );
    auditFromRequest(req, 'content.category_updated', 'category', req.params.id, body);
    res.json({ ok: true });
  }),
);

adminContentRouter.post(
  '/categories/:id/toggle',
  handler((req, res) => {
    run('UPDATE categories SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE id = ?', req.params.id);
    auditFromRequest(req, 'content.category_toggled', 'category', req.params.id, {});
    res.json({ ok: true });
  }),
);

adminContentRouter.delete(
  '/categories/:id',
  handler((req, res) => {
    const usage = count('SELECT COUNT(*) AS t FROM quizzes WHERE category_id = ?', req.params.id) +
      count('SELECT COUNT(*) AS t FROM polls WHERE category_id = ?', req.params.id);
    if (usage > 0) throw conflict(`${usage} item(s) use this category. Deactivate it instead.`);
    run('DELETE FROM categories WHERE id = ?', req.params.id);
    auditFromRequest(req, 'content.category_deleted', 'category', req.params.id, {});
    res.json({ ok: true });
  }),
);

adminContentRouter.get(
  '/tags',
  handler((_req, res) => {
    res.json({
      items: all(
        `SELECT t.id, t.name, t.slug, t.created_at,
                (SELECT COUNT(*) FROM quiz_tags qt WHERE qt.tag_id = t.id) AS usage_count
           FROM tags t ORDER BY t.name`,
      ),
    });
  }),
);

const tagSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(40),
  slug: z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens only.'),
});

adminContentRouter.post(
  '/tags',
  handler((req, res) => {
    const body = parseBody(tagSchema, req.body);
    if (get('SELECT 1 FROM tags WHERE slug = ?', body.slug)) throw conflict('That tag already exists.');
    const id = newId();
    run('INSERT INTO tags (id, name, slug, created_at) VALUES (?,?,?,?)', id, body.name, body.slug, nowIso());
    auditFromRequest(req, 'content.tag_created', 'tag', id, { name: body.name });
    res.status(201).json({ id });
  }),
);

adminContentRouter.patch(
  '/tags/:id',
  handler((req, res) => {
    const body = parseBody(tagSchema.partial(), req.body);
    run(
      'UPDATE tags SET name = COALESCE(?, name), slug = COALESCE(?, slug) WHERE id = ?',
      body.name ?? null,
      body.slug ?? null,
      req.params.id,
    );
    auditFromRequest(req, 'content.tag_updated', 'tag', req.params.id, body);
    res.json({ ok: true });
  }),
);

adminContentRouter.delete(
  '/tags/:id',
  handler((req, res) => {
    run('DELETE FROM tags WHERE id = ?', req.params.id);
    auditFromRequest(req, 'content.tag_deleted', 'tag', req.params.id, {});
    res.json({ ok: true });
  }),
);

adminContentRouter.get(
  '/difficulties',
  handler((_req, res) => {
    res.json({
      items: all(
        `SELECT d.id, d.name, d.slug, d.sort_order,
                (SELECT COUNT(*) FROM quizzes q WHERE q.difficulty_id = d.id) AS usage_count
           FROM difficulty_levels d ORDER BY d.sort_order, d.name`,
      ),
    });
  }),
);

const difficultySchema = z.object({
  name: z.string().trim().min(2).max(40),
  slug: z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens only.'),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

adminContentRouter.post(
  '/difficulties',
  handler((req, res) => {
    const body = parseBody(difficultySchema, req.body);
    if (get('SELECT 1 FROM difficulty_levels WHERE slug = ?', body.slug)) throw conflict('That level already exists.');
    const id = newId();
    run(
      'INSERT INTO difficulty_levels (id, name, slug, sort_order) VALUES (?,?,?,?)',
      id,
      body.name,
      body.slug,
      body.sortOrder,
    );
    auditFromRequest(req, 'content.difficulty_created', 'difficulty', id, { name: body.name });
    res.status(201).json({ id });
  }),
);

adminContentRouter.patch(
  '/difficulties/:id',
  handler((req, res) => {
    const body = parseBody(difficultySchema.partial(), req.body);
    run(
      'UPDATE difficulty_levels SET name = COALESCE(?, name), slug = COALESCE(?, slug), sort_order = COALESCE(?, sort_order) WHERE id = ?',
      body.name ?? null,
      body.slug ?? null,
      body.sortOrder ?? null,
      req.params.id,
    );
    auditFromRequest(req, 'content.difficulty_updated', 'difficulty', req.params.id, body);
    res.json({ ok: true });
  }),
);

adminContentRouter.delete(
  '/difficulties/:id',
  handler((req, res) => {
    const used = count('SELECT COUNT(*) AS t FROM quizzes WHERE difficulty_id = ?', req.params.id);
    if (used > 0) throw conflict(`${used} quiz(s) use this level. Reassign them first.`);
    run('DELETE FROM difficulty_levels WHERE id = ?', req.params.id);
    auditFromRequest(req, 'content.difficulty_deleted', 'difficulty', req.params.id, {});
    res.json({ ok: true });
  }),
);

export { quizFull, pollFull };
