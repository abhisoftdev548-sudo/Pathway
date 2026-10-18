import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins } from 'lucide-react';
import { api, ApiError, buildQuery, type Page } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useToast } from '@/components/ui/Toast';
import { PageHeading, StatusBadge, Tabs } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Field';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { ErrorState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { cn } from '@/lib/cn';
import { formatCoins, formatDate, formatRelative } from '@/lib/format';

interface DisputeRow {
  id: string;
  reason: string;
  status: 'pending' | 'resolved' | 'rejected';
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
  user_id: string;
  username: string;
  display_name: string;
  attempt_id: string | null;
  score_percent: number | null;
  reward_paid: number | null;
  entry_fee_charged: number | null;
  quiz_title: string | null;
}

export function AdminRewardDisputes() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<DisputeRow | null>(null);
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [note, setNote] = useState('');

  const query = useQuery<Page<DisputeRow>>({
    queryKey: qk.adminRewardDisputes({ status, page }),
    queryFn: () => api.get(`/admin/qcoin/reward-disputes${buildQuery({ status, page, pageSize: 25 })}`),
    placeholderData: (prev) => prev,
  });

  const decide = useMutation({
    mutationFn: () => api.post(`/admin/qcoin/reward-disputes/${selected?.id ?? ''}/decision`, { status: decision, note }),
    onSuccess: () => {
      setSelected(null);
      setNote('');
      queryClient.invalidateQueries();
      toast.success('Dispute decision recorded.');
    },
    onError: (err) => {
      setSelected(null);
      toast.error(err instanceof ApiError ? err.message : 'Could not record the decision.');
    },
  });

  const columns: Column<DisputeRow>[] = [
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
          <span className="block max-w-[20rem] truncate text-ink-soft">{row.quiz_title ?? 'Attempt removed'}</span>
          <span className="text-2xs text-ink-faint">
            {row.score_percent !== null ? `scored ${row.score_percent}%` : 'no score'} · reward paid{' '}
            {formatCoins(row.reward_paid ?? 0)} · fee {formatCoins(row.entry_fee_charged ?? 0)}
          </span>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Dispute',
      render: (row) => <span className="block max-w-[24rem] truncate text-ink-muted">{row.reason}</span>,
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
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
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setSelected(row);
              setDecision('approved');
              setNote('');
            }}
          >
            Decide
          </Button>
        ) : (
          <span className="block max-w-[16rem] truncate text-2xs text-ink-faint">{row.resolution ?? '—'}</span>
        ),
    },
  ];

  return (
    <>
      <PageHeading
        title="Reward disputes"
        description="Users contesting a quiz reward or entry fee. Deciding a dispute does not change a balance on its own — use a manual adjustment when a payment is owed."
      />

      <Tabs
        className="mb-4"
        tabs={[
          { id: 'pending', label: 'Awaiting decision' },
          { id: 'resolved', label: 'Resolved' },
          { id: 'rejected', label: 'Rejected' },
          { id: 'all', label: 'All disputes' },
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
            emptyTitle="No reward disputes"
            emptyDescription="When a user contests a reward or entry fee, the dispute appears here with the attempt it relates to."
          />
          {query.data && query.data.total > 0 && (
            <Pagination page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPage={setPage} />
          )}
        </>
      )}

      <ConfirmDialog
        open={selected !== null}
        title={selected ? `${decision === 'approved' ? 'Resolve' : 'Reject'} dispute from ${selected.display_name}?` : ''}
        description="Your decision and note are recorded, the user is notified, and the audit log records the action."
        confirmLabel={decision === 'approved' ? 'Resolve in favour' : 'Reject dispute'}
        tone={decision === 'approved' ? 'primary' : 'danger'}
        loading={decide.isPending}
        onConfirm={() => decide.mutate()}
        onCancel={() => {
          setSelected(null);
          setNote('');
        }}
      >
        <div className="space-y-3">
          <div className="rounded-md border border-line bg-canvas px-3 py-2">
            <p className="text-2xs uppercase tracking-wide text-ink-faint">Dispute</p>
            <p className="mt-1 whitespace-pre-line text-[13px] text-ink-soft">{selected?.reason}</p>
          </div>
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
                {option === 'approved' ? 'Resolve in favour of user' : 'Reject'}
              </button>
            ))}
          </div>
          <TextArea
            label="Outcome"
            required
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            hint="At least 5 characters. Sent to the user and stored in the audit log."
          />
          {selected && decision === 'approved' && (
            <p className="text-xs text-ink-muted">
              If a payment is owed, make a separate{' '}
              <Link to="/admin/qcoin/adjustments" className="text-brand-700 underline">
                manual adjustment
              </Link>
              . Decisions never edit a balance silently.
            </p>
          )}
        </div>
      </ConfirmDialog>
    </>
  );
}
