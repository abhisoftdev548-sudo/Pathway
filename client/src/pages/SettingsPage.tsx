import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { KeyRound, Monitor, ShieldCheck } from 'lucide-react';
import endpoints from '@/services/endpoints';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/hooks';
import { Badge } from '@/components/ui/Data';
import { Card, CardBody, CardHeader, PageHeader, SkeletonList } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { Input, Switch } from '@/components/ui/Form';
import { formatDateTime } from '@/utils/format';
import { apiErrorMessage } from '@/services/api';

/** Account settings: password, notifications, leaderboard visibility, sessions. */
export function SettingsPage() {
  useDocumentTitle('Settings');
  const { user, refreshUser, logout } = useAuth();
  const toast = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const sessionsQuery = useQuery({
    queryKey: ['sessions'],
    queryFn: () => endpoints.auth.sessions(),
  });

  const changePassword = useMutation({
    mutationFn: () => endpoints.auth.changePassword({ currentPassword, newPassword }),
    onSuccess: async () => {
      toast.success('Password changed', 'Please sign in again with your new password.');
      setCurrentPassword('');
      setNewPassword('');
      await logout();
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'Could not change password'));
      setPasswordSaving(false);
    },
  });

  const updateSettings = useMutation({
    mutationFn: (settings: Record<string, unknown>) => endpoints.users.updateMe({ settings }),
    onSuccess: async () => {
      await refreshUser();
      toast.success('Preferences saved');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not save preferences')),
  });

  const revokeSessions = useMutation({
    mutationFn: () => endpoints.auth.revokeSessions(),
    onSuccess: async (result) => {
      toast.success(`${result.revoked} sessions signed out`);
      await logout();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not sign out sessions')),
  });

  const onPasswordSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPasswordSaving(true);
    changePassword.mutate();
  };

  return (
    <div>
      <PageHeader title="Settings" description="Security and preferences for your account." />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Password */}
        <Card>
          <CardHeader title="Password" subtitle="Changing your password signs out all sessions." />
          <CardBody>
            <form onSubmit={onPasswordSubmit} className="space-y-4">
              <Input
                label="Current password"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <Input
                label="New password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                hint="At least 8 characters, with a letter and a number."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Button type="submit" loading={passwordSaving} icon={<KeyRound className="h-4 w-4" />}>
                Change password
              </Button>
            </form>
          </CardBody>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader title="Preferences" />
          <CardBody className="space-y-5">
            <Switch
              label="Email notifications"
              description="Receive updates about moderation decisions and rewards."
              checked={user?.settings?.emailNotifications ?? true}
              onChange={(next) => updateSettings.mutate({ emailNotifications: next })}
            />
            <Switch
              label="Show on leaderboards"
              description="Allow your name and stats to appear in public rankings."
              checked={user?.settings?.showOnLeaderboards ?? true}
              onChange={(next) => updateSettings.mutate({ showOnLeaderboards: next })}
            />
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium text-body">
                <Monitor className="h-4 w-4 text-muted" /> Appearance
              </p>
              <p className="mt-0.5 text-xs text-body">
                QuizSphere follows your system theme ({user?.settings?.theme ?? 'system'}).
              </p>
            </div>
          </CardBody>
        </Card>

        {/* Sessions */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Active sessions"
            subtitle="Devices currently signed in with your account."
            actions={
              <Button
                variant="outline"
                size="sm"
                onClick={() => revokeSessions.mutate()}
                loading={revokeSessions.isPending}
              >
                Sign out everywhere
              </Button>
            }
          />
          <CardBody>
            {sessionsQuery.isLoading ? (
              <SkeletonList count={1} />
            ) : (sessionsQuery.data?.items ?? []).length === 0 ? (
              <p className="text-sm text-body">No active sessions found.</p>
            ) : (
              <div className="space-y-2">
                {(sessionsQuery.data?.items ?? []).map((session) => (
                  <div
                    key={session.familyId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-4 py-3"
                  >
                    <div>
                      <p className="flex items-center gap-2 text-sm font-medium text-heading">
                        <ShieldCheck className="h-4 w-4 text-success" />
                        {session.userAgent?.slice(0, 60) ?? 'Unknown device'}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {session.ip ? `${session.ip} · ` : ''}started {formatDateTime(session.createdAt)}
                      </p>
                    </div>
                    <Badge>expires {formatDateTime(session.expiresAt)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default SettingsPage;
