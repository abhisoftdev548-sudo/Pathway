import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Laptop, LogOut, MonitorSmartphone } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { PageHeading, Panel, Badge, DetailList } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { ErrorState, InlineError, LoadingBlock } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { formatRelative } from '@/lib/format';

interface Session {
  id: string;
  created_at: string;
  expires_at: string;
  last_used_at: string | null;
  ip: string | null;
  user_agent: string | null;
  current: boolean;
}

export function SettingsPage() {
  const { user, signOut } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState(false);

  const sessions = useQuery<{ items: Session[] }>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/auth/sessions'),
  });

  const changePassword = useMutation({
    mutationFn: () => api.post('/auth/password', { currentPassword: current, newPassword: next }),
    onSuccess: () => {
      setCurrent('');
      setNext('');
      toast.success('Your password has been changed.');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not change your password.'),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.del(`/auth/sessions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.info('Session signed out.');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not sign out that session.'),
  });

  return (
    <>
      <PageHeading title="Settings" description="Account security and active sessions." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Change password">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              changePassword.mutate();
            }}
          >
            <TextInput
              label="Current password"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              error={changePassword.error instanceof ApiError ? changePassword.error.fieldErrors.currentPassword : undefined}
              required
            />
            <TextInput
              label="New password"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
              error={changePassword.error instanceof ApiError ? changePassword.error.fieldErrors.newPassword : undefined}
              hint="At least 10 characters, including a letter and a number."
              required
            />
            {changePassword.error instanceof ApiError && !changePassword.error.fieldErrors.currentPassword && (
              <InlineError message={changePassword.error.message} />
            )}
            <Button type="submit" variant="primary" size="sm" loading={changePassword.isPending} icon={<KeyRound className="h-3.5 w-3.5" />}>
              Update password
            </Button>
          </form>
        </Panel>

        <Panel title="Account">
          <DetailList
            columns={1}
            items={[
              { label: 'Email', value: user?.email },
              { label: 'Username', value: `@${user?.username}` },
              { label: 'Role', value: user?.role },
              { label: 'Status', value: <Badge tone={user?.accountStatus === 'active' ? 'success' : 'danger'}>{user?.accountStatus?.replace(/_/g, ' ')}</Badge> },
            ]}
          />
          <p className="mt-4 text-xs leading-relaxed text-ink-muted">
            Email and username changes are handled by an administrator. Contact support from the Help and Support page if you
            need one.
          </p>
        </Panel>
      </div>

      <Panel
        title="Active sessions"
        description="Devices currently signed in to your account."
        className="mt-4"
        actions={
          <Button size="sm" variant="secondary" icon={<LogOut className="h-3.5 w-3.5" />} onClick={() => setConfirm(true)}>
            Sign out everywhere
          </Button>
        }
        bodyClassName="p-0"
      >
        {sessions.isLoading ? (
          <div className="p-4">
            <LoadingBlock rows={3} />
          </div>
        ) : sessions.error ? (
          <div className="p-4">
            <ErrorState error={sessions.error} onRetry={() => sessions.refetch()} compact />
          </div>
        ) : !sessions.data?.items.length ? (
          <p className="p-4 text-[13px] text-ink-muted">No active sessions recorded.</p>
        ) : (
          <ul className="divide-y divide-line">
            {sessions.data.items.map((session) => (
              <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <MonitorSmartphone className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-medium text-ink">
                        {session.user_agent ? String(session.user_agent).slice(0, 60) : 'Unknown device'}
                      </span>
                      {session.current && <Badge tone="brand">This device</Badge>}
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-2xs text-ink-faint">
                      <Laptop className="h-3 w-3" />
                      {session.ip ?? 'Unknown IP'}
                      <span>· Last used {formatRelative(session.last_used_at ?? session.created_at)}</span>
                      <span>· Expires {formatRelative(session.expires_at)}</span>
                    </p>
                  </div>
                </div>
                {!session.current && (
                  <Button size="sm" variant="ghost" loading={revoke.isPending} onClick={() => revoke.mutate(session.id)}>
                    Sign out
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <ConfirmDialog
        open={confirm}
        title="Sign out of every device?"
        description="You will need to sign in again on all devices, including this one."
        confirmLabel="Sign out everywhere"
        tone="danger"
        onConfirm={async () => {
          setConfirm(false);
          await signOut();
          window.location.assign('/login');
        }}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}
