import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { api } from '@/lib/api';
import { qk } from '@/lib/queries';
import { PageHeading, Panel } from '@/components/ui/Primitives';
import { Select } from '@/components/ui/Field';
import { DataTable, type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState, CardSkeleton } from '@/components/ui/States';
import { TimeSeriesChart, seriesColor } from '@/components/ui/Chart';
import { formatNumber } from '@/lib/format';

interface SeriesPoint extends Record<string, unknown> {
  day: string;
  attempts: number;
  passes: number;
  votes: number;
  ratings: number;
}

interface PerQuizRow {
  id: string;
  title: string;
  total_attempts: number;
  passes: number;
  average_score: number | null;
  rating_count: number;
  rating_average: number | null;
}

export function CreatorAnalytics() {
  const [days, setDays] = useState(30);
  const query = useQuery<{ series: SeriesPoint[]; perQuiz: PerQuizRow[]; rangeDays: number }>({
    queryKey: qk.creatorAnalytics(days),
    queryFn: () => api.get(`/creator/analytics?days=${days}`),
    placeholderData: (prev) => prev,
  });

  const columns: Column<PerQuizRow>[] = [
    {
      key: 'title',
      header: 'Quiz',
      render: (row) => (
        <a href={`/app/quizzes/${row.id}`} className="block max-w-[24rem] truncate font-medium text-ink hover:text-brand-700">
          {row.title}
        </a>
      ),
    },
    { key: 'attempts', header: 'Attempts', align: 'right', render: (row) => <span className="tabular-nums">{formatNumber(row.total_attempts)}</span> },
    { key: 'passes', header: 'Passed', align: 'right', render: (row) => <span className="tabular-nums">{formatNumber(row.passes ?? 0)}</span> },
    {
      key: 'average',
      header: 'Average score',
      align: 'right',
      render: (row) => <span className="tabular-nums">{row.average_score !== null ? `${row.average_score}%` : '—'}</span>,
    },
    {
      key: 'rating',
      header: 'Rating',
      align: 'right',
      render: (row) => (
        <span className="tabular-nums">
          {row.rating_count > 0 ? `${row.rating_average} (${row.rating_count})` : '—'}
        </span>
      ),
    },
  ];

  const series = query.data?.series ?? [];
  const hasActivity = series.some((point) => point.attempts || point.votes || point.ratings);

  return (
    <>
      <PageHeading
        title="Creator analytics"
        description="Attempts, votes and ratings on your published content, grouped by day."
        actions={
          <Select
            wrapperClassName="w-40"
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
        <CardSkeleton count={3} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !hasActivity && !query.data?.perQuiz.length ? (
        <EmptyState
          icon={<BarChart3 className="h-4 w-4" />}
          title="Analytics will appear once users interact with your content"
          description="No attempts, votes or ratings have been recorded on your published content in this range yet."
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <TimeSeriesChart
              title="Quiz attempts and passes"
              description="Daily attempts on your published quizzes."
              data={series}
              series={[
                { key: 'attempts', label: 'Attempts', color: seriesColor(0) },
                { key: 'passes', label: 'Passed', color: seriesColor(1) },
              ]}
            />
            <TimeSeriesChart
              title="Poll votes and ratings"
              description="Daily votes on your polls and ratings received across your content."
              data={series}
              series={[
                { key: 'votes', label: 'Poll votes', color: seriesColor(2) },
                { key: 'ratings', label: 'Ratings', color: seriesColor(3) },
              ]}
            />
          </div>

          <Panel title="Per-quiz performance" className="mt-4" bodyClassName="p-0">
            {!query.data?.perQuiz.length ? (
              <div className="p-4">
                <EmptyState compact title="No published quizzes to compare" description="Approved quizzes appear here with their engagement figures." />
              </div>
            ) : (
              <DataTable columns={columns} rows={query.data.perQuiz} rowKey={(row) => row.id} />
            )}
          </Panel>
        </>
      )}
    </>
  );
}
