import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Crown, Flame, Trophy } from 'lucide-react';
import endpoints, { type LeaderboardRow } from '@/services/endpoints';
import { useAuth } from '@/context/AuthContext';
import { useDocumentTitle } from '@/hooks';
import { Avatar, Badge, Tabs } from '@/components/ui/Data';
import { EmptyState, ErrorState, PageHeader, SkeletonTable, Card, CardBody } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { formatNumber, formatPercent } from '@/utils/format';
import { apiErrorMessage } from '@/services/api';
import { cn } from '@/utils/cn';

type BoardKey = 'performance' | 'consistency' | 'creators';

/**
 * Leaderboards computed from real, server-verified activity.
 * Boards with no qualifying entries show an honest empty state instead of
 * fabricated rankings.
 */
export function LeaderboardsPage() {
  useDocumentTitle('Leaderboards');
  const { user } = useAuth();
  const [board, setBoard] = useState<BoardKey>('performance');

  const query = useQuery({
    queryKey: ['leaderboard', board],
    queryFn: () => {
      if (board === 'performance') return endpoints.leaderboards.performance(20);
      if (board === 'consistency') return endpoints.leaderboards.consistency(20);
      return endpoints.leaderboards.creators(20);
    },
  });

  const rows = query.data?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Leaderboards"
        description="Rankings built from real attempts and eligible ratings — never from wallet balances."
      />

      <div className="mb-6">
        <Tabs
          items={[
            { key: 'performance', label: <TabLabel icon={<Trophy className="h-4 w-4" />} text="Performance" /> },
            { key: 'consistency', label: <TabLabel icon={<Flame className="h-4 w-4" />} text="Consistency" /> },
            { key: 'creators', label: <TabLabel icon={<Crown className="h-4 w-4" />} text="Creators" /> },
          ]}
          active={board}
          onChange={(key) => setBoard(key as BoardKey)}
        />
      </div>

      {query.isLoading ? (
        <SkeletonTable rows={8} cols={4} />
      ) : query.isError ? (
        <ErrorState
          title="Could not load leaderboard"
          description={apiErrorMessage(query.error)}
          action={<Button onClick={() => query.refetch()}>Try again</Button>}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-6 w-6" />}
          title="No rankings yet"
          description={
            board === 'performance'
              ? 'Performance rankings appear once members complete at least three passed quizzes.'
              : board === 'consistency'
                ? 'Consistency rankings appear once members complete at least five quiz attempts.'
                : 'Creator rankings appear once published content receives community ratings.'
          }
        />
      ) : (
        <Card>
          <CardBody className="p-0">
            <ol className="divide-y divide-line">
              {rows.map((row: LeaderboardRow) => {
                const isMe = user && row.userId === user._id;
                return (
                  <li
                    key={row.userId}
                    className={cn(
                      'flex items-center gap-4 px-5 py-3.5',
                      isMe && 'bg-brand-50/60'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                        row.rank === 1
                          ? 'bg-amber-100 text-warning'
                          : row.rank === 2
                            ? 'bg-line text-body'
                            : row.rank === 3
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-surface-muted text-body'
                      )}
                    >
                      {row.rank}
                    </span>
                    <Avatar name={row.name} src={row.avatarUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-heading">
                        {row.name}
                        {isMe && <Badge tone="brand" className="ml-2">You</Badge>}
                      </p>
                      <p className="text-xs text-muted">{describeRow(board, row)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-heading">{primaryValue(board, row)}</p>
                      <p className="text-xs text-muted">{primaryLabel(board)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function TabLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {text}
    </span>
  );
}

function describeRow(board: BoardKey, row: LeaderboardRow): string {
  if (board === 'performance') {
    return `${formatNumber(row.passedCount ?? 0)} passed · ${formatNumber(row.completedCount ?? 0)} completed`;
  }
  if (board === 'consistency') {
    return `${formatNumber(row.completedCount ?? 0)} attempts · score variance ${row.scoreStdev ?? 0}`;
  }
  return `${formatNumber(row.publishedCount ?? 0)} published · ${formatNumber(row.ratingCount ?? 0)} ratings`;
}

function primaryValue(board: BoardKey, row: LeaderboardRow): string {
  if (board === 'performance') return formatPercent(row.avgScore ?? 0, 1);
  if (board === 'consistency') return formatNumber(row.consistencyScore ?? 0);
  return (row.ratingScore ?? 0).toFixed(2);
}

function primaryLabel(board: BoardKey): string {
  if (board === 'performance') return 'avg score';
  if (board === 'consistency') return 'consistency';
  return 'rating';
}

export default LeaderboardsPage;
