import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap } from 'lucide-react';
import endpoints, { type QuizAdminDto } from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { Badge, Table, Td, STATUS_LABELS, statusTone, Pagination } from '@/components/ui/Data';
import { Card, CardBody, CardHeader, EmptyState, ErrorState, PageHeader, SkeletonTable } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { ModerationActions } from '@/features/admin/AdminShared';
import { formatDate, formatNumber } from '@/utils/format';
import { apiErrorMessage } from '@/services/api';

/**
 * Quiz approval queue: inspect full submissions (answer keys via detail link),
 * then approve / request changes / reject with quality ratings and notes.
 */
export function AdminQuizApprovalsPage() {
  useDocumentTitle('Quiz approvals');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'quiz-approvals', page],
    queryFn: () => endpoints.quizzes.moderation({ status: 'PENDING_REVIEW', page, limit: 10 }),
    placeholderData: (prev) => prev,
    refetchInterval: 30000,
  });

  const items = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div>
      <PageHeader
        title="Quiz approvals"
        description="Review submitted quizzes: check questions, answer keys, and fee/reward configuration before publication."
      />

      {isLoading ? (
        <SkeletonTable rows={4} cols={5} />
      ) : isError ? (
        <ErrorState
          title="Could not load the review queue"
          description={apiErrorMessage(error)}
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="h-6 w-6" />}
          title="Review queue is clear"
          description="New quiz submissions will appear here for moderation."
        />
      ) : (
        <>
          <div className="space-y-4">
            {items.map((quiz: QuizAdminDto) => (
              <Card key={quiz._id}>
                <CardHeader
                  title={quiz.title}
                  subtitle={`by ${quiz.creator?.name ?? 'Unknown'} · ${formatDate(quiz.updatedAt)}`}
                  actions={
                    <div className="flex items-center gap-2">
                      <Badge tone={statusTone(quiz.status)}>{quiz.status ? STATUS_LABELS[quiz.status] : ''}</Badge>
                      {(quiz.questions?.length ?? 0) > 0 && (
                        <Badge>{formatNumber(quiz.questions?.length)} questions</Badge>
                      )}
                    </div>
                  }
                />
                <CardBody>
                  {quiz.description && <p className="text-sm text-body">{quiz.description}</p>}

                  <dl className="mt-3 grid grid-cols-2 gap-3 text-xs text-body sm:grid-cols-4">
                    <div>
                      <dt>Difficulty</dt>
                      <dd className="font-medium text-heading">{quiz.difficulty}</dd>
                    </div>
                    <div>
                      <dt>Passing score</dt>
                      <dd className="font-medium text-heading">{quiz.passingScore}%</dd>
                    </div>
                    <div>
                      <dt>Entry fee</dt>
                      <dd className="font-medium text-heading">{formatNumber(quiz.entryFee ?? 0)} QCoins</dd>
                    </div>
                    <div>
                      <dt>Reward</dt>
                      <dd className="font-medium text-heading">
                        {formatNumber(quiz.reward ?? 0)} QCoins
                        {quiz.rewardMode === 'TOP_PERCENT' ? ` (top ${quiz.topPercent}%)` : ''}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpanded(expanded === quiz._id ? null : quiz._id)}
                    >
                      {expanded === quiz._id ? 'Hide questions' : `Inspect ${quiz.questions?.length ?? 0} questions`}
                    </Button>
                    <ModerationActions targetType="quiz" targetId={quiz._id} status={quiz.status} onDone={() => refetch()} />
                  </div>

                  {expanded === quiz._id && (
                    <div className="mt-4 space-y-3 rounded-lg bg-background p-4">
                      {(quiz.questions ?? []).map((q, i) => (
                        <div key={q.id} className="rounded-md bg-white p-3 text-sm">
                          <p className="font-medium text-heading">
                            {i + 1}. {q.text}
                          </p>
                          <p className="mt-1 text-xs text-body">
                            Correct answer:{' '}
                            {q.type === 'TRUE_FALSE'
                              ? String(q.correctBoolean)
                              : q.type === 'FILL_BLANK'
                                ? (q.correctAnswers ?? []).join(' / ')
                                : q.type === 'SHORT_ANSWER'
                                  ? `keywords: ${(q.evaluationRules?.keywords ?? []).map((k) => k.text).join(', ')}`
                                  : (q.options ?? [])
                                      .filter((o) => o.isCorrect)
                                      .map((o) => o.text)
                                      .join(', ')}
                          </p>
                          {q.explanation && (
                            <p className="mt-1 text-xs text-body">Explanation: {q.explanation}</p>
                          )}
                        </div>
                      ))}
                      <Link to={`/quizzes/${quiz.slug}`} className="text-xs font-medium text-brand-600 hover:text-brand-700">
                        Open participant view →
                      </Link>
                    </div>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
          {meta && (
            <div className="mt-6">
              <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default AdminQuizApprovalsPage;
