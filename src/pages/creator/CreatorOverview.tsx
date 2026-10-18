import { useQuery } from '@tanstack/react-query';
import { BarChart3, ClipboardList, FileText, Megaphone, Plus, Star } from 'lucide-react';
import { api } from '@/lib/api';
import { qk } from '@/lib/queries';
import { PageHeading, Metric, Panel, StatusBadge, Badge } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, CardSkeleton } from '@/components/ui/States';
import { formatCoins, formatDate, formatNumber, formatPercent } from '@/lib/format';

interface CreatorOverviewData {
  counts: Record<string, number>;
  engagement: { attempts: number; passes: number; votes: number; averageScore: number | null };
  ratings: { count: number; average: number | null };
  latestDecisions: { decision: string; reason: string | null; created_at: string; content_type: string; content_id: string; content_title: string }[];
  topContent: { id: string; title: string; total_attempts: number; rating_average: number | null }[];
}

export function CreatorOverview() {
  const query = useQuery<CreatorOverviewData>({
    queryKey: qk.creatorOverview,
    queryFn: () => api.get('/creator/overview'),
  });

  if (query.isLoading) return <CardSkeleton count={4} />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const data = query.data!;
  const hasContent =
    data.counts.quizzesApproved + data.counts.quizzesDraft + data.counts.quizzesPending + data.counts.pollsPublished > 0;

  return (
    <>
      <PageHeading
        title="Creator overview"
        description="How your published content is performing. All figures come from recorded activity."
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

      {!hasContent ? (
        <EmptyState
          icon={<FileText className="h-4 w-4" />}
          title="No content yet"
          description="Create a quiz or a poll and submit it for review. Once it is approved, engagement and rating data will appear here."
          action={
            <Button to="/app/quizzes/new" size="sm" variant="primary">
              Create your first quiz
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Published quizzes" value={formatNumber(data.counts.quizzesApproved)} hint={`${data.counts.quizzesDraft} draft(s)`} />
            <Metric label="Quiz attempts" value={formatNumber(data.engagement.attempts)} hint={`${formatNumber(data.engagement.passes)} passed`} />
            <Metric label="Poll votes" value={formatNumber(data.engagement.votes)} hint={`${data.counts.pollsPublished} published poll(s)`} />
            <Metric
              label="Average rating"
              value={data.ratings.average ?? '—'}
              hint={`${formatNumber(data.ratings.count)} rating(s)`}
            />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Panel title="Submission pipeline" bodyClassName="p-0">
                <ul className="divide-y divide-line">
                  {[
                    { label: 'Drafts not yet submitted', value: data.counts.quizzesDraft + data.counts.pollsDraft, to: '/app/creator/drafts' },
                    { label: 'Awaiting moderation', value: data.counts.quizzesPending + data.counts.pollsPending, to: '/app/creator/pending' },
                    { label: 'Changes requested', value: data.counts.quizzesChangesRequested, to: '/app/creator/changes' },
                    { label: 'Rejected', value: data.counts.quizzesRejected, to: '/app/creator/changes' },
                    { label: 'Published quizzes', value: data.counts.quizzesApproved, to: '/app/creator/quizzes' },
                    { label: 'Published polls', value: data.counts.pollsPublished, to: '/app/creator/polls' },
                  ].map((row) => (
                    <li key={row.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <Button to={row.to} variant="ghost" size="sm" className="px-0 text-ink-soft hover:bg-transparent hover:text-brand-700">
                        {row.label}
                      </Button>
                      <span className="tabular-nums text-[13px] font-medium text-ink">{formatNumber(row.value)}</span>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title="Latest moderation decisions" bodyClassName="p-0">
                {data.latestDecisions.length === 0 ? (
                  <div className="p-4">
                    <EmptyState compact icon={<ClipboardList className="h-4 w-4" />} title="No decisions recorded yet" />
                  </div>
                ) : (
                  <ul className="divide-y divide-line">
                    {data.latestDecisions.map((decision) => (
                      <li key={`${decision.content_type}-${decision.content_id}-${decision.created_at}`} className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-[13px] font-medium text-ink">{decision.content_title}</span>
                          <div className="flex items-center gap-2">
                            <Badge tone="neutral">{decision.content_type}</Badge>
                            <StatusBadge status={decision.decision} />
                          </div>
                        </div>
                        {decision.reason && <p className="mt-1 text-xs text-ink-muted">{decision.reason}</p>}
                        <p className="mt-1 text-2xs text-ink-faint">{formatDate(decision.created_at)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

            <div className="space-y-4">
              <Panel title="Most attempted">
                {data.topContent.length === 0 ? (
                  <p className="text-[13px] text-ink-muted">No attempts recorded on your quizzes yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.topContent.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3">
                        <a href={`/app/quizzes/${item.id}`} className="min-w-0 truncate text-[13px] text-ink hover:text-brand-700">
                          {item.title}
                        </a>
                        <span className="shrink-0 tabular-nums text-xs text-ink-muted">{formatNumber(item.total_attempts)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title="Performance">
                <div className="space-y-2 text-[13px]">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">Average score</span>
                    <span className="tabular-nums text-ink">
                      {data.engagement.averageScore !== null ? `${data.engagement.averageScore}%` : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">Pass rate</span>
                    <span className="tabular-nums text-ink">
                      {data.engagement.attempts > 0
                        ? formatPercent(data.engagement.passes / data.engagement.attempts)
                        : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">Ratings received</span>
                    <span className="tabular-nums text-ink">{formatNumber(data.ratings.count)}</span>
                  </div>
                </div>
              </Panel>

              <Panel title="Quick actions">
                <div className="space-y-2">
                  <Button to="/app/creator/analytics" size="sm" variant="secondary" block icon={<BarChart3 className="h-3.5 w-3.5" />}>
                    View analytics
                  </Button>
                  <Button to="/app/creator/feedback" size="sm" variant="ghost" block icon={<Star className="h-3.5 w-3.5" />}>
                    Ratings and feedback
                  </Button>
                  <Button to="/app/creator/polls" size="sm" variant="ghost" block icon={<Megaphone className="h-3.5 w-3.5" />}>
                    My published polls
                  </Button>
                </div>
              </Panel>
            </div>
          </div>
        </>
      )}
    </>
  );
}
