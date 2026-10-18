import { Router } from 'express';
import { z } from 'zod';
import { all, count, get, newId, nowIso, run, tx } from '../db/index.js';
import { conflict, forbidden, notFound, unavailable, validationError } from '../lib/errors.js';
import { handler, parseBody, parseQuery } from '../lib/http.js';
import { auditFromRequest } from '../lib/audit.js';
import { currentUser, requireAuth } from '../lib/auth.js';
import { pageResult, paging, Where } from '../lib/paging.js';
import { getSetting, isFeatureEnabled } from '../lib/settings.js';
import { savePollVersion, ratingSummary, moderationHistory } from '../lib/content.js';
import { notify } from '../lib/notify.js';
import { evaluate } from '../lib/achievements.js';
import { notifyAdminsOfPending, promoteToCreator, recordResubmission } from './quizzes.js';

export const pollsRouter = Router();

const pollInputSchema = z.object({
  question: z.string().trim().min(8, 'Write a poll question of at least 8 characters.').max(160),
  description: z.string().trim().max(2000).default(''),
  categoryId: z.string().trim().nullable().optional(),
  allowMultiple: z.boolean().default(false),
  isAnonymous: z.boolean().default(false),
  visibility: z.enum(['public', 'unlisted']).default('public'),
  closesInDays: z.number().int().min(1).nullable().optional(),
  options: z.array(z.string().trim().min(1, 'Option text is required.').max(160)).min(2).max(8),
});

function validatePollRules(body: z.infer<typeof pollInputSchema>) {
  const rules = getSetting<{ min_options: number; max_options: number; max_duration_days: number }>('poll_rules', {
    min_options: 2,
    max_options: 8,
    max_duration_days: 90,
  });
  const errors: Record<string, string> = {};
  if (body.options.length < rules.min_options) errors.options = `A poll needs at least ${rules.min_options} options.`;
  if (body.options.length > rules.max_options) errors.options = `A poll can have at most ${rules.max_options} options.`;
  if (new Set(body.options.map((o) => o.toLowerCase())).size !== body.options.length) {
    errors.options = 'Each option must be different.';
  }
  if (body.closesInDays && body.closesInDays > rules.max_duration_days) {
    errors.closesInDays = `A poll can run for at most ${rules.max_duration_days} days.`;
  }
  return errors;
}

const LIST_COLUMNS = `
  p.id, p.question, p.description, p.status, p.allow_multiple, p.is_anonymous, p.visibility,
  p.closes_at, p.version, p.submitted_at, p.published_at, p.review_notes, p.quality_rating,
  p.category_id, p.created_at, p.updated_at,
  c.name AS category_name, c.slug AS category_slug,
  u.id AS creator_id, u.username AS creator_username, u.display_name AS creator_name,
  (SELECT COUNT(*) FROM poll_votes v WHERE v.poll_id = p.id) AS vote_count,
  (SELECT COUNT(*) FROM ratings r WHERE r.content_type='poll' AND r.content_id=p.id AND r.status='published') AS rating_count,
  (SELECT ROUND(AVG(score),2) FROM ratings r WHERE r.content_type='poll' AND r.content_id=p.id AND r.status='published') AS rating_average
`;

function decorate(rows: any[]) {
  const now = Date.now();
  return rows.map((r) => ({
    ...r,
    allowMultiple: !!r.allow_multiple,
    isAnonymous: !!r.is_anonymous,
    isClosed: !!r.closes_at && new Date(r.closes_at).getTime() <= now,
    closesAt: r.closes_at,
  }));
}

export function pollOptions(pollId: string, viewerId?: string | null) {
  return all<any>(
    `SELECT o.id, o.position, o.body,
            (SELECT COUNT(*) FROM poll_votes v WHERE v.option_id = o.id) AS votes
       FROM poll_options o WHERE o.poll_id = ? ORDER BY o.position`,
    pollId,
  ).map((o) => ({ id: o.id, position: o.position, body: o.body, votes: o.votes }));
}

const listQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().optional(),
  open: z.enum(['all', 'open', 'closed']).optional(),
  sort: z.enum(['newest', 'popular', 'closing']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(60).optional(),
});

