import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { api } from '@/lib/api';
import { qk } from '@/lib/queries';
import { PageHeading, Panel } from '@/components/ui/Primitives';
import { Select } from '@/components/ui/Field';
import { DataTable, type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState, CardSkeleton } from '@/components/ui/States';
import { BarSeriesChart, TimeSeriesChart, seriesColor } from '@/components/ui/Chart';
import { formatNumber, titleCase } from '@/lib/format';

interface AnalyticsData {
  series: {
    day: string;
    newUsers: number;
    usersCumulative: number;
    attempts: number;
    quizzesPublished: number;
    votes: number;
    coinsIssued: number;
    coinsSpent: number;
  }[];
  breakdown: {
    quizzesByCategory: { name: string; total: number }[];
    quizzesByDifficulty: { name: string; total: number }[];
    attemptsByOutcome: { outcome: string; total: number }[];
    roleBreakdown: { role: string; total: number }[];
    statusBreakdown: { status: string; total: number }[];
  };
  topQuizzes: { id: string; title: string; total_attempts: number; entry_fee: number; reward_coins: number; rating_average: number | null }[];
  hasAnyData: boolean;
  rangeDays: number;
}

export function AdminAnalytics() {
  const [days, setDays] = useState(30);
  const query = useQuery<AnalyticsData>({
    queryKey: qk.adminAnalytics(days),
    queryFn: () => api.get(`/admin/analytics?days=${days}`),
    placeholderData: (prev) => prev,
  });

  const columns: Column<AnalyticsData['topQuizzes'][number]>[] = [
    {
      key: 'title',
      header: 'Quiz',
      render: (row) => (
        <a href={`/admin/quizzes/${row.id}`} className="block max-w-[24rem] truncate font-medium text-ink hover:text-brand-700">
          {row.title}
        </a>
      ),
    },
    { key: 'attempts', header: 'Attempts', align: 'right', render: (row) => <span className="tabular-nums">{formatNumber(row.total_attempts)}</span> },
    {
      key: 'economy',
      header: 'Entry / reward',
      align: 'right',
      render: (row) => (
        <span className="tabular-nums text-ink-muted">
          {row.entry_fee} / {row.reward_coins}
        </span>
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      align: 'right',
      render: (row) => <span className="tabular-nums">{row.rating_average ?? '—'}</span>,
    },
  ];

  return (
    <>
      <PageHeading
        title="Platform analytics"
        description="Trends built from recorded events only. When a range has no data, the chart says so instead of drawing a guess."
        actions={
          <Select
            wrapperClassName="w-36"
            aria-label="Date range"
            value={String(days)}
            onChange={(event) => setDays(Number(event.target.value))}
            options={[
              { value: '7', label: 'Last 7 days' },
              { value: '30', label: 'Last 30 days' },
              { value: '90', label: 'Last 90 days' },
            ]}
          />
        }
      />

      {query.isLoading ? (
        <CardSkeleton count={4} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !query.data?.hasAnyData ? (
        <EmptyState
          icon={<BarChart3 className="h-4 w-4" />}
          title="No platform data to chart yet"
          description="Charts appear once accounts are created, quizzes are published and players start attempting them. Every series on this page is derived from database records."
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <TimeSeriesChart
              title="Registered users"
              description="New accounts per day and the running total."
              data={query.data.series}
              series={[
                { key: 'newUsers', label: 'New users', color: seriesColor(0) },
                { key: 'usersCumulative', label: 'Total users', color: seriesColor(3) },
              ]}
            />
            <TimeSeriesChart
              title="Quiz activity"
              description="Completed attempts and quizzes approved per day."
              data={query.data.series}
              series={[
                { key: 'attempts', label: 'Attempts', color: seriesColor(1) },
                { key: 'quizzesPublished', label: 'Quizzes published', color: seriesColor(2) },
              ]}
            />
            <TimeSeriesChart
              title="QCoin flow"
              description="Coins issued and spent per day from the ledger."
              data={query.data.series}
              series={[
                { key: 'coinsIssued', label: 'Issued', color: seriesColor(1) },
                { key: 'coinsSpent', label: 'Spent', color: seriesColor(4) },
              ]}
            />
            <TimeSeriesChart
              title="Poll votes"
              description="Votes recorded per day."
              data={query.data.series}
              series={[{ key: 'votes', label: 'Votes', color: seriesColor(2) }]}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <BarSeriesChart
              title="Approved quizzes by category"
              data={query.data.breakdown.quizzesByCategory.map((row) => ({ name: row.name, total: row.total }))}
              series={[{ key: 'total', label: 'Quizzes', color: seriesColor(0) }]}
              height={Math.max(200, query.data.breakdown.quizzesByCategory.length * 36)}
            />
            <BarSeriesChart
              title="Attempt outcomes"
              description="Completed attempts grouped by pass result."
              data={query.data.breakdown.attemptsByOutcome.map((row) => ({ name: row.outcome, total: row.total }))}
              series={[{ key: 'total', label: 'Attempts', color: seriesColor(1) }]}
              height={220}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Panel title="Accounts by role">
              <ul className="space-y-1.5 text-[13px]">
                {query.data.breakdown.roleBreakdown.length === 0 ? (
                  <li className="text-ink-muted">No accounts yet.</li>
                ) : (
                  query.data.breakdown.roleBreakdown.map((row) => (
                    <li key={row.role} className="flex items-center justify-between">
                      <span className="text-ink-muted">{titleCase(row.role)}</span>
                      <span className="tabular-nums text-ink">{formatNumber(row.total)}</span>
                    </li>
                  ))
                )}
              </ul>
            </Panel>
            <Panel title="Accounts by status">
              <ul className="space-y-1.5 text-[13px]">
                {query.data.breakdown.statusBreakdown.map((row) => (
                  <li key={row.status} className="flex items-center justify-between">
                    <span className="text-ink-muted">{titleCase(row.status)}</span>
                    <span className="tabular-nums text-ink">{formatNumber(row.total)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Approved quizzes by difficulty">
              <ul className="space-y-1.5 text-[13px]">
                {query.data.breakdown.quizzesByDifficulty.length === 0 ? (
                  <li className="text-ink-muted">No approved quizzes yet.</li>
                ) : (
                  query.data.breakdown.quizzesByDifficulty.map((row) => (
                    <li key={row.name} className="flex items-center justify-between">
                      <span className="text-ink-muted">{row.name}</span>
                      <span className="tabular-nums text-ink">{formatNumber(row.total)}</span>
                    </li>
                  ))
                )}
              </ul>
            </Panel>
          </div>

          <Panel title="Most attempted quizzes" className="mt-4" bodyClassName="p-0">
            {!query.data.topQuizzes.length ? (
              <div className="p-4">
                <EmptyState compact title="No approved quizzes yet" description="Published quizzes are ranked here by recorded attempts." />
              </div>
            ) : (
              <DataTable columns={columns} rows={query.data.topQuizzes} rowKey={(row) => row.id} />
            )}
          </Panel>
        </>
      )}
    </>
  );
}
