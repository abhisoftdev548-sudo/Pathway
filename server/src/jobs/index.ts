import { all, count, get, newId, nowIso, run, tx, getDb } from '../db/index.js';
import { notify } from '../lib/notify.js';
import { audit } from '../lib/audit.js';

export type JobType = 'session_cleanup' | 'attempt_expiry' | 'poll_closed_notify' | 'db_integrity_check';

type Handler = (payload: Record<string, unknown>) => Record<string, unknown>;

const handlers: Record<JobType, Handler> = {
  session_cleanup: () => {
    const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString();
    const res = run('DELETE FROM sessions WHERE expires_at < ?', cutoff);
    return { deletedSessions: res.changes };
  },

  attempt_expiry: () => {
    // Attempts left open for more than 24 hours are marked abandoned.
    const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
    const res = run(
      "UPDATE quiz_attempts SET status = 'abandoned', submitted_at = ?, time_spent_seconds = 0 WHERE status = 'in_progress' AND started_at < ?",
      nowIso(),
      cutoff,
    );
    return { abandonedAttempts: res.changes };
  },

  poll_closed_notify: () => {
    // Notify creators of polls that closed within the last hour.
    const since = new Date(Date.now() - 1000 * 60 * 60).toISOString();
    const rows = all<{ id: string; creator_id: string; question: string }>(
      `SELECT id, creator_id, question FROM polls
        WHERE status = 'published' AND closes_at IS NOT NULL
          AND closes_at <= ? AND closes_at >= ?`,
      nowIso(),
      since,
    );
    let notified = 0;
    for (const poll of rows) {
      const already = get(
        "SELECT 1 FROM jobs WHERE type = 'poll_closed_notify' AND status = 'completed' AND payload LIKE ?",
        `%${poll.id}%`,
      );
      if (already) continue;
      notify({
        userId: poll.creator_id,
        kind: 'poll_review',
        title: 'Your poll has closed',
        body: poll.question,
        link: `/app/polls/${poll.id}`,
      });
      notified += 1;
    }
    return { pollsChecked: rows.length, creatorsNotified: notified };
  },

  db_integrity_check: () => {
    const result = getDb().prepare('PRAGMA integrity_check').get() as { integrity_check: string };
    const ok = result?.integrity_check === 'ok';
    if (!ok) {
      audit({
        actor: null,
        action: 'system.integrity_check_failed',
        metadata: { result: result?.integrity_check },
      });
    }
    return { ok, detail: result?.integrity_check ?? 'unknown' };
  },
};

/** Adds a job if an equivalent one is not already queued or running. */
export function enqueue(type: JobType, payload: Record<string, unknown> = {}, runAt?: string): string | null {
  const serialized = JSON.stringify(payload);
  const existing = get<{ id: string }>(
    "SELECT id FROM jobs WHERE type = ? AND payload = ? AND status IN ('pending','running')",
    type,
    serialized,
  );
  if (existing) return null;
  const id = newId();
  run(
    `INSERT INTO jobs (id, type, payload, status, attempts, max_attempts, run_at, created_at)
     VALUES (?,?,?, 'pending', 0, 3, ?, ?)`,
    id,
    type,
    serialized,
    runAt ?? nowIso(),
    nowIso(),
  );
  return id;
}

