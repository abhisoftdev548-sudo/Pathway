import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { api, buildQuery, type Page } from '@/lib/api';
import { qk } from '@/lib/queries';
import { PageHeading, Badge } from '@/components/ui/Primitives';
import { Select } from '@/components/ui/Field';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { formatCoins, formatDate, formatDuration, formatNumber } from '@/lib/format';

interface LeaderboardRow {
  rank: number;
  user_id: string;
  username: string;
  display_name: string;
  average_score?: number | null;
  best_score?: number | null;
  attempts: number;
  passes?: number;
  coins_earned?: number;
  best_time_seconds?: number | null;
  last_attempt_at?: string;
}

export function LeaderboardsPage() {
  const [scope, setScope] = useState('global');
  const [period, setPeriod] = useState('all');
  const [page, setPage] = useState(1);
  const [quizId, setQuizId] = useState('');

  const quizzes = useQuery<Page<{ id: string; title: string }>>({
    queryKey: qk.quizzes({ page: 1, pageSize: 100, sort: 'newest' }),
    queryFn: () => api.get('/quizzes?page=1&pageSize=100'),
    enabled: scope === 'quiz',
  });

  const path = `/leaderboards${buildQuery({ scope, period, quizId: scope === 'quiz' ? quizId : null, page, pageSize: 25 })}`;
  const query = useQuery<Page<LeaderboardRow> & { disabled?: boolean }>({
    queryKey: qk.leaderboards({ scope, period, quizId, page }),
    queryFn: () => api.get(path),
    enabled: scope === 'global' || Boolean(quizId),
    placeholderData: (prev) => prev,
  });

  const columns: Column<LeaderboardRow>[] = [
    {
      key: 'rank',
      header: '#',
      className: 'w-12',
      render: (row) => (
        <span
          className={`flex h-5 w-5 items-center justify-center rounded text-2xs font-semibold ${
            row.rank <= 3 ? 'bg-brand-50 text-brand-700' : 'bg-canvas text-ink-muted'
          }`}
        >
          {row.rank}
        </span>
      ),
    },
    {
      key: 'player',
      header: 'Player',
      render: (row) => (
        <div className="min-w-0">
          <span className="block truncate font-medium text-ink">{row.display_name}</span>
          <span className="text-2xs text-ink-faint">@{row.username}</span>
        </div>
      ),
    },
    ...(scope === 'quiz'
      ? [
          {
            key: 'best',
            header: 'Best score',
            align: 'right' as const,
            render: (row: LeaderboardRow) => (
              <span className="tabular-nums font-medium text-ink">{row.best_score ?? 0}%</span>
            ),
          },
          {
            key: 'time',
            header: 'Best time',
            align: 'right' as const,
            render: (row: LeaderboardRow) => (
              <span className="tabular-nums text-ink-muted">{formatDuration(row.best_time_seconds)}</span>
            ),
          },
        ]
      : [
          {
            key: 'average',
            header: 'Average score',
            align: 'right' as const,
            render: (row: LeaderboardRow) => (
              <span className="tabular-nums font-medium text-ink">{row.average_score ?? 0}%</span>
            ),
          },
          {
            key: 'passes',
            header: 'Passed',
            align: 'right' as const,
            render: (row: LeaderboardRow) => (
              <span className="tabular-nums text-ink-muted">
                {formatNumber(row.passes ?? 0)}/{formatNumber(row.attempts)}
              </span>
            ),
          },
          {
            key: 'coins',
            header: 'QCoin earned',
            align: 'right' as const,
            render: (row: LeaderboardRow) => (
              <span className="tabular-nums text-ink-muted">{formatCoins(row.coins_earned ?? 0)}</span>
            ),
          },
        ]),
    {
      key: 'attempts',
      header: 'Attempts',
      align: 'right',
      render: (row) => <span className="tabular-nums text-ink-muted">{formatNumber(row.attempts)}</span>,
    },
    {
      key: 'last',
      header: 'Last attempt',
      align: 'right',
      render: (row) => (
        <span className="whitespace-nowrap text-ink-muted">{row.last_attempt_at ? formatDate(row.last_attempt_at) : '—'}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeading
        title="Leaderboards"
        description={
          scope === 'global'
            ? 'Global rankings use the mean score across eligible attempts. Players need at least three completed attempts to appear.'
            : 'Per-quiz rankings use each player’s best score, with earlier submissions ranked higher on ties.'
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Select
          wrapperClassName="w-44"
          label="Board"
          value={scope}
          onChange={(event) => {
            setScope(event.target.value);
            setPage(1);
          }}
          options={[
            { value: 'global', label: 'Global' },
            { value: 'quiz', label: 'Single quiz' },
          ]}
        />
        {scope === 'quiz' && (
          <Select
            wrapperClassName="w-72"
            label="Quiz"
            value={quizId}
            onChange={(event) => {
              setQuizId(event.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: quizzes.isLoading ? 'Loading quizzes…' : 'Select a quiz' },
              ...(quizzes.data?.items ?? []).map((quiz) => ({ value: quiz.id, label: quiz.title })),
            ]}
          />
        )}
        <Select
          wrapperClassName="w-40"
          label="Period"
          value={period}
          onChange={(event) => {
            setPeriod(event.target.value);
            setPage(1);
          }}
          options={[
            { value: 'all', label: 'All time' },
            { value: '30d', label: 'Last 30 days' },
            { value: '7d', label: 'Last 7 days' },
          ]}
        />
      </div>

      {query.data?.disabled ? (
        <EmptyState
          icon={<Trophy className="h-4 w-4" />}
          title="Leaderboards are switched off"
          description="An administrator has disabled leaderboards in platform configuration."
        />
      ) : scope === 'quiz' && !quizId ? (
        <EmptyState
          icon={<Trophy className="h-4 w-4" />}
          title="Choose a quiz"
          description="Select a quiz above to see its leaderboard."
        />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
          {scope === 'global' && (query.data?.total ?? 0) > 0 && (
            <p className="mb-2 text-xs text-ink-muted">
              <Badge tone="neutral">Minimum 3 attempts</Badge> Players with fewer completed attempts are not ranked yet.
            </p>
          )}
          <DataTable
            columns={columns}
            rows={query.data?.items}
            loading={query.isLoading || query.isFetching}
            rowKey={(row) => row.user_id}
            emptyIcon={<Trophy className="h-4 w-4" />}
            emptyTitle="Complete an eligible quiz to appear on the leaderboard"
            emptyDescription={
              scope === 'global'
                ? 'Global rankings need at least three completed attempts per player before anyone is listed.'
                : 'No one has completed this quiz yet.'
            }
          />
          {query.data && query.data.total > 0 && (
            <Pagination page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPage={setPage} />
          )}
        </>
      )}
    </>
  );
}
