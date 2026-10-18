import endpoints, { type AuditLogDto } from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { Badge, Td } from '@/components/ui/Data';
import { AdminTablePage } from '@/features/admin/AdminShared';
import { formatDateTime } from '@/utils/format';

/** Immutable audit trail of every sensitive administrative action. */
export function AdminAuditLogsPage() {
  useDocumentTitle('Audit logs');

  return (
    <AdminTablePage<AuditLogDto>
      title="Audit logs"
      description="Permanent record of administrative actions — never edited or deleted."
      queryKey={['admin', 'audit-logs']}
      fetcher={(params) => endpoints.admin.auditLogs(params)}
      searchPlaceholder="Filter by action name…"
      statusOptions={[
        { value: 'MODERATION_APPROVE', label: 'Approvals' },
        { value: 'MODERATION_REJECT', label: 'Rejections' },
        { value: 'USER_SUSPEND', label: 'Suspensions' },
        { value: 'USER_RESTORE', label: 'Restores' },
        { value: 'USER_ADJUST_COINS', label: 'Coin adjustments' },
        { value: 'REFUND_APPROVED', label: 'Refunds approved' },
        { value: 'SETTING_UPDATED', label: 'Settings updated' },
        { value: 'REPORT_RESOLVED', label: 'Reports resolved' },
        { value: 'NOTIFICATION_BROADCAST', label: 'Broadcasts' },
      ]}
      head={['Action', 'Actor', 'Target', 'Details', 'IP', 'When']}
      renderRow={(log) => (
        <tr key={log._id} className="hover:bg-surface-muted/70">
          <Td>
            <Badge
              tone={
                log.action.includes('REJECT') || log.action.includes('SUSPEND')
                  ? 'danger'
                  : log.action.includes('APPROVE') || log.action.includes('RESTORE')
                    ? 'success'
                    : 'neutral'
              }
            >
              {log.action}
            </Badge>
          </Td>
          <Td className="text-body">{log.actor?.name ?? '—'}</Td>
          <Td className="text-body">
            {log.targetType}
            {log.targetId ? ` · ${String(log.targetId).slice(-6)}` : ''}
          </Td>
          <Td className="max-w-[240px] truncate text-body">
            {log.details && Object.keys(log.details).length > 0
              ? JSON.stringify(log.details).slice(0, 120)
              : '—'}
          </Td>
          <Td className="text-body">{log.ip ?? '—'}</Td>
          <Td className="text-body">{formatDateTime(log.createdAt)}</Td>
        </tr>
      )}
      emptyTitle="No audit entries yet"
      emptyDescription="Every sensitive admin action writes an entry here automatically."
    />
  );
}

export default AdminAuditLogsPage;
