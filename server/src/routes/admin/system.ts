import { Router } from 'express';
import { z } from 'zod';
import os from 'node:os';
import fs from 'node:fs';
import { all, count, get, nowIso, run, getDb } from '../../db/index.js';
import { notFound } from '../../lib/errors.js';
import { handler, parseQuery } from '../../lib/http.js';
import { auditFromRequest } from '../../lib/audit.js';
import { currentUser } from '../../lib/auth.js';
import { pageResult, paging, Where } from '../../lib/paging.js';
import { resolveDbPath } from '../../db/index.js';
import { enqueue, jobStats, retryJob, runJobNow, JOB_TYPES, type JobType } from '../../jobs/index.js';

export const adminSystemRouter = Router();

const startedAt = Date.now();

/**
 * Real service health: database reachability, sqlite integrity, queue depth
 * and process uptime. Nothing is simulated.
 */
adminSystemRouter.get(
  '/health',
  handler((_req, res) => {
    const checks: { name: string; status: 'ok' | 'degraded' | 'down'; detail: string }[] = [];

    let dbOk = true;
    let dbDetail = 'Connected';
    try {
      const row = getDb().prepare('SELECT 1 AS ok').get() as { ok: number } | undefined;
      dbOk = row?.ok === 1;
      if (!dbOk) dbDetail = 'Unexpected query result';
    } catch (err) {
      dbOk = false;
      dbDetail = err instanceof Error ? err.message : 'Unreachable';
    }
    checks.push({ name: 'Database', status: dbOk ? 'ok' : 'down', detail: dbDetail });

    let integrity: string;
    try {
      integrity = (getDb().prepare('PRAGMA integrity_check').get() as { integrity_check: string })?.integrity_check ?? 'unknown';
    } catch (err) {
      integrity = err instanceof Error ? err.message : 'unknown';
    }
    checks.push({
      name: 'Database integrity',
      status: integrity === 'ok' ? 'ok' : 'degraded',
      detail: integrity,
    });

    const stats = jobStats();
    checks.push({
      name: 'Background jobs',
      status: stats.failed > 0 ? 'degraded' : stats.running > 0 || stats.pending > 0 ? 'ok' : 'ok',
      detail: `${stats.pending} queued · ${stats.running} running · ${stats.completed} completed · ${stats.failed} failed`,
    });

    const recentErrors = count('SELECT COUNT(*) AS t FROM error_logs WHERE created_at >= ?', new Date(Date.now() - 3600_000).toISOString());
    checks.push({
      name: 'Application errors (last hour)',
      status: recentErrors === 0 ? 'ok' : 'degraded',
      detail: `${recentErrors} error(s) recorded`,
    });

    const dbPath = resolveDbPath();
    let sizeBytes: number | null = null;
    try {
      sizeBytes = dbPath === ':memory:' ? null : fs.statSync(dbPath).size;
    } catch {
      sizeBytes = null;
    }

    res.json({
      checks,
      uptime: {
        since: new Date(startedAt).toISOString(),
        seconds: Math.round((Date.now() - startedAt) / 1000),
      },
      process: {
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsedMb: Math.round(process.memoryUsage().rss / 1_048_576),
        loadAverage: os.loadavg().map((n) => Number(n.toFixed(2))),
        cpus: os.cpus().length,
      },
      database: {
        path: dbPath === ':memory:' ? ':memory:' : dbPath.replace(process.cwd(), '.'),
        sizeBytes,
        tables: tableCounts(),
      },
      jobStats: stats,
    });
  }),
);

function tableCounts() {
  const names = all<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return names.map((t) => ({
    table: t.name,
    rows: count(`SELECT COUNT(*) AS t FROM "${t.name}"`),
  }));
}

adminSystemRouter.get(
  '/jobs',
  handler((req, res) => {
    const query = parseQuery(
      z.object({
        status: z.enum(['all', 'pending', 'running', 'completed', 'failed']).optional(),
        type: z.string().trim().optional(),
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(100).optional(),
      }),
      req.query,
    );
    const p = paging({ page: query.page, pageSize: query.pageSize ?? 25 });
    const where = new Where();
    where.addIf(query.status && query.status !== 'all', 'j.status = ?', query.status);
    where.addIf(query.type && query.type !== 'all', 'j.type = ?', query.type);

    const rows = all(
      `SELECT j.id, j.type, j.payload, j.status, j.attempts, j.max_attempts, j.last_error,
              j.run_at, j.started_at, j.finished_at, j.created_at
         FROM jobs j ${where.build()}
        ORDER BY CASE j.status WHEN 'running' THEN 0 WHEN 'pending' THEN 1 WHEN 'failed' THEN 2 ELSE 3 END,
                 j.created_at DESC
        LIMIT ? OFFSET ?`,
      ...where.params,
      p.pageSize,
      p.offset,
    );
    const total = count(`SELECT COUNT(*) AS total FROM jobs j ${where.build()}`, ...where.params);
    res.json({ ...pageResult(rows, total, p), stats: jobStats(), types: JOB_TYPES });
  }),
);

