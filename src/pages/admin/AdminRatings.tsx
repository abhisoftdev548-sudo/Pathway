import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { api, ApiError, buildQuery, type Page } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useToast } from '@/components/ui/Toast';
import { PageHeading, Badge, StatusBadge, Metric } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { TextInput, Select, TextArea } from '@/components/ui/Field';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { ErrorState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { StarRating } from '@/components/patterns/RatingSection';
import { formatDate, formatNumber } from '@/lib/format';

interface RatingRow {
  id: string;
  content_type: 'quiz' | 'poll';
  content_id: string;
  contentTitle: string;
  score: number;
  review_text: string | null;
  status: 'published' | 'hidden';
  created_at: string;
  updated_at: string | null;
  user_id: string;
  username: string;
  display_name: string;
  dispute_count: number;
}

export function AdminRatings() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [contentType, setContentType] = useState('all');
  const [status, setStatus] = useState('all');
  const [score, setScore] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<{ row: RatingRow; action: 'hide' | 'restore' } | null>(null);
  const [reason, setReason] = useState('');

  const query = useQuery<Page<RatingRow> & { summary: { total: number; hidden: number; disputes: number; average: number | null } }>({
    queryKey: qk.adminRatings({ contentType, status, score, search, page }),
    queryFn: () => api.get(`/admin/ratings${buildQuery({ contentType, status, score, q: search, page, pageSize: 25 })}`),
    placeholderData: (prev) => prev,
  });

  const moderate = useMutation({
    mutationFn: ({ row, action }: { row: RatingRow; action: 'hide' | 'restore' }) =>
      api.post(`/admin/ratings/${row.id}/${action}`, { reason }),
    onSuccess: () => {
      setPending(null);
      setReason('');
      queryClient.invalidateQueries();
      toast.success('Rating updated and the moderation action was recorded.');
    },
    onError: (err) => {
      setPending(null);
      toast.error(err instanceof ApiError ? err.message : 'Could not update that rating.');
    },
  });

  const columns: Column<RatingRow>[] = [
    {
      key: 'content',
      header: 'Content',
      render: (row) => (
        <div className="min-w-0">
          <Link
            to={`/admin/${row.content_type === 'quiz' ? 'quizzes' : 'polls'}/${row.content_id}`}
            className="block max-w-[20rem] truncate font-medium text-ink hover:text-brand-700"
          >
            {row.contentTitle}
          </Link>
          <span className="text-2xs text-ink-faint">{row.content_type}</span>
        </div>
      ),
    },
    { key: 'score', header: 'Score', render: (row) => <StarRating value={row.score} readOnly size="sm" /> },
    {
      key: 'review',
      header: 'Review',
      render: (row) => (
        <span className="block max-w-[26rem] truncate text-ink-muted">{row.review_text ?? 'No written review'}</span>
      ),
    },
    {
      key: 'author',
      header: 'Author',
      render: (row) => (
        <Link to={`/admin/users/${row.user_id}`} className="text-ink-soft hover:text-brand-700">
          @{row.username}
        </Link>
      ),
    },
    {
      key: 'disputes',
      header: 'Disputes',
      align: 'right',
      render: (row) =>
        row.dispute_count > 0 ? <Badge tone="warning">{row.dispute_count}</Badge> : <span className="text-ink-faint">0</span>,
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'date', header: 'Submitted', align: 'right', render: (row) => <span className="whitespace-nowrap text-ink-muted">{formatDate(row.created_at)}</span> },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (row) =>
        row.status === 'hidden' ? (
          <Button size="sm" variant="ghost" onClick={() => { setPending({ row, action: 'restore' }); setReason(''); }}>
            Restore
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => { setPending({ row, action: 'hide' }); setReason(''); }}>
            Hide
          </Button>
        ),
    },
  ];

  const summary = query.data?.summary;

  return (
    <>
      <PageHeading
        title="Quality ratings"
        description="Every rating and written review on the platform. Hiding a review removes it from public averages but keeps it in this record."
        actions={<Button to="/admin/ratings/disputes" size="sm" variant="ghost">Open disputes</Button>}
      />

      {summary && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Ratings submitted" value={formatNumber(summary.total)} definition="Every rating row in the database, including hidden ones." />
          <Metric label="Hidden by moderators" value={formatNumber(summary.hidden)} definition="Ratings with status hidden." />
          <Metric label="Open disputes" value={formatNumber(summary.disputes)} definition="Rating disputes with status pending." />
          <Metric
            label="Average published score"
            value={summary.average !== null ? `${summary.average} / 5` : '—'}
            definition="AVG(score) across ratings with status published. Null when nothing has been rated."
          />
        </div>
      )}

      <div className="surface mb-4 flex flex-wrap items-end gap-2 p-3">
        <div className="min-w-[200px] flex-1">
          <TextInput
            aria-label="Search ratings"
            placeholder="Search review text or author"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          wrapperClassName="w-40"
          aria-label="Content type"
          value={contentType}
          onChange={(event) => {
            setContentType(event.target.value);
            setPage(1);
          }}
          options={[
            { value: 'all', label: 'All content' },
            { value: 'quiz', label: 'Quizzes' },
            { value: 'poll', label: 'Polls' },
          ]}
        />
        <Select
          wrapperClassName="w-36"
          aria-label="Score"
          value={score}
          onChange={(event) => {
            setScore(event.target.value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'Any score' },
            { value: '5', label: '5 stars' },
            { value: '4', label: '4 stars' },
            { value: '3', label: '3 stars' },
            { value: '2', label: '2 stars' },
            { value: '1', label: '1 star' },
          ]}
        />
        <Select
          wrapperClassName="w-40"
          aria-label="Status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          options={[
            { value: 'all', label: 'Any status' },
            { value: 'published', label: 'Published' },
            { value: 'hidden', label: 'Hidden' },
          ]}
        />
      </div>

      {query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={query.data?.items}
            loading={query.isLoading || query.isFetching}
            rowKey={(row) => row.id}
            emptyIcon={<Star className="h-4 w-4" />}
            emptyTitle="No ratings recorded"
            emptyDescription="Ratings and written reviews appear here once users rate published quizzes or polls."
          />
          {query.data && query.data.total > 0 && (
            <Pagination page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPage={setPage} />
          )}
        </>
      )}

      <ConfirmDialog
        open={pending !== null}
        title={pending ? `${pending.action === 'hide' ? 'Hide' : 'Restore'} this review?` : ''}
        description={
          pending?.action === 'hide'
            ? 'Hidden reviews stop counting towards public averages. The rating itself is kept and can be restored.'
            : 'The review becomes public again and counts towards averages.'
        }
        confirmLabel={pending?.action === 'hide' ? 'Hide review' : 'Restore review'}
        tone={pending?.action === 'hide' ? 'danger' : 'primary'}
        loading={moderate.isPending}
        onConfirm={() => pending && moderate.mutate(pending)}
        onCancel={() => {
          setPending(null);
          setReason('');
        }}
      >
        <div className="space-y-3">
          {pending?.row.review_text && (
            <p className="rounded-md border border-line bg-canvas px-3 py-2 text-[13px] text-ink-soft">{pending.row.review_text}</p>
          )}
          <TextArea
            label="Reason"
            required
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            hint="At least 5 characters. Recorded in the audit log and shown to the author when hiding."
          />
        </div>
      </ConfirmDialog>
    </>
  );
}
