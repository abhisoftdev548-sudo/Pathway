import { useQuery } from '@tanstack/react-query';
import {
  Activity, AlertTriangle, Coins, Flag, History, RotateCcw, Users, Vote,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import endpoints from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { Badge, StatCard, Table, Td } from '@/components/ui/Data';
import { Card, CardBody, CardHeader, ErrorState, PageHeader, SkeletonTable, EmptyState } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { formatDate, formatNumber } from '@/utils/format';
import { apiErrorMessage } from '@/services/api';

/** Admin overview — every metric is computed from real database state. */
export function AdminOverviewPage() {
  useDocumentTitle('Admin overview');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => endpoints.admin.overview(),
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-lg" />
          ))}
        </div>
        <SkeletonTable rows={5} cols={4} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <ErrorState
        title="Could not load admin metrics"
        description={apiErrorMessage(error)}
        action={<Button onClick={() => refetch()}>Try again</Button>}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Admin overview"
        description="Live platform metrics and recent moderation activity."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Registered users" value={formatNumber(data.users.registered)} icon={<Users className="h-5 w-5" />} tone="brand" />
        <StatCard
          label="Active (7 days)"
          value={formatNumber(data.users.activeLast7Days)}
          icon={<Activity className="h-5 w-5" />}
        />
        <StatCard
          label="Approved quizzes"
          value={formatNumber(data.content.approvedQuizzes)}
          hint={`${formatNumber(data.content.pendingQuizzes)} pending`}
          icon={<Vote className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Approved polls"
          value={formatNumber(data.content.approvedPolls)}
          hint={`${formatNumber(data.content.pendingPolls)} pending`}
          icon={<Vote className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Open reports"
          value={formatNumber(data.moderation.openReports)}
          icon={<Flag className="h-5 w-5" />}
          tone={data.moderation.openReports > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          label="Pending refunds"
          value={formatNumber(data.moderation.pendingRefunds)}
          icon={<RotateCcw className="h-5 w-5" />}
          tone={data.moderation.pendingRefunds > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          label="QCoins issued"
          value={formatNumber(data.qcoins.totalIssued)}
          hint={`${formatNumber(data.qcoins.transactionCount)} transactions`}
          icon={<Coins className="h-5 w-5" />}
        />
        <StatCard
          label="QCoins spent"
          value={formatNumber(data.qcoins.totalSpent)}
          icon={<Coins className="h-5 w-5" />}
        />
      </div>

      {/* 24h activity — only rendered as supporting context, real numbers */}
      <div className="mt-5 flex flex-wrap gap-3 text-sm text-zinc-600">
        <span className="rounded-lg bg-zinc-100 px-3 py-1.5">
          Last 24h: <strong>{formatNumber(data.activity24h.attempts)}</strong> quiz attempts
        </span>
        <span className="rounded-lg bg-zinc-100 px-3 py-1.5">
          Last 24h: <strong>{formatNumber(data.activity24h.votes)}</strong> poll votes
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Recent moderation */}
        <Card>
          <CardHeader
            title="Recent moderation actions"
            subtitle="Latest decisions by the moderation team."
            actions={
              <Link to="/admin/moderation-history" className="text-xs font-medium text-brand-600 hover:text-brand-700">
                Full history
              </Link>
            }
          />
          {data.recentModerationActions.length === 0 ? (
            <EmptyState
              icon={<History className="h-6 w-6" />}
              title="No moderation actions yet"
              description="Approve, reject, and change requests will appear here."
              className="py-8"
            />
          ) : (
            <CardBody className="p-0">
              <Table head={['Action', 'Content', 'By', 'When']}>
                {data.recentModerationActions.map((action) => (
                  <tr key={action.id} className="hover:bg-zinc-50/70">
                    <Td>
                      <Badge
                        tone={
                          action.action === 'APPROVE'
                            ? 'success'
                            : action.action === 'REJECT'
                              ? 'danger'
                              : 'warning'
                        }
                      >
                        {action.action}
                      </Badge>
                    </Td>
                    <Td className="max-w-[180px] truncate">
                      <Link
                        to={
                          action.targetType === 'QUIZ'
                            ? `/admin/quizzes`
                            : `/admin/polls`
                        }
                        className="text-zinc-700 hover:text-brand-700"
                      >
                        {action.targetType} · {action.targetId.slice(-6)}
                      </Link>
                    </Td>
                    <Td className="text-zinc-500">{action.reviewer}</Td>
                    <Td className="text-zinc-500">{formatDate(action.createdAt)}</Td>
                  </tr>
                ))}
              </Table>
            </CardBody>
          )}
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader title="Attention needed" />
          <CardBody className="space-y-3">
            <QuickAction
              to="/admin/quiz-approvals"
              icon={<AlertTriangle className="h-4 w-4" />}
              label={`${formatNumber(data.content.pendingQuizzes)} quizzes awaiting review`}
            />
            <QuickAction
              to="/admin/poll-approvals"
              icon={<AlertTriangle className="h-4 w-4" />}
              label={`${formatNumber(data.content.pendingPolls)} polls awaiting review`}
            />
            <QuickAction
              to="/admin/content-reports"
              icon={<Flag className="h-4 w-4" />}
              label={`${formatNumber(data.moderation.openReports)} open reports`}
            />
            <QuickAction
              to="/admin/refunds"
              icon={<RotateCcw className="h-4 w-4" />}
              label={`${formatNumber(data.moderation.pendingRefunds)} pending refund requests`}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function QuickAction({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg border border-zinc-100 px-4 py-3 text-sm text-zinc-700 hover:border-brand-200 hover:bg-brand-50/40"
    >
      <span className="text-zinc-400">{icon}</span>
      {label}
    </Link>
  );
}

export default AdminOverviewPage;
