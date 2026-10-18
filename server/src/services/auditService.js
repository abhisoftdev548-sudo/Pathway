import AuditLog from '../models/AuditLog.js';

/**
 * Append-only audit trail for sensitive administrative actions.
 * Never updated or deleted.
 */
export async function audit({ actor, action, targetType = 'SYSTEM', targetId = null, details = {}, req = null }) {
  return AuditLog.create({
    actor,
    action,
    targetType,
    targetId: targetId ? String(targetId) : null,
    details,
    ip: req?.ip ?? null,
    userAgent: req?.headers?.['user-agent'] ?? null,
  });
}

export async function listAuditLogs({ page = 1, limit = 20, action = null, actor = null }) {
  const filter = {};
  if (action) filter.action = action;
  if (actor) filter.actor = actor;
  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('actor', 'name email')
      .lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { items, total };
}

export default { audit, listAuditLogs };
