import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Filter,
  Flame,
  Info,
  ListChecks,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge, Button, Card, EmptyState, Input, ProgressBar, Select, Skeleton } from '@/components/ui';
import { ErrorBlock, PageHeader, ProgressRing, StatCard, TaskRow, TaskTypeBadge } from '@/components/common';
import { apiGet, apiPost, getApiError } from '@/lib/api';
import { cn, formatMinutes, percent, todayIso } from '@/lib/utils';
import type { DailyPlan, StreakData, Task } from '@/lib/types';

interface TodayResponse {
  plan: DailyPlan;
  streak: StreakData;
  user: { id: string; name: string; timezone: string; dailyGoalMinutes: number };
}

function QuickCompleteDialog({ task, onClose, onComplete, pending }: { task: Task | null; onClose: () => void; onComplete: (task: Task, minutes: number) => void; pending: boolean }) {
  const [minutes, setMinutes] = useState(task?.estimatedDuration ?? 20);
  if (!task) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Complete task">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-lift">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">Log completion</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">{task.title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">Record the minutes you actually spent. Only published, unlocked tasks count toward progress.</p>
        <label htmlFor="minutes" className="mt-4 block text-xs font-medium text-muted">Minutes spent</label>
        <input
          id="minutes"
          type="number"
          min={1}
          max={1440}
          value={minutes}
          onChange={(event) => setMinutes(Number(event.target.value))}
          className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={pending} onClick={() => onComplete(task, minutes)}><CheckCircle2 /> Complete task</Button>
        </div>
      </div>
    </div>
  );
}

