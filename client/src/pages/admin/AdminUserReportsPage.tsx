import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import endpoints, { type ReportDto } from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { useToast } from '@/context/ToastContext';
import { Badge, Td } from '@/components/ui/Data';
import { AdminTablePage, ConfirmDialog } from '@/features/admin/AdminShared';
import { Button } from '@/components/ui/Button';
import { Select, Textarea } from '@/components/ui/Form';
import { formatDate } from '@/utils/format';
import { REPORT_REASON_LABELS } from '@/utils/constants';
import { apiErrorMessage } from '@/services/api';

/** User reports: community reports filed against other members. */
export function AdminUserReportsPage() {
  useDocumentTitle('User reports');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<ReportDto | null>(null);
  const [resolution, setResolution] = useState('');
  const [status, setStatus] = useState<'RESOLVED' | 'DISMISSED' | 'UNDER_REVIEW'>('RESOLVED');

  const mutation = useMutation({
    mutationFn: () => endpoints.admin.resolveReport(target!._id, { status, resolution }),
    onSuccess: () => {
      toast.success('Report updated');
      setTarget(null);
      setResolution('');
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not update report')),
  });

  return (
    <>
      <AdminTablePage<ReportDto>
        title="User reports"
        description="Reports filed by members against other members (harassment, fraud, and similar)."
        queryKey={['admin', 'user-reports']}
        fetcher={(params) => endpoints.admin.reports({ ...params, targetType: 'USER' })}
        searchPlaceholder="Search user reports…"
        statusOptions={[
          { value: 'OPEN', label: 'Open' },
          { value: 'UNDER_REVIEW', label: 'Under review' },
          { value: 'RESOLVED', label: 'Resolved' },
          { value: 'DISMISSED', label: 'Dismissed' },
        ]}
        head={['Reason', 'Reported user', 'Reporter', 'Details', 'Status', '']}
        renderRow={(report) => (
          <tr key={report._id} className="hover:bg-zinc-50/70">
            <Td>
              <Badge tone={report.status === 'OPEN' ? 'warning' : 'neutral'}>
                {REPORT_REASON_LABELS[report.reason] ?? report.reason}
              </Badge>
            </Td>
            <Td className="text-zinc-500">{report.targetId.slice(-8)}</Td>
            <Td className="text-zinc-500">{report.reporter?.name ?? '—'}</Td>
            <Td className="max-w-[200px] truncate text-zinc-500">{report.details || '—'}</Td>
            <Td>
              <Badge tone={report.status === 'OPEN' ? 'danger' : 'neutral'}>{report.status}</Badge>
            </Td>
            <Td>
              <Button size="sm" variant="outline" onClick={() => setTarget(report)}>
                Resolve
              </Button>
            </Td>
          </tr>
        )}
        emptyTitle="No user reports"
        emptyDescription="Reports against members will appear here for review."
      />

      <ConfirmDialog
        open={target !== null}
        onClose={() => setTarget(null)}
        onConfirm={() => mutation.mutate()}
        loading={mutation.isPending}
        title="Resolve user report"
        confirmLabel="Save decision"
        message={
          <div className="space-y-3">
            <p>
              {REPORT_REASON_LABELS[target?.reason ?? ''] ?? target?.reason} · filed{' '}
              {formatDate(target?.createdAt)}
            </p>
            <Select label="Outcome" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="RESOLVED">Resolved (action taken)</option>
              <option value="DISMISSED">Dismissed (no violation)</option>
              <option value="UNDER_REVIEW">Keep under review</option>
            </Select>
            <Textarea
              label="Resolution notes"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="What was done and why?"
              maxLength={1000}
            />
          </div>
        }
      />
    </>
  );
}

export default AdminUserReportsPage;
