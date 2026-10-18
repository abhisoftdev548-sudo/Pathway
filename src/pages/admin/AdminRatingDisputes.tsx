import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquareQuote } from 'lucide-react';
import { api, ApiError, buildQuery, type Page } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useToast } from '@/components/ui/Toast';
import { PageHeading, StatusBadge, Tabs } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { TextArea, Switch } from '@/components/ui/Field';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { ErrorState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { StarRating } from '@/components/patterns/RatingSection';
import { cn } from '@/lib/cn';
import { formatDate, formatRelative } from '@/lib/format';

interface DisputeRow {
  id: string;
  reason: string;
  status: 'pending' | 'upheld' | 'rejected';
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
  rating_id: string;
  score: number;
  review_text: string | null;
  content_type: 'quiz' | 'poll';
  content_id: string;
  contentTitle: string;
  raised_by_id: string;
  raised_by_username: string;
  author_username: string;
  author_id: string;
}

export function AdminRatingDisputes() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<DisputeRow | null>(null);
  const [decision, setDecision] = useState<'upheld' | 'rejected'>('upheld');
  const [hideRating, setHideRating] = useState(false);
  const [resolution, setResolution] = useState('');

  const query = useQuery<Page<DisputeRow>>({
    queryKey: qk.adminDisputes({ status, page }),
    queryFn: () => api.get(`/admin/ratings/disputes${buildQuery({ status, page, pageSize: 25 })}`),
    placeholderData: (prev) => prev,
  });

  const decide = useMutation({
    mutationFn: () =>
      api.post(`/admin/ratings/disputes/${selected?.id ?? ''}/decision`, {
        status: decision,
        resolution,
        hideRating: decision === 'upheld' ? hideRating : false,
      }),
    onSuccess: () => {
      setSelected(null);
      setResolution('');
      setHideRating(false);
      queryClient.invalidateQueries();
      toast.success('Dispute decided and recorded.');
    },
    onError: (err) => {
      setSelected(null);
      toast.error(err instanceof ApiError ? err.message : 'Could not record the decision.');
    },
  });

  const columns: Column<DisputeRow>[] = [
    {
      key: 'rating',
      header: 'Disputed rating',
      render: (row) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StarRating value={row.score} readOnly size="sm" />
            <Link
              to={`/admin/${row.content_type === 'quiz' ? 'quizzes' : 'polls'}/${row.content_id}`}
              className="max-w-[16rem] truncate text-ink hover:text-brand-700"
            >
              {row.contentTitle}
            </Link>
          </div>
          {row.review_text && <p className="mt-0.5 max-w-[28rem] truncate text-2xs text-ink-faint">{row.review_text}</p>}
        </div>
      ),
    },
    {
      key: 'author',
      header: 'Rating author',
      render: (row) => (
        <Link to={`/admin/users/${row.author_id}`} className="text-ink-soft hover:text-brand-700">
          @{row.author_username}
        </Link>
      ),
    },
    {
      key: 'raised',
      header: 'Raised by',
      render: (row) => (
        <Link to={`/admin/users/${row.raised_by_id}`} className="text-ink-soft hover:text-brand-700">
          @{row.raised_by_username}
        </Link>
      ),
    },
    {
      key: 'reason',
      header: 'Grounds',
      render: (row) => <span className="block max-w-[22rem] truncate text-ink-muted">{row.reason}</span>,
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
              setDecision('upheld');
              setHideRating(false);
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
        title="Rating disputes"
        description="Users asking for a rating or review to be reviewed. Upholding a dispute can hide the rating; either way the decision is recorded."
      />

      <Tabs
        className="mb-4"
        tabs={[
          { id: 'pending', label: 'Awaiting decision' },
          { id: 'upheld', label: 'Upheld' },
          { id: 'rejected', label: 'Declined' },
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
            emptyIcon={<MessageSquareQuote className="h-4 w-4" />}
            emptyTitle="No rating disputes"
            emptyDescription="When a user asks for a rating to be reviewed, the dispute appears here with the rating it concerns."
          />
          {query.data && query.data.total > 0 && (
            <Pagination page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPage={setPage} />
          )}
        </>
      )}

      <ConfirmDialog
        open={selected !== null}
        title={selected ? `${decision === 'upheld' ? 'Uphold' : 'Decline'} this dispute?` : ''}
        description="The outcome is stored against the dispute, the rating author is notified, and the action is written to the audit log."
        confirmLabel={decision === 'upheld' ? 'Uphold dispute' : 'Decline dispute'}
        tone={decision === 'upheld' ? 'primary' : 'danger'}
        loading={decide.isPending}
        onConfirm={() => decide.mutate()}
        onCancel={() => {
          setSelected(null);
          setResolution('');
          setHideRating(false);
        }}
      >
        <div className="space-y-3">
          <div className="rounded-md border border-line bg-canvas px-3 py-2">
            <p className="text-2xs uppercase tracking-wide text-ink-faint">Grounds for dispute</p>
            <p className="mt-1 whitespace-pre-line text-[13px] text-ink-soft">{selected?.reason}</p>
          </div>
          {selected?.review_text && (
            <div className="rounded-md border border-line px-3 py-2">
              <p className="text-2xs uppercase tracking-wide text-ink-faint">Review</p>
              <p className="mt-1 whitespace-pre-line text-[13px] text-ink-soft">{selected.review_text}</p>
            </div>
          )}
          <div className="flex gap-2">
            {(['upheld', 'rejected'] as const).map((option) => (
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
                {option === 'upheld' ? 'Uphold' : 'Decline'}
              </button>
            ))}
          </div>
          {decision === 'upheld' && (
            <Switch
              checked={hideRating}
              onChange={setHideRating}
              label="Also hide the rating"
              hint="Hidden ratings stop counting towards the public average but remain in the record."
            />
          )}
          <TextArea
            label="Outcome"
            required
            rows={3}
            value={resolution}
            onChange={(event) => setResolution(event.target.value)}
            hint="At least 5 characters. Stored with the dispute and sent to the person who raised it."
          />
        </div>
      </ConfirmDialog>
    </>
  );
}
