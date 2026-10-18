import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Bell,
  BookOpen,
  ClipboardList,
  Coins,
  FileText,
  Play,
  Plus,
  Star,
  Trophy,
  Vote,
} from 'lucide-react';
import { PageHeading, Metric, Panel, Badge, StatusBadge } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/States';
import { api } from '@/lib/api';
import { qk, usePagedQuery } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { formatCoins, formatDate, formatNumber, formatRelative } from '@/lib/format';

interface AttemptSummary {
  items: {
    id: string;
    quiz_id: string;
    quiz_title: string;
    score_percent: number | null;
    passed: number | null;
    submitted_at: string;
    reward_paid: number;
    entry_fee_charged: number;
  }[];
  summary: {
    attempts: number;
    passes: number;
    averageScore: number | null;
    coinsEarned: number;
    coinsSpent: number;
  };
  total: number;
}

export function UserOverview() {
  const { user, wallet, unreadNotifications } = useAuth();

  const attempts = usePagedQuery<AttemptSummary['items'][number]>(
    qk.attempts({ page: 1, pageSize: 5 }),
    '/attempts?page=1&pageSize=5',
  );

  const myQuizzes = useQuery<{ items: { id: string; title: string; status: string; updated_at: string }[]; total: number }>({
    queryKey: qk.myQuizzes({ page: 1, pageSize: 5 }),
    queryFn: () => api.get('/quizzes/mine/list?page=1&pageSize=5'),
  });

  const typedAttempts = attempts.data as unknown as AttemptSummary | undefined;
  const summary = typedAttempts?.summary;

  return (
    <>
      <PageHeading
        title={`Welcome back, ${user?.displayName?.split(' ')[0] ?? 'there'}`}
        description="Your recent activity, submissions and QCoin balance."
        actions={
          <>
            <Button to="/app/quizzes/new" size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />}>
              New quiz
            </Button>
            <Button to="/app/polls/new" size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />}>
              New poll
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Quizzes completed"
          value={formatNumber(summary?.attempts ?? 0)}
          hint={summary?.attempts ? `${summary.passes} passed` : 'Attempts appear here once you finish a quiz'}
        />
        <Metric
          label="Average score"
          value={summary?.averageScore !== null && summary?.averageScore !== undefined ? `${summary.averageScore}%` : '—'}
          hint={summary?.attempts ? `Across ${summary.attempts} attempt(s)` : 'No attempts recorded yet'}
        />
        <Metric
          label="QCoin balance"
          value={formatCoins(wallet?.balance ?? 0)}
          hint={wallet ? `${formatCoins(wallet.lifetimeEarned)} earned in total` : undefined}
        />
        <Metric
          label="My submissions"
          value={formatNumber(myQuizzes.data?.total ?? 0)}
          hint="Quizzes you have created"
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel
            title="Recent attempts"
            actions={
              <Button to="/app/attempts" size="sm" variant="ghost">
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            }
            bodyClassName="p-0"
          >
            {attempts.isLoading ? (
              <div className="p-4">
                <LoadingBlock rows={4} />
              </div>
            ) : attempts.error ? (
              <div className="p-4">
                <ErrorState error={attempts.error} onRetry={() => attempts.refetch()} compact />
              </div>
            ) : !typedAttempts?.items.length ? (
              <div className="p-4">
                <EmptyState
                  icon={<Play className="h-4 w-4" />}
                  title="You have not completed a quiz yet"
                  description="Browse published quizzes and take one. Your score and reward will be recorded here."
                  action={
                    <Button to="/app/quizzes" size="sm" variant="primary">
                      Explore quizzes
                    </Button>
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {typedAttempts.items.map((attempt) => (
                  <li key={attempt.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <Link to={`/app/attempts/${attempt.id}`} className="block truncate text-[13px] font-medium text-ink hover:text-brand-700">
                        {attempt.quiz_title}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-2 text-2xs text-ink-faint">
                        <span>{formatRelative(attempt.submitted_at)}</span>
                        {attempt.entry_fee_charged > 0 && <span>· {formatCoins(attempt.entry_fee_charged)} entry</span>}
                        {attempt.reward_paid > 0 && <span>· +{formatCoins(attempt.reward_paid)} earned</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {attempt.passed !== null && (
                        <Badge tone={attempt.passed ? 'success' : 'neutral'}>
                          {attempt.score_percent}%
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Your submissions"
            description="Quizzes you have created and their current moderation state."
            actions={
              <Button to="/app/my-quizzes" size="sm" variant="ghost">
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            }
            bodyClassName="p-0"
          >
            {myQuizzes.isLoading ? (
              <div className="p-4">
                <LoadingBlock rows={3} />
              </div>
            ) : !myQuizzes.data?.items.length ? (
              <div className="p-4">
                <EmptyState
                  icon={<FileText className="h-4 w-4" />}
                  title="You have not created a quiz yet"
                  description="Write your first quiz, submit it for review and track its status here."
                  action={
                    <Button to="/app/quizzes/new" size="sm" variant="primary">
                      Create a quiz
                    </Button>
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {myQuizzes.data.items.map((quiz) => (
                  <li key={quiz.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <Link to={`/app/quizzes/${quiz.id}`} className="min-w-0 truncate text-[13px] font-medium text-ink hover:text-brand-700">
                      {quiz.title}
                    </Link>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-2xs text-ink-faint">{formatDate(quiz.updated_at)}</span>
                      <StatusBadge status={quiz.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Quick links" bodyClassName="p-2">
            <nav className="space-y-0.5">
              {[
                { to: '/app/quizzes', label: 'Explore quizzes', icon: BookOpen },
                { to: '/app/polls', label: 'Explore polls', icon: Vote },
                { to: '/app/leaderboards', label: 'Leaderboards', icon: Trophy },
                { to: '/app/wallet', label: 'QCoin wallet', icon: Coins },
                { to: '/app/ratings', label: 'Ratings and reviews', icon: Star },
                { to: '/app/notifications', label: 'Notifications', icon: Bell },
                { to: '/app/my-quizzes', label: 'My quizzes', icon: FileText },
                { to: '/app/attempts', label: 'My quiz attempts', icon: ClipboardList },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-2.5 rounded-md px-2 py-2 text-[13px] text-ink-soft transition-colors hover:bg-canvas hover:text-ink"
                >
                  <item.icon className="h-4 w-4 text-ink-faint" />
                  {item.label}
                  {item.to === '/app/notifications' && unreadNotifications > 0 && (
                    <Badge tone="brand" className="ml-auto">
                      {unreadNotifications}
                    </Badge>
                  )}
                </Link>
              ))}
            </nav>
          </Panel>

          <Panel title="QCoin wallet">
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-ink-muted">Balance</span>
                <span className="text-lg font-semibold tabular-nums text-ink">{formatCoins(wallet?.balance ?? 0)}</span>
              </div>
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="text-ink-muted">Earned in total</span>
                <span className="tabular-nums text-emerald-700">{formatCoins(wallet?.lifetimeEarned ?? 0)}</span>
              </div>
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="text-ink-muted">Spent in total</span>
                <span className="tabular-nums text-ink-soft">{formatCoins(wallet?.lifetimeSpent ?? 0)}</span>
              </div>
              <Button to="/app/wallet" size="sm" variant="secondary" block className="mt-3">
                Open wallet
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
