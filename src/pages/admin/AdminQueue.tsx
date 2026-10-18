import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { api, buildQuery, type Page } from '@/lib/api';
import { qk } from '@/lib/queries';
import { PageHeading, Tabs, Badge } from '@/components/ui/Primitives';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { formatCoins, formatDate, formatRelative, titleCase } from '@/lib/format';

interface QueueRow {
  content_type: 'quiz' | 'poll';
  id: string;
  title: string;
  status: string;
  creator_name: string;
  creator_username: string;
  submitted_at: string | null;
  version: number;
  entry_fee?: number;
  reward_coins?: number;
  question_count?: number;
  option_count?: number;
  previous_decision?: string | null;
  review_count?: number;
  category_name?: string | null;
}

export function AdminQueue() {
  const navigate = useNavigate();
  const [type, setType] = useState('all');
  const [page, setPage] = useState(1);

  const path = `/admin/content/queue${buildQuery({ page, pageSize: 25, type })}`;
  const query = useQuery<Page<QueueRow>>({
    queryKey: qk.adminQueue({ page, type }),
    queryFn: () => api.get(path),
    placeholderData: (prev) => prev,
  });

  const columns: Column<QueueRow>[] = [
    {
      key: 'title',
      header: 'Content',
      render: (row) => (
        <div className="min-w-0">
          <span className="block max-w-[24rem] truncate font-medium text-ink">{row.title}</span>
          <span className="text-2xs text-ink-faint">
            {row.content_type}
            {row.content_type === 'quiz' ? ` · ${row.question_count ?? 0} questions` : ` · ${row.option_count ?? 0} options`}
            {row.category_name ? ` · ${row.category_name}` : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'creator',
      header: 'Creator',
      render: (row) => (
        <div className="min-w-0">
          <span className="block truncate text-ink-soft">{row.creator_name}</span>
          <span className="text-2xs text-ink-faint">@{row.creator_username}</span>
        </div>
      ),
    },
    {
      key: 'version',
      header: 'Version',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Badge tone="neutral">v{row.version}</Badge>
          {row.review_count && row.review_count > 1 ? <Badge tone="warning">Resubmission</Badge> : <Badge tone="neutral">First review</Badge>}
        </div>
      ),
    },
    {
      key: 'economy',
      header: 'Entry / reward',
      align: 'right',
      render: (row) =>
        row.content_type === 'quiz' ? (
          <span className="tabular-nums text-ink-muted">
            {formatCoins(row.entry_fee ?? 0)} / {formatCoins(row.reward_coins ?? 0)}
          </span>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      key: 'waiting',
      header: 'Waiting',
      align: 'right',
      render: (row) => (
        <span className="whitespace-nowrap text-ink-muted">
          {row.submitted_at ? formatRelative(row.submitted_at) : '—'}
        </span>
      ),
    },
    {
      key: 'submitted',
      header: 'Submitted',
      align: 'right',
      render: (row) => <span className="whitespace-nowrap text-ink-faint">{formatDate(row.submitted_at)}</span>,
    },
  ];

  return (
    <>
      <PageHeading
        title="Pending reviews"
        description="Submissions waiting for a first decision or a re-review, oldest first. Click a row to open the full review."
      />

      <Tabs
        className="mb-4"
        tabs={[
          { id: 'all', label: 'Everything', count: query.data?.total ?? 0 },
          { id: 'quiz', label: 'Quizzes' },
          { id: 'poll', label: 'Polls' },
        ]}
        active={type}
        onChange={(next) => {
          setType(next);
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
            rowKey={(row) => `${row.content_type}-${row.id}`}
            onRowClick={(row) => navigate(`/admin/${row.content_type === 'quiz' ? 'quizzes' : 'polls'}/${row.id}`)}
            emptyIcon={<ClipboardList className="h-4 w-4" />}
            emptyTitle="The moderation queue is empty"
            emptyDescription="Nothing is waiting for review right now. New submissions appear here as soon as they are submitted."
          />
          {query.data && query.data.total > 0 && (
            <Pagination page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPage={setPage} />
          )}
        </>
      )}

      {query.data && query.data.total > 0 && (
        <p className="mt-3 text-xs text-ink-muted">
          {query.data.total} submission(s) awaiting a decision. Use{' '}
          <span className="font-medium">{titleCase('request changes')}</span> when a creator can fix the issue and resubmit.
        </p>
      )}
    </>
  );
}
