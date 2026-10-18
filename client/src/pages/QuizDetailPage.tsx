import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight, Coins, Clock, Flag, ListChecks, Lock, Pencil, ShieldCheck, Star, Target, Users,
} from 'lucide-react';
import endpoints, { type RatingDto } from '@/services/endpoints';
import { apiErrorMessage } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/hooks';
import { Button } from '@/components/ui/Button';
import { Badge, RatingStars } from '@/components/ui/Data';
import { Card, CardBody, CardHeader, PageHeader, SkeletonList, ErrorState, EmptyState } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Overlay';
import { Textarea, Select } from '@/components/ui/Form';
import { DIFFICULTY_LABELS, REPORT_REASONS, REPORT_REASON_LABELS } from '@/utils/constants';
import { formatDate, formatNumber, formatPercent } from '@/utils/format';

/** Quiz landing page: details, fee/reward terms, attempts, ratings, and report. */
export function QuizDetailPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string>('SPAM');
  const [reportDetails, setReportDetails] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['quiz', slug],
    queryFn: () => endpoints.quizzes.get(slug),
    enabled: Boolean(slug),
  });

  useDocumentTitle(data?.quiz?.title ?? 'Quiz');

  const { data: ratingsData, isLoading: ratingsLoading } = useQuery({
    queryKey: ['ratings', 'QUIZ', data?.quiz?._id],
    queryFn: () => endpoints.ratings.forTarget('QUIZ', data!.quiz._id, { page: 1, limit: 10 }),
    enabled: Boolean(data?.quiz?._id),
  });

  const reportMutation = useMutation({
    mutationFn: () =>
      endpoints.reports.create({
        targetType: 'QUIZ',
        targetId: data!.quiz._id,
        reason: reportReason,
        details: reportDetails,
      }),
    onSuccess: () => {
      toast.success('Report submitted', 'Our moderators will review it.');
      setReportOpen(false);
      setReportDetails('');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not submit report')),
  });

  if (isLoading) {
    return (
      <div>
        <SkeletonList count={2} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <ErrorState
        title="Quiz unavailable"
        description={apiErrorMessage(error, 'This quiz does not exist or is not published.')}
        action={
          <div className="flex gap-2">
            <Button onClick={() => refetch()}>Try again</Button>
            <Link to="/explore/quizzes">
              <Button variant="outline">Browse quizzes</Button>
            </Link>
          </div>
        }
      />
    );
  }

  const { quiz, questionCount, totalPoints, myAttempts, solution } = data;
  const isOwner = user && (quiz.creator?._id === user._id || user.role === 'ADMIN');
  const attemptsUsed = myAttempts.length;
  const attemptsAllowed = (quiz as unknown as { attemptsAllowed?: number }).attemptsAllowed ?? 1;
  const attemptsLeft = Math.max(0, attemptsAllowed - attemptsUsed);
  const entryFee = quiz.entryFee ?? 0;
  const reward = quiz.reward ?? 0;

  return (
    <div>
      <PageHeader
        title={quiz.title}
        description={quiz.description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isOwner && user && (
              <Link to={`/creator/quizzes/${quiz._id}/edit`}>
                <Button variant="outline" icon={<Pencil className="h-4 w-4" />}>
                  Edit quiz
                </Button>
              </Link>
            )}
            {user ? (
              attemptsLeft > 0 ? (
                <Button
                  icon={<ArrowRight className="h-4 w-4" />}
                  onClick={() => navigate(`/quizzes/${quiz.slug}/attempt`)}
                >
                  {attemptsUsed === 0 ? 'Start quiz' : 'Try again'}
                </Button>
              ) : (
                <Button disabled icon={<Lock className="h-4 w-4" />}>
                  No attempts left
                </Button>
              )
            ) : (
              <Link to={`/login?from=/quizzes/${quiz.slug}`}>
                <Button icon={<Lock className="h-4 w-4" />}>Sign in to participate</Button>
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
          {/* Meta */}
          <Card>
            <CardBody>
              <div className="flex flex-wrap items-center gap-2">
                {quiz.difficulty && (
                  <Badge tone={quiz.difficulty === 'HARD' ? 'danger' : quiz.difficulty === 'EASY' ? 'success' : 'info'}>
                    {DIFFICULTY_LABELS[quiz.difficulty] ?? quiz.difficulty}
                  </Badge>
                )}
                {quiz.category?.name && <Badge>{quiz.category.name}</Badge>}
                {(quiz.tags ?? []).map((tag) => (
                  <span key={tag} className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-500">
                    {tag}
                  </span>
                ))}
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Detail icon={<ListChecks className="h-4 w-4" />} label="Questions" value={formatNumber(questionCount)} />
                <Detail icon={<Target className="h-4 w-4" />} label="Total points" value={formatNumber(totalPoints)} />
                <Detail icon={<Clock className="h-4 w-4" />} label="Time limit" value={(quiz as unknown as { timeLimitMinutes?: number }).timeLimitMinutes ? `${(quiz as unknown as { timeLimitMinutes?: number }).timeLimitMinutes} min` : 'Untimed'} />
                <Detail icon={<Users className="h-4 w-4" />} label="Attempts" value={formatNumber(quiz.stats?.attemptsCount ?? 0)} />
              </dl>

              {(quiz.stats?.completionsCount ?? 0) > 0 && (
                <div className="mt-5 rounded-lg bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                  <span className="font-medium text-zinc-900">{formatNumber(quiz.stats?.completionsCount)}</span> completed
                  this quiz · average score{' '}
                  <span className="font-medium text-zinc-900">{formatPercent(quiz.stats?.avgScore ?? 0)}</span> ·{' '}
                  <span className="font-medium text-zinc-900">{formatNumber(quiz.stats?.passesCount ?? 0)}</span> passed
                </div>
              )}
            </CardBody>
          </Card>

          {/* Fee / reward terms — shown BEFORE participation, per spec */}
          {(entryFee > 0 || reward > 0) && (
            <Card>
              <CardHeader title="Participation terms" subtitle="Exactly what you pay and what you can earn." />
              <CardBody>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-zinc-100 p-4">
                    <p className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                      <Coins className="h-4 w-4 text-amber-500" /> Entry fee
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-zinc-900">
                      {entryFee > 0 ? `${formatNumber(entryFee)} QCoins` : 'Free'}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {entryFee > 0
                        ? 'Deducted when you start. Refundable if the quiz is cancelled by the platform or you abandon before submitting.'
                        : 'No entry fee — participate at no cost.'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-100 p-4">
                    <p className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                      <Coins className="h-4 w-4 text-emerald-500" /> Reward
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-zinc-900">
                      {reward > 0 ? `${formatNumber(reward)} QCoins` : 'No reward'}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {reward > 0
                        ? (quiz as unknown as { rewardMode?: string }).rewardMode === 'TOP_PERCENT'
                          ? `Paid to top-performing passes (top ${((quiz as unknown as { topPercent?: number }).topPercent ?? 20)}%).`
                          : 'Paid after a server-verified pass.'
                        : 'This quiz offers no QCoin reward.'}
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Previous attempts */}
          {user && myAttempts.length > 0 && (
            <Card>
              <CardHeader title="Your attempts" subtitle={`${attemptsUsed} of ${attemptsAllowed} used`} />
              <CardBody className="space-y-2">
                {myAttempts.map((attempt) => (
                  <Link
                    key={attempt._id}
                    to={`/attempts/${attempt._id}`}
                    className="flex items-center justify-between rounded-lg border border-zinc-100 px-4 py-2.5 hover:border-brand-200 hover:bg-brand-50/40"
                  >
                    <div className="flex items-center gap-3 text-sm">
                      <Badge tone={attempt.passed ? 'success' : 'neutral'}>
                        {attempt.passed ? 'Passed' : 'Not passed'}
                      </Badge>
                      <span className="text-zinc-500">{formatDate(attempt.submittedAt)}</span>
                    </div>
                    <span className="text-sm font-semibold text-zinc-900">{formatPercent(attempt.percentage)}</span>
                  </Link>
                ))}
              </CardBody>
            </Card>
          )}

          {/* Solution preview for owner/admin */}
          {solution && (
            <Card>
              <CardHeader
                title="Answer key"
                subtitle={`${solution.length} questions with correct answers and explanations`}
                actions={<Badge tone="brand"><ShieldCheck className="h-3 w-3" /> Creator view</Badge>}
              />
              <CardBody className="space-y-4">
                {solution.map((q, i) => (
                  <div key={q.id} className="rounded-lg border border-zinc-100 p-4">
                    <p className="text-sm font-medium text-zinc-900">
                      {i + 1}. {q.text}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Correct:{' '}
                      {q.type === 'TRUE_FALSE'
                        ? String(q.correctBoolean)
                        : q.type === 'FILL_BLANK'
                          ? (q.correctAnswers ?? []).join(', ')
                          : q.type === 'SHORT_ANSWER'
                            ? `keywords: ${(q.evaluationRules?.keywords ?? []).map((k) => k.text).join(', ')}`
                            : (q.options ?? [])
                                .filter((o) => o.isCorrect)
                                .map((o) => o.text)
                                .join(', ')}
                    </p>
                    {q.explanation && <p className="mt-1.5 text-xs text-zinc-600">{q.explanation}</p>}
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          {/* Community ratings */}
          <Card>
            <CardHeader
              title="Community ratings"
              subtitle={
                (quiz.stats?.ratingCount ?? 0) > 0
                  ? `${formatNumber(quiz.stats?.ratingCount)} ratings`
                  : 'No ratings yet'
              }
              actions={<RatingStars value={quiz.stats?.ratingBayes ?? null} count={quiz.stats?.ratingCount} size="md" />}
            />
            <CardBody>
              {ratingsLoading ? (
                <div className="space-y-2">
                  <div className="skeleton h-14 w-full" />
                  <div className="skeleton h-14 w-full" />
                </div>
              ) : (ratingsData?.items ?? []).length === 0 ? (
                <EmptyState
                  title="No reviews yet"
                  description="Ratings appear once participants who completed the quiz share their feedback."
                  className="py-6"
                />
              ) : (
                <div className="space-y-4">
                  {(ratingsData?.items ?? []).map((rating: RatingDto) => (
                    <div key={rating._id} className="border-b border-zinc-100 pb-4 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between gap-3">
                        <Link to={`/users/${rating.user?._id}`} className="text-sm font-medium text-zinc-900 hover:text-brand-700">
                          {rating.user?.name ?? 'Member'}
                        </Link>
                        <RatingStars value={rating.score} />
                      </div>
                      {rating.review && <p className="mt-1.5 text-sm text-zinc-600">{rating.review}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Creator" />
            <CardBody>
              <Link to={`/users/${quiz.creator?._id}`} className="flex items-center gap-3 hover:opacity-80">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 font-medium text-brand-700">
                  {(quiz.creator?.name ?? '?').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{quiz.creator?.name}</p>
                  <p className="text-xs text-zinc-500">View creator profile</p>
                </div>
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Details" />
            <CardBody>
              <dl className="space-y-3 text-sm">
                <Row label="Passing score" value={`${(quiz as unknown as { passingScore?: number }).passingScore ?? 50}%`} />
                <Row label="Attempts allowed" value={String(attemptsAllowed)} />
                <Row label="Published" value={formatDate(quiz.publishedAt)} />
                <Row label="Version" value={`v${data.versionNumber}`} />
              </dl>
            </CardBody>
          </Card>

          {user && !isOwner && <RatingWidget targetType="QUIZ" targetId={quiz._id} />}
        </div>
      </div>

      {/* Report modal */}
      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Report this quiz"
        description="Reports are reviewed by moderators."
        footer={
          <>
            <Button variant="outline" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => reportMutation.mutate()}
              loading={reportMutation.isPending}
            >
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
            placeholder="Describe the problem…"
            maxLength={2000}
          />
        </div>
      </Modal>
    </div>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-zinc-500">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-zinc-900">{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium text-zinc-900">{value}</dd>
    </div>
  );
}

/** Inline rating form — eligibility enforced server-side. */
export function RatingWidget({ targetType, targetId }: { targetType: 'QUIZ' | 'POLL'; targetId: string }) {
  const [score, setScore] = useState(5);
  const [review, setReview] = useState('');
  const toast = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => endpoints.ratings.create({ targetType, targetId, score, review }),
    onSuccess: () => {
      toast.success('Thanks for your rating');
      setReview('');
      void queryClient.invalidateQueries({ queryKey: ['ratings', targetType, targetId] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not submit rating')),
  });

  return (
    <Card>
      <CardHeader title="Rate this content" subtitle="Available after real participation." />
      <CardBody className="space-y-3">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setScore(value)}
              aria-label={`${value} star${value > 1 ? 's' : ''}`}
              className="rounded p-1 hover:bg-zinc-50"
            >
              <Star
                className={`h-6 w-6 transition-colors ${
                  value <= score ? 'fill-amber-400 text-amber-400' : 'text-zinc-300'
                }`}
              />
            </button>
          ))}
        </div>
        <Textarea
          label="Review (optional)"
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="What did you think?"
          maxLength={2000}
        />
        <Button className="w-full" onClick={() => mutation.mutate()} loading={mutation.isPending}>
          Submit rating
        </Button>
        <p className="text-xs text-zinc-400">
          Creators cannot rate their own content, and one rating per person is allowed.
        </p>
      </CardBody>
    </Card>
  );
}

export default QuizDetailPage;
