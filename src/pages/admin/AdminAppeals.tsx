import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquareQuote } from 'lucide-react';
import { api, ApiError, buildQuery, type Page } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useToast } from '@/components/ui/Toast';
import { PageHeading, StatusBadge, Tabs } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Field';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { cn } from '@/lib/cn';
import { formatDate, formatRelative } from '@/lib/format';

interface AppealRow {
  id: string;
  content_type: 'quiz' | 'poll';
  content_id: string;
  contentTitle: string;
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
  submitter_id: string;
  username: string;
  display_name: string;
}

export function AdminAppeals() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AppealRow | null>(null);
  const [decision, setDecision] = useState<'accepted' | 'rejected'>('accepted');
  const [resolution, setResolution] = useState('');

  const query = useQuery<Page<AppealRow>>({
    queryKey: qk.adminAppeals({ status, page }),
    queryFn: () => api.get(`/admin/moderation/appeals${buildQuery({ status, page, pageSize: 25 })}`),
    placeholderData: (prev) => prev,
  });

  const decide = useMutation({
    mutationFn: () => api.post(`/admin/moderation/appeals/${selected?.id ?? ''}/decision`, { status: decision, resolution }),
    onSuccess: () => {
      setSelected(null);
      setResolution('');
      queryClient.invalidateQueries();
      toast.success('Appeal decision recorded.');
    },
    onError: (err) => {
      setSelected(null);
      toast.error(err instanceof ApiError ? err.message : 'Could not record the decision.');
    },
  });

  const columns: Column<AppealRow>[] = [
    {
      key: 'content',
      header: 'Content under appeal',
      render: (row) => (
        <div className="min-w-0">
          <Link
            to={`/admin/${row.content_type === 'quiz' ? 'quizzes' : 'polls'}/${row.content_id}`}
            className="block max-w-[24rem] truncate font-medium text-ink hover:text-brand-700"
          >
            {row.contentTitle}
          </Link>
          <span className="text-2xs text-ink-faint">
            {row.content_type} · @{row.username}
          </span>
        </div>
      ),
    },
    {
      key: 'reason',
      header: "Creator's argument",
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
              setDecision('accepted');
              setResolution('');
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
        title="Appeals and re-review requests"
        description="Creators asking for a rejected or change-requested item to be looked at again. Accepting an appeal returns the content to the review queue."
      />

      <Tabs
        className="mb-4"
        tabs={[
          { id: 'pending', label: 'Pending' },
          { id: 'accepted', label: 'Accepted' },
          { id: 'rejected', label: 'Declined' },
          { id: 'all', label: 'All appeals' },
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
            emptyIcon={<MessageSquareQuote className="h-4 w-4" />}
            emptyTitle="No appeals here"
            emptyDescription="When a creator appeals a moderation decision it appears here for a second review."
          />
          {query.data && query.data.total > 0 && (
            <Pagination page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPage={setPage} />
          )}
        </>
      )}

      <ConfirmDialog
        open={selected !== null}
        title={selected ? `${decision === 'accepted' ? 'Accept' : 'Decline'} appeal on ${selected.contentTitle}?` : ''}
        description={
          decision === 'accepted'
            ? 'Accepting returns the content to the moderation queue as pending review, and the creator is notified.'
            : 'Declining leaves the current status unchanged and records your reasoning.'
        }
        confirmLabel={decision === 'accepted' ? 'Accept appeal' : 'Decline appeal'}
        tone={decision === 'accepted' ? 'primary' : 'danger'}
        loading={decide.isPending}
        onConfirm={() => decide.mutate()}
        onCancel={() => {
          setSelected(null);
          setResolution('');
        }}
      >
        <div className="space-y-3">
          {selected?.reason && (
            <div className="rounded-md border border-line bg-canvas px-3 py-2">
              <p className="text-2xs uppercase tracking-wide text-ink-faint">Creator's argument</p>
              <p className="mt-1 whitespace-pre-line text-[13px] text-ink-soft">{selected.reason}</p>
            </div>
          )}
          <div className="flex gap-2">
            {(['accepted', 'rejected'] as const).map((option) => (
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
                {option === 'accepted' ? 'Accept' : 'Decline'}
              </button>
            ))}
          </div>
          <TextArea
            label="Outcome"
            required
            rows={3}
            value={resolution}
            onChange={(event) => setResolution(event.target.value)}
            hint="At least 5 characters. Sent to the creator and stored in the moderation audit trail."
          />
        </div>
      </ConfirmDialog>
    </>
  );
}
