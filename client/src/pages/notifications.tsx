import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellRing, Check, CheckCheck, ChevronRight, Info, Sparkles, Trash2, Trophy, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge, Button, Card, EmptyState, Skeleton, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { ErrorBlock, PageHeader } from '@/components/common';
import { apiDelete, apiGet, apiPatch, apiPost, getApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Notification } from '@/lib/types';

interface NotificationResponse {
  items: Notification[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  unreadCount: number;
}

const typeMeta: Record<string, { icon: typeof Bell; label: string; tone: string }> = {
  achievement: { icon: Trophy, label: 'Achievement', tone: 'bg-amber-50 text-amber-700 ring-amber-200' },
  milestone: { icon: Sparkles, label: 'Milestone', tone: 'bg-brand-soft text-brand-deep ring-brand/20' },
  enrollment: { icon: UserPlus, label: 'Enrollment', tone: 'bg-sky-50 text-sky-700 ring-sky-200' },
  reminder: { icon: BellRing, label: 'Reminder', tone: 'bg-violet-50 text-violet-700 ring-violet-200' },
  system: { icon: Info, label: 'System', tone: 'bg-canvas text-ink/70 ring-line' },
};

const filters = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
] as const;

export function Notifications() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['notifications', { filter, page }],
    queryFn: () => apiGet<NotificationResponse>('/me/notifications', { params: { page, limit: 20, ...(filter === 'unread' ? { unreadOnly: 'true' } : {}) } }),
    refetchOnWindowFocus: true,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const markRead = useMutation({
    mutationFn: (id: string) => apiPatch(`/me/notifications/${id}/read`, {}),
    onSuccess: refresh,
    onError: (error) => toast.error(getApiError(error).message),
  });

  const markAll = useMutation({
    mutationFn: () => apiPost('/me/notifications/read-all', {}),
    onSuccess: (data) => {
      toast.success(`Marked ${(data as { updated?: number })?.updated ?? 0} notification(s) as read`);
      refresh();
    },
    onError: (error) => toast.error(getApiError(error).message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/me/notifications/${id}`),
    onSuccess: () => {
      toast.success('Notification removed');
      refresh();
    },
    onError: (error) => toast.error(getApiError(error).message),
  });

  const unreadCount = query.data?.unreadCount ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Milestones, achievements and system messages tied to your learning. Read state is stored server-side."
        actions={
          <>
            <Button variant="outline" disabled={unreadCount === 0} loading={markAll.isPending} onClick={() => markAll.mutate()}><CheckCheck /> Mark all read</Button>
            <Button asChild variant="outline"><Link to="/today"><BellRing /> Today's plan</Link></Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={(value) => { setFilter(value as typeof filter); setPage(1); }}>
          <TabsList className="inline-flex gap-1 rounded-xl bg-surface p-1 ring-1 ring-line">
            {filters.map((item) => (
              <TabsTrigger key={item.value} value={item.value} className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted data-[state=active]:bg-brand-soft data-[state=active]:text-brand-deep">
                {item.label}
                {item.value === 'unread' && unreadCount > 0 ? <span className="ml-1.5 rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">{unreadCount}</span> : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <p className="text-xs text-muted">{query.data?.pagination.total ?? 0} notification{query.data?.pagination.total === 1 ? '' : 's'}</p>
      </div>

      {query.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-20 w-full" />)}</div>
      ) : query.isError ? (
        <ErrorBlock message={getApiError(query.error).message} onRetry={() => void query.refetch()} />
      ) : !query.data || query.data.items.length === 0 ? (
        <EmptyState
          icon={<Bell className="size-6" />}
          title={filter === 'unread' ? 'No unread notifications' : 'Your inbox is clear'}
          description={filter === 'unread' ? 'You’re all caught up. New milestones and streak reminders will appear here.' : 'Completing tasks, finishing roadmaps and earning achievements will produce notifications you can revisit here.'}
          action={<Button asChild variant="outline"><Link to="/today">Open today's plan <ChevronRight /></Link></Button>}
        />
      ) : (
        <div className="space-y-4">
          <Card className="divide-y divide-line/60">
            {query.data.items.map((notification) => {
              const meta = typeMeta[notification.type] ?? typeMeta.system;
              const Icon = meta.icon;
              return (
                <div key={notification.id} className={cn('flex items-start gap-3 px-4 py-4 transition', !notification.read && 'bg-brand-soft/20')}>
                  <span className={cn('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset', meta.tone)}><Icon className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-sm font-semibold text-ink">{notification.title}</p>
                      {!notification.read ? <span className="size-1.5 rounded-full bg-accent" aria-label="Unread" /> : null}
                      <Badge tone={meta.tone} className="text-[10px]">{meta.label}</Badge>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{notification.message}</p>
                    <p className="mt-1 text-[11px] text-muted">{new Date(notification.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    {notification.link ? (
                      <Link to={notification.link} onClick={() => { if (!notification.read) markRead.mutate(notification.id); }} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
                        Open <ChevronRight className="size-3" />
                      </Link>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!notification.read ? (
                      <Button variant="ghost" size="icon-sm" aria-label="Mark as read" onClick={() => markRead.mutate(notification.id)}><Check /></Button>
                    ) : null}
                    <Button variant="ghost" size="icon-sm" aria-label="Delete notification" onClick={() => remove.mutate(notification.id)}><Trash2 /></Button>
                  </div>
                </div>
              );
            })}
          </Card>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">Page {query.data.pagination.page} of {query.data.pagination.totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= query.data.pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
