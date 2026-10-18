import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Clock3, Flag, Pencil, Users } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Field';
import { Badge, DetailList, Panel, StatusBadge } from '@/components/ui/Primitives';
import { ErrorState, InlineError, LoadingBlock } from '@/components/ui/States';
import { Modal } from '@/components/ui/Dialog';
import { RatingSection } from '@/components/patterns/RatingSection';
import { formatDate, formatDateTime, formatNumber, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

interface PollOption {
  id: string;
  position: number;
  body: string;
  votes: number;
  percent: number;
}

interface PollDetailData {
  id: string;
  title: string;
  description: string;
  status: string;
  allowMultiple: boolean;
  isAnonymous: boolean;
  closes_at: string | null;
  isClosed: boolean;
  totalVotes: number;
  options: PollOption[];
  myVotes: string[];
  creator_id: string;
  creator_username: string;
  creator_name: string;
  category_name: string | null;
  published_at: string | null;
  review_notes: string | null;
  moderationHistory: { id: string; decision: string; reason: string | null; created_at: string }[] | null;
  myRating: unknown;
}

export function PollDetail() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const pollQuery = useQuery<{ poll: PollDetailData }>({
    queryKey: qk.poll(id),
    queryFn: () => api.get(`/polls/${id}`),
  });

  const vote = useMutation({
    mutationFn: (optionIds: string[]) => api.put(`/polls/${id}/vote`, { optionIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.poll(id) });
      toast.success('Your vote was recorded.');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not record your vote.'),
  });

  const clearVote = useMutation({
    mutationFn: () => api.del(`/polls/${id}/vote`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.poll(id) });
      toast.info('Your vote was withdrawn.');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not withdraw your vote.'),
  });

  const report = useMutation({
    mutationFn: () => api.post('/reports', { targetType: 'poll', targetId: id, reason: reportReason, details: '' }),
    onSuccess: () => {
      setReportOpen(false);
      setReportReason('');
      toast.success('Report submitted.');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not submit the report.'),
  });

  if (pollQuery.isLoading) {
    return (
      <div className="space-y-4">
        <LoadingBlock rows={6} />
      </div>
    );
  }
  if (pollQuery.error) return <ErrorState error={pollQuery.error} onRetry={() => pollQuery.refetch()} />;

  const poll = pollQuery.data!.poll;
  const isOwner = user?.id === poll.creator_id;
  const canVote = poll.status === 'published' && !poll.isClosed && !isOwner;

  const toggleOption = (optionId: string) => {
    if (!canVote) return;
    if (poll.allowMultiple) {
      const next = poll.myVotes.includes(optionId)
        ? poll.myVotes.filter((v) => v !== optionId)
        : [...poll.myVotes, optionId];
      if (next.length === 0) {
        clearVote.mutate();
        return;
      }
      vote.mutate(next);
    } else {
      vote.mutate([optionId]);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/app/polls" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to polls
      </Link>

      <div className="surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {poll.status !== 'published' ? (
                <StatusBadge status={poll.status} />
              ) : poll.isClosed ? (
                <Badge tone="neutral">Closed</Badge>
              ) : (
                <Badge tone="success">Open for voting</Badge>
              )}
              {poll.category_name && <Badge tone="neutral">{poll.category_name}</Badge>}
              {poll.allowMultiple && <Badge tone="info">Multiple choices allowed</Badge>}
              {poll.isAnonymous && <Badge tone="neutral">Anonymous</Badge>}
            </div>
            <h1 className="mt-2 text-[20px] font-semibold leading-snug tracking-[-0.02em] text-ink">{poll.title}</h1>
            <p className="mt-1 text-[13px] text-ink-muted">
              by <span className="text-ink-soft">@{poll.creator_username}</span>
              {poll.published_at && ` · published ${formatDate(poll.published_at)}`}
            </p>
          </div>
          <div className="flex gap-2">
            {isOwner && ['draft', 'changes_requested', 'rejected'].includes(poll.status) && (
              <Button to={`/app/polls/${poll.id}/edit`} size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" />}>
                Edit
              </Button>
            )}
            {!isOwner && poll.status === 'published' && (
              <Button size="sm" variant="ghost" icon={<Flag className="h-3.5 w-3.5" />} onClick={() => setReportOpen(true)}>
                Report
              </Button>
            )}
          </div>
        </div>

        {poll.description && <p className="mt-3 whitespace-pre-line text-[13px] text-ink-soft">{poll.description}</p>}

        {(poll.status === 'changes_requested' || poll.status === 'rejected') && poll.review_notes && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-2xs font-semibold uppercase tracking-wide text-amber-700">Reviewer notes</p>
            <p className="mt-1 text-[13px] text-amber-900">{poll.review_notes}</p>
          </div>
        )}
      </div>

      <Panel
        title={poll.allowMultiple ? 'Select all that apply' : 'Select one option'}
        description={
          canVote
            ? poll.allowMultiple
              ? 'You can change your choices until the poll closes.'
              : 'You can change your vote until the poll closes.'
            : poll.isClosed
              ? 'This poll has closed. Results are shown below.'
              : 'Results are shown below.'
        }
        className="mt-4"
      >
        {!canVote && poll.myVotes.length === 0 && poll.totalVotes === 0 && (
          <p className="mb-3 text-[13px] text-ink-muted">No votes have been cast in this poll yet.</p>
        )}
        <div className="space-y-2">
          {poll.options.map((option) => {
            const selected = poll.myVotes.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                disabled={!canVote}
                aria-pressed={selected}
                onClick={() => toggleOption(option.id)}
                className={cn(
                  'relative w-full overflow-hidden rounded-md border px-3 py-2.5 text-left transition-colors',
                  selected ? 'border-brand-300 bg-brand-50' : 'border-line bg-white',
                  canVote ? 'hover:border-line-strong hover:bg-canvas' : 'cursor-default',
                )}
              >
                <div
                  className={cn('absolute inset-y-0 left-0 transition-all', selected ? 'bg-brand-100/70' : 'bg-canvas')}
                  style={{ width: `${option.percent}%` }}
                  aria-hidden
                />
                <div className="relative flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-[13px] text-ink">
                    {selected && <Check className="h-3.5 w-3.5 shrink-0 text-brand-600" />}
                    <span className="truncate">{option.body}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-xs text-ink-muted">
                    {option.percent}% · {formatNumber(option.votes)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
            <Users className="h-3.5 w-3.5" />
            {formatNumber(poll.totalVotes)} vote{poll.totalVotes === 1 ? '' : 's'} total
          </span>
          {poll.closes_at && (
            <span className={cn('inline-flex items-center gap-1.5 text-xs', poll.isClosed ? 'text-ink-muted' : 'text-ink-soft')}>
              <Clock3 className="h-3.5 w-3.5" />
              {poll.isClosed ? `Closed ${formatRelative(poll.closes_at)}` : `Closes ${formatDateTime(poll.closes_at)}`}
            </span>
          )}
          {canVote && poll.myVotes.length > 0 && (
            <Button size="sm" variant="ghost" loading={clearVote.isPending} onClick={() => clearVote.mutate()}>
              Withdraw my vote
            </Button>
          )}
        </div>
      </Panel>

      <div className="mt-4">
        <RatingSection
          contentType="poll"
          contentId={poll.id}
          canRate={poll.status === 'published' && !isOwner && poll.myVotes.length > 0}
          canRateHint={poll.status === 'published' && !isOwner ? 'Vote in this poll to leave a rating.' : undefined}
          ownerView={isOwner}
        />
      </div>

      {poll.moderationHistory && poll.moderationHistory.length > 0 && (
        <Panel title="Moderation history" className="mt-4">
          <DetailList
            columns={1}
            items={poll.moderationHistory.map((entry) => ({
              label: `${entry.decision.replace(/_/g, ' ')} · ${formatDate(entry.created_at)}`,
              value: entry.reason ?? '—',
            }))}
          />
        </Panel>
      )}

      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Report this poll"
        description="Reports are reviewed by an administrator."
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={report.isPending}
              disabled={reportReason.trim().length < 3}
              onClick={() => report.mutate()}
            >
              Submit report
            </Button>
          </>
        }
      >
        <TextArea
          label="Reason"
          required
          rows={3}
          value={reportReason}
          onChange={(event) => setReportReason(event.target.value)}
          placeholder="e.g. Offensive content, misleading question, spam"
        />
      </Modal>
    </div>
  );
}
