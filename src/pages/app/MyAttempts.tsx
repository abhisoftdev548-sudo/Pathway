import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ListChecks } from 'lucide-react';
import { api, type Page } from '@/lib/api';
import { qk } from '@/lib/queries';
import { PageHeading, Metric } from '@/components/ui/Primitives';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Primitives';
import { buildQuery } from '@/lib/api';
import { formatCoins, formatDate, formatDuration, formatNumber } from '@/lib/format';

interface AttemptRow {
  id: string;
  quiz_id: string;
  quiz_title: string;
  score_percent: number | null;
  correct_count: number;
  question_count: number;
  passed: number | null;
  time_spent_seconds: number | null;
  entry_fee_charged: number;
  reward_paid: number;
  submitted_at: string;
  category_name: string | null;
}

interface AttemptsResponse extends Page<AttemptRow> {
  summary: {
    attempts: number;
    passes: number;
    averageScore: number | null;
    coinsEarned: number;
    coinsSpent: number;
  };
}

export function MyAttempts() {
  const [page, setPage] = useState(1);
  const path = `/attempts${buildQuery({ page, pageSize: 20 })}`;
  const query = useQuery<AttemptsResponse>({
    queryKey: qk.attempts({ page }),
    queryFn: () => api.get(path),
    placeholderData: (prev) => prev,
  });

  const columns: Column<AttemptRow>[] = [
    {
      key: 'quiz',
      header: 'Quiz',
      render: (row) => (
        <div className="min-w-0">
          <Link to={`/app/attempts/${row.id}`} className="block truncate font-medium text-ink hover:text-brand-700">
            {row.quiz_title}
          </Link>
          <span className="text-2xs text-ink-faint">{row.category_name ?? 'Uncategorised'}</span>
        </div>
      ),
    },
    {
      key: 'score',
      header: 'Score',
      render: (row) => (
        <span className="tabular-nums text-ink">{row.score_percent === null ? '—' : `${row.score_percent}%`}</span>
      ),
    },
    {
      key: 'correct',
      header: 'Correct',
      render: (row) => (
        <span className="tabular-nums text-ink-muted">
          {row.correct_count}/{row.question_count}
        </span>
      ),
    },
    {
      key: 'result',
      header: 'Result',
      render: (row) =>
        row.passed === null ? (
          <span className="text-ink-faint">—</span>
        ) : (
          <Badge tone={row.passed ? 'success' : 'neutral'}>{row.passed ? 'Passed' : 'Not passed'}</Badge>
        ),
    },
    {
      key: 'coins',
      header: 'QCoin',
      align: 'right',
      render: (row) => (
        <span className="tabular-nums">
          {row.reward_paid > 0 && <span className="text-emerald-700">+{formatCoins(row.reward_paid)}</span>}
          {row.entry_fee_charged > 0 && <span className="ml-1 text-ink-muted">−{formatCoins(row.entry_fee_charged)}</span>}
          {row.reward_paid === 0 && row.entry_fee_charged === 0 && <span className="text-ink-faint">—</span>}
        </span>
      ),
    },
    {
      key: 'time',
      header: 'Time',
      align: 'right',
      render: (row) => <span className="text-ink-muted">{formatDuration(row.time_spent_seconds)}</span>,
    },
    {
      key: 'date',
      header: 'Completed',
      align: 'right',
      render: (row) => <span className="whitespace-nowrap text-ink-muted">{formatDate(row.submitted_at)}</span>,
    },
  ];

  return (
    <>
      <PageHeading title="My quiz attempts" description="Every submitted attempt, scored on the server." />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Attempts" value={formatNumber(query.data?.summary.attempts ?? 0)} />
        <Metric label="Passed" value={formatNumber(query.data?.summary.passes ?? 0)} />
        <Metric
          label="Average score"
          value={query.data?.summary.averageScore !== null && query.data?.summary.averageScore !== undefined ? `${query.data.summary.averageScore}%` : '—'}
        />
        <Metric
          label="QCoin earned"
          value={formatCoins(query.data?.summary.coinsEarned ?? 0)}
          hint={`${formatCoins(query.data?.summary.coinsSpent ?? 0)} spent on entry fees`}
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
            emptyTitle="You have not completed any quizzes yet"
            emptyDescription="Once you finish a quiz attempt it will be listed here with its score and any reward earned."
          />
          {query.data && query.data.total > 0 && (
            <Pagination page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPage={setPage} />
          )}
        </>
      )}
    </>
  );
}

export { ListChecks };
