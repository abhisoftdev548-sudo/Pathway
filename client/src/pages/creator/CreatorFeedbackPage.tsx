import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import endpoints, { type RatingDto } from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { Avatar, Pagination, RatingStars } from '@/components/ui/Data';
import { EmptyState, ErrorState, PageHeader, SkeletonList } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/utils/format';
import { apiErrorMessage } from '@/services/api';

/** Ratings and reviews received on the creator's content. */
export function CreatorFeedbackPage() {
  useDocumentTitle('Ratings & feedback');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['creator-feedback', page],
    queryFn: () => endpoints.ratings.creatorFeedback({ page, limit: 12 }),
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div>
      <PageHeader
        title="Ratings & feedback"
        description="What participants are saying about your published content."
      />

      {isLoading ? (
        <SkeletonList count={3} />
      ) : isError ? (
        <ErrorState
          title="Could not load feedback"
          description={apiErrorMessage(error)}
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Star className="h-6 w-6" />}
          title="No feedback yet"
          description="Ratings and reviews from participants will appear here after they engage with your content."
        />
      ) : (
        <>
          <div className="space-y-4">
            {items.map((rating: RatingDto) => (
              <div key={rating._id} className="surface p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={rating.user?.name ?? 'Member'} src={rating.user?.avatar?.url} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-heading">{rating.user?.name ?? 'Member'}</p>
                      <p className="text-xs text-muted">
                        on{' '}
                        {rating.target?.title ?? (rating.targetType === 'QUIZ' ? 'a quiz' : 'a poll')} ·{' '}
                        {formatDate(rating.createdAt)}
                      </p>
                    </div>
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

export default CreatorFeedbackPage;