pollsRouter.get(
  '/',
  handler((req, res) => {
    const query = parseQuery(listQuerySchema, req.query);
    const p = paging({ page: query.page, pageSize: query.pageSize ?? 12 });
    const where = new Where().add("p.status = 'published'").add("p.visibility = 'public'");
    where.addIf(query.q, '(p.question LIKE ? OR p.description LIKE ?)', `%${query.q}%`, `%${query.q}%`);
    where.addIf(query.category, 'c.slug = ?', query.category);
    if (query.open === 'open') where.add("(p.closes_at IS NULL OR p.closes_at > ?)", nowIso());
    if (query.open === 'closed') where.add('p.closes_at IS NOT NULL AND p.closes_at <= ?', nowIso());

    const order = {
      newest: 'p.published_at DESC',
      popular: 'vote_count DESC, p.published_at DESC',
      closing: 'p.closes_at IS NULL, p.closes_at ASC',
    }[query.sort ?? 'newest'];

    const rows = all(
      `SELECT ${LIST_COLUMNS} FROM polls p
         LEFT JOIN categories c ON c.id = p.category_id
         JOIN users u ON u.id = p.creator_id
         ${where.build()}
        ORDER BY ${order} LIMIT ? OFFSET ?`,
      ...where.params,
      p.pageSize,
      p.offset,
    );
    const total = count(
      `SELECT COUNT(*) AS total FROM polls p LEFT JOIN categories c ON c.id = p.category_id ${where.build()}`,
      ...where.params,
    );
    res.json(pageResult(decorate(rows), total, p));
  }),
);

function pollDetail(id: string, viewerId: string | null) {
  const row = get<any>(
    `SELECT ${LIST_COLUMNS} FROM polls p
       LEFT JOIN categories c ON c.id = p.category_id
       JOIN users u ON u.id = p.creator_id
      WHERE p.id = ?`,
    id,
  );
  if (!row) throw notFound('That poll does not exist.');
  const [poll] = decorate([row]);
  const options = pollOptions(id);
  const totalVotes = options.reduce((sum: number, o: any) => sum + o.votes, 0);
  const myVotes = viewerId
    ? all<{ option_id: string }>('SELECT option_id FROM poll_votes WHERE poll_id = ? AND user_id = ?', id, viewerId).map(
        (v) => v.option_id,
      )
    : [];
  const myRating = viewerId
    ? get('SELECT id, score, review_text, status FROM ratings WHERE content_type=? AND content_id=? AND user_id=?', 'poll', id, viewerId)
    : undefined;
  return {
    ...poll,
    options: options.map((o: any) => ({ ...o, percent: totalVotes ? Math.round((o.votes / totalVotes) * 100) : 0 })),
    totalVotes,
    myVotes,
    rating: ratingSummary('poll', id),
    myRating: myRating ?? null,
    moderationHistory:
      viewerId && (poll.creator_id === viewerId || isAdminId(viewerId)) ? moderationHistory('poll', id) : null,
  };
}

function isAdminId(userId: string): boolean {
  return get<{ role: string }>('SELECT role FROM users WHERE id = ?', userId)?.role === 'admin';
}

pollsRouter.get(
  '/:id',
  handler((req, res) => {
    const viewer = req.ctx?.user.id ?? null;
    const poll = pollDetail(req.params.id, viewer);
    if (poll.status !== 'published' && poll.creator_id !== viewer && !isAdminId(viewer ?? '')) {
      throw notFound('That poll is not published.');
    }
    res.json({ poll });
  }),
);

// ------------------------------------------------------------------ mutations

function writePoll(pollId: string, body: z.infer<typeof pollInputSchema>): void {
  const closesAt = body.closesInDays ? new Date(Date.now() + body.closesInDays * 86400000).toISOString() : null;
  run(
    `UPDATE polls SET question=?, description=?, category_id=?, allow_multiple=?, is_anonymous=?, visibility=?, closes_at=?, updated_at=?
      WHERE id=?`,
    body.question,
    body.description,
    body.categoryId ?? null,
    body.allowMultiple,
    body.isAnonymous,
    body.visibility,
    closesAt,
    nowIso(),
    pollId,
  );
  run('DELETE FROM poll_options WHERE poll_id = ?', pollId);
  body.options.forEach((option, index) => {
    run('INSERT INTO poll_options (id, poll_id, position, body) VALUES (?,?,?,?)', newId(), pollId, index + 1, option);
  });
}