/** Runs every due job once. Returns a summary of what happened. */
export function runDueJobs(limit = 20): { processed: number; failed: number } {
  const due = all<{ id: string; type: string; payload: string; attempts: number; max_attempts: number }>(
    `SELECT id, type, payload, attempts, max_attempts FROM jobs
      WHERE status = 'pending' AND run_at <= ?
      ORDER BY run_at ASC LIMIT ?`,
    nowIso(),
    limit,
  );

  let processed = 0;
  let failed = 0;

  for (const job of due) {
    run('UPDATE jobs SET status = ?, started_at = ?, attempts = attempts + 1 WHERE id = ?', 'running', nowIso(), job.id);
    try {
      const payload = JSON.parse(job.payload || '{}') as Record<string, unknown>;
      const result = handlers[job.type as JobType](payload);
      run(
        "UPDATE jobs SET status = 'completed', finished_at = ?, last_error = NULL, payload = ? WHERE id = ?",
        nowIso(),
        JSON.stringify(payload),
        job.id,
      );
      audit({ actor: null, action: 'job.completed', targetType: 'job', targetId: job.id, metadata: { type: job.type, ...result } });
      processed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const exhausted = job.attempts + 1 >= job.max_attempts;
      run(
        'UPDATE jobs SET status = ?, finished_at = ?, last_error = ? WHERE id = ?',
        exhausted ? 'failed' : 'pending',
        nowIso(),
        message,
        job.id,
      );
      if (!exhausted) {
        run('UPDATE jobs SET run_at = ? WHERE id = ?', new Date(Date.now() + 60_000).toISOString(), job.id);
      }
      failed += 1;
    }
  }

  return { processed, failed };
}

/** Ensures the recurring maintenance jobs are always queued. */
export function scheduleRecurring(): void {
  const hour = new Date(Date.now() + 1000 * 60 * 60).toISOString();
  enqueue('session_cleanup', { scheduled: 'hourly' }, hour);
  enqueue('attempt_expiry', { scheduled: 'hourly' }, hour);
  enqueue('poll_closed_notify', { scheduled: 'hourly' }, hour);
  enqueue('db_integrity_check', { scheduled: 'hourly' }, hour);
}

let timer: NodeJS.Timeout | null = null;

export function startWorker(intervalMs = 60_000): void {
  if (timer) return;
  scheduleRecurring();
  timer = setInterval(() => {
    try {
      runDueJobs();
      scheduleRecurring();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[jobs] worker iteration failed', err);
    }
  }, intervalMs);
  timer.unref?.();
}

export function stopWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

export function jobStats() {
  return {
    pending: count("SELECT COUNT(*) AS t FROM jobs WHERE status = 'pending'"),
    running: count("SELECT COUNT(*) AS t FROM jobs WHERE status = 'running'"),
    completed: count("SELECT COUNT(*) AS t FROM jobs WHERE status = 'completed'"),
    failed: count("SELECT COUNT(*) AS t FROM jobs WHERE status = 'failed'"),
  };
}

export function retryJob(id: string): boolean {
  const job = get<{ id: string; status: string }>('SELECT id, status FROM jobs WHERE id = ?', id);
  if (!job || job.status !== 'failed') return false;
  tx(() => {
    run(
      "UPDATE jobs SET status = 'pending', attempts = 0, last_error = NULL, run_at = ?, finished_at = NULL WHERE id = ?",
      nowIso(),
      id,
    );
  });
  audit({ actor: null, action: 'job.retried', targetType: 'job', targetId: id, metadata: {} });
  return true;
}

export function runJobNow(id: string): boolean {
  const job = get<{ id: string; type: string; payload: string; attempts: number; max_attempts: number }>(
    'SELECT id, type, payload, attempts, max_attempts FROM jobs WHERE id = ?',
    id,
  );
  if (!job) return false;
  run('UPDATE jobs SET status = ?, started_at = ?, attempts = attempts + 1 WHERE id = ?', 'running', nowIso(), job.id);
  try {
    const result = handlers[job.type as JobType](JSON.parse(job.payload || '{}'));
    run("UPDATE jobs SET status = 'completed', finished_at = ?, last_error = NULL WHERE id = ?", nowIso(), job.id);
    audit({ actor: null, action: 'job.completed', targetType: 'job', targetId: job.id, metadata: { type: job.type, ...result } });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    run('UPDATE jobs SET status = ?, finished_at = ?, last_error = ? WHERE id = ?', 'failed', nowIso(), message, job.id);
    return false;
  }
}

export const JOB_TYPES = Object.keys(handlers) as JobType[];
