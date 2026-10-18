import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, ClipboardList, Coins, FileText, Info, RefreshCw, Users } from 'lucide-react';
import { api, buildQuery } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useToast } from '@/components/ui/Toast';
import { PageHeading, Metric, Panel, Badge, StatusBadge } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { EmptyState, ErrorState, CardSkeleton } from '@/components/ui/States';
import { formatCoins, formatDate, formatNumber, titleCase } from '@/lib/format';

interface Overview {
  range: { from: string; to: string };
  users: { totalRegistered: number; activeInRange: number; newInRange: number; suspended: number; admins: number; creators: number };
  quizzes: { approved: number; pendingReview: number; changesRequested: number; rejected: number; drafts: number; unpublished: number };
  polls: { published: number; pendingReview: number; changesRequested: number; rejected: number; drafts: number };
  moderation: { queueTotal: number; reportsPending: number; reportsReviewing: number; appealsPending: number; ratingDisputesPending: number };
  qcoin: { issued: number; spent: number; entries: number; refundRequests: number; rewardDisputes: number };
  activity: { attemptsInRange: number; votesInRange: number; ratingsInRange: number };
  recentDecisions: { id: string; content_type: string; content_id: string; decision: string; reason: string | null; created_at: string; content_title: string; reviewer_name: string | null }[];
  openRefunds: { id: string; amount: number; reason: string; created_at: string; username: string }[];
  definitions: { key: string; label: string; definition: string }[];
}

