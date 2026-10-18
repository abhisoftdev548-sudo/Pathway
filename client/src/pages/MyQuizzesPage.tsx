import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, PenLine } from 'lucide-react';
import endpoints from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { Pagination, STATUS_LABELS } from '@/components/ui/Data';
import { EmptyState, ErrorState, PageHeader, SkeletonList } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { QuizCard } from '@/features/quizzes/QuizCard';
import { apiErrorMessage } from '@/services/api';
import { CONTENT_STATUS } from '@/utils/constants';

/** My quizzes — every quiz the current user created, any status. */
export function MyQuizzesPage() {
  useDocumentTitle('My quizzes');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['quizzes', 'mine', status, page],
    queryFn: () => endpoints.quizzes.mine({ status: status || undefined, page, limit: 12 }),
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div>
      <PageHeader
        title="My quizzes"
        description="All quizzes you have created — drafts, in review, and published."
        actions={
          <Link to="/creator/quizzes/new">
            <Button icon={<PenLine className="h-4 w-4" />}>New quiz</Button>
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <FilterChip active={status === ''} onClick={() => { setStatus(''); setPage(1); }}>
          All
        </FilterChip>
        {Object.values(CONTENT_STATUS)
          .filter((s) => s !== 'ARCHIVED')
          .map((s) => (
            <FilterChip key={s} active={status === s} onClick={() => { setStatus(s); setPage(1); }}>
              {STATUS_LABELS[s] ?? s}
            </FilterChip>
          ))}
      </div>

      {isLoading ? (
        <SkeletonList count={3} />
      ) : isError ? (
        <ErrorState
          title="Could not load your quizzes"
          description={apiErrorMessage(error)}
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title={status ? `No ${STATUS_LABELS[status]?.toLowerCase() ?? status.toLowerCase()} quizzes` : 'No quizzes yet'}
          description="Create your first quiz, save it as a draft, and submit it for review when it is ready."
          action={
            <Link to="/creator/quizzes/new">
              <Button>Create a quiz</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((quiz) => (
              <QuizCard key={quiz._id} quiz={quiz} showStatus />
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

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-full bg-heading px-3.5 py-1.5 text-xs font-medium text-white'
          : 'rounded-full border border-line bg-white px-3.5 py-1.5 text-xs font-medium text-body hover:border-line-strong'
      }
    >
      {children}
    </button>
  );
}

export default MyQuizzesPage;
