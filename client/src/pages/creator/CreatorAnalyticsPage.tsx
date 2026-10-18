import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import endpoints, { type QuizSummary } from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { StatCard, Table, Td, RatingStars } from '@/components/ui/Data';
import { Card, CardBody, CardHeader, EmptyState, ErrorState, PageHeader, SkeletonList } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { formatNumber, formatPercent, formatDate } from '@/utils/format';
import { apiErrorMessage } from '@/services/api';

/**
 * Creator analytics over published quizzes — genuine aggregates computed from
 * real attempts. Charts render only when data exists.
 */
export function CreatorAnalyticsPage() {
  useDocumentTitle('Creator analytics');

  const published = useQuery({
    queryKey: ['quizzes', 'mine', 'APPROVED', 1],
    queryFn: () => endpoints.quizzes.mine({ status: 'APPROVED', limit: 50 }),
  });

  const items = (published.data?.items ?? []) as QuizSummary[];
  const totalAttempts = items.reduce((sum, q) => sum + (q.stats?.attemptsCount ?? 0), 0);
  const totalCompletions = items.reduce((sum, q) => sum + (q.stats?.completionsCount ?? 0), 0);
  const totalPasses = items.reduce((sum, q) => sum + (q.stats?.passesCount ?? 0), 0);
  const hasData = items.length > 0 && totalAttempts > 0;

  const chartData = items
    .filter((q) => (q.stats?.attemptsCount ?? 0) > 0)
    .map((q) => ({
      name: q.title.length > 16 ? `${q.title.slice(0, 16)}…` : q.title,
      attempts: q.stats?.attemptsCount ?? 0,
      passes: q.stats?.passesCount ?? 0,
    }));

  return (
    <div>
      <PageHeader
        title="Creator analytics"
        description="Performance of your published quizzes, measured from real attempts."
      />

      {published.isLoading ? (
        <SkeletonList count={2} />
      ) : published.isError ? (
        <ErrorState
          title="Could not load analytics"
          description={apiErrorMessage(published.error)}
          action={<Button onClick={() => published.refetch()}>Try again</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="h-6 w-6" />}
          title="No published content yet"
          description="Analytics appear once your quizzes are approved and start collecting attempts."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Published quizzes" value={formatNumber(items.length)} icon={<BarChart3 className="h-5 w-5" />} />
            <StatCard
              label="Total attempts"
              value={formatNumber(totalAttempts)}
              icon={<TrendingUp className="h-5 w-5" />}
              tone="brand"
            />
            <StatCard label="Completions" value={formatNumber(totalCompletions)} tone="success" />
            <StatCard
              label="Passes"
              value={formatNumber(totalPasses)}
              hint={totalCompletions > 0 ? `${formatPercent((totalPasses / totalCompletions) * 100)} pass rate` : undefined}
            />
          </div>

          {hasData && chartData.length > 0 && (
            <Card className="mt-6">
              <CardHeader title="Attempts vs passes" subtitle="Per published quiz." />
              <CardBody>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="attempts" fill="#6366f1" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="passes" fill="#10b981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardBody>
            </Card>
          )}

          <Card className="mt-6">
            <CardHeader title="Per-quiz breakdown" />
            <CardBody className="p-0">
              <Table head={['Quiz', 'Attempts', 'Pass rate', 'Avg score', 'Rating', 'Published']}>
                {items.map((quiz) => {
                  const completions = quiz.stats?.completionsCount ?? 0;
                  const passes = quiz.stats?.passesCount ?? 0;
                  return (
                    <tr key={quiz._id} className="hover:bg-surface-muted/70">
                      <Td className="font-medium text-heading">{quiz.title}</Td>
                      <Td>{formatNumber(quiz.stats?.attemptsCount ?? 0)}</Td>
                      <Td>{completions > 0 ? formatPercent((passes / completions) * 100) : '—'}</Td>
                      <Td>{formatPercent(quiz.stats?.avgScore ?? 0, 1)}</Td>
                      <Td>
                        {(quiz.stats?.ratingCount ?? 0) > 0 ? (
                          <RatingStars value={quiz.stats?.ratingBayes ?? 0} count={quiz.stats?.ratingCount} />
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </Td>
                      <Td className="text-body">{formatDate(quiz.publishedAt)}</Td>
                    </tr>
                  );
                })}
              </Table>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

export default CreatorAnalyticsPage;