export function AdminOverview() {
  const [days, setDays] = useState(30);
  const query = useQuery<Overview>({
    queryKey: qk.adminOverview({ days }),
    queryFn: () => api.get(`/admin/overview${buildQuery({ days })}`),
    placeholderData: (prev) => prev,
  });

  const data = query.data;

  return (
    <>
      <PageHeading
        title="Admin overview"
        description="Platform health at a glance. Every figure below is a named aggregate over the database."
        actions={
          <>
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
            <Button size="sm" variant="secondary" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => query.refetch()}>
              Refresh
            </Button>
          </>
        }
      />

      {query.isLoading ? (
        <CardSkeleton count={6} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !data ? null : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Total registered users"
              value={formatNumber(data.users.totalRegistered)}
              hint={`${formatNumber(data.users.newInRange)} joined in range · ${formatNumber(data.users.suspended)} suspended`}
              definition="Every user row in the database, regardless of role or status."
            />
            <Metric
              label={`Active users (${days}d)`}
              value={formatNumber(data.users.activeInRange)}
              hint={`${formatNumber(data.users.creators)} creator(s) · ${formatNumber(data.users.admins)} admin(s)`}
              definition="Users whose last recorded activity falls inside the selected date range."
            />
            <Metric
              label="Approved quizzes"
              value={formatNumber(data.quizzes.approved)}
              hint={`${formatNumber(data.quizzes.drafts)} draft(s) · ${formatNumber(data.quizzes.pendingReview)} awaiting review`}
              definition="Quizzes currently in the approved (published) state."
            />
            <Metric
              label="Published polls"
              value={formatNumber(data.polls.published)}
              hint={`${formatNumber(data.polls.pendingReview)} awaiting review`}
              definition="Polls currently in the published state."
            />
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Moderation queue"
              value={formatNumber(data.moderation.queueTotal)}
              hint={`${formatNumber(data.moderation.reportsPending)} reports · ${formatNumber(data.moderation.appealsPending)} appeals`}
              definition="Quiz submissions plus poll submissions awaiting a decision or re-review."
            />
            <Metric
              label="Reports awaiting review"
              value={formatNumber(data.moderation.reportsPending)}
              hint={`${formatNumber(data.moderation.reportsReviewing)} in progress`}
              definition="User-submitted reports that have not been resolved or dismissed."
            />
            <Metric
              label={`QCoins issued (${days}d)`}
              value={formatCoins(data.qcoin.issued)}
              hint={`${formatCoins(data.qcoin.spent)} spent · ${formatNumber(data.qcoin.entries)} entries`}
              definition="Sum of positive ledger entries created inside the selected date range."
            />
            <Metric
              label="Refund requests awaiting action"
              value={formatNumber(data.qcoin.refundRequests)}
              hint={`${formatNumber(data.qcoin.rewardDisputes)} reward dispute(s) open`}
              definition="Refund requests still in the pending state."
            />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Panel
                title="Moderation queue"
                description="Submissions waiting for a decision."
                actions={
                  <Button to="/admin/moderation/queue" size="sm" variant="secondary">
                    Open queue
                  </Button>
                }
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Link to="/admin/quizzes?status=pending_review" className="rounded-md border border-line bg-canvas/60 px-3 py-2.5 transition-colors hover:bg-canvas">
                    <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
                      <FileText className="h-3.5 w-3.5 text-ink-faint" />
                      Quizzes awaiting approval
                    </div>
                    <div className="mt-1 text-xl font-semibold tabular-nums text-ink">{formatNumber(data.quizzes.pendingReview)}</div>
                  </Link>
                  <Link to="/admin/polls?status=pending_review" className="rounded-md border border-line bg-canvas/60 px-3 py-2.5 transition-colors hover:bg-canvas">
                    <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
                      <Activity className="h-3.5 w-3.5 text-ink-faint" />
                      Polls awaiting approval
                    </div>
                    <div className="mt-1 text-xl font-semibold tabular-nums text-ink">{formatNumber(data.polls.pendingReview)}</div>
                  </Link>
                  <Link to="/admin/moderation/reported" className="rounded-md border border-line bg-canvas/60 px-3 py-2.5 transition-colors hover:bg-canvas">
                    <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
                      <AlertTriangle className="h-3.5 w-3.5 text-ink-faint" />
                      Reported content
                    </div>
                    <div className="mt-1 text-xl font-semibold tabular-nums text-ink">{formatNumber(data.moderation.reportsPending)}</div>
                  </Link>
                  <Link to="/admin/moderation/appeals" className="rounded-md border border-line bg-canvas/60 px-3 py-2.5 transition-colors hover:bg-canvas">
                    <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
                      <ClipboardList className="h-3.5 w-3.5 text-ink-faint" />
                      Appeals
                    </div>
                    <div className="mt-1 text-xl font-semibold tabular-nums text-ink">{formatNumber(data.moderation.appealsPending)}</div>
                  </Link>
                </div>
              </Panel>

              <Panel title="Recent moderation decisions" bodyClassName="p-0">
                {data.recentDecisions.length === 0 ? (
                  <div className="p-4">
                    <EmptyState compact icon={<ClipboardList className="h-4 w-4" />} title="No decisions recorded yet" description="Approvals, rejections and change requests will be listed here." />
                  </div>
                ) : (
                  <ul className="divide-y divide-line">
                    {data.recentDecisions.map((decision) => (
                      <li key={decision.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                        <div className="min-w-0">
                          <Link
                            to={`/admin/${decision.content_type === 'quiz' ? 'quizzes' : 'polls'}/${decision.content_id}`}
                            className="block truncate text-[13px] font-medium text-ink hover:text-brand-700"
                          >
                            {decision.content_title ?? 'Deleted content'}
                          </Link>
                          <span className="text-2xs text-ink-faint">
                            {decision.content_type} · {decision.reviewer_name ?? 'System'} · {formatDate(decision.created_at)}
                          </span>
                        </div>
                        <StatusBadge status={decision.decision} />
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

            <div className="space-y-4">
              <Panel title="Activity in range">
                <div className="space-y-2 text-[13px]">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">Completed attempts</span>
                    <span className="tabular-nums text-ink">{formatNumber(data.activity.attemptsInRange)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">Votes cast</span>
                    <span className="tabular-nums text-ink">{formatNumber(data.activity.votesInRange)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">Ratings submitted</span>
                    <span className="tabular-nums text-ink">{formatNumber(data.activity.ratingsInRange)}</span>
                  </div>
                </div>
              </Panel>

              <Panel
                title="Open refund requests"
                actions={
                  <Button to="/admin/qcoin/refunds" size="sm" variant="ghost">
                    Review
                  </Button>
                }
                bodyClassName="p-0"
              >
                {data.openRefunds.length === 0 ? (
                  <p className="p-4 text-[13px] text-ink-muted">No refund requests are waiting.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {data.openRefunds.map((refund) => (
                      <li key={refund.id} className="px-4 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[13px] font-medium text-ink">@{refund.username}</span>
                          <Badge tone="warning">{formatCoins(refund.amount)} QCoin</Badge>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{refund.reason}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title="Content pipeline">
                <div className="space-y-2 text-[13px]">
                  {[
                    ['Quiz drafts', data.quizzes.drafts],
                    ['Awaiting review', data.quizzes.pendingReview],
                    ['Changes requested', data.quizzes.changesRequested],
                    ['Rejected', data.quizzes.rejected],
                    ['Unpublished', data.quizzes.unpublished],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="flex items-center justify-between">
                      <span className="text-ink-muted">{label}</span>
                      <span className="tabular-nums text-ink">{formatNumber(Number(value))}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </div>

          <Panel title="Metric definitions" className="mt-4">
            <p className="mb-3 flex items-start gap-2 text-xs text-ink-muted">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Each metric on this page is defined the same way everywhere it appears in the admin panel.
            </p>
            <dl className="grid gap-3 sm:grid-cols-2">
              {data.definitions.map((definition) => (
                <div key={definition.key}>
                  <dt className="text-[13px] font-medium text-ink">{definition.label}</dt>
                  <dd className="mt-0.5 text-xs leading-relaxed text-ink-muted">{definition.definition}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button to="/admin/users" size="sm" variant="secondary" icon={<Users className="h-3.5 w-3.5" />}>
              Manage users
            </Button>
            <Button to="/admin/qcoin" size="sm" variant="secondary" icon={<Coins className="h-3.5 w-3.5" />}>
              QCoin management
            </Button>
            <Button to="/admin/system/health" size="sm" variant="ghost">
              Service health
            </Button>
          </div>
        </>
      )}
    </>
  );
}

export { titleCase };
