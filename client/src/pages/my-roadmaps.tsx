import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  MoreHorizontal,
  Pause,
  Play,
  RefreshCcw,
  Route,
  Settings2,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge, Button, Card, Dialog, DialogContent, DialogFooter, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, EmptyState, Field, Input, ProgressBar, Select, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { ErrorBlock, PageHeader, PaceBadge, ProgressRing, StatCard } from '@/components/common';
import { apiDelete, apiGet, apiPatch, getApiError } from '@/lib/api';
import { formatMinutes } from '@/lib/utils';
import type { EnrollmentSummary, Pace } from '@/lib/types';

interface MyRoadmapsResponse {
  items: EnrollmentSummary[];
  overall: { percent: number; totalTasks: number; completedTasks: number; totalMinutes: number; completedMinutes: number };
  counts: { active: number; paused: number; completed: number; archived: number; total: number };
  generatedAt: string;
}

const tabs: { value: 'active' | 'paused' | 'completed' | 'archived' | 'all'; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
];

const paceOptions: { value: Pace; label: string }[] = [
  { value: 'relaxed', label: 'Relaxed · 20 min/day' },
  { value: 'standard', label: 'Standard · 45 min/day' },
  { value: 'intensive', label: 'Intensive · 90 min/day' },
  { value: 'custom', label: 'Custom daily goal' },
];

