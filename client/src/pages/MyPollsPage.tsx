import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, PenLine } from 'lucide-react';
import endpoints from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { Pagination } from '@/components/ui/Data';
import { EmptyState, ErrorState, PageHeader, SkeletonList } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { PollCard } from '@/features/polls/PollCard';
import { apiErrorMessage } from '@/services/api';

/** My polls — every poll the current user created, any status. */
export function MyPollsPage() {
  useDocumentTitle('My polls');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['polls', 'mine', page],
    queryFn: () => endpoints.polls.mine({ page, limit: 12 }),
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div>
      <PageHeader
        title="My polls"
        description="All polls you have created — drafts, in review, and open for votes."
        actions={
          <Link to="/creator/polls/new">
            <Button icon={<PenLine className="h-4 w-4" />}>New poll</Button>
          </Link>
        }
      />

      {isLoading ? (
        <SkeletonList count={3} />
      ) : isError ? (
        <ErrorState
          title="Could not load your polls"
          description={apiErrorMessage(error)}
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-6 w-6" />}
          title="No polls yet"
          description="Ask the community something. Drafts save automatically and go live after moderator approval."
          action={
            <Link to="/creator/polls/new">
              <Button>Create a poll</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((poll) => (
              <PollCard key={poll._id} poll={poll} showStatus />
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

export default MyPollsPage;
