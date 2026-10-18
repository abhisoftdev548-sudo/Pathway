import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  Clock3,
  Coins,
  Flag,
  HelpCircle,
  Layers,
  Pencil,
  Play,
  Repeat,
  Trophy,
  Users,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { qk, usePagedQuery } from '@/lib/queries';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Badge, DetailList, Panel, Separator, StatusBadge } from '@/components/ui/Primitives';
import { EmptyState, ErrorState, InlineError, LoadingBlock, Skeleton } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Modal } from '@/components/ui/Dialog';
import { TextArea } from '@/components/ui/Field';
import { RatingSection } from '@/components/patterns/RatingSection';
import { formatCoins, formatDate, formatDuration, formatNumber, formatPercent } from '@/lib/format';

interface QuizQuestionOption {
  id: string;
  position: number;
  body: string;
  isCorrect?: boolean;
}

interface QuizQuestion {
  id: string;
  position: number;
  prompt: string;
  type: string;
  points: number;
  explanation: string;
  options: QuizQuestionOption[];
}

interface QuizDetailData {
  id: string;
  title: string;
  summary: string;
  description: string;
  status: string;
  entry_fee: number;
  reward_coins: number;
  passing_score: number;
  time_limit_seconds: number | null;
  max_attempts: number;
  question_count: number;
  total_attempts: number;
  creator_id: string;
  creator_name: string;
  creator_username: string;
  category_name: string | null;
  difficulty_name: string | null;
  published_at: string | null;
  review_notes: string | null;
  rating_average: number | null;
  rating_count: number;
  tags: { id: string; name: string; slug: string }[];
  questions: QuizQuestion[];
  rating: { count: number; average: number | null };
  myAttempts: number;
  inProgressAttemptId: string | null;
  moderationHistory: { id: string; decision: string; reason: string | null; created_at: string }[] | null;
}

interface LeaderboardRow {
  rank: number;
  user_id: string;
  username: string;
  display_name: string;
  best_score: number;
  attempts: number;
}

