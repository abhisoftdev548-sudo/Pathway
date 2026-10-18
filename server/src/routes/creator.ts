import { Router } from 'express';
import { z } from 'zod';
import { all, count, get, nowIso } from '../db/index.js';
import { handler, parseQuery } from '../lib/http.js';
import { currentUser, requireAuth } from '../lib/auth.js';
import { pageResult, paging, Where, dateRangeTo, dayKey } from '../lib/paging.js';

export const creatorRouter = Router();
creatorRouter.use(requireAuth);

/** Aggregated, DB-backed summary for the signed-in creator. */
creatorRouter.get(
  '/overview',
  handler((req, res) => {
    const user = currentUser(req);
    const uid = user.id;

    const counts = {
      quizzesDraft: count("SELECT COUNT(*) AS t FROM quizzes WHERE creator_id = ? AND status = 'draft'", uid),
      quizzesPending: count("SELECT COUNT(*) AS t FROM quizzes WHERE creator_id = ? AND status = 'pending_review'", uid),
      quizzesChangesRequested: count(
        "SELECT COUNT(*) AS t FROM quizzes WHERE creator_id = ? AND status = 'changes_requested'",
        uid,
      ),
      quizzesApproved: count("SELECT COUNT(*) AS t FROM quizzes WHERE creator_id = ? AND status = 'approved'", uid),
      quizzesRejected: count("SELECT COUNT(*) AS t FROM quizzes WHERE creator_id = ? AND status = 'rejected'", uid),
      pollsDraft: count("SELECT COUNT(*) AS t FROM polls WHERE creator_id = ? AND status = 'draft'", uid),
      pollsPending: count("SELECT COUNT(*) AS t FROM polls WHERE creator_id = ? AND status = 'pending_review'", uid),
      pollsPublished: count("SELECT COUNT(*) AS t FROM polls WHERE creator_id = ? AND status = 'published'", uid),
    };

    // Attempts and votes across everything this creator has published.
    const engagement = get<{ attempts: number; passes: number; votes: number; average_score: number | null }>(
      `SELECT
         (SELECT COUNT(*) FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id
           WHERE q.creator_id = ? AND a.status = 'submitted') AS attempts,
         (SELECT COUNT(*) FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id
           WHERE q.creator_id = ? AND a.status = 'submitted' AND a.passed = 1) AS passes,
         (SELECT COUNT(*) FROM poll_votes v JOIN polls p ON p.id = v.poll_id WHERE p.creator_id = ?) AS votes,
         (SELECT ROUND(AVG(a.score_percent),1) FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id
           WHERE q.creator_id = ? AND a.status = 'submitted') AS average_score`,
      uid,
      uid,
      uid,
      uid,
    );

    const ratings = get<{ n: number; avg: number | null }>(
      `SELECT COUNT(*) AS n, ROUND(AVG(score),2) AS avg FROM ratings r
        WHERE r.status = 'published' AND (
          (r.content_type = 'quiz' AND r.content_id IN (SELECT id FROM quizzes WHERE creator_id = ?)) OR
          (r.content_type = 'poll' AND r.content_id IN (SELECT id FROM polls WHERE creator_id = ?))
        )`,
      uid,
      uid,
    );

    const latestDecisions = all(
      `SELECT m.decision, m.reason, m.created_at, m.content_type, m.content_id,
              CASE WHEN m.content_type = 'quiz'
                   THEN (SELECT title FROM quizzes WHERE id = m.content_id)
                   ELSE (SELECT question FROM polls WHERE id = m.content_id) END AS content_title
         FROM moderation_reviews m
        WHERE (m.content_type = 'quiz' AND m.content_id IN (SELECT id FROM quizzes WHERE creator_id = ?))
           OR (m.content_type = 'poll' AND m.content_id IN (SELECT id FROM polls WHERE creator_id = ?))
        ORDER BY m.created_at DESC LIMIT 8`,
      uid,
      uid,
    );

    const topContent = all(
      `SELECT q.id, q.title, q.total_attempts, q.reward_coins,
              (SELECT ROUND(AVG(score),2) FROM ratings r WHERE r.content_type='quiz' AND r.content_id=q.id AND r.status='published') AS rating_average
         FROM quizzes q WHERE q.creator_id = ? AND q.status = 'approved'
        ORDER BY q.total_attempts DESC, q.published_at DESC LIMIT 5`,
      uid,
    );

    res.json({
      counts,
      engagement: {
        attempts: engagement?.attempts ?? 0,
        passes: engagement?.passes ?? 0,
        votes: engagement?.votes ?? 0,
        averageScore: engagement?.average_score ?? null,
      },
      ratings: { count: ratings?.n ?? 0, average: ratings?.avg ?? null },
      latestDecisions,
      topContent,
    });
  }),
);

