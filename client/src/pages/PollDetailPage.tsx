import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Coins, Flag, Lock, Pencil, Users } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import endpoints from '@/services/endpoints';
import { apiErrorMessage } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/hooks';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Data';
import { Card, CardBody, CardHeader, PageHeader, SkeletonList, ErrorState, EmptyState } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Overlay';
import { Textarea, Select } from '@/components/ui/Form';
import { REPORT_REASONS, REPORT_REASON_LABELS, VOTING_TYPE } from '@/utils/constants';
import { formatDate, formatNumber, formatPercent, timeUntil } from '@/utils/format';
import { cn } from '@/utils/cn';
import { RatingWidget } from './QuizDetailPage';

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#64748b', '#84cc16'];

/** Poll detail: vote, results (respecting visibility rules), ratings, reporting. */
export function PollDetailPage() {
  const { slug = '' } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [selection, setSelection] = useState<string[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('SPAM');
  const [reportDetails, setReportDetails] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['poll', slug],
    queryFn: () => endpoints.polls.get(slug),
    enabled: Boolean(slug),
  });

  useDocumentTitle(data?.poll?.title ?? 'Poll');

  const voteMutation = useMutation({
    mutationFn: () => endpoints.polls.vote(data!.poll._id, selection),
    onSuccess: (result) => {
      toast.success('Vote recorded', result.rewardInfo?.eligible ? `You earned ${result.rewardInfo.paid} QCoins.` : undefined);
      setSelection([]);
      void queryClient.invalidateQueries({ queryKey: ['poll', slug] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not record your vote')),
  });

  const reportMutation = useMutation({
    mutationFn: () =>
      endpoints.reports.create({
        targetType: 'POLL',
        targetId: data!.poll._id,
        reason: reportReason,
        details: reportDetails,
      }),
    onSuccess: () => {
      toast.success('Report submitted');
      setReportOpen(false);
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not submit report')),
  });

  const chartData = useMemo(() => {
    if (!data?.results) return [];
    return (data.results.options ?? []).map((opt, i) => ({
      name: opt.text.length > 22 ? `${opt.text.slice(0, 22)}…` : opt.text,
      votes: data.results!.tally[opt.id] ?? 0,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [data]);

  if (isLoading) return <SkeletonList count={2} />;

  if (isError || !data) {
    return (
      <ErrorState
        title="Poll unavailable"
        description={apiErrorMessage(error, 'This poll does not exist or is not published.')}
        action={
          <div className="flex gap-2">
            <Button onClick={() => refetch()}>Try again</Button>
            <Link to="/explore/polls">
              <Button variant="outline">Browse polls</Button>
            </Link>
          </div>
        }
      />
    );
  }

  const { poll, isClosed, hasVoted, myVote, voterCount, results } = data;
  const isOwner = user && (poll.creator?._id === user._id || user.role === 'ADMIN');
  const canVote = Boolean(user) && !hasVoted && !isClosed;
  const singleChoice = poll.votingType === VOTING_TYPE.SINGLE;

  const toggleOption = (id: string) => {
    setSelection((prev) =>
      singleChoice ? [id] : prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div>
      <PageHeader
        title={poll.title}
        description={poll.question}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isOwner && (
              <Link to={`/creator/polls/${poll._id}/edit`}>
                <Button variant="outline" size="sm" icon={<Pencil className="h-4 w-4" />}>
                  Edit poll
                </Button>
              </Link>
            )}
            {user && !isOwner && (
              <Button variant="ghost" size="sm" onClick={() => setReportOpen(true)} icon={<Flag className="h-4 w-4" />}>
                Report
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title={isClosed ? 'Voting closed' : 'Cast your vote'}
              subtitle={
                isClosed
                  ? `Ended ${formatDate(poll.endsAt)}`
                  : `Closes ${timeUntil(poll.endsAt)} · ${formatDate(poll.endsAt)}`
              }
              actions={
                <div className="flex items-center gap-2">
                  <Badge tone={isClosed ? 'neutral' : 'success'}>{isClosed ? 'Closed' : 'Open'}</Badge>
                  {poll.anonymous && <Badge tone="info">Anonymous</Badge>}
                </div>
              }
            />
            <CardBody>
              {poll.description && <p className="mb-4 text-sm text-body">{poll.description}</p>}

              {!user && (
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-background px-4 py-3 text-sm text-body">
                  <Lock className="h-4 w-4 text-muted" />
                  <Link to={`/login?from=/polls/${poll.slug}`} className="font-medium text-brand-600 hover:text-brand-700">
                    Sign in
                  </Link>
                  <span>to vote in this poll.</span>
                </div>
              )}

              {hasVoted ? (
                <div className="rounded-lg border border-success-soft bg-success-soft px-4 py-3 text-sm text-success">
                  Your vote{myVote && myVote.optionIds.length > 1 ? 's were' : ' was'} recorded on{' '}
                  {formatDate(myVote?.votedAt ?? poll.endsAt)}. Thanks for participating!
                </div>
              ) : canVote ? (
                <>
                  {(poll.entryFee ?? 0) > 0 && (
                    <div className="mb-4 flex items-center gap-2 rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning">
                      <Coins className="h-4 w-4" />
                      Voting costs <strong>{formatNumber(poll.entryFee)} QCoins</strong>
                      {(poll.reward ?? 0) > 0 && (
                        <span>
                          · participants earn <strong>{formatNumber(poll.reward)} QCoins</strong>
                        </span>
                      )}
                      {poll.rewardMode === 'FIRST_N' && (
                        <span>
                          · first {formatNumber(poll.maxRewardRecipients ?? 0)} voters
                        </span>
                      )}
                    </div>
                  )}
                  <div className="space-y-2.5" role="group" aria-label="Poll options">
                    {(poll.options ?? []).map((option) => {
                      const selected = selection.includes(option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => toggleOption(option.id)}
                          aria-pressed={selected}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors',
                            selected
                              ? 'border-brand-500 bg-brand-50 text-brand-800'
                              : 'border-line bg-white text-body hover:border-line-strong'
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-4 w-4 shrink-0 items-center justify-center border',
                              singleChoice ? 'rounded-full' : 'rounded',
                              selected ? 'border-brand-600 bg-brand-600' : 'border-line-strong'
                            )}
                          >
                            {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </span>
                          {option.text}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-5 flex items-center gap-3">
                    <Button
                      onClick={() => voteMutation.mutate()}
                      loading={voteMutation.isPending}
                      disabled={selection.length === 0}
                    >
                      Submit vote
                    </Button>
                    <p className="text-xs text-muted">
                      {singleChoice ? 'Choose one option.' : 'Choose one or more options.'} Voting is final.
                    </p>
                  </div>
                </>
              ) : isClosed ? (
                results ? (
                  <p className="text-sm text-body">This poll has ended. Final results are shown below.</p>
                ) : (
                  <EmptyState title="Results not visible" description="The creator has chosen not to publish results publicly." />
                )
              ) : null}
            </CardBody>
          </Card>

          {/* Results */}
          {results && (
            <Card>
              <CardHeader
                title="Results"
                subtitle={`${formatNumber(voterCount)} voter${voterCount === 1 ? '' : 's'} · ${formatNumber(results.totalSelections)} selections`}
                actions={<BarChart3 className="h-5 w-5 text-muted" />}
              />
              <CardBody>
                {chartData.length === 0 || results.totalSelections === 0 ? (
                  <EmptyState title="No votes yet" description="Results appear as soon as votes come in." className="py-6" />
                ) : (
                  <>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                          <Tooltip
                            cursor={{ fill: 'rgb(228 228 231 / 0.4)' }}
                            contentStyle={{ borderRadius: 8, fontSize: 12 }}
                          />
                          <Bar dataKey="votes" radius={[6, 6, 0, 0]}>
                            {chartData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 space-y-2">
                      {(results.options ?? []).map((opt, i) => {
                        const votes = results.tally[opt.id] ?? 0;
                        const pct = results.totalSelections > 0 ? (votes / results.totalSelections) * 100 : 0;
                        return (
                          <div key={opt.id} className="flex items-center gap-3 text-sm">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                            />
                            <span className="flex-1 truncate text-body">{opt.text}</span>
                            <span className="text-body">{formatNumber(votes)}</span>
                            <span className="w-12 text-right font-medium text-heading">{formatPercent(pct, 1)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardBody>
            </Card>
          )}

          {!results && (
            <Card>
              <CardBody>
                <EmptyState
                  title="Results are hidden"
                  description={
                    poll.resultsVisibility === 'AFTER_END'
                      ? 'Results will be visible after voting closes.'
                      : poll.resultsVisibility === 'AFTER_VOTE'
                        ? 'Results will be visible after you vote.'
                        : 'The creator has chosen to keep results private.'
                  }
                  className="py-6"
                />
              </CardBody>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Poll details" />
            <CardBody>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-body">Voting type</dt>
                  <dd className="font-medium text-heading">{singleChoice ? 'Single choice' : 'Multiple choice'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-body">Voters</dt>
                  <dd className="font-medium text-heading inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {formatNumber(voterCount)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-body">Ends</dt>
                  <dd className="font-medium text-heading">{formatDate(poll.endsAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-body">Anonymity</dt>
                  <dd className="font-medium text-heading">{poll.anonymous ? 'Anonymous' : 'Public voters'}</dd>
                </div>
                {(poll.entryFee ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-body">Entry fee</dt>
                    <dd className="font-medium text-warning">{formatNumber(poll.entryFee)} QCoins</dd>
                  </div>
                )}
                {(poll.reward ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-body">Reward</dt>
                    <dd className="font-medium text-success">{formatNumber(poll.reward)} QCoins</dd>
                  </div>
                )}
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Creator" />
            <CardBody>
              <Link to={`/users/${poll.creator?._id}`} className="flex items-center gap-3 hover:opacity-80">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 font-medium text-brand-700">
                  {(poll.creator?.name ?? '?').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-heading">{poll.creator?.name}</p>
                  <p className="text-xs text-body">View creator profile</p>
                </div>
              </Link>
            </CardBody>
          </Card>

          {user && !isOwner && <RatingWidget targetType="POLL" targetId={poll._id} />}
        </div>
      </div>

      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Report this poll"
        footer={
          <>
            <Button variant="outline" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => reportMutation.mutate()} loading={reportMutation.isPending}>
              Submit report
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="Reason" value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
            {REPORT_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {REPORT_REASON_LABELS[reason] ?? reason}
              </option>
            ))}
          </Select>
          <Textarea
            label="Details (optional)"
            value={reportDetails}
            onChange={(e) => setReportDetails(e.target.value)}
            maxLength={2000}
          />
        </div>
      </Modal>
    </div>
  );
}

export default PollDetailPage;