export function Today() {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<Task | null>(null);
  const [showAlgorithm, setShowAlgorithm] = useState(false);

  const query = useQuery({ queryKey: ['me', 'today'], queryFn: () => apiGet<TodayResponse>('/me/tasks/today') });

  const complete = useMutation({
    mutationFn: ({ task, minutes }: { task: Task; minutes: number }) => apiPost(`/me/tasks/${task.id}/complete`, { actualDuration: minutes }),
    onSuccess: () => {
      toast.success('Task completed', { description: 'Your plan, progress and streak have been updated.' });
      setTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['me'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error) => toast.error(getApiError(error).message),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]"><Skeleton className="h-96" /><Skeleton className="h-96" /></div>
      </div>
    );
  }
  if (query.isError || !query.data) return <ErrorBlock message={getApiError(query.error).message} onRetry={() => void query.refetch()} />;

  const { plan, streak } = query.data;
  const budgetPct = plan.budgetMinutes > 0 ? percent(plan.spentMinutes, plan.budgetMinutes) : 0;
  const goalMinutes = query.data.user.dailyGoalMinutes;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        title="Today's plan"
        description="A short, ordered list built from unlocked published tasks, capped by your daily budget."
        actions={
          <>
            <Button variant="outline" asChild><Link to="/calendar"><CalendarDays /> Calendar</Link></Button>
            <Button asChild><Link to="/tasks"><ListChecks /> All tasks</Link></Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4 p-5">
          <ProgressRing value={budgetPct} size={62} stroke={6} />
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Budget used</p>
            <p className="mt-0.5 text-lg font-semibold text-ink">{plan.spentMinutes} / {plan.budgetMinutes} min</p>
            <p className="text-[11px] text-muted">{plan.remainingBudgetMinutes} minutes left today</p>
          </div>
        </Card>
        <StatCard label="Recommended" value={`${plan.recommendations.length} task${plan.recommendations.length === 1 ? '' : 's'}`} hint={formatMinutes(plan.totalRecommendedMinutes)} icon={<Target className="size-5" />} tone="sky" />
        <StatCard label="Streak" value={`${streak.currentStreak} day${streak.currentStreak === 1 ? '' : 's'}`} hint={`${streak.todayCompleted} completed today · best ${streak.longestStreak}`} icon={<Flame className="size-5" />} tone="accent" />
      </div>

      {plan.warnings.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900"><Info className="size-3.5" /> Plan notes</p>
          <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-amber-900/85">
            {plan.warnings.map((warning) => <li key={warning}>• {warning}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-ink">Queued for today</h2>
                <p className="text-xs text-muted">{plan.recommendations.length > 0 ? `${plan.recommendations.length} tasks · ${formatMinutes(plan.totalRecommendedMinutes)}` : 'Nothing queued'}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowAlgorithm((value) => !value)}><SlidersHorizontal /> Why these?</Button>
            </div>
            {showAlgorithm ? <div className="border-b border-line/70 bg-canvas/50 px-5 py-3 text-xs leading-relaxed text-muted">{plan.algorithm}</div> : null}
            <div className="divide-y divide-line/60">
              {plan.recommendations.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="size-6" /></span>
                  <p className="mt-3 text-sm font-semibold text-ink">{plan.remainingBudgetMinutes <= 0 ? 'Budget complete for today' : 'Nothing unlocked right now'}</p>
                  <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
                    {plan.remainingBudgetMinutes <= 0 ? 'You used your whole budget. Rest is part of the plan — tomorrow’s list is already being prepared.' : 'Finish the current task in your workspace or explore a new roadmap to add tasks to your plan.'}
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    <Button asChild variant="outline" size="sm"><Link to="/my-roadmaps">My roadmaps</Link></Button>
                    <Button asChild size="sm"><Link to="/explore">Explore <ArrowRight /></Link></Button>
                  </div>
                </div>
              ) : (
                plan.recommendations.map((task, index) => (
                  <div key={task.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-deep">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link to={`/tasks/${task.id}`} className="text-sm font-semibold text-ink hover:text-brand">{task.title}</Link>
                        <TaskTypeBadge type={task.type} />
                        {task.exceedsDailyBudget ? <Badge tone="bg-amber-50 text-amber-800 ring-amber-200">Beyond budget</Badge> : null}
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                        <span>{task.roadmapTitle}</span><span aria-hidden>·</span><span>{task.moduleTitle}</span><span aria-hidden>·</span>
                        <span className="inline-flex items-center gap-1"><Clock3 className="size-3" /> {formatMinutes(task.estimatedDuration)}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button asChild variant="outline" size="sm"><Link to={`/tasks/${task.id}`}>Open</Link></Button>
                      <Button size="sm" variant="secondary" onClick={() => setTarget(task)}><CheckCircle2 /> Complete</Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {plan.completedToday.length > 0 ? (
            <Card className="p-5">
              <h2 className="text-base font-semibold text-ink">Completed today</h2>
              <div className="mt-2 space-y-1">
                {plan.completedToday.map((task) => (
                  <TaskRow key={task.id} task={task} href={`/tasks/${task.id}`} showRoadmap compact />
                ))}
              </div>
            </Card>
          ) : null}

          {plan.upcoming.length > 0 ? (
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-ink">After today</h2>
                  <p className="text-xs text-muted">Unlocks once the tasks above are complete</p>
                </div>
                <Badge tone="bg-canvas text-ink/70 ring-line">{plan.upcoming.length} queued</Badge>
              </div>
              <div className="mt-3 space-y-1.5">
                {plan.upcoming.slice(0, 5).map((task) => (
                  <div key={task.id} className="flex items-center gap-3 rounded-xl border border-line/60 px-3 py-2.5 opacity-80">
                    <span className="flex size-6 items-center justify-center rounded-full bg-canvas text-muted"><Clock3 className="size-3" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{task.title}</p>
                      <p className="text-[11px] text-muted">{task.roadmapTitle} · {formatMinutes(task.estimatedDuration)}</p>
                    </div>
                    <TaskTypeBadge type={task.type} />
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><Flame className="size-4 text-accent" /> This week</h2>
            <div className="mt-3 grid grid-cols-7 gap-1.5">
              {streak.weekly.map((day) => {
                const isToday = day.date === todayIso();
                return (
                  <div key={day.date} className="text-center">
                    <p className="text-[9px] uppercase text-muted">{new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' })}</p>
                    <div
                      className={cn(
                        'mx-auto mt-1 flex h-9 w-full items-center justify-center rounded-lg text-[10px] font-semibold',
                        day.active ? 'bg-brand text-white' : 'bg-canvas text-muted ring-1 ring-inset ring-line',
                        isToday && 'ring-2 ring-brand ring-offset-1',
                      )}
                      title={`${day.completedTasks} tasks · ${day.learningMinutes} min`}
                    >
                      {day.completedTasks > 0 ? day.completedTasks : '·'}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-canvas/70 p-3">
              <div>
                <p className="text-[11px] text-muted">Today's goal</p>
                <p className="text-sm font-semibold text-ink">{streak.todayMinutes} / {goalMinutes} min</p>
              </div>
              <ProgressRing value={goalMinutes > 0 ? percent(streak.todayMinutes, goalMinutes) : 0} size={44} stroke={4} />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink">Active roadmaps</h2>
            <div className="mt-3 space-y-3">
              {plan.activeRoadmaps.length === 0 ? (
                <p className="rounded-xl bg-canvas/70 p-3 text-xs text-muted">No active roadmaps. <Link to="/explore" className="font-medium text-brand hover:underline">Explore the catalogue</Link>.</p>
              ) : (
                plan.activeRoadmaps.map((roadmap) => (
                  <Link key={roadmap.enrollmentId} to={`/workspace/${roadmap.enrollmentId}`} className="block rounded-xl border border-line/70 p-3 transition hover:border-brand/30">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-semibold text-ink">{roadmap.title}</p>
                      <span className="text-[11px] font-semibold text-brand">{Math.round(roadmap.percent)}%</span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted">{roadmap.counts ? `${roadmap.counts.recommended} today · ` : ''}{roadmap.completedTasks}/{roadmap.totalTasks} tasks · {roadmap.paceMinutes} min/day</p>
                    <ProgressBar value={roadmap.percent} className="mt-1.5 h-1" label={`${roadmap.title} progress`} />
                  </Link>
                ))
              )}
            </div>
          </Card>

          <Card className="bg-brand-deep p-5 text-white">
            <span className="flex size-9 items-center justify-center rounded-xl bg-white/10"><Sparkles className="size-4.5" /></span>
            <p className="mt-3 text-sm font-semibold">The plan is a suggestion, not a debt.</p>
            <p className="mt-1 text-xs leading-relaxed text-white/70">Recommendations are built from published, unlocked tasks within your chosen budget. Finish less than planned and nothing breaks — the scheduler simply recalculates.</p>
            <Button asChild variant="ghost" size="sm" className="mt-3 px-0 text-white hover:bg-transparent hover:text-white/80"><Link to="/about">How scheduling works <ChevronRight /></Link></Button>
          </Card>
        </div>
      </div>

      <QuickCompleteDialog
        key={target?.id ?? 'none'}
        task={target}
        onClose={() => setTarget(null)}
        pending={complete.isPending}
        onComplete={(task, minutes) => complete.mutate({ task, minutes })}
      />
    </div>
  );
}

/* ── All tasks ───────────────────────────────────────────────────────────── */

interface TaskListResponse {
  items: Task[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  counts: { total: number; completed: number; available: number; locked: number };
}

const typeOptions: { value: string; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'learn', label: 'Learn' },
  { value: 'practice', label: 'Practice' },
  { value: 'code', label: 'Code' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'project', label: 'Project' },
  { value: 'revision', label: 'Revision' },
  { value: 'assessment', label: 'Assessment' },
];

export function AllTasks() {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<Task | null>(null);
  const [searchInput, setSearchInput] = useState(params.get('q') ?? '');

  const q = params.get('q') ?? '';
  const type = params.get('type') ?? '';
  const status = params.get('status') ?? '';
  const difficulty = params.get('difficulty') ?? '';
  const enrollmentId = params.get('roadmap') ?? '';
  const sort = params.get('sort') ?? 'curriculum';
  const page = Number(params.get('page') ?? '1');

  const query = useQuery({
    queryKey: ['me', 'tasks', { q, type, status, difficulty, enrollmentId, sort, page }],
    queryFn: () =>
      apiGet<TaskListResponse>('/me/tasks', {
        params: {
          search: q || undefined,
          type: type || undefined,
          status: status || undefined,
          difficulty: difficulty || undefined,
          enrollmentId: enrollmentId || undefined,
          sort,
          page,
          limit: 20,
        },
      }),
  });

  const enrollments = useQuery({
    queryKey: ['me', 'roadmaps', 'filter-list'],
    queryFn: () => apiGet<{ items: { enrollmentId: string; roadmap: { title: string } }[] }>('/me/roadmaps'),
  });

  const complete = useMutation({
    mutationFn: ({ task, minutes }: { task: Task; minutes: number }) => apiPost(`/me/tasks/${task.id}/complete`, { actualDuration: minutes }),
    onSuccess: () => {
      toast.success('Task completed');
      setTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (error) => toast.error(getApiError(error).message),
  });

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }

  const activeFilters = [q, type, status, difficulty, enrollmentId].filter(Boolean).length;
  const counts = query.data?.counts;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Task library"
        title="All tasks"
        description="Every eligible task across your non-archived enrollments, with locks, status and estimates visible. Filter by type, status or roadmap."
        actions={<Button asChild variant="outline"><Link to="/today"><Target /> Today's plan</Link></Button>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total', value: counts?.total ?? 0, tone: 'bg-canvas text-ink' },
          { label: 'Available', value: counts?.available ?? 0, tone: 'bg-brand-soft text-brand-deep' },
          { label: 'Completed', value: counts?.completed ?? 0, tone: 'bg-emerald-50 text-emerald-700' },
          { label: 'Locked', value: counts?.locked ?? 0, tone: 'bg-amber-50 text-amber-800' },
        ].map((item) => (
          <div key={item.label} className={cn('rounded-xl px-4 py-3 ring-1 ring-inset ring-line', item.tone)}>
            <p className="text-xl font-semibold tracking-tight">{item.value}</p>
            <p className="text-[10px] uppercase tracking-wide opacity-70">{item.label}</p>
          </div>
        ))}
      </div>

      <Card className="p-4">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            update('q', searchInput.trim());
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search tasks, topics or modules…" className="pl-9" aria-label="Search tasks" />
          </div>
          <div className="flex gap-2">
            <Select value={type} onChange={(event) => update('type', event.target.value)} aria-label="Task type" className="w-32">
              {typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
            <Select value={status} onChange={(event) => update('status', event.target.value)} aria-label="Task status" className="w-32">
              <option value="">Any status</option>
              <option value="not_started">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="locked">Locked</option>
            </Select>
            <Button type="submit" variant="outline" size="md"><Search /> Search</Button>
          </div>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line/70 pt-3">
          <Select value={enrollmentId} onChange={(event) => update('roadmap', event.target.value)} aria-label="Roadmap" className="w-56">
            <option value="">All roadmaps</option>
            {enrollments.data?.items.map((item) => <option key={item.enrollmentId} value={item.enrollmentId}>{item.roadmap.title}</option>)}
          </Select>
          <Select value={difficulty} onChange={(event) => update('difficulty', event.target.value)} aria-label="Difficulty" className="w-36">
            <option value="">Any difficulty</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </Select>
          <Select value={sort} onChange={(event) => update('sort', event.target.value)} aria-label="Sort" className="w-40">
            <option value="curriculum">Curriculum order</option>
            <option value="difficulty">Difficulty</option>
            <option value="duration">Shortest first</option>
          </Select>
          {activeFilters > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => { setSearchInput(''); setParams(new URLSearchParams(), { replace: true }); }}>
              <X /> Clear {activeFilters} filter{activeFilters === 1 ? '' : 's'}
            </Button>
          ) : null}
          <span className="ml-auto text-xs text-muted">{query.data ? `${query.data.pagination.total} matching tasks` : 'Loading…'}</span>
        </div>
      </Card>

      {query.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div>
      ) : query.isError ? (
        <ErrorBlock message={getApiError(query.error).message} onRetry={() => void query.refetch()} />
      ) : query.data && query.data.items.length > 0 ? (
        <div className="space-y-4">
          <Card className="divide-y divide-line/60 p-2">
            {query.data.items.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                href={`/tasks/${task.id}`}
                showRoadmap
                onComplete={() => setTarget(task)}
                completing={complete.isPending && target?.id === task.id}
              />
            ))}
          </Card>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">Page {query.data.pagination.page} of {query.data.pagination.totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => update('page', String(page - 1))}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= query.data.pagination.totalPages} onClick={() => update('page', String(page + 1))}>Next</Button>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<Filter className="size-6" />}
          title="No tasks match these filters"
          description="Try clearing a filter, or enrol in another roadmap to widen your task library."
          action={<Button variant="outline" onClick={() => { setSearchInput(''); setParams(new URLSearchParams(), { replace: true }); }}>Clear filters</Button>}
        />
      )}

      <QuickCompleteDialog key={target?.id ?? 'none'} task={target} onClose={() => setTarget(null)} pending={complete.isPending} onComplete={(task, minutes) => complete.mutate({ task, minutes })} />
    </div>
  );
}
