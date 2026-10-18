import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, ChevronLeft, ChevronRight, Clock3, Flag } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Badge, Panel } from '@/components/ui/Primitives';
import { ErrorState, FullPageLoader, InlineError, LoadingBlock } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { cn } from '@/lib/cn';
import { formatDuration } from '@/lib/format';

interface TakeQuestion {
  id: string;
  position: number;
  prompt: string;
  type: 'single' | 'multiple' | 'true_false';
  points: number;
  explanation: string;
  options: { id: string; position: number; body: string }[];
}

interface TakeAttempt {
  id: string;
  quizId: string;
  quizTitle: string;
  status: string;
  startedAt: string;
  questionCount: number;
  passingScore: number;
  rewardCoins: number;
  entryFeeCharged: number;
  timeLimitSeconds: number | null;
}

interface TakeResponse {
  attempt: TakeAttempt;
  questions: TakeQuestion[];
  answers: Record<string, string[]>;
}

export function QuizTake() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const attemptId = params.get('attempt');
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const saveTimer = useRef<number | null>(null);

  const query = useQuery<TakeResponse>({
    queryKey: qk.attempt(attemptId ?? 'new'),
    queryFn: () => api.get<TakeResponse>(`/attempts/${attemptId}`),
    enabled: Boolean(attemptId),
    retry: false,
  });

  useEffect(() => {
    if (query.data) setAnswers(query.data.answers ?? {});
  }, [query.data]);

  const attempt = query.data?.attempt;
  const questions = query.data?.questions ?? [];

  // Countdown for timed quizzes.
  useEffect(() => {
    if (!attempt?.timeLimitSeconds || attempt.status !== 'in_progress') return;
    const deadline = new Date(attempt.startedAt).getTime() + attempt.timeLimitSeconds * 1000;
    const tick = () => {
      const remaining = Math.round((deadline - Date.now()) / 1000);
      setSecondsLeft(Math.max(0, remaining));
      if (remaining <= 0) submit.mutate();
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt?.id, attempt?.timeLimitSeconds, attempt?.status]);

  const saveAnswers = useCallback(
    (next: Record<string, string[]>) => {
      if (!attemptId) return;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(async () => {
        setSaving(true);
        try {
          await api.put(`/attempts/${attemptId}/answers`, {
            answers: Object.entries(next).map(([questionId, selected]) => ({ questionId, selected })),
          });
        } catch {
          toast.error('We could not save that answer. Your progress is kept on this page — try submitting again.');
        } finally {
          setSaving(false);
        }
      }, 600);
    },
    [attemptId, toast],
  );

  const submit = useMutation({
    mutationFn: async () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      return api.post<{ result: { attemptId: string; scorePercent: number } }>(`/attempts/${attemptId}/submit`, {
        answers: Object.entries(answers).map(([questionId, selected]) => ({ questionId, selected })),
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries();
      navigate(`/app/attempts/${result.result.attemptId}`, { replace: true });
    },
    onError: (err) => {
      setConfirmSubmit(false);
      toast.error(err instanceof ApiError ? err.message : 'Could not submit your attempt.');
    },
  });

  const toggleOption = (question: TakeQuestion, optionId: string) => {
    setAnswers((current) => {
      const selected = current[question.id] ?? [];
      let next: string[];
      if (question.type === 'multiple') {
        next = selected.includes(optionId) ? selected.filter((v) => v !== optionId) : [...selected, optionId];
      } else {
        next = selected[0] === optionId ? [] : [optionId];
      }
      const updated = { ...current, [question.id]: next };
      saveAnswers(updated);
      return updated;
    });
  };

  const answeredCount = useMemo(
    () => questions.filter((q) => (answers[q.id] ?? []).length > 0).length,
    [questions, answers],
  );

  if (!attemptId) {
    return (
      <div className="mx-auto max-w-md py-10">
        <InlineError message="No attempt was started for this quiz." />
        <Button className="mt-3" to={`/app/quizzes/${id}`}>
          Back to quiz
        </Button>
      </div>
    );
  }

  if (query.isLoading) return <FullPageLoader />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (attempt?.status !== 'in_progress') {
    return (
      <div className="mx-auto max-w-md py-10">
        <Panel title="This attempt is already finished">
          <p className="text-[13px] text-ink-soft">
            It was submitted and can no longer be edited. Open the result to review your answers.
          </p>
          <Button className="mt-3" to={`/app/attempts/${attemptId}`} variant="primary" size="sm">
            View result
          </Button>
        </Panel>
      </div>
    );
  }

  const unanswered = questions.length - answeredCount;

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[19px] font-semibold tracking-[-0.02em] text-ink">{attempt.quizTitle}</h1>
            <p className="mt-0.5 text-xs text-ink-muted">
              {attempt.questionCount} questions · pass mark {attempt.passingScore}%
              {attempt.entryFeeCharged > 0 && ` · ${attempt.entryFeeCharged} QCoin entry fee paid`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {secondsLeft !== null && (
              <Badge tone={secondsLeft < 60 ? 'danger' : 'neutral'}>
                <Clock3 className="h-3 w-3" />
                {formatDuration(secondsLeft)}
              </Badge>
            )}
            <Badge tone="neutral">
              {answeredCount}/{questions.length} answered
            </Badge>
            {saving && <span className="text-2xs text-ink-faint">Saving…</span>}
          </div>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-brand-600 transition-all"
            style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }}
          />
        </div>
      </header>

      <div className="space-y-3">
        {questions.map((question, index) => (
          <section key={question.id} className="surface p-4">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-canvas text-2xs font-semibold text-ink-soft ring-1 ring-line">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium leading-snug text-ink">{question.prompt}</p>
                <p className="mt-0.5 text-2xs text-ink-faint">
                  {question.type === 'multiple' ? 'Select all that apply' : 'Select one answer'} · {question.points} point
                  {question.points === 1 ? '' : 's'}
                </p>
                <div className="mt-3 grid gap-2">
                  {question.options.map((option) => {
                    const selected = (answers[question.id] ?? []).includes(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => toggleOption(question, option.id)}
                        aria-pressed={selected}
                        className={cn(
                          'flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-left text-[13px] transition-colors',
                          selected
                            ? 'border-brand-300 bg-brand-50 text-ink ring-1 ring-brand-200'
                            : 'border-line bg-white text-ink-soft hover:border-line-strong hover:bg-canvas',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center border bg-white text-white',
                            question.type === 'multiple' ? 'rounded' : 'rounded-full',
                            selected ? 'border-brand-600 bg-brand-600' : 'border-line-strong',
                          )}
                        >
                          {selected && (question.type === 'multiple' ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-white" />)}
                        </span>
                        {option.body}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="sticky bottom-0 -mx-4 mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <ChevronLeft className="h-3.5 w-3.5" />
          {unanswered > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-amber-700">
              <AlertCircle className="h-3.5 w-3.5" />
              {unanswered} question{unanswered === 1 ? '' : 's'} still unanswered
            </span>
          ) : (
            <span>All questions answered</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="md" onClick={() => navigate(`/app/quizzes/${id}`)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            icon={<Flag className="h-3.5 w-3.5" />}
            onClick={() => setConfirmSubmit(true)}
            loading={submit.isPending}
          >
            Submit answers
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmSubmit}
        title="Submit your answers?"
        description="Once submitted, an attempt cannot be changed. Your score is calculated on the server and any reward is written to your QCoin ledger."
        confirmLabel="Submit attempt"
        loading={submit.isPending}
        onConfirm={() => submit.mutate()}
        onCancel={() => setConfirmSubmit(false)}
      >
        {unanswered > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <p className="text-xs text-amber-800">
              {unanswered} question{unanswered === 1 ? '' : 's'} will be marked incorrect.
            </p>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
