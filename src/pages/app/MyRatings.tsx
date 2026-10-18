import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Star, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useToast } from '@/components/ui/Toast';
import { PageHeading, Badge, Panel } from '@/components/ui/Primitives';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { StarRating } from '@/components/patterns/RatingSection';
import { formatDate } from '@/lib/format';
import { useState } from 'react';

interface MyRating {
  id: string;
  content_type: 'quiz' | 'poll';
  content_id: string;
  score: number;
  review_text: string;
  status: string;
  created_at: string;
  content_title: string;
}

export function MyRatings() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState<MyRating | null>(null);

  const query = useQuery<{ items: MyRating[] }>({
    queryKey: qk.ratings({ scope: 'mine' }),
    queryFn: () => api.get('/ratings/mine'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/ratings/${id}`),
    onSuccess: () => {
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: qk.ratings({ scope: 'mine' }) });
      toast.info('Your rating was removed.');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not remove that rating.'),
  });

  return (
    <>
      <PageHeading
        title="Ratings and reviews"
        description="Feedback you have left on quizzes and polls."
      />

      {query.isLoading ? (
        <Panel title="Your ratings">
          <LoadingBlock rows={4} />
        </Panel>
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !query.data?.items.length ? (
        <EmptyState
          icon={<Star className="h-4 w-4" />}
          title="You have not rated anything yet"
          description="Complete a quiz or vote in a poll, then leave a rating to help other players and the creator."
          action={
            <Button to="/app/quizzes" size="sm" variant="primary">
              Explore quizzes
            </Button>
          }
        />
      ) : (
        <Panel title={`${query.data.items.length} rating(s)`} bodyClassName="p-0">
          <ul className="divide-y divide-line">
            {query.data.items.map((rating) => (
              <li key={rating.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`/app/${rating.content_type === 'quiz' ? 'quizzes' : 'polls'}/${rating.content_id}`}
                      className="text-[13px] font-medium text-ink hover:text-brand-700"
                    >
                      {rating.content_title}
                    </a>
                    <Badge tone="neutral">{rating.content_type}</Badge>
                    {rating.status === 'hidden' && <Badge tone="danger">Hidden by moderator</Badge>}
                  </div>
                  <div className="mt-1">
                    <StarRating value={rating.score} readOnly size="sm" />
                  </div>
                  {rating.review_text && (
                    <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">{rating.review_text}</p>
                  )}
                  <p className="mt-1 text-2xs text-ink-faint">Last updated {formatDate(rating.created_at)}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    to={`/app/${rating.content_type === 'quiz' ? 'quizzes' : 'polls'}/${rating.content_id}`}
                  >
                    Open
                  </Button>
                  <IconButton
                    label="Remove rating"
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => setConfirmDelete(rating)}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Remove your rating?"
        description="Your score and review will be deleted. This cannot be undone."
        confirmLabel="Remove"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => confirmDelete && remove.mutate(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}
