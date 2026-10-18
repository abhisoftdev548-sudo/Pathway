import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, CheckCircle2 } from 'lucide-react';
import endpoints, { type NotificationDto } from '@/services/endpoints';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/hooks';
import { Badge, Pagination } from '@/components/ui/Data';
import { EmptyState, ErrorState, PageHeader, SkeletonList } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/Menu';
import { formatRelative } from '@/utils/format';
import { cn } from '@/utils/cn';
import { apiErrorMessage } from '@/services/api';

/** Notification inbox with read/unread management. */
export function NotificationsPage() {
  useDocumentTitle('Notifications');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['notifications', filter, page],
    queryFn: () => endpoints.notifications.list({ page, limit: 15, unread: filter === 'unread' ? 'true' : undefined }),
    placeholderData: (prev) => prev,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => endpoints.notifications.markRead(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAll = useMutation({
    mutationFn: () => endpoints.notifications.markAllRead(),
    onSuccess: (result) => {
      toast.success(`${result.marked} notifications marked as read`);
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Moderation decisions, rewards, ratings, and platform updates."
        actions={
          unreadCount > 0 ? (
            <Button variant="outline" size="sm" onClick={() => markAll.mutate()} loading={markAll.isPending} icon={<CheckCheck className="h-4 w-4" />}>
              Mark all read
            </Button>
          ) : undefined
        }
      />

      <div className="mb-5">
        <SegmentedControl
          options={[
            { value: 'all' as const, label: 'All' },
            { value: 'unread' as const, label: `Unread${unreadCount ? ` (${unreadCount})` : ''}` },
          ]}
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
        />
      </div>

      {isLoading ? (
        <SkeletonList count={4} />
      ) : isError ? (
        <ErrorState
          title="Could not load notifications"
          description={apiErrorMessage(error)}
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-6 w-6" />}
          title={filter === 'unread' ? 'All caught up' : 'No notifications yet'}
          description={
            filter === 'unread'
              ? 'You have no unread notifications.'
              : 'When something happens on your content or account, it will appear here.'
          }
        />
      ) : (
        <>
          <div className="surface divide-y divide-zinc-100 overflow-hidden">
            {items.map((notification) => (
              <div
                key={notification._id}
                className={cn(
                  'flex items-start gap-3 px-5 py-4',
                  !notification.readAt && 'bg-brand-50/50'
                )}
              >
                <div
                  className={cn(
                    'mt-1 h-2 w-2 shrink-0 rounded-full',
                    notification.readAt ? 'bg-zinc-200' : 'bg-brand-500'
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className={cn('text-sm', notification.readAt ? 'text-zinc-700' : 'font-medium text-zinc-900')}>
                      {notification.title}
                    </p>
                    <span className="shrink-0 text-xs text-zinc-400">{formatRelative(notification.createdAt)}</span>
                  </div>
                  {notification.body && <p className="mt-1 text-sm text-zinc-500">{notification.body}</p>}
                  <div className="mt-2 flex items-center gap-3">
                    {notification.link && (
                      <Link to={notification.link} className="text-xs font-medium text-brand-600 hover:text-brand-700">
                        View details →
                      </Link>
                    )}
                    {!notification.readAt && (
                      <button
                        type="button"
                        onClick={() => markRead.mutate(notification._id)}
                        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Mark read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default NotificationsPage;
