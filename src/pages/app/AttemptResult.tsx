import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Coins, Repeat, Trophy, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { qk } from '@/lib/queries';
import { Button } from '@/components/ui/Button';
import { Badge, DetailList, Panel } from '@/components/ui/Primitives';
import { ErrorState, FullPageLoader } from '@/components/ui/States';
import { formatCoins, formatDateTime, formatDuration } from '@/lib/format';
import { cn } from '@/lib/cn';

interface ResultQuestion {
  id: string;
  position: number;
  prompt: string;
  type: string;
  points: number;
  explanation: string;
  options: { id: string; position: number; body: string; isCorrect: boolean }[];
}

interface AttemptResultData {
  attempt: {
    id: string;
    quizId: string;
    quizTitle: string;
    status: string;
    submittedAt: string | null;
    timeSpentSeconds: number | null;
    scorePercent: number | null;
    passed: boolean | null;
    correctCount: number;
    questionCount: number;
    earnedPoints: number;
    possiblePoints: number;
    entryFeeCharged: number;
    rewardPaid: number;
    passingScore: number;
    showExplanations: boolean;
  };
  questions: ResultQuestion[];
  answers: Record<string, string[]>;
}

export function AttemptResult() {
  const { id = '' } = useParams();
  const query = useQuery<AttemptResultData>({
    queryKey: qk.attempt(id),
    queryFn: () => api.get(`/attempts/${id}`),
  });

  if (query.isLoading) return <FullPageLoader />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const { attempt, questions, answers } = query.data!;

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/app/attempts" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to my attempts
      </Link>

      <div className="surface p-6 text-center">
        <div
          className={cn(
            'mx-auto flex h-11 w-11 items-center justify-center rounded-full',
            attempt.passed ? 'bg-emerald-50 text-emerald-600' : 'bg-canvas text-ink-faint',
          )}
        >
          {attempt.passed ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
        </div>
        <h1 className="mt-3 text-[20px] font-semibold tracking-[-0.02em] text-ink">{attempt.quizTitle}</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          {attempt.passed ? 'You passed this quiz.' : 'You did not reach the pass mark this time.'} Pass mark is{' '}
          {attempt.passingScore}%.
        </p>

        <div className="mt-5 flex items-end justify-center gap-6">
          <div>
            <div className="text-3xl font-semibold tabular-nums tracking-[-0.03em] text-ink">{attempt.scorePercent}%</div>
            <div className="mt-0.5 text-2xs uppercase tracking-wide text-ink-faint">Score</div>
          </div>
          <div>
            <div className="text-3xl font-semibold tabular-nums tracking-[-0.03em] text-ink">
              {attempt.correctCount}/{attempt.questionCount}
            </div>
            <div className="mt-0.5 text-2xs uppercase tracking-wide text-ink-faint">Correct</div>
          </div>
          {attempt.rewardPaid > 0 && (
            <div>
              <div className="text-3xl font-semibold tabular-nums tracking-[-0.03em] text-emerald-700">
                +{attempt.rewardPaid}
              </div>
              <div className="mt-0.5 text-2xs uppercase tracking-wide text-ink-faint">QCoin earned</div>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button to={`/app/leaderboards?scope=quiz&quizId=${attempt.quizId}`} size="sm" variant="secondary" icon={<Trophy className="h-3.5 w-3.5" />}>
            View leaderboard
          </Button>
          <Button to={`/app/quizzes/${attempt.quizId}`} size="sm" variant="ghost" icon={<Repeat className="h-3.5 w-3.5" />}>
            Quiz details
          </Button>
          <Button to="/app/wallet" size="sm" variant="ghost" icon={<Coins className="h-3.5 w-3.5" />}>
            Wallet
          </Button>
        </div>
      </div>

      <Panel title="Attempt summary" className="mt-4">
        <DetailList
          columns={3}
          items={[
            { label: 'Submitted', value: formatDateTime(attempt.submittedAt) },
            { label: 'Time taken', value: formatDuration(attempt.timeSpentSeconds) },
            { label: 'Points', value: `${attempt.earnedPoints} / ${attempt.possiblePoints}` },
            { label: 'Entry fee charged', value: `${formatCoins(attempt.entryFeeCharged)} QCoin` },
            { label: 'Reward paid', value: `${formatCoins(attempt.rewardPaid)} QCoin` },
            { label: 'Result', value: attempt.passed ? 'Passed' : 'Not passed' },
          ]}
        />
      </Panel>

      <Panel
        title="Question review"
        description={attempt.showExplanations ? 'Correct answers and explanations are shown below.' : undefined}
        className="mt-4"
        bodyClassName="p-0"
      >
        <ol className="divide-y divide-line">
          {questions.map((question, index) => {
            const selected = answers[question.id] ?? [];
            const correctIds = question.options.filter((o) => o.isCorrect).map((o) => o.id);
            const isCorrect =
              selected.length === correctIds.length && selected.every((s) => correctIds.includes(s)) && correctIds.length > 0;
            return (
              <li key={question.id} className="p-4">
                <div className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-2xs font-semibold',
                      isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
                    )}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink">{question.prompt}</p>
                    <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {question.options.map((option) => {
                        const wasSelected = selected.includes(option.id);
                        return (
                          <li
                            key={option.id}
                            className={cn(
                              'flex items-start gap-2 rounded border px-2.5 py-1.5 text-[13px]',
                              option.isCorrect && 'border-emerald-200 bg-emerald-50 text-emerald-900',
                              wasSelected && !option.isCorrect && 'border-red-200 bg-red-50 text-red-900',
                              !option.isCorrect && !wasSelected && 'border-line bg-white text-ink-muted',
                            )}
                          >
                            <span className="mt-0.5 shrink-0">
                              {option.isCorrect ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              ) : wasSelected ? (
                                <XCircle className="h-3.5 w-3.5 text-red-600" />
                              ) : (
                                <span className="block h-3.5 w-3.5" />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">{option.body}</span>
                            {wasSelected && <Badge tone="neutral">Your pick</Badge>}
                          </li>
                        );
                      })}
                    </ul>
                    {attempt.showExplanations && question.explanation && (
                      <p className="mt-2 rounded border border-line bg-canvas/70 px-2.5 py-2 text-xs leading-relaxed text-ink-soft">
                        {question.explanation}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </Panel>
    </div>
  );
}
