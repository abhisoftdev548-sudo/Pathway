import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import { api, ApiError, buildQuery, type Page } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useToast } from '@/components/ui/Toast';
import { PageHeading, Tabs, Badge } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Table';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/States';
import { formatRelative } from '@/lib/format';

interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export function NotificationsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);

  const path = `/notifications${buildQuery({ page, pageSize: 20, filter })}`;
  const query = useQuery<Page<Notification> & { unread: number }>({
    queryKey: qk.notifications({ page, filter }),
    queryFn: () => api.get(path),
    placeholderData: (prev) => prev,
  });

  const markRead = useMutation({
    mutationFn: (id?: string) => api.post('/notifications/read', id ? { id } : {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.notifications({ page, filter }) });
      queryClient.invalidateQueries({ queryKey: qk.me });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update notifications.'),
  });

  return (
    <>
      <PageHeading
        title="Notifications"
        description="Updates about your submissions, wallet and account."
        actions={
          (query.data?.unread ?? 0) > 0 ? (
            <Button size="sm" variant="secondary" icon={<CheckCheck className="h-3.5 w-3.5" />} loading={markRead.isPending} onClick={() => markRead.mutate()}>
              Mark all as read
            </Button>
          ) : undefined
        }
      />

      <Tabs
        className="mb-4"
        tabs={[
          { id: 'all', label: 'All' },
          { id: 'unread', label: 'Unread', count: query.data?.unread ?? 0 },
        ]}
        active={filter}
        onChange={(next) => {
          setFilter(next as 'all' | 'unread');
          setPage(1);
        }}
      />

      {query.isLoading ? (
        <div className="surface p-4">
          <LoadingBlock rows={5} />
        </div>
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !query.data?.items.length ? (
        <EmptyState
          icon={<Bell className="h-4 w-4" />}
          title="You're all caught up"
          description={
            filter === 'unread'
              ? 'You have no unread notifications.'
              : 'Notifications appear here when your submissions are reviewed, your wallet changes or you unlock an achievement.'
          }
        />
      ) : (
        <>
          <div className="surface divide-y divide-line">
            {query.data.items.map((notification) => (
              <div
                key={notification.id}
                className={`flex items-start gap-3 px-4 py-3 ${notification.read_at ? '' : 'bg-brand-50/40'}`}
              >
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                    notification.read_at ? 'bg-line-strong' : 'bg-brand-600'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-medium text-ink">{notification.title}</p>
                    {!notification.read_at && <Badge tone="brand">New</Badge>}
                    <span className="text-2xs text-ink-faint">{formatRelative(notification.created_at)}</span>
                  </div>
                  {notification.body && (
                    <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">{notification.body}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {notification.link && (
                    <Button to={notification.link} size="sm" variant="ghost" icon={<ExternalLink className="h-3.5 w-3.5" />}>
                      Open
                    </Button>
                  )}
                  {!notification.read_at && (
                    <Button size="sm" variant="ghost" onClick={() => markRead.mutate(notification.id)}>
                      Mark read
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {query.data.total > 0 && (
            <Pagination page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPage={setPage} />
          )}
        </>
      )}
    </>
  );
}
