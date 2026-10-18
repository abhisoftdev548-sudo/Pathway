import type { Request } from 'express';
import { newId, nowIso, run, tx } from '../db/index.js';
import type { SessionUser } from './auth.js';

export interface AuditEntry {
  actor?: SessionUser | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

/**
 * Append an entry to the audit trail. The audit log is append-only: there is
 * no update or delete path anywhere in the application.
 */
export function audit(entry: AuditEntry): void {
  run(
    `INSERT INTO audit_logs (id, actor_id, actor_label, action, target_type, target_id, metadata, ip, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    newId(),
    entry.actor?.id ?? null,
    entry.actor ? `${entry.actor.displayName} (${entry.actor.email})` : 'system',
    entry.action,
    entry.targetType ?? null,
    entry.targetId ?? null,
    JSON.stringify(entry.metadata ?? {}),
    entry.ip ?? null,
    nowIso(),
  );
}

export function auditFromRequest(
  req: Request,
  action: string,
  targetType?: string | null,
  targetId?: string | null,
  metadata?: Record<string, unknown>,
): void {
  audit({
    actor: req.ctx?.user ?? null,
    action,
    targetType,
    targetId,
    metadata,
    ip: clientIp(req),
  });
}

export function clientIp(req: Request): string | null {
  return (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip ?? null;
}

export interface SecurityEventInput {
  userId?: string | null;
  event: string;
  outcome: 'success' | 'failure' | 'blocked';
  req?: Request;
  metadata?: Record<string, unknown>;
}

export function recordSecurityEvent(input: SecurityEventInput): void {
  run(
    `INSERT INTO security_events (id, user_id, event, outcome, ip, user_agent, metadata, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    newId(),
    input.userId ?? null,
    input.event,
    input.outcome,
    input.req ? clientIp(input.req) : null,
    input.req?.headers['user-agent'] ?? null,
    JSON.stringify(input.metadata ?? {}),
    nowIso(),
  );
}

/**
 * Guard used for high-impact administrative actions: records the intent in
 * the audit trail before performing the work.
 */
export function withAudit<T>(entry: AuditEntry, fn: () => T): T {
  return tx(() => {
    const result = fn();
    audit(entry);
    return result;
  });
}
