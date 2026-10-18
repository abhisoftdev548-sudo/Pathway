import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Coins, Flag, Lightbulb, Timer } from 'lucide-react';
import endpoints, { type AttemptAnswer, type QuestionDto } from '@/services/endpoints';
import { apiErrorMessage } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle, useInterval } from '@/hooks';
import { Button } from '@/components/ui/Button';
import { Badge, ProgressBar } from '@/components/ui/Data';
import { Card, CardBody, ErrorState, InlineSpinner, SkeletonList } from '@/components/ui/Feedback';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { QUESTION_TYPES, QUESTION_TYPE_LABELS } from '@/utils/constants';
import { formatDuration, formatNumber } from '@/utils/format';
import { cn } from '@/utils/cn';

/**
 * Quiz attempt runner: one question at a time with progress, timer (when the
 * quiz is timed), question transitions, and a fee confirmation before starting.
 */
export function QuizAttemptPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const reduceMotion = useReducedMotion();
  useDocumentTitle('Taking quiz');

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionDto[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [feeAccepted, setFeeAccepted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  const { data: quizData, isLoading, isError, error } = useQuery({
    queryKey: ['quiz', slug],
    queryFn: () => endpoints.quizzes.get(slug),
    enabled: Boolean(slug) && !attemptId,
  });

  const startMutation = useMutation({
    mutationFn: () => endpoints.quizzes.startAttempt(quizData!.quiz._id),
    onSuccess: (attempt) => {
      setAttemptId(attempt.id);
      setQuestions(attempt.questions ?? []);
      startedAtRef.current = Date.now();
      const limit = (quizData?.quiz as unknown as { timeLimitMinutes?: number } | undefined)?.timeLimitMinutes ?? 0;
      if (limit > 0) setSecondsLeft(limit * 60);
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not start the attempt')),
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      endpoints.quizzes.submitAttempt(attemptId!, {
        answers: Object.entries(answers).map(([questionId, value]) => ({ questionId, value })),
        timeSpentSec: Math.round((Date.now() - startedAtRef.current) / 1000),
      }),
    onSuccess: (result) => {
      navigate(`/attempts/${result.id}`, { replace: true, state: { fresh: true } });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not submit your attempt')),
  });

  // Auto-submit when time runs out.
  const doSubmit = useCallback(() => {
    if (submitMutation.isPending) return;
    submitMutation.mutate();
  }, [submitMutation]);

  useInterval(
    () => {
      setSecondsLeft((prev) => {
        if (prev === null) return prev;
        if (prev <= 1) {
          doSubmit();
          return 0;
        }
        return prev - 1;
      });
    },
    secondsLeft !== null && secondsLeft > 0 ? 1000 : null
  );

  useEffect(() => {
    if (secondsLeft === 0) toast.info('Time is up', 'Your attempt was submitted automatically.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  const question = questions[current];
  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q.id] !== undefined && (Array.isArray(answers[q.id]) ? (answers[q.id] as unknown[]).length > 0 : String(answers[q.id]).length > 0)).length,
    [questions, answers]
  );

  const setAnswer = (questionId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  if (isLoading) return <SkeletonList count={2} />;

  if (isError || !quizData) {
    return (
      <ErrorState
        title="Could not load quiz"
        description={apiErrorMessage(error)}
        action={<Button onClick={() => navigate('/explore/quizzes')}>Back to explore</Button>}
      />
    );
  }

  const quiz = quizData.quiz;
  const entryFee = quiz.entryFee ?? 0;

  // Pre-start confirmation screen (shows fee/reward terms before charging).
  if (!attemptId) {
    return (
      <div className="mx-auto max-w-xl">
        <Card>
          <CardBody className="p-6">
            <Badge tone="brand" className="mb-3">
              {QUESTION_TYPE_LABELS[QUESTION_TYPES.SINGLE_CHOICE] && 'Ready when you are'}
            </Badge>
            <h1 className="text-xl font-semibold text-zinc-900">{quiz.title}</h1>
            <p className="mt-2 text-sm text-zinc-500">
              {quizData.questionCount} questions · {formatNumber(quizData.totalPoints)} points ·{' '}
              {(quiz as unknown as { timeLimitMinutes?: number }).timeLimitMinutes
                ? `${(quiz as unknown as { timeLimitMinutes?: number }).timeLimitMinutes} minute limit`
                : 'no time limit'}
            </p>

            {(entryFee > 0 || (quiz.reward ?? 0) > 0) && (
              <div className="mt-5 space-y-2 rounded-lg border border-zinc-100 p-4 text-sm">
                {entryFee > 0 && (
                  <p className="flex items-center gap-2 text-zinc-700">
                    <Coins className="h-4 w-4 text-amber-500" />
                    Entry fee: <strong>{formatNumber(entryFee)} QCoins</strong> — deducted when you start.
                  </p>
                )}
                {(quiz.reward ?? 0) > 0 && (
                  <p className="flex items-center gap-2 text-zinc-700">
                    <Coins className="h-4 w-4 text-emerald-500" />
                    Reward: <strong>{formatNumber(quiz.reward)} QCoins</strong> — paid after a verified pass.
                  </p>
                )}
                <p className="text-xs text-zinc-400">
                  Refunds apply if the quiz is cancelled or you abandon before submitting. QCoins have no cash value.
                </p>
              </div>
            )}

            {entryFee > 0 && (
              <label className="mt-4 flex items-start gap-2.5 text-sm text-zinc-600">
                <input
                  type="checkbox"
                  checked={feeAccepted}
                  onChange={(e) => setFeeAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-brand-600"
                />
                I understand this attempt costs {formatNumber(entryFee)} QCoins.
              </label>
            )}

            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={() => navigate(`/quizzes/${quiz.slug}`)}>
                Cancel
              </Button>
              <Button
                onClick={() => startMutation.mutate()}
                loading={startMutation.isPending}
                disabled={entryFee > 0 && !feeAccepted}
                icon={<ArrowRight className="h-4 w-4" />}
              >
                Start attempt
              </Button>
            </div>
            {!user && <p className="mt-3 text-xs text-red-500">You must be signed in.</p>}
          </CardBody>
        </Card>
      </div>
    );
  }

  if (questions.length === 0) {
    return <InlineSpinner label="Preparing your questions…" />;
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Progress header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-900">{quiz.title}</p>
            <p className="text-xs text-zinc-500">
              Question {current + 1} of {questions.length} · {answeredCount} answered
            </p>
          </div>
          {secondsLeft !== null && (
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
                secondsLeft < 60 ? 'bg-red-50 text-red-700' : 'bg-zinc-100 text-zinc-700'
              )}
              aria-live="polite"
            >
              <Timer className="h-4 w-4" />
              {formatDuration(secondsLeft)}
            </div>
          )}
        </div>
        <div className="mt-3">
          <ProgressBar value={answeredCount} max={questions.length} animated={false} />
        </div>
      </div>

      {/* Question card with transitions */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={question.id}
          initial={reduceMotion ? false : { opacity: 0, x: direction * 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * -24 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <Card>
            <CardBody className="p-6">
              <div className="flex items-start justify-between gap-3">
                <Badge tone="info">{QUESTION_TYPE_LABELS[question.type as keyof typeof QUESTION_TYPE_LABELS] ?? question.type}</Badge>
                <span className="text-xs text-zinc-400">{question.points} pt{question.points !== 1 ? 's' : ''}</span>
              </div>
              <h2 className="mt-4 text-lg font-medium text-zinc-900">{question.text}</h2>

              {question.hint && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-zinc-500">
                  <Lightbulb className="mt-0.5 h-3.5 w-3.5 text-amber-500" />
                  Hint: {question.hint}
                </p>
              )}

              <div className="mt-5">
                <QuestionInput question={question} value={answers[question.id]} onChange={(v) => setAnswer(question.id, v)} />
              </div>
            </CardBody>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <Button
          variant="outline"
          disabled={current === 0}
          onClick={() => {
            setDirection(-1);
            setCurrent((c) => Math.max(0, c - 1));
          }}
          icon={<ArrowLeft className="h-4 w-4" />}
        >
          Previous
        </Button>
        <div className="flex items-center gap-2">
          {current < questions.length - 1 ? (
            <Button
              onClick={() => {
                setDirection(1);
                setCurrent((c) => Math.min(questions.length - 1, c + 1));
              }}
              icon={<ArrowRight className="h-4 w-4" />}
            >
              Next
            </Button>
          ) : (
            <Button onClick={() => setConfirmSubmit(true)} icon={<Check className="h-4 w-4" />}>
              Submit attempt
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmSubmit}
        onClose={() => setConfirmSubmit(false)}
        onConfirm={doSubmit}
        title="Submit your attempt?"
        message={
          <div className="space-y-2">
            <p>
              You answered {answeredCount} of {questions.length} questions. Once submitted, answers are final and
              scored on the server.
            </p>
            {answeredCount < questions.length && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Unanswered questions will be marked incorrect.
              </p>
            )}
          </div>
        }
        confirmLabel="Submit"
        loading={submitMutation.isPending}
      />
    </div>
  );
}

/** Renders the right input widget per question type. */
function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: QuestionDto;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (question.type) {
    case QUESTION_TYPES.SINGLE_CHOICE:
    case QUESTION_TYPES.TRUE_FALSE: {
      const options =
        question.type === QUESTION_TYPES.TRUE_FALSE
          ? [
              { id: 'true', text: 'True' },
              { id: 'false', text: 'False' },
            ]
          : question.options ?? [];
      return (
        <div className="space-y-2.5" role="radiogroup">
          {options.map((option) => {
            const selected = String(value) === String(option.id);
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(option.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors',
                  selected
                    ? 'border-brand-500 bg-brand-50 text-brand-800'
                    : 'border-zinc-200 hover:border-zinc-300'
                )}
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                    selected ? 'border-brand-600 bg-brand-600' : 'border-zinc-300'
                  )}
                >
                  {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                {option.text}
              </button>
            );
          })}
        </div>
      );
    }
    case QUESTION_TYPES.MULTIPLE_CHOICE: {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-2.5">
          {(question.options ?? []).map((option) => {
            const checked = selected.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={checked}
                onClick={() =>
                  onChange(checked ? selected.filter((id) => id !== option.id) : [...selected, option.id])
                }
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors',
                  checked ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-zinc-200 hover:border-zinc-300'
                )}
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                    checked ? 'border-brand-600 bg-brand-600' : 'border-zinc-300'
                  )}
                >
                  {checked && <Check className="h-3 w-3 text-white" />}
                </span>
                {option.text}
              </button>
            );
          })}
          <p className="text-xs text-zinc-400">Select all that apply.</p>
        </div>
      );
    }
    case QUESTION_TYPES.FILL_BLANK:
      return (
        <input
          type="text"
          className="field-input"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your answer…"
          aria-label="Your answer"
        />
      );
    case QUESTION_TYPES.SHORT_ANSWER:
      return (
        <textarea
          className="field-input min-h-[120px]"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write your answer…"
          aria-label="Your answer"
        />
      );
    default:
      return null;
  }
}

export default QuizAttemptPage;
