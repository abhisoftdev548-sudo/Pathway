import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileEdit, PenLine, Vote } from 'lucide-react';
import endpoints, { type PollSummary, type QuizSummary } from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { EmptyState, ErrorState, PageHeader, SkeletonList } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { QuizCard } from '@/features/quizzes/QuizCard';
import { PollCard } from '@/features/polls/PollCard';
import { apiErrorMessage } from '@/services/api';

/** Drafts workspace: unpublished quizzes and polls still being written. */
export function CreatorDraftsPage() {
  useDocumentTitle('Drafts');

  const quizzes = useQuery({
    queryKey: ['quizzes', 'mine', 'DRAFT', 1],
    queryFn: () => endpoints.quizzes.mine({ status: 'DRAFT', limit: 24 }),
  });
  const polls = useQuery({
    queryKey: ['polls', 'mine', 'DRAFT', 1],
    queryFn: () => endpoints.polls.mine({ status: 'DRAFT', limit: 24 }),
  });

  const quizItems = quizzes.data?.items ?? [];
  const pollItems = polls.data?.items ?? [];
  const isLoading = quizzes.isLoading || polls.isLoading;
  const isError = quizzes.isError || polls.isError;

  return (
    <div>
      <PageHeader
        title="Drafts"
        description="Unfinished quizzes and polls — private until you submit them for review."
        actions={
          <div className="flex gap-2">
            <Link to="/creator/quizzes/new">
              <Button icon={<PenLine className="h-4 w-4" />}>New quiz</Button>
            </Link>
            <Link to="/creator/polls/new">
              <Button variant="outline" icon={<Vote className="h-4 w-4" />}>
                New poll
              </Button>
            </Link>
          </div>
        }
      />

      {isLoading ? (
        <SkeletonList count={3} />
      ) : isError ? (
        <ErrorState
          title="Could not load drafts"
          description={apiErrorMessage(quizzes.error ?? polls.error)}
          action={<Button onClick={() => window.location.reload()}>Try again</Button>}
        />
      ) : quizItems.length === 0 && pollItems.length === 0 ? (
        <EmptyState
          icon={<FileEdit className="h-6 w-6" />}
          title="No drafts"
          description="Start a quiz or poll and save it as a draft. Drafts stay private and can be edited anytime."
        />
      ) : (
        <div className="space-y-8">
          {quizItems.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">Quiz drafts</h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {quizItems.map((quiz: QuizSummary) => (
                  <QuizCard key={quiz._id} quiz={quiz} showStatus />
                ))}
              </div>
            </section>
          )}
          {pollItems.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">Poll drafts</h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {pollItems.map((poll: PollSummary) => (
                  <PollCard key={poll._id} poll={poll} showStatus />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export default CreatorDraftsPage;