creatorRouter.get(
  '/analytics',
  handler((req, res) => {
    const user = currentUser(req);
    const query = parseQuery(
      z.object({ days: z.coerce.number().int().min(1).max(180).optional().default(30) }),
      req.query,
    );
    const from = new Date(Date.now() - query.days * 86400000).toISOString();

    const attemptsByDay = all<{ day: string; attempts: number; passes: number }>(
      `SELECT substr(a.submitted_at,1,10) AS day, COUNT(*) AS attempts,
              SUM(CASE WHEN a.passed = 1 THEN 1 ELSE 0 END) AS passes
         FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id
        WHERE q.creator_id = ? AND a.status = 'submitted' AND a.submitted_at >= ?
        GROUP BY day ORDER BY day`,
      user.id,
      from,
    );

    const votesByDay = all<{ day: string; votes: number }>(
      `SELECT substr(v.created_at,1,10) AS day, COUNT(*) AS votes
         FROM poll_votes v JOIN polls p ON p.id = v.poll_id
        WHERE p.creator_id = ? AND v.created_at >= ?
        GROUP BY day ORDER BY day`,
      user.id,
      from,
    );

    const ratingsByDay = all<{ day: string; ratings: number; average: number | null }>(
      `SELECT substr(r.created_at,1,10) AS day, COUNT(*) AS ratings, ROUND(AVG(r.score),2) AS average
         FROM ratings r
        WHERE r.created_at >= ? AND (
          (r.content_type='quiz' AND r.content_id IN (SELECT id FROM quizzes WHERE creator_id = ?)) OR
          (r.content_type='poll' AND r.content_id IN (SELECT id FROM polls WHERE creator_id = ?)))
        GROUP BY day ORDER BY day`,
      from,
      user.id,
      user.id,
    );

    const series = buildSeries(query.days, attemptsByDay, votesByDay, ratingsByDay);

    const perQuiz = all(
      `SELECT q.id, q.title, q.total_attempts,
              (SELECT COUNT(*) FROM quiz_attempts a WHERE a.quiz_id = q.id AND a.status='submitted' AND a.passed=1) AS passes,
              (SELECT ROUND(AVG(a.score_percent),1) FROM quiz_attempts a WHERE a.quiz_id=q.id AND a.status='submitted') AS average_score,
              (SELECT COUNT(*) FROM ratings r WHERE r.content_type='quiz' AND r.content_id=q.id AND r.status='published') AS rating_count,
              (SELECT ROUND(AVG(r.score),2) FROM ratings r WHERE r.content_type='quiz' AND r.content_id=q.id AND r.status='published') AS rating_average
         FROM quizzes q WHERE q.creator_id = ? ORDER BY q.total_attempts DESC LIMIT 10`,
      user.id,
    );

    res.json({ series, perQuiz, rangeDays: query.days });
  }),
);

