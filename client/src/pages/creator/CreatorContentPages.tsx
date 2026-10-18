import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, FileText, PenLine } from 'lucide-react';
import endpoints, { type PollSummary, type QuizSummary } from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { Pagination } from '@/components/ui/Data';
import { EmptyState, ErrorState, PageHeader, SkeletonList } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { QuizCard } from '@/features/quizzes/QuizCard';
import { PollCard } from '@/features/polls/PollCard';
import { apiErrorMessage } from '@/services/api';

/**
 * Shared list implementation for creator status-filtered workspaces.
 * Each page below is its own route with its own real API query.
 */
function CreatorList({
  title,
  description,
  kind,
  status,
  emptyTitle,
  emptyDescription,
}: {
  title: string;
  description: string;
  kind: 'quizzes' | 'polls';
  status?: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  useDocumentTitle(title);
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: [kind, 'mine', status ?? 'ALL', page],
    queryFn: () =>
      kind === 'quizzes'
        ? endpoints.quizzes.mine({ status, page, limit: 12 })
        : endpoints.polls.mine({ status, page, limit: 12 }),
    placeholderData: (prev) => prev,
  });

  const items = query.data?.items ?? [];
  const meta = query.data?.meta;

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Link to={kind === 'quizzes' ? '/creator/quizzes/new' : '/creator/polls/new'}>
            <Button icon={<PenLine className="h-4 w-4" />}>New {kind === 'quizzes' ? 'quiz' : 'poll'}</Button>
          </Link>
        }
      />

      {query.isLoading ? (
        <SkeletonList count={3} />
      ) : query.isError ? (
        <ErrorState
          title={`Could not load ${kind}`}
          description={apiErrorMessage(query.error)}
          action={<Button onClick={() => query.refetch()}>Try again</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={kind === 'quizzes' ? <FileText className="h-6 w-6" /> : <ClipboardList className="h-6 w-6" />}
          title={emptyTitle}
          description={emptyDescription}
          action={
            <Link to={kind === 'quizzes' ? '/creator/quizzes/new' : '/creator/polls/new'}>
              <Button variant="outline">Create {kind === 'quizzes' ? 'a quiz' : 'a poll'}</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) =>
              kind === 'quizzes' ? (
                <QuizCard key={item._id} quiz={item as QuizSummary} showStatus />
              ) : (
                <PollCard key={item._id} poll={item as unknown as PollSummary} showStatus />
              )
            )}
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

export function CreatorQuizzesPage() {
  return (
    <CreatorList
      title="My published quizzes"
      description="Quizzes that are approved and visible to participants."
      kind="quizzes"
      status="APPROVED"
      emptyTitle="No published quizzes yet"
      emptyDescription="Submit a quiz for review — once approved, it appears here with live performance data."
    />
  );
}

export function CreatorPollsPage() {
  return (
    <CreatorList
      title="My published polls"
      description="Polls that are approved and open to the community."
      kind="polls"
      status="APPROVED"
      emptyTitle="No published polls yet"
      emptyDescription="Submit a poll for review — once approved, it collects votes here."
    />
  );
}

export function CreatorDraftsPage() {
  return (
    <>
      <CreatorList
        title="Drafts"
        description="Unfinished quizzes — saved automatically as you work."
        kind="quizzes"
        status="DRAFT"
        emptyTitle="No drafts"
        emptyDescription="Start a quiz and save it as a draft. It stays private until you submit it for review."
      />
    </>
  );
}

export function CreatorPendingPage() {
  return (
    <CreatorList
      title="Pending reviews"
      description="Submissions waiting for a moderation decision."
      kind="quizzes"
      status="PENDING_REVIEW"
      emptyTitle="Nothing pending"
      emptyDescription="Quizzes and polls submitted for review will appear here until moderators decide."
    />
  );
}

export function CreatorChangesPage() {
  return (
    <CreatorList
      title="Changes requested"
      description="Submissions a moderator reviewed and wants improved before publication."
      kind="quizzes"
      status="CHANGES_REQUESTED"
      emptyTitle="No change requests"
      emptyDescription="When moderators request changes, the notes they left appear here so you know exactly what to fix."
    />
  );
}

export default CreatorQuizzesPage;