pollsRouter.post(
  '/',
  requireAuth,
  handler((req, res) => {
    if (!isFeatureEnabled('polls_enabled')) throw unavailable('Poll creation is currently switched off.');
    const user = currentUser(req);
    const body = parseBody(pollInputSchema, req.body);
    const errors = validatePollRules(body);
    if (Object.keys(errors).length) throw validationError('Please correct the highlighted fields.', errors);

    const id = newId();
    const now = nowIso();
    const closesAt = body.closesInDays ? new Date(Date.now() + body.closesInDays * 86400000).toISOString() : null;
    tx(() => {
      run(
        `INSERT INTO polls (id, creator_id, question, description, status, created_at, updated_at)
         VALUES (?,?,?,?, 'draft', ?, ?)`,
        id,
        user.id,
        body.question,
        body.description,
        now,
        now,
      );
      writePoll(id, body);
      promoteToCreator(user.id);
    });
    auditFromRequest(req, 'poll.created', 'poll', id, { question: body.question });
    res.status(201).json({ id, poll: pollDetail(id, user.id) });
  }),
);

pollsRouter.patch(
  '/:id',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const existing = get<{ creator_id: string; status: string }>('SELECT creator_id, status FROM polls WHERE id = ?', req.params.id);
    if (!existing) throw notFound('That poll does not exist.');
    if (existing.creator_id !== user.id && user.role !== 'admin') throw forbidden('You can only edit your own polls.');
    if (!['draft', 'changes_requested', 'rejected'].includes(existing.status) && user.role !== 'admin') {
      throw conflict('This poll is locked while it is under review or published.');
    }
    const body = parseBody(pollInputSchema, req.body);
    const errors = validatePollRules(body);
    if (Object.keys(errors).length) throw validationError('Please correct the highlighted fields.', errors);
    tx(() => {
      writePoll(req.params.id, body);
      run("UPDATE polls SET status = CASE WHEN status='changes_requested' THEN 'draft' ELSE status END WHERE id = ?", req.params.id);
    });
    auditFromRequest(req, 'poll.updated', 'poll', req.params.id, { question: body.question });
    res.json({ poll: pollDetail(req.params.id, user.id) });
  }),
);

pollsRouter.post(
  '/:id/submit',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const poll = get<{ id: string; creator_id: string; status: string; question: string; version: number }>(
      'SELECT id, creator_id, status, question, version FROM polls WHERE id = ?',
      req.params.id,
    );
    if (!poll) throw notFound('That poll does not exist.');
    if (poll.creator_id !== user.id && user.role !== 'admin') throw forbidden('You can only submit your own polls.');
    if (!['draft', 'changes_requested', 'rejected'].includes(poll.status)) {
      throw conflict('This poll has already been submitted for review.');
    }
    const body = parseBody(z.object({ changeNote: z.string().trim().max(400).optional().default('') }), req.body ?? {});
    tx(() => {
      const nextVersion = poll.version + 1;
      run(
        `UPDATE polls SET status='pending_review', submitted_at=?, version=?, updated_at=?, review_notes=NULL WHERE id=?`,
        nowIso(),
        nextVersion,
        nowIso(),
        poll.id,
      );
      savePollVersion(poll.id, body.changeNote || `Version ${nextVersion} submitted for review`, user.id);
      recordResubmission('poll', poll.id, nextVersion, user.id);
    });
    auditFromRequest(req, 'poll.submitted', 'poll', poll.id, { question: poll.question });
    notifyAdminsOfPending('poll', poll.id, poll.question);
    res.json({ poll: pollDetail(poll.id, user.id) });
  }),
);

pollsRouter.post(
  '/:id/unpublish',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const poll = get<{ creator_id: string; status: string; question: string }>(
      'SELECT creator_id, status, question FROM polls WHERE id = ?',
      req.params.id,
    );
    if (!poll) throw notFound('That poll does not exist.');
    if (poll.creator_id !== user.id && user.role !== 'admin') throw forbidden('You can only unpublish your own polls.');
    if (poll.status !== 'published') throw conflict('Only published polls can be unpublished.');
    run("UPDATE polls SET status='unpublished', updated_at=? WHERE id=?", nowIso(), req.params.id);
    auditFromRequest(req, 'poll.unpublished', 'poll', req.params.id, { question: poll.question });
    res.json({ ok: true });
  }),
);

