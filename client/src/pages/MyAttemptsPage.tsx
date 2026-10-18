import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ListChecks } from 'lucide-react';
import { api } from '@/services/api';
import { useDocumentTitle } from '@/hooks';
import { Badge, Pagination, Table, Td } from '@/components/ui/Data';
import { EmptyState, ErrorState, PageHeader, SkeletonTable } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { formatDate, formatDuration, formatPercent } from '@/utils/format';
import { apiErrorMessage } from '@/services/api';

interface AttemptRow {
  _id: string;
  quiz?: { title?: string; slug?: string; difficulty?: string } | null;
  percentage?: number;
  score?: number;
  maxScore?: number;
  passed?: boolean;
  needsReview?: boolean;
  timeSpentSec?: number;
  submittedAt?: string;
  versionNumber?: number;
}

/** All quiz attempts by the current user (real history, paginated). */
export function MyAttemptsPage() {
  useDocumentTitle('My attempts');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['attempts', 'mine', page],
    queryFn: async () => {
      const res = await api.get('/users/me/attempts', { params: { page, limit: 15 } });
      return { items: res.data.data.items as AttemptRow[], meta: res.data.meta };
    },
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div>
      <PageHeader
        title="My attempts"
        description="Every quiz you have submitted, with server-verified scores."
      />

      {isLoading ? (
        <SkeletonTable rows={5} cols={5} />
      ) : isError ? (
        <ErrorState
          title="Could not load attempts"
          description={apiErrorMessage(error)}
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="h-6 w-6" />}
          title="No attempts yet"
          description="When you complete a quiz, every attempt will be listed here with its score and review."
          action={
            <Link to="/explore/quizzes">
              <Button>Explore quizzes</Button>
            </Link>
          }
        />
      ) : (
        <div className="surface overflow-hidden">
          <Table head={['Quiz', 'Submitted', 'Score', 'Time', 'Result']}>
            {items.map((attempt) => (
              <tr key={attempt._id} className="hover:bg-zinc-50/70">
                <Td>
                  <Link to={`/attempts/${attempt._id}`} className="font-medium text-zinc-900 hover:text-brand-700">
                    {attempt.quiz?.title ?? 'Quiz'}
                  </Link>
                  {attempt.versionNumber ? (
                    <p className="text-xs text-zinc-400">version {attempt.versionNumber}</p>
                  ) : null}
                </Td>
                <Td className="text-zinc-500">{formatDate(attempt.submittedAt)}</Td>
                <Td>
                  <span className="font-medium text-zinc-900">{formatPercent(attempt.percentage ?? 0, 1)}</span>
                  <span className="ml-1 text-xs text-zinc-400">
                    ({attempt.score ?? 0}/{attempt.maxScore ?? 0})
                  </span>
                </Td>
                <Td className="text-zinc-500">{formatDuration(attempt.timeSpentSec ?? 0)}</Td>
                <Td>
                  {attempt.needsReview ? (
                    <Badge tone="warning">In review</Badge>
                  ) : (
                    <Badge tone={attempt.passed ? 'success' : 'neutral'}>
                      {attempt.passed ? 'Passed' : 'Not passed'}
                    </Badge>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
          {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />}
        </div>
      )}
    </div>
  );
}

export default MyAttemptsPage;
