import { Router } from 'express';
import { z } from 'zod';
import { all, count, get, nowIso } from '../../db/index.js';
import { handler, parseQuery } from '../../lib/http.js';
import { currentUser } from '../../lib/auth.js';
import { dateRangeTo, dayKey } from '../../lib/paging.js';
import { getSetting } from '../../lib/settings.js';
import { ledgerTotals } from '../../lib/wallet.js';

export const adminRouter = Router();

const rangeSchema = z.object({
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
});

/**
 * Every figure below is a named, database-backed aggregate.
 * Nothing here is estimated, cached from a fixture or synthesised.
 */
adminRouter.get(
  '/overview',
  handler((req, res) => {
    void currentUser(req);
    const query = parseQuery(rangeSchema, req.query);
    const from = query.from
      ? new Date(query.from).toISOString()
      : new Date(Date.now() - (query.days ?? 30) * 86400000).toISOString();
    const to = query.to ? new Date(query.to).toISOString() : nowIso();

    const users = {
      totalRegistered: count('SELECT COUNT(*) AS t FROM users'),
      activeInRange: count('SELECT COUNT(*) AS t FROM users WHERE last_active_at >= ?', from),
      newInRange: count('SELECT COUNT(*) AS t FROM users WHERE created_at BETWEEN ? AND ?', from, to),
      suspended: count("SELECT COUNT(*) AS t FROM users WHERE account_status = 'suspended'"),
      admins: count("SELECT COUNT(*) AS t FROM users WHERE role = 'admin'"),
      creators: count("SELECT COUNT(*) AS t FROM users WHERE role IN ('creator','admin')"),
    };

    const quizzes = {
      approved: count("SELECT COUNT(*) AS t FROM quizzes WHERE status = 'approved'"),
      pendingReview: count("SELECT COUNT(*) AS t FROM quizzes WHERE status = 'pending_review'"),
      changesRequested: count("SELECT COUNT(*) AS t FROM quizzes WHERE status = 'changes_requested'"),
      rejected: count("SELECT COUNT(*) AS t FROM quizzes WHERE status = 'rejected'"),
      drafts: count("SELECT COUNT(*) AS t FROM quizzes WHERE status = 'draft'"),
      unpublished: count("SELECT COUNT(*) AS t FROM quizzes WHERE status = 'unpublished'"),
    };

    const polls = {
      published: count("SELECT COUNT(*) AS t FROM polls WHERE status = 'published'"),
      pendingReview: count("SELECT COUNT(*) AS t FROM polls WHERE status = 'pending_review'"),
      changesRequested: count("SELECT COUNT(*) AS t FROM polls WHERE status = 'changes_requested'"),
      rejected: count("SELECT COUNT(*) AS t FROM polls WHERE status = 'rejected'"),
      drafts: count("SELECT COUNT(*) AS t FROM polls WHERE status = 'draft'"),
    };

    const moderation = {
      queueTotal: quizzes.pendingReview + polls.pendingReview,
      reportsPending: count("SELECT COUNT(*) AS t FROM reports WHERE status = 'pending'"),
      reportsReviewing: count("SELECT COUNT(*) AS t FROM reports WHERE status = 'reviewing'"),
      appealsPending: count("SELECT COUNT(*) AS t FROM appeals WHERE status = 'pending'"),
      ratingDisputesPending: count("SELECT COUNT(*) AS t FROM rating_disputes WHERE status = 'pending'"),
    };

    const qcoin = ledgerTotals(from, to);
    const qcoinPending = {
      refundRequests: count("SELECT COUNT(*) AS t FROM refund_requests WHERE status = 'pending'"),
      rewardDisputes: count("SELECT COUNT(*) AS t FROM reward_disputes WHERE status = 'pending'"),
    };

    const activity = {
      attemptsInRange: count(
        "SELECT COUNT(*) AS t FROM quiz_attempts WHERE status='submitted' AND submitted_at BETWEEN ? AND ?",
        from,
        to,
      ),
      votesInRange: count('SELECT COUNT(*) AS t FROM poll_votes WHERE created_at BETWEEN ? AND ?', from, to),
      ratingsInRange: count('SELECT COUNT(*) AS t FROM ratings WHERE created_at BETWEEN ? AND ?', from, to),
    };

    const recentDecisions = all(
      `SELECT m.id, m.content_type, m.content_id, m.decision, m.reason, m.created_at, m.quality_rating,
              u.display_name AS reviewer_name,
              CASE WHEN m.content_type='quiz' THEN (SELECT title FROM quizzes WHERE id=m.content_id)
                   ELSE (SELECT question FROM polls WHERE id=m.content_id) END AS content_title
         FROM moderation_reviews m LEFT JOIN users u ON u.id = m.reviewer_id
        WHERE m.decision <> 'resubmitted'
        ORDER BY m.created_at DESC LIMIT 10`,
    );

    const openRefunds = all(
      `SELECT r.id, r.amount, r.reason, r.created_at, u.username, u.display_name
         FROM refund_requests r JOIN users u ON u.id = r.user_id
        WHERE r.status = 'pending' ORDER BY r.created_at ASC LIMIT 5`,
    );

    res.json({
      range: { from, to },
      users,
      quizzes,
      polls,
      moderation,
      qcoin: { ...qcoin, ...qcoinPending },
      activity,
      recentDecisions,
      openRefunds,
      definitions: metricDefinitions(),
    });
  }),
);

