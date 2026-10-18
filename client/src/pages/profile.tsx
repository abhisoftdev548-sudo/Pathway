import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, Award, CheckCircle2, Clock3, KeyRound, LogOut, Mail, Route, Save, ShieldCheck, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, Avatar, Badge, Button, Card, Field, Input, Select, Skeleton, Switch, Textarea } from '@/components/ui';
import { ErrorBlock, PageHeader, StatCard } from '@/components/common';
import { apiGet, apiPatch, apiPost, fieldErrors, getApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatMinutes } from '@/lib/utils';
import type { User } from '@/lib/types';

interface ProfileResponse {
  user: User;
  stats: { roadmaps: number; completedTasks: number; achievements: number };
}

const fallbackTimezones = [
  'UTC', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
  'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Europe/Madrid', 'Europe/Warsaw',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Sao_Paulo',
  'Africa/Lagos', 'Africa/Nairobi', 'Africa/Johannesburg',
];

export function Profile() {
  const { user: authUser, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['me', 'profile'], queryFn: () => apiGet<ProfileResponse>('/me/profile') });
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('');
  const [dailyGoal, setDailyGoal] = useState(45);
  const [timezone, setTimezone] = useState('UTC');
  const [preferences, setPreferences] = useState({
    emailNotifications: false,
    inAppReminders: true,
    reminderTime: '19:00',
    weekStartsOn: 1,
    showCompletedTasks: true,
    reduceMotion: false,
    weeklyGoalTasks: 10,
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const timezones = useMemo(() => {
    try {
      const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone');
      if (supported?.length) return supported;
    } catch {
      // Ignore and fall back to the curated list.
    }
    return fallbackTimezones;
  }, []);

  const profile = query.data?.user;

  if (profile && !loaded) {
    setName(profile.name);
    setBio(profile.bio ?? '');
    setAvatar(profile.avatar ?? '');
    setDailyGoal(profile.dailyGoalMinutes ?? 45);
    setTimezone(profile.timezone ?? 'UTC');
    setPreferences((current) => ({ ...current, ...profile.preferences }));
    setLoaded(true);
  }

  const save = useMutation({
    mutationFn: () => apiPatch<{ user: User }>('/me/profile', {
      name: name.trim(),
      bio: bio.trim(),
      avatar: avatar.trim(),
      dailyGoalMinutes: dailyGoal,
      timezone,
      preferences,
    }),
    onSuccess: async (data) => {
      toast.success('Profile saved', { description: data.user.timezone !== profile?.timezone ? 'Your daily plan and streaks now follow the new timezone.' : undefined });
      await refreshUser();
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (error) => {
      const parsed = getApiError(error);
      toast.error(parsed.message, { description: Object.values(fieldErrors(parsed.details))[0] });
    },
  });

  const changePassword = useMutation({
    mutationFn: () => apiPatch('/auth/password', { currentPassword, newPassword }),
    onSuccess: () => {
      toast.success('Password changed', { description: 'Other sessions were signed out.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
    },
    onError: (error) => {
      const parsed = getApiError(error);
      setPasswordError(parsed.message);
    },
  });

  const logoutAll = useMutation({
    mutationFn: () => apiPost('/me/logout-all', {}),
    onSuccess: () => {
      window.location.href = '/login';
    },
    onError: (error) => toast.error(getApiError(error).message),
  });

  if (query.isLoading) {
    return <div className="space-y-5"><Skeleton className="h-28 w-full" /><div className="grid gap-5 lg:grid-cols-[1fr_360px]"><Skeleton className="h-96" /><Skeleton className="h-96" /></div></div>;
  }
  if (query.isError || !query.data || !profile) return <ErrorBlock message={getApiError(query.error).message} onRetry={() => void query.refetch()} />;

  const stats = query.data.stats;
  const displayName = name || authUser?.name || 'Learner';

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Account"
        title="Profile & preferences"
        description="Control how PathForge schedules, reminds and reports. Timezone changes rebuild daily activity so streaks stay accurate."
        actions={<Button variant="outline" asChild><Link to="/notifications"><Mail /> Notifications</Link></Button>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active enrollments" value={stats.roadmaps} hint="Archived roadmaps excluded" icon={<Route className="size-5" />} />
        <StatCard label="Tasks completed" value={stats.completedTasks} hint="Across all roadmaps" icon={<CheckCircle2 className="size-5" />} tone="sky" />
        <StatCard label="Achievements" value={stats.achievements} hint="Unlocked badges" icon={<Award className="size-5" />} tone="accent" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-brand-soft text-brand"><UserRound className="size-4.5" /></span>
              <div>
                <h2 className="text-sm font-semibold text-ink">Public profile</h2>
                <p className="text-[11px] text-muted">Used on certificates and the navigation menu.</p>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Avatar name={displayName} src={avatar || undefined} size={64} />
              <div className="flex-1">
                <Field label="Avatar URL" htmlFor="avatar" hint="Optional · https://…">
                  <Input id="avatar" value={avatar} onChange={(event) => setAvatar(event.target.value)} placeholder="https://example.com/avatar.png" />
                </Field>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Name" htmlFor="name" hint="2–80 characters">
                <Input id="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
              </Field>
              <Field label="Email" htmlFor="email" hint="Contact support to change">
                <Input id="email" value={profile.email} disabled />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Bio" htmlFor="bio" hint={`${bio.length}/280`}>
                <Textarea id="bio" rows={3} value={bio} onChange={(event) => setBio(event.target.value.slice(0, 280))} placeholder="What are you working towards?" />
              </Field>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Clock3 className="size-4.5" /></span>
              <div>
                <h2 className="text-sm font-semibold text-ink">Scheduling</h2>
                <p className="text-[11px] text-muted">Defaults for daily plans and streak calculations.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Daily goal" htmlFor="daily-goal" hint="5–480 minutes">
                <Input id="daily-goal" type="number" min={5} max={480} value={dailyGoal} onChange={(event) => setDailyGoal(Number(event.target.value))} />
              </Field>
              <Field label="Timezone" htmlFor="timezone" hint="IANA timezone">
                <Select id="timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
                  {timezones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
                </Select>
              </Field>
              <Field label="Weekly task goal" htmlFor="weekly-goal" hint="1–200 tasks">
                <Input id="weekly-goal" type="number" min={1} max={200} value={preferences.weeklyGoalTasks} onChange={(event) => setPreferences((current) => ({ ...current, weeklyGoalTasks: Number(event.target.value) }))} />
              </Field>
              <Field label="Week starts on" htmlFor="week-start">
                <Select id="week-start" value={preferences.weekStartsOn} onChange={(event) => setPreferences((current) => ({ ...current, weekStartsOn: Number(event.target.value) }))}>
                  <option value={0}>Sunday</option>
                  <option value={1}>Monday</option>
                </Select>
              </Field>
            </div>
            <div className="mt-4 space-y-3 border-t border-line/70 pt-4">
              <Switch checked={preferences.inAppReminders} onCheckedChange={(value) => setPreferences((current) => ({ ...current, inAppReminders: value }))} label="In-app reminders" description="Show a gentle nudge when today's plan is untouched." />
              <Switch checked={preferences.emailNotifications} onCheckedChange={(value) => setPreferences((current) => ({ ...current, emailNotifications: value }))} label="Email notifications" description="Achievements and weekly summaries. No marketing mail." />
              <Switch checked={preferences.showCompletedTasks} onCheckedChange={(value) => setPreferences((current) => ({ ...current, showCompletedTasks: value }))} label="Show completed tasks" description="Include completed tasks in workspace and task lists." />
              <Switch checked={preferences.reduceMotion} onCheckedChange={(value) => setPreferences((current) => ({ ...current, reduceMotion: value }))} label="Reduce motion" description="Minimise animations across the interface." />
            </div>
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-line/70 pt-4">
              <p className="text-[11px] leading-relaxed text-muted">Timezone: {timezone} · reminders at {preferences.reminderTime}</p>
              <Button loading={save.isPending} onClick={() => save.mutate()}><Save /> Save changes</Button>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-canvas text-ink/70"><KeyRound className="size-4.5" /></span>
              <div>
                <h2 className="text-sm font-semibold text-ink">Change password</h2>
                <p className="text-[11px] text-muted">At least 10 characters with upper, lower and a number.</p>
              </div>
            </div>
            {passwordError ? <div className="mt-4"><Alert tone="danger">{passwordError}</Alert></div> : null}
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Current password" htmlFor="current-password"><Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></Field>
              <Field label="New password" htmlFor="new-password"><Input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></Field>
              <Field label="Confirm new password" htmlFor="confirm-password"><Input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></Field>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[11px] text-muted"><ShieldCheck className="size-3.5 text-brand" /> Changing your password signs out every other session.</p>
              <Button
                variant="outline"
                loading={changePassword.isPending}
                disabled={!currentPassword || newPassword.length < 10 || newPassword !== confirmPassword}
                onClick={() => { setPasswordError(''); changePassword.mutate(); }}
              >
                Update password
              </Button>
            </div>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card className="p-5 text-center">
            <Avatar name={displayName} src={avatar || undefined} size={72} />
            <h2 className="mt-3 text-base font-semibold text-ink">{displayName}</h2>
            <p className="text-xs text-muted">{profile.email}</p>
            <div className="mt-2 flex justify-center gap-1.5">
              <Badge tone="bg-brand-soft text-brand-deep ring-brand/20" className="capitalize">{profile.role}</Badge>
              <Badge tone="bg-canvas text-ink/70 ring-line">{timezone}</Badge>
            </div>
            <p className="mt-3 rounded-xl bg-canvas/70 p-3 text-[11px] leading-relaxed text-muted">
              {bio || 'Add a short bio to remind yourself why this work matters.'}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-left">
              <div className="rounded-lg bg-canvas/70 p-2.5">
                <p className="text-[10px] uppercase text-muted">Goal</p>
                <p className="text-xs font-semibold text-ink">{formatMinutes(dailyGoal)}/day</p>
              </div>
              <div className="rounded-lg bg-canvas/70 p-2.5">
                <p className="text-[10px] uppercase text-muted">Weekly</p>
                <p className="text-xs font-semibold text-ink">{preferences.weeklyGoalTasks} tasks</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink"><AlertTriangle className="size-4 text-accent" /> Sessions</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted">Sessions use short-lived access cookies with rotating refresh cookies. Signing out everywhere invalidates every issued token.</p>
            <Button variant="outline" size="sm" className="mt-3 w-full" loading={logoutAll.isPending} onClick={() => logoutAll.mutate()}><LogOut /> Sign out everywhere</Button>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-ink">Your data</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted">Task completions, reopens and minutes are retained as an audit trail. Reopening never deletes history.</p>
            <div className="mt-2 flex gap-2">
              <Button asChild variant="ghost" size="sm"><Link to="/history">History <ArrowRight /></Link></Button>
              <Button asChild variant="ghost" size="sm"><Link to="/achievements">Achievements <ArrowRight /></Link></Button>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
