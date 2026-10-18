import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import endpoints, { type RefundRequestDto } from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { useToast } from '@/context/ToastContext';
import { Badge, Td } from '@/components/ui/Data';
import { AdminTablePage, ConfirmDialog } from '@/features/admin/AdminShared';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Form';
import { formatDate, formatNumber } from '@/utils/format';
import { apiErrorMessage } from '@/services/api';

/** Refund request queue: abandoned attempts and cancelled content awaiting refunds. */
export function AdminRefundRequestsPage() {
  useDocumentTitle('Refund requests');
  const toast = useToast();
  const queryClient = useQueryClient();

  const [target, setTarget] = useState<RefundRequestDto | null>(null);
  const [approve, setApprove] = useState(true);
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      endpoints.admin.processRefund(target!.kind, target!.id, {
        approve,
        reason: reason || (approve ? 'Refund approved after review' : 'Refund denied after review'),
      }),
    onSuccess: (result) => {
      toast.success(result.approved ? 'Refund processed' : 'Refund denied', 'Recorded in the ledger and audit log.');
      setTarget(null);
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Refund action failed')),
  });

  return (
    <>
      <AdminTablePage<RefundRequestDto>
        title="Refund requests"
        description="Entry fees eligible for refund: abandoned attempts and cancelled content."
        queryKey={['admin', 'refunds']}
        fetcher={async (params) => {
          const result = await endpoints.admin.refunds(params);
          return result;
        }}
        head={['Type', 'User', 'Activity', 'Amount', 'Reason', 'Requested', '']}
        renderRow={(request) => (
          <tr key={`${request.kind}-${request.id}`} className="hover:bg-zinc-50/70">
            <Td>
              <Badge tone="info">
                <RotateCcw className="h-3 w-3" /> {request.kind.replace('_', ' ').toLowerCase()}
              </Badge>
            </Td>
            <Td className="text-zinc-700">{request.user?.name ?? '—'}</Td>
            <Td className="max-w-[180px] truncate text-zinc-500">{request.activity?.title ?? '—'}</Td>
            <Td className="font-medium text-zinc-900">{formatNumber(request.amount)} QCoins</Td>
            <Td className="max-w-[180px] truncate text-zinc-500">{request.reason}</Td>
            <Td className="text-zinc-500">{formatDate(request.createdAt)}</Td>
            <Td>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  onClick={() => {
                    setTarget(request);
                    setApprove(true);
                  }}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setTarget(request);
                    setApprove(false);
                  }}
                >
                  Deny
                </Button>
              </div>
            </Td>
          </tr>
        )}
        emptyTitle="No pending refunds"
        emptyDescription="Eligible refund requests appear here automatically."
      />

      <ConfirmDialog
        open={target !== null}
        onClose={() => setTarget(null)}
        onConfirm={() => mutation.mutate()}
        loading={mutation.isPending}
        destructive={!approve}
        title={approve ? 'Approve refund?' : 'Deny refund?'}
        confirmLabel={approve ? 'Approve refund' : 'Deny request'}
        message={
          <div className="space-y-3">
            <p>
              {approve
                ? `${formatNumber(target?.amount ?? 0)} QCoins will be returned to ${target?.user?.name ?? 'the user'} and logged as a new ledger entry.`
                : 'The request will be closed without a refund. The decision is audited.'}
            </p>
            <Textarea
              label="Reason (recorded permanently)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={approve ? 'Why this refund is approved' : 'Why this refund is denied'}
              maxLength={500}
            />
          </div>
        }
      />
    </>
  );
}

export default AdminRefundRequestsPage;
