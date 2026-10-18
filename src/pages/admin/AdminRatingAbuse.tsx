import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { qk } from '@/lib/queries';
import { PageHeading, Panel, Badge } from '@/components/ui/Primitives';
import { DataTable, type Column } from '@/components/ui/Table';
import { ErrorState } from '@/components/ui/States';
import { formatDateTime, formatNumber } from '@/lib/format';

interface AbuseSignals {
  burstRatings: { user_id: string; username: string; display_name: string; ratings: number; first_at: string; last_at: string }[];
  singleScoreRaters: { user_id: string; username: string; display_name: string; score: number; ratings: number }[];
  disputed: {
    rating_id: string;
    content_type: string;
    content_id: string;
    contentTitle: string;
    score: number;
    disputes: number;
    last_disputed_at: string;
  }[];
  generatedAt: string;
}

export function AdminRatingAbuse() {
  const query = useQuery<AbuseSignals>({ queryKey: qk.adminRatingAbuse, queryFn: () => api.get('/admin/ratings/abuse') });

  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const data = query.data;
  const total = data
    ? data.burstRatings.length + data.singleScoreRaters.length + data.disputed.length
    : 0;

  const burstColumns: Column<AbuseSignals['burstRatings'][number]>[] = [
    {
      key: 'user',
      header: 'Account',
      render: (row) => (
        <Link to={`/admin/users/${row.user_id}`} className="truncate font-medium text-ink hover:text-brand-700">
          @{row.username}
        </Link>
      ),
    },
    {
      key: 'ratings',
      header: 'Ratings in 24h',
      align: 'right',
      render: (row) => <span className="tabular-nums text-ink">{formatNumber(row.ratings)}</span>,
    },
    { key: 'first', header: 'First', align: 'right', render: (row) => <span className="whitespace-nowrap text-ink-muted">{formatDateTime(row.first_at)}</span> },
    { key: 'last', header: 'Last', align: 'right', render: (row) => <span className="whitespace-nowrap text-ink-muted">{formatDateTime(row.last_at)}</span> },
  ];

  const singleScoreColumns: Column<AbuseSignals['singleScoreRaters'][number]>[] = [
    {
      key: 'user',
      header: 'Account',
      render: (row) => (
        <Link to={`/admin/users/${row.user_id}`} className="truncate font-medium text-ink hover:text-brand-700">
          @{row.username}
        </Link>
      ),
    },
    { key: 'score', header: 'Score', align: 'right', render: (row) => <span className="tabular-nums text-ink">{row.score} / 5</span> },
    {
      key: 'ratings',
      header: 'Ratings at this score',
      align: 'right',
      render: (row) => <span className="tabular-nums text-ink">{formatNumber(row.ratings)}</span>,
    },
  ];

  const disputedColumns: Column<AbuseSignals['disputed'][number]>[] = [
    {
      key: 'content',
      header: 'Content',
      render: (row) => (
        <div className="min-w-0">
          <Link
            to={`/admin/${row.content_type === 'quiz' ? 'quizzes' : 'polls'}/${row.content_id}`}
            className="block max-w-[24rem] truncate font-medium text-ink hover:text-brand-700"
          >
            {row.contentTitle}
          </Link>
          <span className="text-2xs text-ink-faint">
            {row.content_type} · rating {row.score}/5
          </span>
        </div>
      ),
    },
    {
      key: 'disputes',
      header: 'Disputes',
      align: 'right',
      render: (row) => <Badge tone="warning">{formatNumber(row.disputes)}</Badge>,
    },
    {
      key: 'last',
      header: 'Last disputed',
      align: 'right',
      render: (row) => <span className="whitespace-nowrap text-ink-muted">{formatDateTime(row.last_disputed_at)}</span>,
    },
  ];

  return (
    <>
      <PageHeading
        title="Rating abuse reports"
        description="Patterns detected in the rating data itself. Each row is a real aggregate query — nothing is estimated."
        actions={
          data ? (
            <Badge tone={total === 0 ? 'success' : 'warning'}>
              {total === 0 ? 'No patterns detected' : `${total} signal(s)`}
            </Badge>
          ) : null
        }
      />

      {query.isLoading ? (
        <div className="surface p-6 text-[13px] text-ink-muted">Scanning rating activity…</div>
      ) : total === 0 ? (
        <div className="surface flex flex-col items-center gap-2 px-4 py-12 text-center">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <p className="text-[13px] font-medium text-ink">No rating abuse patterns found</p>
          <p className="max-w-md text-[13px] text-ink-muted">
            No accounts rated five or more times within 24 hours, no repeated single-score patterns, and no ratings under dispute.
          </p>
          {data && <p className="mt-1 text-2xs text-ink-faint">Last scan: {formatDateTime(data.generatedAt)}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {data && data.burstRatings.length > 0 && (
            <Panel
              title="Rating bursts"
              description="Accounts that submitted five or more ratings within the last 24 hours."
              actions={<Badge tone="warning">{data.burstRatings.length}</Badge>}
            >
              <DataTable columns={burstColumns} rows={data.burstRatings} rowKey={(row) => row.user_id} />
            </Panel>
          )}
          {data && data.singleScoreRaters.length > 0 && (
            <Panel
              title="Repeated identical scores"
              description="Accounts that gave the same score five or more times."
              actions={<Badge tone="warning">{data.singleScoreRaters.length}</Badge>}
            >
              <DataTable columns={singleScoreColumns} rows={data.singleScoreRaters} rowKey={(row) => `${row.user_id}-${row.score}`} />
            </Panel>
          )}
          {data && data.disputed.length > 0 && (
            <Panel
              title="Most disputed ratings"
              description="Ratings that users have asked to be reviewed, most disputed first."
              actions={<Badge tone="warning">{data.disputed.length}</Badge>}
            >
              <DataTable columns={disputedColumns} rows={data.disputed} rowKey={(row) => row.rating_id} />
            </Panel>
          )}
          {data && (
            <p className="flex items-center gap-1.5 text-xs text-ink-muted">
              <ShieldAlert className="h-3.5 w-3.5" />
              Scan generated {formatDateTime(data.generatedAt)}. Hide a rating from the ratings page if it breaks the guidelines.
            </p>
          )}
        </div>
      )}
    </>
  );
}