pollsRouter.delete(
  '/:id',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const poll = get<{ creator_id: string; status: string }>('SELECT creator_id, status FROM polls WHERE id = ?', req.params.id);
    if (!poll) throw notFound('That poll does not exist.');
    if (poll.creator_id !== user.id && user.role !== 'admin') throw forbidden('You can only delete your own polls.');
    if (poll.status === 'published' && user.role !== 'admin') throw conflict('Unpublish this poll before deleting it.');
    run('DELETE FROM polls WHERE id = ?', req.params.id);
    auditFromRequest(req, 'poll.deleted', 'poll', req.params.id, {});
    res.json({ ok: true });
  }),
);

// ------------------------------------------------------------------ voting

const voteSchema = z.object({ optionIds: z.array(z.string().min(1)).min(1).max(8) });

pollsRouter.put(
  '/:id/vote',
  requireAuth,
  handler((req, res) => {
    if (!isFeatureEnabled('polls_enabled')) throw unavailable('Polls are currently switched off.');
    const user = currentUser(req);
    const poll = get<{ id: string; status: string; allow_multiple: number; closes_at: string | null; question: string; creator_id: string }>(
      'SELECT id, status, allow_multiple, closes_at, question, creator_id FROM polls WHERE id = ?',
      req.params.id,
    );
    if (!poll) throw notFound('That poll does not exist.');
    if (poll.status !== 'published') throw conflict('This poll is not open for voting.');
    if (poll.closes_at && new Date(poll.closes_at).getTime() <= Date.now()) throw conflict('This poll has closed.');

    const body = parseBody(voteSchema, req.body);
    const unique = [...new Set(body.optionIds)];
    if (!poll.allow_multiple && unique.length > 1) throw conflict('This poll accepts a single choice.');

    const valid = all<{ id: string }>('SELECT id FROM poll_options WHERE poll_id = ?', poll.id).map((o) => o.id);
    if (unique.some((id) => !valid.includes(id))) throw conflict('One of those options is not part of this poll.');

    tx(() => {
      run('DELETE FROM poll_votes WHERE poll_id = ? AND user_id = ?', poll.id, user.id);
      for (const optionId of unique) {
        run(
          'INSERT OR IGNORE INTO poll_votes (id, poll_id, option_id, user_id, created_at) VALUES (?,?,?,?,?)',
          newId(),
          poll.id,
          optionId,
          user.id,
          nowIso(),
        );
      }
    });

    if (poll.creator_id !== user.id) {
      notify({
        userId: poll.creator_id,
        kind: 'system',
        title: 'New vote on your poll',
        body: `${user.displayName} voted on "${poll.question}".`,
        link: '/app/creator',
      });
    }
    evaluate(user.id);
    res.json({ poll: pollDetail(poll.id, user.id) });
  }),
);

pollsRouter.delete(
  '/:id/vote',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const poll = get<{ id: string; closes_at: string | null; status: string }>(
      'SELECT id, closes_at, status FROM polls WHERE id = ?',
      req.params.id,
    );
    if (!poll) throw notFound('That poll does not exist.');
    if (poll.closes_at && new Date(poll.closes_at).getTime() <= Date.now()) throw conflict('This poll has closed.');
    run('DELETE FROM poll_votes WHERE poll_id = ? AND user_id = ?', poll.id, user.id);
    res.json({ poll: pollDetail(poll.id, user.id) });
  }),
);

// ------------------------------------------------------------------ mine

pollsRouter.get(
  '/mine/list',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const query = parseQuery(
      z.object({
        status: z.string().trim().optional(),
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(60).optional(),
      }),
      req.query,
    );
    const p = paging({ page: query.page, pageSize: query.pageSize ?? 20 });
    const where = new Where().add('p.creator_id = ?', user.id);
    where.addIf(query.status && query.status !== 'all', 'p.status = ?', query.status);
    const rows = all(
      `SELECT ${LIST_COLUMNS} FROM polls p
         LEFT JOIN categories c ON c.id = p.category_id
         JOIN users u ON u.id = p.creator_id
         ${where.build()} ORDER BY p.updated_at DESC LIMIT ? OFFSET ?`,
      ...where.params,
      p.pageSize,
      p.offset,
    );
    const total = count(
      `SELECT COUNT(*) AS total FROM polls p LEFT JOIN categories c ON c.id = p.category_id ${where.build()}`,
      ...where.params,
    );
    res.json(pageResult(decorate(rows), total, p));
  }),
);

export { pollDetail };
