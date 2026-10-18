import { useQuery } from '@tanstack/react-query';
import { Award, Lock } from 'lucide-react';
import endpoints, { type AchievementDto } from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { Badge } from '@/components/ui/Data';
import { ErrorState, PageHeader, SkeletonList } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/utils/format';
import { cn } from '@/utils/cn';
import { apiErrorMessage } from '@/services/api';

/** Achievement catalog — earned/unearned state from real activity. */
export function AchievementsPage() {
  useDocumentTitle('Achievements');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => endpoints.users.myAchievements(),
  });

  const items = data?.items ?? [];
  const earnedCount = items.filter((a: AchievementDto) => a.earned).length;

  return (
    <div>
      <PageHeader
        title="Achievements"
        description="Milestones unlocked by real activity on the platform."
        actions={items.length > 0 ? <Badge tone="brand">{earnedCount} of {items.length} unlocked</Badge> : undefined}
      />

      {isLoading ? (
        <SkeletonList count={3} />
      ) : isError ? (
        <ErrorState
          title="Could not load achievements"
          description={apiErrorMessage(error)}
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      ) : items.length === 0 ? (
        <ErrorState title="No achievements defined" description="Achievement data is unavailable right now." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((achievement: AchievementDto) => (
            <div
              key={achievement.key}
              className={cn(
                'surface flex items-start gap-4 p-5',
                !achievement.earned && 'opacity-70'
              )}
            >
              <div
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
                  achievement.earned ? 'bg-amber-50 text-amber-600' : 'bg-zinc-100 text-zinc-400'
                )}
              >
                {achievement.earned ? <Award className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-zinc-900">{achievement.title}</p>
                  {achievement.earned && <Badge tone="success">Unlocked</Badge>}
                </div>
                <p className="mt-1 text-xs text-zinc-500">{achievement.description}</p>
                {achievement.earned && achievement.awardedAt && (
                  <p className="mt-2 text-xs text-zinc-400">Earned {formatDate(achievement.awardedAt)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AchievementsPage;