export function metricDefinitions() {
  return [
    { key: 'users.totalRegistered', label: 'Total registered users', definition: 'Every user row in the database, regardless of role or status.' },
    { key: 'users.activeInRange', label: 'Active users', definition: 'Users whose last recorded activity falls inside the selected date range.' },
    { key: 'users.newInRange', label: 'New users', definition: 'Accounts created inside the selected date range.' },
    { key: 'quizzes.approved', label: 'Approved quizzes', definition: 'Quizzes currently in the approved (published) state. Drafts and submissions awaiting review are counted separately.' },
    { key: 'quizzes.pendingReview', label: 'Quizzes awaiting review', definition: 'Quiz submissions in the pending_review state.' },
    { key: 'quizzes.drafts', label: 'Quiz drafts', definition: 'Quizzes never submitted, or returned for changes and not yet resubmitted.' },
    { key: 'moderation.queueTotal', label: 'Moderation queue', definition: 'Quiz submissions plus poll submissions awaiting a first decision or a re-review.' },
    { key: 'moderation.reportsPending', label: 'Reports awaiting review', definition: 'User-submitted reports that have not been resolved or dismissed.' },
    { key: 'qcoin.issued', label: 'QCoins issued', definition: 'Sum of positive ledger entries created inside the selected date range.' },
    { key: 'qcoin.spent', label: 'QCoins spent', definition: 'Sum of negative ledger entries (absolute value) created inside the selected date range.' },
    { key: 'activity.attemptsInRange', label: 'Completed quiz attempts', definition: 'Submitted attempts finished inside the selected date range.' },
  ];
}

const trendSchema = z.object({ days: z.coerce.number().int().min(7).max(365).optional().default(30) });