export function MyRoadmaps() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'active' | 'paused' | 'completed' | 'archived' | 'all'>('all');
  const [paceTarget, setPaceTarget] = useState<EnrollmentSummary | null>(null);
  const [pace, setPace] = useState<Pace>('standard');
  const [customGoal, setCustomGoal] = useState(30);

  const query = useQuery({ queryKey: ['me', 'roadmaps'], queryFn: () => apiGet<MyRoadmapsResponse>('/me/roadmaps') });

  const update = useMutation({
    mutationFn: ({ enrollmentId, body }: { enrollmentId: string; body: Record<string, unknown> }) => apiPatch(`/me/roadmaps/${enrollmentId}`, body),
    onSuccess: () => {
      toast.success('Roadmap updated');
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (error) => toast.error(getApiError(error).message),
  });

  const archive = useMutation({
    mutationFn: (enrollmentId: string) => apiDelete(`/me/roadmaps/${enrollmentId}`),
    onSuccess: () => {
      toast.success('Roadmap archived', { description: 'Progress is preserved. Restore it any time.' });
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (error) => toast.error(getApiError(error).message),
  });

  const items = query.data?.items ?? [];
  const filtered = useMemo(() => (tab === 'all' ? items : items.filter((item) => item.status === tab)), [items, tab]);

  const counts = query.data?.counts;
  const overall = query.data?.overall;

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full" />
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-64" />)}</div>
      </div>
    );
  }
  if (query.isError) return <ErrorBlock message={getApiError(query.error).message} onRetry={() => void query.refetch()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your learning"
        title="My roadmaps"
        description="Everything you're enrolled in, with honest progress and the next unlocked task. Archived roadmaps keep their history without affecting overall progress."
        actions={<Button asChild><Link to="/explore"><Route /> Find another roadmap</Link></Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Overall progress" value={`${(overall?.percent ?? 0).toFixed(1)}%`} hint={`${overall?.completedTasks ?? 0} of ${overall?.totalTasks ?? 0} eligible tasks`} icon={<Route className="size-5" />} />
        <StatCard label="Time invested" value={formatMinutes(overall?.completedMinutes ?? 0)} hint={`of ${formatMinutes(overall?.totalMinutes ?? 0)} planned`} icon={<Clock3 className="size-5" />} tone="sky" />
        <StatCard label="Active" value={counts?.active ?? 0} hint={`${counts?.paused ?? 0} paused · ${counts?.completed ?? 0} completed`} icon={<Play className="size-5" />} tone="accent" />
        <Card className="flex items-center gap-4 p-5">
          <ProgressRing value={overall?.percent ?? 0} size={62} />
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Weighted overall</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">Minutes completed ÷ minutes available across active, paused and completed roadmaps.</p>
          </div>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="flex flex-wrap gap-1 rounded-xl bg-surface p-1 ring-1 ring-line">
            {tabs.map((item) => (
              <TabsTrigger key={item.value} value={item.value} className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted data-[state=active]:bg-brand-soft data-[state=active]:text-brand-deep">
                {item.label}
                <span className="ml-1.5 text-[11px] opacity-70">{item.value === 'all' ? counts?.total ?? 0 : counts?.[item.value] ?? 0}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          <p className="text-xs text-muted">{filtered.length} roadmap{filtered.length === 1 ? '' : 's'} shown</p>
        </div>

        <TabsContent value={tab} className="mt-5">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="size-6" />}
              title={tab === 'all' ? 'No enrollments yet' : `No ${tab} roadmaps`}
              description={tab === 'all' ? 'Pick a roadmap and choose a pace. PathForge will build your first daily plan immediately.' : 'Try another tab, or explore the catalogue for a new path.'}
              action={<Button asChild><Link to="/explore">Explore roadmaps <ArrowRight /></Link></Button>}
            />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((item) => (
                <Card key={item.enrollmentId} className="flex flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone="bg-canvas text-ink/70 ring-line">{item.roadmap.category}</Badge>
                      <Badge
                        tone={
                          item.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                            : item.status === 'paused'
                              ? 'bg-amber-50 text-amber-800 ring-amber-200'
                              : item.status === 'completed'
                                ? 'bg-brand-soft text-brand-deep ring-brand/20'
                                : 'bg-canvas text-muted ring-line'
                        }
                        className="capitalize"
                      >
                        {item.status}
                      </Badge>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${item.roadmap.title}`}><MoreHorizontal /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => { setPaceTarget(item); setPace(item.learningPace); setCustomGoal(item.customDailyGoal ?? item.paceMinutes); }}>
                          <Settings2 /> Change pace
                        </DropdownMenuItem>
                        {item.status === 'active' ? (
                          <DropdownMenuItem onSelect={() => update.mutate({ enrollmentId: item.enrollmentId, body: { status: 'paused' } })}>
                            <Pause /> Pause roadmap
                          </DropdownMenuItem>
                        ) : null}
                        {item.status === 'paused' || item.status === 'archived' ? (
                          <DropdownMenuItem onSelect={() => update.mutate({ enrollmentId: item.enrollmentId, body: { status: 'active' } })}>
                            <RefreshCcw /> Resume learning
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuSeparator />
                        {item.status !== 'archived' ? (
                          <DropdownMenuItem className="text-rose-700" onSelect={() => archive.mutate(item.enrollmentId)}>
                            <Archive /> Archive
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem className="text-rose-700" onSelect={() => update.mutate({ enrollmentId: item.enrollmentId, body: { status: 'active' } })}>
                            <Trash2 /> Restore
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <h3 className="mt-3 text-base font-semibold leading-snug tracking-tight text-ink">
                    <Link to={`/workspace/${item.enrollmentId}`} className="hover:text-brand">{item.roadmap.title}</Link>
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{item.roadmap.tagline}</p>

                  <div className="mt-4 flex items-center gap-3">
                    <ProgressRing value={item.percent} size={54} stroke={5} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted">{item.completedTasks} / {item.totalTasks} tasks</span>
                        <span className="font-semibold text-ink">{Math.round(item.percent)}%</span>
                      </div>
                      <ProgressBar value={item.percent} className="mt-1.5" label={`${item.roadmap.title} progress`} />
                      <p className="mt-1.5 text-[11px] text-muted">{formatMinutes(item.completedMinutes)} of {formatMinutes(item.totalMinutes)}</p>
                    </div>
                  </div>

                  {item.nextTask ? (
                    <div className="mt-4 rounded-xl border border-line/70 bg-canvas/50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Next up · {formatMinutes(item.nextTask.estimatedDuration)}</p>
                      <p className="mt-1 line-clamp-2 text-sm font-medium text-ink">{item.nextTask.title}</p>
                      <p className="mt-0.5 text-[11px] text-muted">{item.nextTask.moduleTitle}</p>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-800">
                      <p className="flex items-center gap-1.5 font-semibold"><CheckCircle2 className="size-3.5" /> {item.status === 'completed' ? 'Roadmap complete' : 'No unlocked tasks'}</p>
                      <p className="mt-0.5 text-emerald-700/80">{item.status === 'completed' ? 'Reopen any completed task to continue learning.' : 'Published content may be catching up. Check back soon.'}</p>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-line/70 pt-3">
                    <div className="flex items-center gap-1.5">
                      <PaceBadge pace={item.learningPace} />
                      <span className="text-[11px] text-muted">{item.paceMinutes} min/day</span>
                    </div>
                    <Button asChild variant="ghost" size="sm" className="text-brand">
                      <Link to={`/workspace/${item.enrollmentId}`}>Open <ArrowRight /></Link>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(paceTarget)} onOpenChange={(open) => { if (!open) setPaceTarget(null); }}>
        <DialogContent
          title="Change learning pace"
          description="Pace changes affect scheduling immediately. Completed tasks and historical timestamps are untouched."
        >
          <div className="space-y-4">
            <Field label="Learning pace" htmlFor="pace">
              <Select
                id="pace"
                value={pace}
                onChange={(event) => setPace(event.target.value as Pace)}
              >
                {paceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
            </Field>
            {pace === 'custom' ? (
              <Field label="Daily minutes" htmlFor="custom-goal" hint="5–300 minutes">
                <Input id="custom-goal" type="number" min={5} max={300} value={customGoal} onChange={(event) => setCustomGoal(Number(event.target.value))} />
              </Field>
            ) : null}
            <div className="rounded-xl bg-canvas/70 p-3 text-xs leading-relaxed text-muted">
              <p className="font-medium text-ink">What changes</p>
              <p className="mt-1">Daily recommendations and the “minutes left today” budget use the new pace. Historical completion minutes stay exactly as recorded.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaceTarget(null)}>Cancel</Button>
            <Button
              loading={update.isPending}
              onClick={() => {
                if (!paceTarget) return;
                update.mutate(
                  { enrollmentId: paceTarget.enrollmentId, body: { learningPace: pace, ...(pace === 'custom' ? { customDailyGoal: customGoal } : {}) } },
                  { onSuccess: () => setPaceTarget(null) },
                );
              }}
            >
              Save pace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
