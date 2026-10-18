import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import endpoints, { type QuizSummary } from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { Avatar, Badge, RatingStars } from '@/components/ui/Data';
import { Card, CardBody, ErrorState, PageHeader, SkeletonList } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { QuizCard } from '@/features/quizzes/QuizCard';
import { formatDate, formatNumber } from '@/utils/format';
import { apiErrorMessage } from '@/services/api';

/** Public creator profile: real published content and computed reputation. */
export function PublicProfilePage() {
  const { id = '' } = useParams();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['public-profile', id],
    queryFn: () => endpoints.users.publicProfile(id),
    enabled: Boolean(id),
  });

  useDocumentTitle(data?.profile?.name ?? 'Profile');

  if (isLoading) return <SkeletonList count={2} />;

  if (isError || !data) {
    return (
      <ErrorState
        title="Profile unavailable"
        description={apiErrorMessage(error, 'This profile does not exist.')}
        action={<Button onClick={() => refetch()}>Try again</Button>}
      />
    );
  }

  const { profile, stats, reputation, publishedQuizzes } = data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar name={profile.name} src={profile.avatar?.url} size="lg" />
            {profile.name}
          </span>
        }
        description={profile.bio || undefined}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {publishedQuizzes.length > 0 ? (
            <>
              <h2 className="text-lg font-semibold text-zinc-900">Published quizzes</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                {publishedQuizzes.map((quiz: QuizSummary) => (
                  <QuizCard key={quiz._id} quiz={quiz} />
                ))}
              </div>
            </>
          ) : (
            <Card>
              <CardBody>
                <p className="text-sm text-zinc-500">This creator has no published quizzes yet.</p>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardBody>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Creator stats</p>
              <dl className="mt-3 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Published quizzes</dt>
                  <dd className="font-medium text-zinc-900">{formatNumber(stats.publishedQuizzes)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Published polls</dt>
                  <dd className="font-medium text-zinc-900">{formatNumber(stats.publishedPolls)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Member since</dt>
                  <dd className="font-medium text-zinc-900">{formatDate(profile.joinedAt)}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Reputation</p>
              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-xs text-zinc-500">Community rating</p>
                  <div className="mt-1">
                    <RatingStars value={reputation.community.score} count={reputation.community.count} size="md" />
                  </div>
                </div>
                {reputation.adminQuality.score !== null && (
                  <div>
                    <p className="text-xs text-zinc-500">Admin quality rating</p>
                    <p className="mt-1">
                      <Badge tone="brand">{reputation.adminQuality.score.toFixed(1)} / 5</Badge>
                    </p>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          <Link to="/explore/quizzes">
            <Button variant="outline" className="w-full">
              Explore more creators
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default PublicProfilePage;
