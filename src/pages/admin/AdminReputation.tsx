import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { api, buildQuery, type Page } from '@/lib/api';
import { qk } from '@/lib/queries';
import { PageHeading, Badge, StatusBadge, Metric } from '@/components/ui/Primitives';
import { TextInput } from '@/components/ui/Field';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { ErrorState } from '@/components/ui/States';
import { formatNumber } from '@/lib/format';

interface ReputationRow {
  id: string;
  username: string;
  display_name: string;
  role: string;
  account_status: string;
  approved_quizzes: number;
  published_polls: number;
  rating_count: number;
  average_rating: number | null;
  approvals: number;
  rejections: number;
}

export function AdminReputation() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const query = useQuery<Page<ReputationRow>>({
    queryKey: qk.adminReputation({ search, page }),
    queryFn: () => api.get(`/admin/ratings/reputation${buildQuery({ q: search, page, pageSize: 25 })}`),
    placeholderData: (prev) => prev,
  });

  const rows = query.data?.items ?? [];
  const rated = rows.filter((row) => row.average_rating !== null);
  const platformAverage =
    rated.length > 0
      ? rated.reduce((sum, row) => sum + (row.average_rating ?? 0), 0) / rated.length
      : null;
  const totalRatings = rows.reduce((sum, row) => sum + row.rating_count, 0);

  const columns: Column<ReputationRow>[] = [
    {
      key: 'creator',
      header: 'Creator',
      render: (row) => (
        <div className="min-w-0">
          <Link to={`/admin/users/${row.id}`} className="block truncate font-medium text-ink hover:text-brand-700">
            {row.display_name}
          </Link>
          <span className="text-2xs text-ink-faint">@{row.username}</span>
        </div>
      ),
    },
    {
      key: 'published',
      header: 'Published',
      align: 'right',
      render: (row) => (
        <span className="tabular-nums text-ink-muted">
          {formatNumber(row.approved_quizzes)} quizzes · {formatNumber(row.published_polls)} polls
        </span>
      ),
    },
    {
      key: 'reviews',
      header: 'Decisions',
      align: 'right',
      render: (row) => (
        <span className="tabular-nums text-ink-muted">
          <span className="text-emerald-700">{formatNumber(row.approvals)}</span> approved ·{' '}
          <span className="text-red-600">{formatNumber(row.rejections)}</span> rejected
        </span>
      ),
    },
    {
      key: 'ratings',
      header: 'Ratings received',
      align: 'right',
      render: (row) => <span className="tabular-nums text-ink-soft">{formatNumber(row.rating_count)}</span>,
    },
    {
      key: 'average',
      header: 'Average rating',
      align: 'right',
      render: (row) =>
        row.average_rating !== null ? (
          <span className="tabular-nums font-medium text-ink">{row.average_rating.toFixed(2)} / 5</span>
        ) : (
          <span className="text-ink-faint">Not rated</span>
        ),
    },
    {
      key: 'standing',
      header: 'Account',
      align: 'right',
      render: (row) =>
        row.account_status === 'active' ? (
          <Badge tone="success">Active</Badge>
        ) : (
          <StatusBadge status={row.account_status} />
        ),
    },
  ];

  return (
    <>
      <PageHeading
        title="Creator reputation"
        description="How each creator's published content has been rated, alongside their moderation record. Averages only count ratings that are currently published."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Metric
          label="Creators tracked"
          value={formatNumber(query.data?.total ?? 0)}
          definition="Accounts with the creator or admin role."
        />
        <Metric
          label="Average creator rating (this page)"
          value={platformAverage !== null ? `${platformAverage.toFixed(2)} / 5` : '—'}
          definition="Mean of the per-creator average ratings shown on this page. Creators with no ratings are excluded."
        />
        <Metric
          label="Ratings behind these averages"
          value={formatNumber(totalRatings)}
          definition="SUM of published ratings received by the creators on this page."
        />
      </div>

      <div className="mb-4 max-w-sm">
        <TextInput
          aria-label="Search creators"
          placeholder="Search by username or display name"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
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
            onRowClick={(row) => undefined}
            emptyIcon={<Users className="h-4 w-4" />}
            emptyTitle="No creators to show"
            emptyDescription="Accounts gain the creator role when they publish their first quiz or poll."
          />
          {query.data && query.data.total > 0 && (
            <Pagination page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPage={setPage} />
          )}
        </>
      )}
    </>
  );
}
