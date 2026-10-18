import { Link, useNavigate } from 'react-router-dom';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { StatusBadge, Badge } from '@/components/ui/Primitives';
import { buildQuery, type Page as ApiPage } from '@/lib/api';
import { formatCoins, formatDate, titleCase } from '@/lib/format';

export interface ContentRow {
  id: string;
  title: string;
  status: string;
  creator_name?: string;
  creator_username?: string;
  submitted_at?: string | null;
  published_at?: string | null;
  updated_at?: string;
  entry_fee?: number;
  reward_coins?: number;
  question_count?: number;
  option_count?: number;
  vote_count?: number;
  total_attempts?: number;
  engagement?: number;
  version?: number;
  review_notes?: string | null;
  previous_decision?: string | null;
  review_count?: number;
  category_name?: string | null;
  closes_at?: string | null;
  content_type?: 'quiz' | 'poll';
}

interface ContentTableProps<T extends ContentRow> {
  data?: ApiPage<T>;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  onPage: (page: number) => void;
  linkTo: (row: T) => string;
  showCreator?: boolean;
  showPreviousDecision?: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}

export function ContentTable<T extends ContentRow>({
  data,
  loading,
  error,
  onRetry,
  onPage,
  linkTo,
  showCreator = false,
  showPreviousDecision = false,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: ContentTableProps<T>) {
  const navigate = useNavigate();
  const columns: Column<T>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (row) => (
        <Link
          to={linkTo(row)}
          className="block min-w-0"
          onClick={(event) => event.stopPropagation()}
        >
          <span className="block max-w-[26rem] truncate font-medium text-ink hover:text-brand-700">{row.title}</span>
          <span className="mt-0.5 block text-2xs text-ink-faint">
            {row.content_type === 'poll'
              ? `${row.option_count ?? 0} options`
              : `${row.question_count ?? 0} questions`}
            {row.version ? ` · v${row.version}` : ''}
            {row.category_name ? ` · ${row.category_name}` : ''}
          </span>
        </Link>
      ),
    },
    ...(showCreator
      ? [
          {
            key: 'creator',
            header: 'Creator',
            render: (row: T) => (
              <span className="text-ink-soft">
                {row.creator_name ?? '—'}
                {row.creator_username && <span className="block text-2xs text-ink-faint">@{row.creator_username}</span>}
              </span>
            ),
          } satisfies Column<T>,
        ]
      : []),
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    ...(showPreviousDecision
      ? [
          {
            key: 'previous',
            header: 'Previous review',
            render: (row: T) =>
              row.previous_decision ? (
                <Badge tone="neutral">{titleCase(row.previous_decision)}</Badge>
              ) : (
                <span className="text-ink-faint">First review</span>
              ),
          } satisfies Column<T>,
        ]
      : []),
    {
      key: 'economy',
      header: 'Entry / reward',
      render: (row) =>
        row.content_type === 'poll' ? (
          <span className="tabular-nums text-ink-muted">{formatCoins(row.vote_count ?? 0)} votes</span>
        ) : (
          <span className="tabular-nums text-ink-muted">
            {formatCoins(row.entry_fee ?? 0)} / {formatCoins(row.reward_coins ?? 0)}
          </span>
        ),
    },
    {
      key: 'date',
      header: 'Submitted',
      render: (row) => <span className="whitespace-nowrap text-ink-muted">{formatDate(row.submitted_at ?? row.published_at ?? row.updated_at)}</span>,
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={data?.items}
        loading={loading}
        error={error}
        onRetry={onRetry}
        rowKey={(row) => row.id}
        onRowClick={(row) => navigate(linkTo(row))}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        emptyAction={emptyAction}
      />
      {data && data.total > 0 && (
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={onPage} />
      )}
    </>
  );
}

export { buildQuery };
