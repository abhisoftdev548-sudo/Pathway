import { useQuery } from '@tanstack/react-query';
import * as icons from 'lucide-react';
import { Trophy } from 'lucide-react';
import { api } from '@/lib/api';
import { qk } from '@/lib/queries';
import { PageHeading, Panel, Badge } from '@/components/ui/Primitives';
import { EmptyState, ErrorState, CardSkeleton } from '@/components/ui/States';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

interface Achievement {
  code: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: string | null;
}

function IconFor({ name, className }: { name: string; className?: string }) {
  const set = icons as unknown as Record<string, React.ComponentType<{ className?: string }>>;
  const Component = set[name] ?? Trophy;
  return <Component className={className} />;
}

export function AchievementsPage() {
  const query = useQuery<{ items: Achievement[]; earnedCount: number }>({
    queryKey: qk.achievements,
    queryFn: () => api.get('/achievements'),
  });

  return (
    <>
      <PageHeading
        title="Achievements"
        description="Awards are calculated from your recorded activity. Nothing here is granted manually."
      />

      {query.isLoading ? (
        <CardSkeleton count={6} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !query.data?.items.length ? (
        <EmptyState
          icon={<Trophy className="h-4 w-4" />}
          title="No achievements are configured"
          description="Achievement definitions are managed by administrators. None have been set up yet."
        />
      ) : (
        <>
          <Panel
            title="Progress"
            description={`${query.data.earnedCount} of ${query.data.items.length} unlocked`}
            className="mb-4"
          >
            <div className="h-2 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-brand-600 transition-all"
                style={{ width: `${(query.data.earnedCount / query.data.items.length) * 100}%` }}
              />
            </div>
          </Panel>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {query.data.items.map((achievement) => (
              <div
                key={achievement.code}
                className={cn(
                  'surface p-4',
                  !achievement.earnedAt && 'border-dashed bg-canvas/50',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-md',
                      achievement.earnedAt ? 'bg-brand-50 text-brand-600' : 'bg-canvas text-ink-faint ring-1 ring-line',
                    )}
                  >
                    <IconFor name={achievement.icon} className="h-4 w-4" />
                  </span>
                  {achievement.earnedAt ? (
                    <Badge tone="success">Unlocked</Badge>
                  ) : (
                    <Badge tone="neutral">Locked</Badge>
                  )}
                </div>
                <h3 className="mt-3 text-[13px] font-semibold text-ink">{achievement.name}</h3>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">{achievement.description}</p>
                {achievement.earnedAt && (
                  <p className="mt-2 border-t border-line pt-2 text-2xs text-ink-faint">
                    Earned {formatDate(achievement.earnedAt)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
