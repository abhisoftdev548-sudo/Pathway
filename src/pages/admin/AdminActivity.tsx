import { useQuery } from '@tanstack/react-query';
import { Activity } from 'lucide-react';
import { api } from '@/lib/api';
import { qk } from '@/lib/queries';
import { PageHeading, Panel, Badge } from '@/components/ui/Primitives';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/States';
import { MetadataCell, TimestampCell } from '@/components/patterns/LogTable';
import { titleCase } from '@/lib/format';

interface ActivityRow {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  actor_label: string;
  metadata: unknown;
  created_at: string;
}

export function AdminActivity() {
  const query = useQuery<{ items: ActivityRow[] }>({
    queryKey: qk.adminActivity(40),
    queryFn: () => api.get('/admin/activity?limit=40'),
  });

  const groupLabel = (action: string) => {
    if (action.startsWith('admin.')) return 'User management';
    if (action.startsWith('moderation.')) return 'Moderation';
    if (action.startsWith('qcoin.')) return 'QCoin';
    if (action.startsWith('config.')) return 'Configuration';
    if (action.startsWith('content.')) return 'Taxonomy';
    return 'Other';
  };

  return (
    <>
      <PageHeading
        title="Recent administrative activity"
        description="The most recent privileged actions, read straight from the audit log."
      />

      <Panel bodyClassName="p-0">
        {query.isLoading ? (
          <div className="p-4">
            <LoadingBlock rows={6} />
          </div>
        ) : query.error ? (
          <div className="p-4">
            <ErrorState error={query.error} onRetry={() => query.refetch()} compact />
          </div>
        ) : !query.data?.items.length ? (
          <div className="p-4">
            <EmptyState
              compact
              icon={<Activity className="h-4 w-4" />}
              title="No administrative activity recorded"
              description="Actions taken by administrators, moderators and QCoin operators are listed here."
            />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {query.data.items.map((row) => (
              <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-medium text-ink">{titleCase(row.action.replace(/\./g, ' '))}</span>
                    <Badge tone="neutral">{groupLabel(row.action)}</Badge>
                  </div>
                  <p className="mt-0.5 text-2xs text-ink-faint">
                    {row.actor_label}
                    {row.target_type && ` · ${row.target_type}${row.target_id ? ` ${row.target_id.slice(0, 8)}` : ''}`}
                  </p>
                  <div className="mt-1">
                    <MetadataCell value={row.metadata} />
                  </div>
                </div>
                <TimestampCell value={row.created_at} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
