import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import endpoints, { type RatingDto } from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { Avatar, Pagination, RatingStars } from '@/components/ui/Data';
import { EmptyState, ErrorState, PageHeader, SkeletonList } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/utils/format';
import { apiErrorMessage } from '@/services/api';
void endpoints;

/** Ratings & reviews written by the current user. */
export function RatingsReviewsPage() {
  useDocumentTitle('Ratings & reviews');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['my-ratings', page],
    queryFn: async () => {
      const { api } = await import('@/services/api');
      const res = await api.get('/users/me/ratings', { params: { page, limit: 12 } });
      return {
        items: res.data.data.items as RatingDto[],
        meta: res.data.meta,
      };
    },
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div>
      <PageHeader
        title="Ratings & reviews"
        description="Feedback you have left on quizzes and polls you participated in."
      />

      {isLoading ? (
        <SkeletonList count={3} />
      ) : isError ? (
        <ErrorState
          title="Could not load your ratings"
          description={apiErrorMessage(error)}
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Star className="h-6 w-6" />}
          title="No ratings yet"
          description="After you complete a quiz or vote in a poll, you can rate it here."
          action={
            <Link to="/explore/quizzes">
              <Button variant="outline">Explore content</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="space-y-4">
            {items.map((rating) => (
              <div key={rating._id} className="surface p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-heading">
                      {rating.target?.title ?? (rating.targetType === 'QUIZ' ? 'Quiz' : 'Poll')}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {rating.targetType === 'QUIZ' ? 'Quiz' : 'Poll'} · {formatDate(rating.createdAt)}
                    </p>
                  </div>
                  <RatingStars value={rating.score} size="md" />
                </div>
                {rating.review && <p className="mt-3 text-sm text-body">{rating.review}</p>}
              </div>
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

export default RatingsReviewsPage;
