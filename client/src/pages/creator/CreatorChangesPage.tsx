import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageSquareWarning, Pencil } from 'lucide-react';
import endpoints, { type PollSummary, type QuizSummary } from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { Badge, statusTone, STATUS_LABELS } from '@/components/ui/Data';
import { Card, CardBody, EmptyState, ErrorState, PageHeader, SkeletonList } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { apiErrorMessage } from '@/services/api';

/**
 * Change requests: moderator notes attached to submissions that need work.
 * Both quizzes and polls are listed with the exact feedback to address.
 */
export function CreatorChangesPage() {
  useDocumentTitle('Changes requested');

  const quizzes = useQuery({
    queryKey: ['quizzes', 'mine', 'CHANGES_REQUESTED', 1],
    queryFn: () => endpoints.quizzes.mine({ status: 'CHANGES_REQUESTED', limit: 24 }),
  });
  const polls = useQuery({
    queryKey: ['polls', 'mine', 'CHANGES_REQUESTED', 1],
    queryFn: () => endpoints.polls.mine({ status: 'CHANGES_REQUESTED', limit: 24 }),
  });

  const quizItems = quizzes.data?.items ?? [];
  const pollItems = polls.data?.items ?? [];
  const isLoading = quizzes.isLoading || polls.isLoading;
  const isError = quizzes.isError || polls.isError;

  const allItems = [
    ...quizItems.map((q: QuizSummary) => ({ kind: 'Quiz' as const, item: q })),
    ...pollItems.map((p: PollSummary) => ({ kind: 'Poll' as const, item: p })),
  ];

  return (
    <div>
      <PageHeader
        title="Changes requested"
        description="Moderators reviewed these submissions and left notes explaining what to fix before publication."
      />

      {isLoading ? (
        <SkeletonList count={2} />
      ) : isError ? (
        <ErrorState
          title="Could not load change requests"
          description={apiErrorMessage(quizzes.error ?? polls.error)}
          action={<Button onClick={() => window.location.reload()}>Try again</Button>}
        />
      ) : allItems.length === 0 ? (
        <EmptyState
          icon={<MessageSquareWarning className="h-6 w-6" />}
          title="No change requests"
          description="When moderators request changes, their notes appear here so you know exactly what to fix."
        />
      ) : (
        <div className="space-y-4">
          {allItems.map(({ kind, item }) => (
            <Card key={`${kind}-${item._id}`}>
              <CardBody>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge>{kind}</Badge>
                      <Badge tone={statusTone(item.status)}>{item.status ? STATUS_LABELS[item.status] : ''}</Badge>
                    </div>
                    <h2 className="mt-2 text-base font-semibold text-heading">{item.title}</h2>
                    {item.moderation?.changesRequestedNote && (
                      <div className="mt-3 rounded-lg border border-warning-soft bg-warning-soft px-4 py-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-warning">Moderator note</p>
                        <p className="mt-1 text-sm text-amber-900">{item.moderation.changesRequestedNote}</p>
                      </div>
                    )}
                    {item.moderation?.lastNotes && !item.moderation.changesRequestedNote && (
                      <p className="mt-2 text-sm text-body">{item.moderation.lastNotes}</p>
                    )}
                  </div>
                  <Link
                    to={
                      kind === 'Quiz'
                        ? `/creator/quizzes/${item._id}/edit`
                        : `/creator/polls/${item._id}/edit`
                    }
                  >
                    <Button size="sm" icon={<Pencil className="h-4 w-4" />}>
                      Edit & resubmit
                    </Button>
                  </Link>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default CreatorChangesPage;
