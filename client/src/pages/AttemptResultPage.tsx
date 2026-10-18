import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { Award, CheckCircle2, Coins, Home, RotateCcw, XCircle } from 'lucide-react';
import endpoints from '@/services/endpoints';
import { apiErrorMessage } from '@/services/api';
import { useDocumentTitle } from '@/hooks';
import { Button } from '@/components/ui/Button';
import { Badge, ProgressBar } from '@/components/ui/Data';
import { Card, CardBody, CardHeader, ErrorState, SkeletonList } from '@/components/ui/Feedback';
import { QUESTION_TYPES, QUESTION_TYPE_LABELS } from '@/utils/constants';
import { formatDuration, formatNumber, formatPercent } from '@/utils/format';
import { cn } from '@/utils/cn';

/** Attempt result: score summary + per-question review with explanations. */
export function AttemptResultPage() {
  const { attemptId = '' } = useParams();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const fresh = Boolean((location.state as { fresh?: boolean } | null)?.fresh);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: () => endpoints.quizzes.getAttempt(attemptId),
    enabled: Boolean(attemptId),
  });

  useDocumentTitle(data ? `Result: ${data.percentage}%` : 'Attempt result');

  if (isLoading) return <SkeletonList count={2} />;

  if (isError || !data) {
    return (
      <ErrorState
        title="Result unavailable"
        description={apiErrorMessage(error)}
        action={<Button onClick={() => refetch()}>Try again</Button>}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Score summary */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card>
          <CardBody className="p-7 text-center">
            <div
              className={cn(
                'mx-auto flex h-16 w-16 items-center justify-center rounded-full',
                data.needsReview
                  ? 'bg-warning-soft text-warning'
                  : data.passed
                    ? 'bg-success-soft text-success'
                    : 'bg-surface-muted text-body'
              )}
            >
              {data.needsReview ? (
                <Award className="h-8 w-8" />
              ) : data.passed ? (
                <CheckCircle2 className="h-8 w-8" />
              ) : (
                <XCircle className="h-8 w-8" />
              )}
            </div>

            <h1 className="mt-4 text-2xl font-semibold text-heading">
              {data.needsReview
                ? 'Awaiting manual review'
                : data.passed
                  ? 'Congratulations — you passed!'
                  : 'Attempt complete'}
            </h1>
            {data.quiz && <p className="mt-1 text-sm text-body">{data.quiz.title}</p>}

            <div className="mx-auto mt-6 max-w-sm">
              <ProgressBar
                value={data.percentage}
                tone={data.passed ? 'success' : data.needsReview ? 'warning' : 'brand'}
                label="Score"
              />
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Summary label="Points" value={`${formatNumber(data.score)} / ${formatNumber(data.maxScore)}`} />
              <Summary label="Percentage" value={formatPercent(data.percentage, 1)} />
              <Summary label="Passing" value={`${data.quiz?.passingScore ?? 50}%`} />
              <Summary label="Time" value={formatDuration(data.timeSpentSec)} />
            </dl>

            {data.entryFeeCharged > 0 && (
              <p className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-warning-soft px-3 py-1.5 text-xs text-warning">
                <Coins className="h-3.5 w-3.5" /> {formatNumber(data.entryFeeCharged)} QCoins entry fee was charged
              </p>
            )}
            {data.rewardPaid > 0 && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-success-soft px-3 py-1.5 text-xs text-success">
                <Coins className="h-3.5 w-3.5" /> {formatNumber(data.rewardPaid)} QCoins reward credited to your wallet
              </p>
            )}
            {data.rewardInfo && !data.rewardInfo.eligible && data.rewardInfo.reason && data.quiz && (
              <p className="mt-2 text-xs text-muted">
                Reward not paid: {data.rewardInfo.reason.toLowerCase().replace(/_/g, ' ')}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {data.quiz && (
                <Link to={`/quizzes/${data.quiz.slug}`}>
                  <Button variant="outline" icon={<RotateCcw className="h-4 w-4" />}>
                    Back to quiz
                  </Button>
                </Link>
              )}
              <Link to="/dashboard">
                <Button variant="ghost" icon={<Home className="h-4 w-4" />}>
                  Dashboard
                </Button>
              </Link>
            </div>
            {fresh && data.passed && (
              <p className="mt-3 text-xs text-success">Nice work — your result is saved to your profile.</p>
            )}
          </CardBody>
        </Card>
      </motion.div>

      {/* Question review */}
      <Card className="mt-6">
        <CardHeader
          title="Question review"
          subtitle="Correct answers and explanations below."
          actions={data.needsReview ? <Badge tone="warning">Manual review pending</Badge> : null}
        />
        <CardBody className="space-y-5">
          {data.questions.map((q, i) => {
            const review = q as typeof q & {
              yourAnswer?: unknown;
              awardedPoints?: number;
              correct?: boolean;
              isCorrectOptionIds?: string[];
              correctBoolean?: boolean | null;
              correctAnswers?: string[];
              explanation?: string;
            };
            return (
              <div
                key={review.id}
                className={cn(
                  'rounded-lg border p-4',
                  review.needsReview
                    ? 'border-warning-soft bg-warning-soft/40'
                    : review.correct
                      ? 'border-success-soft bg-success-soft/30'
                      : 'border-line'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-heading">
                    {i + 1}. {review.text}
                  </p>
                  <div className="flex shrink-0 items-center gap-2">
                    {review.needsReview ? (
                      <Badge tone="warning">In review</Badge>
                    ) : review.correct ? (
                      <CheckCircle2 className="h-4.5 w-4.5 text-success" />
                    ) : (
                      <XCircle className="h-4.5 w-4.5 text-danger" />
                    )}
                    <span className="text-xs text-muted">
                      {formatNumber(review.awardedPoints ?? 0)}/{formatNumber(review.points ?? 1)}
                    </span>
                  </div>
                </div>

                <p className="mt-1 text-xs text-muted">
                  {QUESTION_TYPE_LABELS[review.type as keyof typeof QUESTION_TYPE_LABELS] ?? review.type}
                </p>

                <div className="mt-3 space-y-1.5 text-sm">
                  <p className="text-body">
                    <span className="text-muted">Your answer:</span>{' '}
                    <AnswerText question={review} value={review.yourAnswer} />
                  </p>
                  {!review.correct && !review.needsReview && (
                    <p className="text-success">
                      <span className="text-muted">Correct answer:</span>{' '}
                      <AnswerText question={review} value={correctAnswerOf(review)} />
                    </p>
                  )}
                </div>

                {review.explanation && (
                  <p className="mt-3 rounded-md bg-background px-3 py-2 text-xs text-body">
                    <span className="font-medium text-body">Explanation:</span> {review.explanation}
                  </p>
                )}
              </div>
            );
          })}
        </CardBody>
      </Card>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-body">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-heading">{value}</dd>
    </div>
  );
}

function correctAnswerOf(q: {
  type: string;
  isCorrectOptionIds?: string[];
  correctBoolean?: boolean | null;
  correctAnswers?: string[];
  evaluationRules?: { keywords?: { text: string }[] };
  options?: { id: string; text: string }[];
}): unknown {
  if (q.type === QUESTION_TYPES.TRUE_FALSE) return q.correctBoolean ? 'True' : 'False';
  if (q.type === QUESTION_TYPES.FILL_BLANK) return (q.correctAnswers ?? []).join(' or ');
  if (q.type === QUESTION_TYPES.SHORT_ANSWER)
    return `keywords: ${(q.evaluationRules?.keywords ?? []).map((k) => k.text).join(', ') || 'manual review'}`;
  return (q.options ?? [])
    .filter((o) => (q.isCorrectOptionIds ?? []).includes(o.id))
    .map((o) => o.text)
    .join(', ');
}

function AnswerText({ question, value }: { question: { type: string; options?: { id: string; text: string }[] }; value: unknown }) {
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
    return <em className="text-muted">No answer</em>;
  }
  if (Array.isArray(value)) {
    const texts = value.map((id) => question.options?.find((o) => o.id === id)?.text ?? String(id));
    return <>{texts.join(', ')}</>;
  }
  if (question.options) {
    const text = question.options.find((o) => o.id === String(value))?.text;
    return <>{text ?? String(value)}</>;
  }
  return <>{String(value)}</>;
}

export default AttemptResultPage;
