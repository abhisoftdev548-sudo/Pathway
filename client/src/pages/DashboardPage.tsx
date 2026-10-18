import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight, Award, Coins, FileText, ListChecks, PenLine, Star, Trophy, Vote, Wallet,
} from 'lucide-react';
import endpoints from '@/services/endpoints';
import { useAuth } from '@/context/AuthContext';
import { useDocumentTitle } from '@/hooks';
import { Button } from '@/components/ui/Button';
import { Badge, StatCard, Table, Td } from '@/components/ui/Data';
import { Card, CardBody, CardHeader, EmptyState, ErrorState, SkeletonList, SkeletonTable } from '@/components/ui/Feedback';
import { formatDate, formatNumber, formatPercent, formatRelative } from '@/utils/format';
import { TX_TYPE_LABELS } from '@/utils/constants';
import { apiErrorMessage } from '@/services/api';

/** User overview: real activity counts, recent attempts, wallet movement. */
export function DashboardPage() {
  const { user } = useAuth();
  useDocumentTitle('Overview');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['user-stats'],
    queryFn: () => endpoints.users.myStats(),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-lg" />
          ))}
        </div>
        <SkeletonList count={2} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <ErrorState
        title="Could not load your overview"
        description={apiErrorMessage(error)}
        action={<Button onClick={() => refetch()}>Try again</Button>}
      />
    );
  }

  const counts = data.counts ?? {
    quizzesCreated: 0,
    pollsCreated: 0,
    attempts: 0,
    passedAttempts: 0,
    notificationsUnread: 0,
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-heading">
            Welcome back, {user?.name.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-body">
            {counts.attempts > 0
              ? `You have completed ${formatNumber(counts.attempts)} attempt${counts.attempts === 1 ? '' : 's'} so far.`
              : 'Create content or take your first quiz to get started.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/creator/quizzes/new">
            <Button icon={<PenLine className="h-4 w-4" />}>New quiz</Button>
          </Link>
          <Link to="/explore/quizzes">
            <Button variant="outline" icon={<ArrowRight className="h-4 w-4" />}>
              Explore
            </Button>
          </Link>
        </div>
      </div>

      {/* Real stats only — each card maps to a real count */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Quiz attempts"
          value={formatNumber(counts.attempts)}
          hint={`${formatNumber(counts.passedAttempts)} passed`}
          icon={<ListChecks className="h-5 w-5" />}
          tone="brand"
        />
        <StatCard
          label="Quizzes created"
          value={formatNumber(counts.quizzesCreated)}
          icon={<FileText className="h-5 w-5" />}
        />
        <StatCard
          label="Polls created"
          value={formatNumber(counts.pollsCreated)}
          icon={<Vote className="h-5 w-5" />}
        />
        <StatCard
          label="QCoin balance"
          value={formatNumber(user?.wallet?.balance ?? 0)}
          hint={user?.wallet && user.wallet.totalEarned > 0 ? `${formatNumber(user.wallet.totalEarned)} earned all-time` : undefined}
          icon={<Coins className="h-5 w-5" />}
          tone="success"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Recent attempts */}
        <Card>
          <CardHeader
            title="Recent attempts"
            subtitle="Your latest quiz submissions"
            actions={
              <Link to="/attempts" className="text-xs font-medium text-brand-600 hover:text-brand-700">
                View all
              </Link>
            }
          />
          {data.recentAttempts && data.recentAttempts.length > 0 ? (
            <CardBody className="space-y-2">
              {(data.recentAttempts as unknown[]).map((raw) => {
                const attempt = raw as {
                  _id: string;
                  quiz?: { title?: string; slug?: string } | null;
                  percentage?: number;
                  passed?: boolean;
                  createdAt?: string;
                };
                return (
                  <Link
                    key={attempt._id}
                    to={`/attempts/${attempt._id}`}
                    className="flex items-center justify-between rounded-lg border border-line px-4 py-2.5 hover:border-brand-200 hover:bg-brand-50/40"
                  >
                    <div>
                      <p className="text-sm font-medium text-heading">{attempt.quiz?.title ?? 'Quiz'}</p>
                      <p className="text-xs text-muted">{formatRelative(attempt.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={attempt.passed ? 'success' : 'neutral'}>
                        {attempt.passed ? 'Passed' : 'Not passed'}
                      </Badge>
                      <span className="text-sm font-semibold text-heading">
                        {formatPercent(attempt.percentage ?? 0)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </CardBody>
          ) : (
            <EmptyState
              title="No attempts yet"
              description="Take a published quiz and your results will appear here."
              action={
                <Link to="/explore/quizzes">
                  <Button variant="outline" size="sm">
                    Find a quiz
                  </Button>
                </Link>
              }
              className="py-8"
            />
          )}
        </Card>

        {/* Recent wallet activity */}
        <Card>
          <CardHeader
            title="Wallet activity"
            subtitle="Latest QCoin movements"
            actions={
              <Link to="/wallet" className="text-xs font-medium text-brand-600 hover:text-brand-700">
                Open wallet
              </Link>
            }
          />
          {data.recentTransactions && data.recentTransactions.length > 0 ? (
            <CardBody className="p-0">
              <Table head={['Type', 'When', 'Amount']}>
                {data.recentTransactions.map((tx) => (
                  <tr key={tx._id} className="hover:bg-surface-muted/70">
                    <Td>{TX_TYPE_LABELS[tx.type] ?? tx.type}</Td>
                    <Td className="text-body">{formatDate(tx.createdAt)}</Td>
                    <Td>
                      <span className={tx.amount > 0 ? 'font-medium text-success' : 'font-medium text-body'}>
                        {tx.amount > 0 ? '+' : ''}
                        {formatNumber(tx.amount)}
                      </span>
                    </Td>
                  </tr>
                ))}
              </Table>
            </CardBody>
          ) : (
            <EmptyState
              title="No transactions yet"
              description="Entry fees, rewards, and bonuses will show up here."
              icon={<Wallet className="h-6 w-6" />}
              className="py-8"
            />
          )}
        </Card>
      </div>

      {/* Quick links */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <QuickLink to="/achievements" icon={<Award className="h-5 w-5" />} title="Achievements" description="Track what you have unlocked." />
        <QuickLink to="/leaderboards" icon={<Trophy className="h-5 w-5" />} title="Leaderboards" description="See how you rank in the community." />
        <QuickLink to="/ratings" icon={<Star className="h-5 w-5" />} title="Your ratings" description="Reviews you have written." />
      </div>
    </div>
  );
}

function QuickLink({
  to,
  icon,
  title,
  description,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link to={to} className="surface flex items-start gap-3 p-4 transition-shadow hover:shadow-pop">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">{icon}</div>
      <div>
        <p className="text-sm font-semibold text-heading">{title}</p>
        <p className="mt-0.5 text-xs text-body">{description}</p>
      </div>
    </Link>
  );
}

export default DashboardPage;