adminRouter.get(
  '/analytics',
  handler((req, res) => {
    void currentUser(req);
    const query = parseQuery(trendSchema, req.query);
    const days = query.days;
    const from = new Date(Date.now() - days * 86400000).toISOString();

    const rawUsers = all<{ day: string; n: number }>(
      `SELECT substr(created_at,1,10) AS day, COUNT(*) AS n FROM users WHERE created_at >= ? GROUP BY day`,
      from,
    );
    const rawAttempts = all<{ day: string; n: number }>(
      `SELECT substr(submitted_at,1,10) AS day, COUNT(*) AS n FROM quiz_attempts
        WHERE status='submitted' AND submitted_at >= ? GROUP BY day`,
      from,
    );
    const rawPublished = all<{ day: string; n: number }>(
      `SELECT substr(published_at,1,10) AS day, COUNT(*) AS n FROM quizzes
        WHERE status='approved' AND published_at IS NOT NULL AND published_at >= ? GROUP BY day`,
      from,
    );
    const rawVotes = all<{ day: string; n: number }>(
      `SELECT substr(created_at,1,10) AS day, COUNT(*) AS n FROM poll_votes WHERE created_at >= ? GROUP BY day`,
      from,
    );
    const rawCoins = all<{ day: string; issued: number; spent: number }>(
      `SELECT substr(created_at,1,10) AS day,
              SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS issued,
              SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS spent
         FROM ledger_entries WHERE created_at >= ? GROUP BY day`,
      from,
    );

    const userMap = new Map(rawUsers.map((r) => [r.day, r.n]));
    const attemptMap = new Map(rawAttempts.map((r) => [r.day, r.n]));
    const publishMap = new Map(rawPublished.map((r) => [r.day, r.n]));
    const voteMap = new Map(rawVotes.map((r) => [r.day, r.n]));
    const coinMap = new Map(rawCoins.map((r) => [r.day, r]));

    const series = [];
    let usersCumulative = count('SELECT COUNT(*) AS t FROM users WHERE created_at < ?', from);
    for (let i = days - 1; i >= 0; i -= 1) {
      const day = dayKey(new Date(Date.now() - i * 86400000).toISOString());
      usersCumulative += userMap.get(day) ?? 0;
      const coins = coinMap.get(day);
      series.push({
        day,
        newUsers: userMap.get(day) ?? 0,
        usersCumulative,
        attempts: attemptMap.get(day) ?? 0,
        quizzesPublished: publishMap.get(day) ?? 0,
        votes: voteMap.get(day) ?? 0,
        coinsIssued: coins?.issued ?? 0,
        coinsSpent: coins?.spent ?? 0,
      });
    }

    const breakdown = {
      quizzesByCategory: all(
        `SELECT c.name, COUNT(q.id) AS total FROM categories c
           LEFT JOIN quizzes q ON q.category_id = c.id AND q.status = 'approved'
          GROUP BY c.id HAVING total > 0 ORDER BY total DESC`,
      ),
      quizzesByDifficulty: all(
        `SELECT d.name, COUNT(q.id) AS total FROM difficulty_levels d
           LEFT JOIN quizzes q ON q.difficulty_id = d.id AND q.status = 'approved'
          GROUP BY d.id HAVING total > 0 ORDER BY d.sort_order`,
      ),
      attemptsByOutcome: all(
        `SELECT CASE WHEN passed = 1 THEN 'Passed' ELSE 'Not passed' END AS outcome, COUNT(*) AS total
           FROM quiz_attempts WHERE status='submitted' GROUP BY outcome`,
      ),
      roleBreakdown: all('SELECT role, COUNT(*) AS total FROM users GROUP BY role'),
      statusBreakdown: all('SELECT account_status AS status, COUNT(*) AS total FROM users GROUP BY account_status'),
    };

    const topQuizzes = all(
      `SELECT q.id, q.title, q.total_attempts, q.entry_fee, q.reward_coins,
              (SELECT ROUND(AVG(r.score),2) FROM ratings r WHERE r.content_type='quiz' AND r.content_id=q.id AND r.status='published') AS rating_average
         FROM quizzes q WHERE q.status = 'approved' ORDER BY q.total_attempts DESC, q.published_at DESC LIMIT 10`,
    );

    const hasAnyData =
      series.some((s) => s.newUsers || s.attempts || s.quizzesPublished || s.votes || s.coinsIssued || s.coinsSpent) ||
      count('SELECT COUNT(*) AS t FROM users') > 0;

    res.json({ series, breakdown, topQuizzes, hasAnyData, rangeDays: days });
  }),
);

adminRouter.get(
  '/activity',
  handler((req, res) => {
    void currentUser(req);
    const query = parseQuery(
      z.object({ limit: z.coerce.number().int().min(1).max(100).optional().default(30) }),
      req.query,
    );
    const rows = all(
      `SELECT a.id, a.action, a.target_type, a.target_id, a.actor_label, a.metadata, a.created_at
         FROM audit_logs a
        WHERE a.action LIKE 'admin.%' OR a.action LIKE 'moderation.%' OR a.action LIKE 'qcoin.%'
           OR a.action LIKE 'user.%' OR a.action LIKE 'config.%' OR a.action LIKE 'content.%'
        ORDER BY a.created_at DESC LIMIT ?`,
      query.limit,
    );
    res.json({ items: rows });
  }),
);

export { getSetting };
