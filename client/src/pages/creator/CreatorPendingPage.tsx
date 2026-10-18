import { useQuery } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import endpoints, { type PollSummary, type QuizSummary } from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { EmptyState, ErrorState, PageHeader, SkeletonList } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { QuizCard } from '@/features/quizzes/QuizCard';
import { PollCard } from '@/features/polls/PollCard';
import { apiErrorMessage } from '@/services/api';

/** Content submitted for review and awaiting a moderation decision. */
export function CreatorPendingPage() {
  useDocumentTitle('Pending reviews');

  const quizzes = useQuery({
    queryKey: ['quizzes', 'mine', 'PENDING_REVIEW', 1],
    queryFn: () => endpoints.quizzes.mine({ status: 'PENDING_REVIEW', limit: 24 }),
  });
  const polls = useQuery({
    queryKey: ['polls', 'mine', 'PENDING_REVIEW', 1],
    queryFn: () => endpoints.polls.mine({ status: 'PENDING_REVIEW', limit: 24 }),
  });

  const quizItems = quizzes.data?.items ?? [];
  const pollItems = polls.data?.items ?? [];
  const isLoading = quizzes.isLoading || polls.isLoading;
  const isError = quizzes.isError || polls.isError;

  return (
    <div>
      <PageHeader
        title="Pending reviews"
        description="Submissions waiting for a moderation decision. This usually takes a short while."
      />

      {isLoading ? (
        <SkeletonList count={3} />
      ) : isError ? (
        <ErrorState
          title="Could not load pending submissions"
          description={apiErrorMessage(quizzes.error ?? polls.error)}
          action={<Button onClick={() => window.location.reload()}>Try again</Button>}
        />
      ) : quizItems.length === 0 && pollItems.length === 0 ? (
        <EmptyState
          icon={<Clock className="h-6 w-6" />}
          title="Nothing pending"
          description="Quizzes and polls submitted for review will appear here until moderators decide."
        />
      ) : (
        <div className="space-y-8">
          {quizItems.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Quizzes in review</h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {quizItems.map((quiz: QuizSummary) => (
                  <QuizCard key={quiz._id} quiz={quiz} showStatus />
                ))}
              </div>
            </section>
          )}
          {pollItems.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Polls in review</h2>
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

export default CreatorPendingPage;