export function QuizDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user, wallet } = useAuth();
  const [confirmStart, setConfirmStart] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');

  const quizQuery = useQuery<{ quiz: QuizDetailData }>({
    queryKey: qk.quiz(id),
    queryFn: () => api.get(`/quizzes/${id}`),
    enabled: Boolean(id),
  });
  const boardQuery = usePagedQuery<LeaderboardRow>(qk.quizLeaderboard(id, { page: 1 }), `/quizzes/${id}/leaderboard?page=1&pageSize=5`);

  const start = useMutation({
    mutationFn: () => api.post<{ attemptId: string; resumed: boolean }>('/attempts', { quizId: id }),
    onSuccess: (result) => {
      setConfirmStart(false);
      navigate(`/app/quizzes/${id}/take?attempt=${result.attemptId}`);
    },
    onError: (err) => {
      setConfirmStart(false);
      toast.error(err instanceof ApiError ? err.message : 'Could not start this quiz.');
    },
  });

  const report = useMutation({
    mutationFn: () => api.post('/reports', { targetType: 'quiz', targetId: id, reason: reportReason, details: reportDetails }),
    onSuccess: () => {
      setReportOpen(false);
      setReportReason('');
      setReportDetails('');
      toast.success('Report submitted. A moderator will review it.');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not submit the report.'),
  });

  if (quizQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (quizQuery.error) {
    return <ErrorState error={quizQuery.error} onRetry={() => quizQuery.refetch()} />;
  }

  const quiz = quizQuery.data!.quiz;
  const isOwner = user?.id === quiz.creator_id;
  const attemptsRemaining = quiz.max_attempts - quiz.myAttempts;
  const canStart =
    quiz.status === 'approved' &&
    !isOwner &&
    attemptsRemaining > 0 &&
    (wallet?.balance ?? 0) >= quiz.entry_fee;

  return (
    <>
      <Link to="/app/quizzes" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to quizzes
      </Link>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {quiz.status !== 'approved' && <StatusBadge status={quiz.status} />}
                  {quiz.category_name && <Badge tone="neutral">{quiz.category_name}</Badge>}
                  {quiz.difficulty_name && <Badge tone="neutral">{quiz.difficulty_name}</Badge>}
                </div>
                <h1 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-ink">{quiz.title}</h1>
                <p className="mt-1 text-[13px] text-ink-muted">
                  by <span className="text-ink-soft">@{quiz.creator_username}</span>
                  {quiz.published_at && ` · published ${formatDate(quiz.published_at)}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {isOwner && (quiz.status === 'draft' || quiz.status === 'changes_requested' || quiz.status === 'rejected') && (
                  <Button to={`/app/quizzes/${quiz.id}/edit`} size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" />}>
                    Edit
                  </Button>
                )}
                {!isOwner && quiz.status === 'approved' && (
                  <Button size="sm" variant="ghost" icon={<Flag className="h-3.5 w-3.5" />} onClick={() => setReportOpen(true)}>
                    Report
                  </Button>
                )}
              </div>
            </div>

            {quiz.summary && <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">{quiz.summary}</p>}
            {quiz.description && quiz.description !== quiz.summary && (
              <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-ink-muted">{quiz.description}</p>
            )}

            {quiz.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {quiz.tags.map((tag) => (
                  <Badge key={tag.id} tone="neutral">
                    {tag.name}
                  </Badge>
                ))}
              </div>
            )}

            {quiz.status === 'changes_requested' && quiz.review_notes && (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-2xs font-semibold uppercase tracking-wide text-amber-700">Reviewer notes</p>
                <p className="mt-1 text-[13px] text-amber-900">{quiz.review_notes}</p>
              </div>
            )}
            {quiz.status === 'rejected' && quiz.review_notes && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                <p className="text-2xs font-semibold uppercase tracking-wide text-red-700">Rejected</p>
                <p className="mt-1 text-[13px] text-red-900">{quiz.review_notes}</p>
              </div>
            )}
          </div>

          <Panel title={`Questions (${quiz.questions.length})`} description="Correct answers are hidden until you submit an attempt.">
            {quiz.questions.length === 0 ? (
              <EmptyState compact title="This quiz has no questions" description="The creator has not added questions yet." />
            ) : (
              <ol className="space-y-3">
                {quiz.questions.map((question, index) => (
                  <li key={question.id} className="rounded-md border border-line bg-canvas/50 p-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-surface text-2xs font-semibold text-ink-soft ring-1 ring-line">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-ink">{question.prompt}</p>
                        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                          {question.options.map((option) => (
                            <li
                              key={option.id}
                              className={`rounded border px-2 py-1.5 text-[13px] ${
                                option.isCorrect
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                  : 'border-line bg-surface text-ink-soft'
                              }`}
                            >
                              {option.body}
                              {option.isCorrect && <span className="ml-1.5 text-2xs font-medium">correct</span>}
                            </li>
                          ))}
                        </ul>
                        {question.explanation && (
                          <p className="mt-2 text-xs leading-relaxed text-ink-muted">{question.explanation}</p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <RatingSection
            contentType="quiz"
            contentId={quiz.id}
            canRate={quiz.status === 'approved' && !isOwner && quiz.myAttempts > 0}
            canRateHint={
              quiz.status === 'approved' && !isOwner
                ? 'Complete this quiz to leave a rating.'
                : undefined
            }
            ownerView={isOwner}
          />
        </div>

        <div className="space-y-4">
          <Panel title="Take this quiz" bodyClassName="p-4">
            <DetailList
              columns={1}
              items={[
                { label: 'Questions', value: `${quiz.question_count} questions`, },
                { label: 'Passing score', value: `${quiz.passing_score}%` },
                { label: 'Entry fee', value: quiz.entry_fee > 0 ? `${formatCoins(quiz.entry_fee)} QCoin` : 'Free' },
                { label: 'Reward', value: quiz.reward_coins > 0 ? `Up to ${formatCoins(quiz.reward_coins)} QCoin` : 'No reward set' },
                { label: 'Time limit', value: quiz.time_limit_seconds ? formatDuration(quiz.time_limit_seconds) : 'No limit' },
                { label: 'Attempts allowed', value: `${quiz.max_attempts} per player` },
                { label: 'Attempts so far', value: `${quiz.myAttempts} by you · ${formatNumber(quiz.total_attempts)} total` },
              ]}
            />

            <Separator className="my-4" />

            {quiz.status !== 'approved' ? (
              <p className="text-[13px] text-ink-muted">
                This quiz is not published, so it cannot be attempted.
              </p>
            ) : isOwner ? (
              <p className="text-[13px] text-ink-muted">You cannot attempt your own quiz.</p>
            ) : quiz.inProgressAttemptId ? (
              <Button to={`/app/quizzes/${quiz.id}/take?attempt=${quiz.inProgressAttemptId}`} variant="primary" block icon={<Play className="h-3.5 w-3.5" />}>
                Resume attempt
              </Button>
            ) : attemptsRemaining <= 0 ? (
              <p className="text-[13px] text-ink-muted">
                You have used all {quiz.max_attempts} permitted attempt(s) for this quiz.
              </p>
            ) : (
              <>
                {(wallet?.balance ?? 0) < quiz.entry_fee && (
                  <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <p className="text-xs text-amber-800">
                      This quiz costs {formatCoins(quiz.entry_fee)} QCoin and your balance is {formatCoins(wallet?.balance ?? 0)}.
                    </p>
                  </div>
                )}
                <Button
                  variant="primary"
                  block
                  icon={<Play className="h-3.5 w-3.5" />}
                  disabled={!canStart}
                  onClick={() => (quiz.entry_fee > 0 ? setConfirmStart(true) : start.mutate())}
                  loading={start.isPending}
                >
                  {quiz.entry_fee > 0 ? `Start for ${formatCoins(quiz.entry_fee)} QCoin` : 'Start quiz'}
                </Button>
                <p className="mt-2 text-center text-2xs text-ink-faint">
                  {attemptsRemaining} attempt{attemptsRemaining === 1 ? '' : 's'} remaining
                </p>
              </>
            )}
          </Panel>

          <Panel
            title="Leaderboard"
            description="Best score per player, earliest submission first on ties."
            actions={
              <Button to={`/app/leaderboards?scope=quiz&quizId=${quiz.id}`} size="sm" variant="ghost">
                View all
              </Button>
            }
            bodyClassName="p-0"
          >
            {boardQuery.isLoading ? (
              <div className="p-4">
                <LoadingBlock rows={3} />
              </div>
            ) : !boardQuery.data?.items.length ? (
              <div className="p-4">
                <EmptyState
                  compact
                  icon={<Trophy className="h-4 w-4" />}
                  title="No leaderboard entries yet"
                  description="Complete an eligible quiz to appear on the leaderboard."
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {boardQuery.data.items.map((row) => (
                  <li key={row.user_id} className="flex items-center gap-3 px-4 py-2.5">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-2xs font-semibold ${
                        row.rank <= 3 ? 'bg-brand-50 text-brand-700' : 'bg-canvas text-ink-muted'
                      }`}
                    >
                      {row.rank}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{row.display_name}</span>
                    <span className="tabular-nums text-[13px] font-medium text-ink">{row.best_score}%</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {quiz.moderationHistory && quiz.moderationHistory.length > 0 && (
            <Panel title="Moderation history" bodyClassName="p-0">
              <ul className="divide-y divide-line">
                {quiz.moderationHistory.map((entry) => (
                  <li key={entry.id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge status={entry.decision} />
                      <span className="text-2xs text-ink-faint">{formatDate(entry.created_at)}</span>
                    </div>
                    {entry.reason && <p className="mt-1 text-xs text-ink-muted">{entry.reason}</p>}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Quiz stats">
            <div className="space-y-2 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-ink-muted">
                  <Users className="h-3.5 w-3.5" /> Attempts
                </span>
                <span className="tabular-nums text-ink">{formatNumber(quiz.total_attempts)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-ink-muted">
                  <HelpCircle className="h-3.5 w-3.5" /> Questions
                </span>
                <span className="tabular-nums text-ink">{quiz.question_count}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-ink-muted">
                  <Layers className="h-3.5 w-3.5" /> Average rating
                </span>
                <span className="tabular-nums text-ink">
                  {quiz.rating.count > 0 ? `${quiz.rating.average} (${quiz.rating.count})` : '—'}
                </span>
              </div>
              {quiz.time_limit_seconds && (
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-ink-muted">
                    <Clock3 className="h-3.5 w-3.5" /> Time limit
                  </span>
                  <span className="tabular-nums text-ink">{formatDuration(quiz.time_limit_seconds)}</span>
                </div>
              )}
              {quiz.reward_coins > 0 && (
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-ink-muted">
                    <Coins className="h-3.5 w-3.5" /> Reward
                  </span>
                  <span className="tabular-nums text-ink">{formatCoins(quiz.reward_coins)} QCoin</span>
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={confirmStart}
        title={`Start this quiz for ${formatCoins(quiz.entry_fee)} QCoin?`}
        description={`${formatCoins(quiz.entry_fee)} QCoin will be deducted from your balance now. Your balance after starting will be ${formatCoins(
          (wallet?.balance ?? 0) - quiz.entry_fee,
        )} QCoin.`}
        confirmLabel="Pay and start"
        loading={start.isPending}
        onConfirm={() => start.mutate()}
        onCancel={() => setConfirmStart(false)}
      />

      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Report this quiz"
        description="Reports go to the moderation queue and are reviewed by an administrator."
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
          rows={2}
          value={reportReason}
          onChange={(event) => setReportReason(event.target.value)}
          placeholder="e.g. Misleading answers, offensive content, spam"
        />
        <TextArea
          label="Details"
          rows={4}
          className="mt-3"
          value={reportDetails}
          onChange={(event) => setReportDetails(event.target.value)}
          placeholder="Anything that will help the reviewer understand the issue."
        />
      </Modal>
    </>
  );
}