function buildSeries(
  days: number,
  attempts: { day: string; attempts: number; passes: number }[],
  votes: { day: string; votes: number }[],
  ratings: { day: string; ratings: number; average: number | null }[],
) {
  const attemptMap = new Map(attempts.map((r) => [r.day, r]));
  const voteMap = new Map(votes.map((r) => [r.day, r]));
  const ratingMap = new Map(ratings.map((r) => [r.day, r]));
  const out: { day: string; attempts: number; passes: number; votes: number; ratings: number }[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = dayKey(new Date(Date.now() - i * 86400000).toISOString());
    const a = attemptMap.get(day);
    const v = voteMap.get(day);
    const r = ratingMap.get(day);
    out.push({
      day,
      attempts: a?.attempts ?? 0,
      passes: a?.passes ?? 0,
      votes: v?.votes ?? 0,
      ratings: r?.ratings ?? 0,
    });
  }
  return out;
}

/** Ratings and written feedback left on this creator's content. */
creatorRouter.get(
  '/feedback',
  handler((req, res) => {
    const user = currentUser(req);
    const query = parseQuery(
      z.object({
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(50).optional(),
        minScore: z.coerce.number().int().min(1).max(5).optional(),
      }),
      req.query,
    );
    const p = paging({ page: query.page, pageSize: query.pageSize ?? 20 });
    const where = new Where()
      .add(
        `((r.content_type = 'quiz' AND r.content_id IN (SELECT id FROM quizzes WHERE creator_id = ?))
        OR (r.content_type = 'poll' AND r.content_id IN (SELECT id FROM polls WHERE creator_id = ?)))`,
        user.id,
        user.id,
      )
      .addIf(query.minScore, 'r.score >= ?', query.minScore);

    const rows = all(
      `SELECT r.id, r.content_type, r.content_id, r.score, r.review_text, r.status, r.created_at,
              u.username, u.display_name,
              CASE WHEN r.content_type='quiz'
                   THEN (SELECT title FROM quizzes WHERE id = r.content_id)
                   ELSE (SELECT question FROM polls WHERE id = r.content_id) END AS content_title
         FROM ratings r JOIN users u ON u.id = r.user_id
         ${where.build()}
        ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
      ...where.params,
      p.pageSize,
      p.offset,
    );
    const total = count(`SELECT COUNT(*) AS total FROM ratings r ${where.build()}`, ...where.params);
    res.json(pageResult(rows, total, p));
  }),
);

/** Content list used by the creator's own tables. */
creatorRouter.get(
  '/content',
  handler((req, res) => {
    const user = currentUser(req);
    const query = parseQuery(
      z.object({
        type: z.enum(['quiz', 'poll']).optional(),
        status: z.string().trim().optional(),
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(60).optional(),
      }),
      req.query,
    );
    const p = paging({ page: query.page, pageSize: query.pageSize ?? 20 });
    const type = query.type ?? 'quiz';

    if (type === 'poll') {
      const where = new Where().add('p.creator_id = ?', user.id);
      where.addIf(query.status && query.status !== 'all', 'p.status = ?', query.status);
      const rows = all(
        `SELECT p.id, p.question AS title, p.status, p.published_at, p.submitted_at, p.updated_at, p.review_notes,
                (SELECT COUNT(*) FROM poll_votes v WHERE v.poll_id = p.id) AS engagement
           FROM polls p ${where.build()} ORDER BY p.updated_at DESC LIMIT ? OFFSET ?`,
        ...where.params,
        p.pageSize,
        p.offset,
      );
      const total = count(`SELECT COUNT(*) AS total FROM polls p ${where.build()}`, ...where.params);
      res.json(pageResult(rows, total, p));
      return;
    }

    const where = new Where().add('q.creator_id = ?', user.id);
    where.addIf(query.status && query.status !== 'all', 'q.status = ?', query.status);
    const rows = all(
      `SELECT q.id, q.title, q.status, q.published_at, q.submitted_at, q.updated_at, q.review_notes,
              q.entry_fee, q.reward_coins, q.total_attempts AS engagement
         FROM quizzes q ${where.build()} ORDER BY q.updated_at DESC LIMIT ? OFFSET ?`,
      ...where.params,
      p.pageSize,
      p.offset,
    );
    const total = count(`SELECT COUNT(*) AS total FROM quizzes q ${where.build()}`, ...where.params);
    res.json(pageResult(rows, total, p));
  }),
);