adminSystemRouter.post(
  '/jobs/:id/retry',
  handler((req, res) => {
    const admin = currentUser(req);
    if (!retryJob(req.params.id)) throw notFound('Only failed jobs can be retried.');
    auditFromRequest(req, 'system.job_retried', 'job', req.params.id, {});
    res.json({ ok: true });
  }),
);

adminSystemRouter.post(
  '/jobs/:id/run',
  handler((req, res) => {
    const admin = currentUser(req);
    if (!runJobNow(req.params.id)) throw notFound('That job could not be run.');
    auditFromRequest(req, 'system.job_run', 'job', req.params.id, {});
    res.json({ ok: true });
  }),
);

adminSystemRouter.post(
  '/jobs',
  handler((req, res) => {
    const admin = currentUser(req);
    const body = z.object({ type: z.enum(JOB_TYPES as [JobType, ...JobType[]]) }).safeParse(req.body ?? {});
    if (!body.success) throw notFound('Unknown job type.');
    const id = enqueue(body.data.type, { requestedBy: admin.id, at: nowIso() });
    auditFromRequest(req, 'system.job_queued', 'job', id ?? 'deduped', { type: body.data.type });
    res.status(201).json({ id, deduped: id === null });
  }),
);

adminSystemRouter.get(
  '/errors',
  handler((req, res) => {
    const query = parseQuery(
      z.object({
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(100).optional(),
      }),
      req.query,
    );
    const p = paging({ page: query.page, pageSize: query.pageSize ?? 25 });
    const rows = all(
      `SELECT e.id, e.method, e.path, e.status, e.message, e.stack, e.created_at, u.username
         FROM error_logs e LEFT JOIN users u ON u.id = e.user_id
        ORDER BY e.created_at DESC LIMIT ? OFFSET ?`,
      p.pageSize,
      p.offset,
    );
    const total = count('SELECT COUNT(*) AS total FROM error_logs');
    res.json({
      ...pageResult(rows, total, p),
      last24h: count('SELECT COUNT(*) AS t FROM error_logs WHERE created_at >= ?', new Date(Date.now() - 86400_000).toISOString()),
    });
  }),
);

adminSystemRouter.delete(
  '/errors',
  handler((req, res) => {
    const admin = currentUser(req);
    const result = run('DELETE FROM error_logs');
    auditFromRequest(req, 'system.errors_cleared', 'error_log', null, { deleted: result.changes });
    res.json({ deleted: result.changes });
  }),
);

adminSystemRouter.get(
  '/diagnostics',
  handler((_req, res) => {
    const db = getDb();
    const pragmas: Record<string, unknown> = {};
    for (const pragma of ['journal_mode', 'foreign_keys', 'page_size', 'page_count', 'freelist_count', 'encoding', 'user_version', 'wal_checkpoint(TRUNCATE)']) {
      try {
        const row = db.prepare(`PRAGMA ${pragma}`).get() as Record<string, unknown>;
        pragmas[pragma] = row ? Object.values(row)[0] : null;
      } catch (err) {
        pragmas[pragma] = err instanceof Error ? err.message : 'error';
      }
    }

    const indexes = all<{ name: string; tbl_name: string; sql: string }>(
      "SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY tbl_name, name",
    );

    const dbPath = resolveDbPath();
    let files: { name: string; sizeBytes: number }[] = [];
    try {
      if (dbPath !== ':memory:') {
        const dir = dbPath.replace(/[^/\\]+$/, '');
        files = fs
          .readdirSync(dir || '.')
          .filter((f) => f.startsWith('quizsphere.db'))
          .map((f) => ({ name: f, sizeBytes: fs.statSync(`${dir}${f}`).size }));
      }
    } catch {
      files = [];
    }

    res.json({ pragmas, indexes, files, tableCounts: tableCounts(), collectedAt: nowIso() });
  }),
);
