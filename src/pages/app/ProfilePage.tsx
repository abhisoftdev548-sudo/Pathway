import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { PageHeading, Panel, Badge, DetailList } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { TextInput, TextArea } from '@/components/ui/Field';
import { ErrorState, LoadingBlock } from '@/components/ui/States';
import { formatCoins, formatDate, formatNumber, initials } from '@/lib/format';

export function ProfilePage() {
  const { user, wallet, refresh, permissions } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');

  const stats = useQuery<{ quizzesCreated: number; quizzesPublished: number; pollsPublished: number; attempts: number }>({
    queryKey: ['profile-stats', user?.id],
    queryFn: async () => {
      const [quizzes, polls, attempts] = await Promise.all([
        api.get<{ total: number }>('/quizzes/mine/list?page=1&pageSize=1'),
        api.get<{ total: number }>('/polls/mine/list?page=1&pageSize=1'),
        api.get<{ total: number }>('/attempts?page=1&pageSize=1'),
      ]);
      const approved = await api.get<{ total: number }>('/quizzes/mine/list?page=1&pageSize=1&status=approved');
      const published = await api.get<{ total: number }>('/polls/mine/list?page=1&pageSize=1&status=published');
      return {
        quizzesCreated: quizzes.total,
        quizzesPublished: approved.total,
        pollsPublished: published.total,
        attempts: attempts.total,
      };
    },
    enabled: Boolean(user),
  });

  const save = useMutation({
    mutationFn: () => api.patch('/auth/profile', { displayName, bio }),
    onSuccess: async () => {
      setEditing(false);
      await refresh();
      queryClient.invalidateQueries();
      toast.success('Profile updated.');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update your profile.'),
  });

  if (!user) return null;

  return (
    <>
      <PageHeading
        title="My profile"
        description="How you appear to other players and on leaderboards."
        actions={
          !editing ? (
            <Button size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(true)}>
              Edit profile
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          {editing ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate();
              }}
            >
              <TextInput
                label="Display name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                hint="2–48 characters."
                required
              />
              <TextArea
                label="Bio"
                rows={4}
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                hint="Up to 400 characters. Shown on your profile only."
              />
              <div className="flex gap-2">
                <Button type="submit" variant="primary" size="sm" loading={save.isPending}>
                  Save changes
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-100 text-base font-semibold text-brand-700">
                {initials(user.displayName)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[16px] font-semibold text-ink">{user.displayName}</h2>
                  <Badge tone={user.role === 'admin' ? 'brand' : user.role === 'creator' ? 'info' : 'neutral'}>
                    {user.role}
                  </Badge>
                  {user.accountStatus !== 'active' && <Badge tone="danger">{user.accountStatus.replace(/_/g, ' ')}</Badge>}
                </div>
                <p className="mt-0.5 text-[13px] text-ink-muted">
                  @{user.username} · {user.email}
                </p>
                {user.bio && <p className="mt-3 whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">{user.bio}</p>}
                <p className="mt-3 text-2xs text-ink-faint">Joined {formatDate(user.createdAt)}</p>
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Activity">
          {stats.isLoading ? (
            <LoadingBlock rows={4} />
          ) : stats.error ? (
            <ErrorState error={stats.error} onRetry={() => stats.refetch()} compact />
          ) : (
            <div className="space-y-2 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Quizzes created</span>
                <span className="tabular-nums text-ink">{formatNumber(stats.data?.quizzesCreated ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Quizzes published</span>
                <span className="tabular-nums text-ink">{formatNumber(stats.data?.quizzesPublished ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Polls published</span>
                <span className="tabular-nums text-ink">{formatNumber(stats.data?.pollsPublished ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Attempts completed</span>
                <span className="tabular-nums text-ink">{formatNumber(stats.data?.attempts ?? 0)}</span>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Permissions" className="mt-4">
        <DetailList
          columns={2}
          items={[
            { label: 'Create content', value: permissions.canCreate ? 'Yes' : 'No' },
            { label: 'Moderate content', value: permissions.canModerate ? 'Yes' : 'No' },
            { label: 'Manage users', value: permissions.canManageUsers ? 'Yes' : 'No' },
            { label: 'Manage QCoins', value: permissions.canManageQCoins ? 'Yes' : 'No' },
            { label: 'Manage platform configuration', value: permissions.canManageConfig ? 'Yes' : 'No' },
            { label: 'Export reports', value: permissions.canExportReports ? 'Yes' : 'No' },
          ]}
        />
        {permissions.canModerate && (
          <div className="mt-4 flex items-center gap-2 rounded-md border border-brand-200 bg-brand-50 px-3 py-2">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
            <p className="text-xs text-brand-800">
              You have administrator access.{' '}
              <a className="underline" href="/admin">
                Open the admin panel
              </a>
              .
            </p>
          </div>
        )}
      </Panel>

      <Panel title="QCoin summary" className="mt-4">
        <DetailList
          columns={2}
          items={[
            { label: 'Current balance', value: `${formatCoins(wallet?.balance ?? 0)} QCoin` },
            { label: 'Lifetime earned', value: `${formatCoins(wallet?.lifetimeEarned ?? 0)} QCoin` },
            { label: 'Lifetime spent', value: `${formatCoins(wallet?.lifetimeSpent ?? 0)} QCoin` },
          ]}
        />
      </Panel>
    </>
  );
}
