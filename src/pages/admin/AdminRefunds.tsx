import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins } from 'lucide-react';
import { api, ApiError, buildQuery, type Page } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useToast } from '@/components/ui/Toast';
import { PageHeading, Badge, StatusBadge, Tabs } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Field';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { cn } from '@/lib/cn';
import { formatCoins, formatDate, formatNumber, formatRelative } from '@/lib/format';

interface RefundRow {
  id: string;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  decision_note: string | null;
  created_at: string;
  resolved_at: string | null;
  user_id: string;
  username: string;
  display_name: string;
  attempt_id: string | null;
  score_percent: number | null;
  submitted_at: string | null;
  entry_fee_charged: number | null;
  quiz_id: string | null;
  quiz_title: string | null;
  prior_approved_refunds: number;
}

export function AdminRefunds() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<RefundRow | null>(null);
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [note, setNote] = useState('');

  const query = useQuery<Page<RefundRow>>({
    queryKey: qk.adminQcoinRefunds({ status, page }),
    queryFn: () => api.get(`/admin/qcoin/refunds${buildQuery({ status, page, pageSize: 25 })}`),
    placeholderData: (prev) => prev,
  });

  const decide = useMutation({
    mutationFn: () => api.post(`/admin/qcoin/refunds/${selected?.id ?? ''}/decision`, { status: decision, note }),
    onSuccess: () => {
      setSelected(null);
      setNote('');
      queryClient.invalidateQueries();
      toast.success(decision === 'approved' ? 'Refund approved and credited to the wallet.' : 'Refund declined.');
    },
    onError: (err) => {
      setSelected(null);
      toast.error(err instanceof ApiError ? err.message : 'Could not record the decision.');
    },
  });

  const columns: Column<RefundRow>[] = [
    {
      key: 'user',
      header: 'Account',
      render: (row) => (
        <div className="min-w-0">
          <Link to={`/admin/users/${row.user_id}`} className="block truncate font-medium text-ink hover:text-brand-700">
            {row.display_name}
          </Link>
          <span className="text-2xs text-ink-faint">@{row.username}</span>
        </div>
      ),
    },
    {
      key: 'quiz',
      header: 'Quiz / attempt',
      render: (row) => (
        <div className="min-w-0">
          <Link
            to={row.quiz_id ? `/admin/quizzes/${row.quiz_id}` : '#'}
            className={cn('block max-w-[18rem] truncate text-ink-soft', row.quiz_id && 'hover:text-brand-700')}
          >
            {row.quiz_title ?? 'Attempt removed'}
          </Link>
          <span className="text-2xs text-ink-faint">
            {row.score_percent !== null ? `scored ${row.score_percent}%` : 'no attempt linked'} · fee charged{' '}
            {formatCoins(row.entry_fee_charged ?? 0)}
          </span>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Requested',
      align: 'right',
      render: (row) => <span className="tabular-nums font-medium text-ink">{formatCoins(row.amount)}</span>,
    },
    {
      key: 'history',
      header: 'Refund history',
      align: 'right',
      render: (row) =>
        row.prior_approved_refunds >= 3 ? (
          <Badge tone="warning">{row.prior_approved_refunds} approved</Badge>
        ) : (
          <span className="tabular-nums text-ink-muted">{formatNumber(row.prior_approved_refunds)} approved</span>
        ),
    },
    {
      key: 'reason',
      header: 'Reason given',
      render: (row) => <span className="block max-w-[20rem] truncate text-ink-muted">{row.reason}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'filed',
      header: 'Filed',
      align: 'right',
      render: (row) => (
        <span className="whitespace-nowrap text-ink-muted" title={formatDate(row.created_at)}>
          {formatRelative(row.created_at)}
        </span>
      ),
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (row) =>
        row.status === 'pending' ? (
          <div className="flex justify-end gap-1">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setSelected(row);
                setDecision('approved');
                setNote('');
              }}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSelected(row);
                setDecision('rejected');
                setNote('');
              }}
            >
              Decline
            </Button>
          </div>
        ) : (
          <span className="block max-w-[14rem] truncate text-2xs text-ink-faint">{row.decision_note ?? '—'}</span>
        ),
    },
  ];

  return (
    <>
      <PageHeading
        title="Refund requests"
        description="Users asking for a paid entry fee back. Approving posts a single ledger entry keyed to this request, so a refund can never be paid twice."
      />

      <Tabs
        className="mb-4"
        tabs={[
          { id: 'pending', label: 'Awaiting decision' },
          { id: 'approved', label: 'Approved' },
          { id: 'rejected', label: 'Declined' },
          { id: 'all', label: 'All requests' },
        ]}
        active={status}
        onChange={(next) => {
          setStatus(next);
          setPage(1);
        }}
      />

      {query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={query.data?.items}
            loading={query.isLoading || query.isFetching}
            rowKey={(row) => row.id}
            emptyIcon={<Coins className="h-4 w-4" />}
            emptyTitle="No refund requests here"
            emptyDescription="Requests for a paid entry fee to be returned appear here for review."
          />
          {query.data && query.data.total > 0 && (
            <Pagination page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPage={setPage} />
          )}
        </>
      )}

      <ConfirmDialog
        open={selected !== null}
        title={selected ? `${decision === 'approved' ? 'Approve' : 'Decline'} ${formatCoins(selected.amount)} refund for ${selected.display_name}?` : ''}
        description={
          decision === 'approved'
            ? 'The amount is credited to the wallet in a single idempotent ledger entry and the user is notified.'
            : 'No balance change is made. The user is notified of the decision.'
        }
        confirmLabel={decision === 'approved' ? 'Approve and credit' : 'Decline request'}
        tone={decision === 'approved' ? 'primary' : 'danger'}
        loading={decide.isPending}
        onConfirm={() => decide.mutate()}
        onCancel={() => {
          setSelected(null);
          setNote('');
        }}
      >
        <div className="space-y-3">
          {selected?.reason && (
            <div className="rounded-md border border-line bg-canvas px-3 py-2">
              <p className="text-2xs uppercase tracking-wide text-ink-faint">Reason given</p>
              <p className="mt-1 whitespace-pre-line text-[13px] text-ink-soft">{selected.reason}</p>
            </div>
          )}
          <div className="flex gap-2">
            {(['approved', 'rejected'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDecision(option)}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-[13px] transition-colors duration-fast',
                  decision === option
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-line bg-surface text-ink-soft hover:border-line-strong',
                )}
              >
                {option === 'approved' ? 'Approve' : 'Decline'}
              </button>
            ))}
          </div>
          <TextArea
            label="Decision note"
            required
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            hint="At least 5 characters. Stored against the request and in the audit log."
          />
        </div>
      </ConfirmDialog>
    </>
  );
}
