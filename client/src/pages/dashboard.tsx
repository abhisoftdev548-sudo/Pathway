import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Compass,
  Flame,
  Play,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge, Button, Card, ProgressBar, Skeleton } from '@/components/ui';
import { ContinueCard, ErrorBlock, ProgressRing, StatCard, StreakCard, TaskTypeBadge } from '@/components/common';
import { apiGet, apiPost, getApiError } from '@/lib/api';
import { formatMinutes, percent } from '@/lib/utils';
import type { DashboardData, Task } from '@/lib/types';

function todayLabel() {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
}

export function Dashboard() {
  const queryClient = useQueryClient();
  const [quickTask, setQuickTask] = useState<Task | null>(null);
  const [duration, setDuration] = useState(0);

  const query = useQuery({
    queryKey: ['me', 'dashboard'],
    queryFn: () => apiGet<DashboardData>('/me/dashboard'),
  });

  const complete = useMutation({
    mutationFn: (task: Task) => apiPost(`/me/tasks/${task.id}/complete`, { actualDuration: duration || task.estimatedDuration }),
    onSuccess: () => {
      toast.success('Task completed', { description: 'Progress and today’s plan have been recalculated.' });
      setQuickTask(null);
      void queryClient.invalidateQueries({ queryKey: ['me'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error) => toast.error(getApiError(error).message),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
        <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]"><Skeleton className="h-96" /><Skeleton className="h-96" /></div>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return <ErrorBlock message={getApiError(query.error).message} onRetry={() => void query.refetch()} />;
  }

  const data = query.data;
  const { plan, stats, streak } = data;
  const firstName = data.user.name.split(' ')[0];
  const budgetPercent = plan.budgetMinutes > 0 ? percent(plan.spentMinutes, plan.budgetMinutes) : 0;
  const weeklyPercent = stats.weeklyGoal > 0 ? percent(stats.weeklyCompleted, stats.weeklyGoal) : 0;
  const chartData = data.learningTime.slice(-14).map((entry) => ({
    ...entry,
    label: new Date(`${entry.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:p-6">
        <div>
          <p className="eyebrow">{todayLabel()}</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {data.welcome.message || `Good to see you, ${firstName}`}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
            {plan.recommendations.length > 0
              ? `You have ${plan.recommendations.length} task${plan.recommendations.length === 1 ? '' : 's'} lined up (${formatMinutes(plan.totalRecommendedMinutes)}) within today's ${plan.budgetMinutes}-minute budget.`
              : plan.remainingBudgetMinutes <= 0
                ? 'Today’s budget is spent. Let the learning settle — the plan will be ready tomorrow.'
                : 'Nothing is queued right now. Explore a new roadmap or revisit a module you paused.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-muted">Today</p>
            <p className="text-sm font-semibold text-ink">{plan.spentMinutes} / {plan.budgetMinutes} min</p>
          </div>
          <ProgressRing value={budgetPercent} size={56} stroke={5} />
          {plan.recommendations[0] ? (
            <Button asChild size="lg" className="hidden sm:inline-flex">
              <Link to={`/tasks/${plan.recommendations[0].id}`}><Play /> Start next</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Overall progress" value={`${stats.overallPercent.toFixed(1)}%`} hint={`${stats.completedTasks} of ${stats.totalTasks} tasks`} icon={<TrendingUp className="size-5" />} />
        <StatCard label="Learning time" value={formatMinutes(stats.completedMinutes)} hint={`${formatMinutes(stats.todayMinutes)} logged today`} icon={<Clock3 className="size-5" />} tone="sky" />
        <StatCard label="Current streak" value={`${streak.currentStreak} day${streak.currentStreak === 1 ? '' : 's'}`} hint={`Longest ${streak.longestStreak} · ${streak.totalActiveDays} active days`} icon={<Flame className="size-5" />} tone="accent" />
        <StatCard label="Weekly goal" value={`${stats.weeklyCompleted} / ${stats.weeklyGoal}`} hint="Tasks completed this week" icon={<Target className="size-5" />} tone="rose" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/70 px-5 py-4">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-ink"><Target className="size-4.5 text-brand" /> Today's plan</h2>
              <p className="mt-0.5 text-xs text-muted">{plan.algorithm}</p>
            </div>
            <Badge tone="bg-brand-soft text-brand-deep ring-brand/15">{plan.remainingBudgetMinutes} min left</Badge>
          </div>
          <div className="px-2 py-2">
            {plan.recommendations.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="size-6" /></span>
                <p className="mt-3 text-sm font-semibold text-ink">Nothing else for today</p>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">Your plan only recommends unlocked, published tasks within your budget. Come back tomorrow, or open a workspace to read ahead.</p>
                <Button asChild variant="outline" size="sm" className="mt-4"><Link to="/my-roadmaps">Review roadmaps</Link></Button>
              </div>
            ) : (
              plan.recommendations.map((task) => (
                <div key={task.id} className="group flex items-start gap-3 rounded-xl px-3 py-3 transition hover:bg-canvas/60">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                    <Play className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link to={`/tasks/${task.id}`} className="text-sm font-semibold text-ink hover:text-brand">{task.title}</Link>
                      <TaskTypeBadge type={task.type} />
                      {task.exceedsDailyBudget ? <Badge tone="bg-amber-50 text-amber-800 ring-amber-200">Over budget</Badge> : null}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      <span>{task.roadmapTitle}</span>
                      <span aria-hidden>·</span>
                      <span>{task.moduleTitle}</span>
                      <span aria-hidden>·</span>
                      <span className="inline-flex items-center gap-1"><Clock3 className="size-3" /> {formatMinutes(task.estimatedDuration)}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button asChild variant="outline" size="sm"><Link to={`/tasks/${task.id}`}>Open</Link></Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setQuickTask(task);
                        setDuration(task.estimatedDuration);
                      }}
                    >
                      <CheckCircle2 /> <span className="hidden sm:inline">Complete</span>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          {plan.completedToday.length > 0 ? (
            <div className="border-t border-line/70 px-5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Completed today</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {plan.completedToday.map((task) => (
                  <Link key={task.id} to={`/tasks/${task.id}`} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
                    <CheckCircle2 className="size-3" /> {task.title}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          <div className="border-t border-line/70 px-5 py-3">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted">
              <span>Daily budget</span>
              <span className="font-medium text-ink">{plan.spentMinutes} / {plan.budgetMinutes} min</span>
            </div>
            <ProgressBar value={budgetPercent} barClassName="bg-brand" label="Daily budget used" />
          </div>
        </Card>

        <div className="space-y-5">
          {data.continueLearning ? (
            <ContinueCard
              enrollmentId={data.continueLearning.enrollmentId}
              roadmapTitle={data.continueLearning.roadmapTitle}
              percent={data.continueLearning.percent}
              nextTask={data.continueLearning.nextTask}
            />
          ) : (
            <Card className="p-5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand"><Compass className="size-5" /></span>
              <h3 className="mt-3 text-sm font-semibold text-ink">No active roadmap</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">Pick a curated path and PathForge will build a pace-aware daily plan for you.</p>
              <Button asChild className="mt-4 w-full"><Link to="/explore">Explore roadmaps <ArrowRight /></Link></Button>
            </Card>
          )}
          <StreakCard current={streak.currentStreak} longest={streak.longestStreak} todayMinutes={streak.todayMinutes} goalMinutes={data.user.dailyGoalMinutes} />
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">Weekly goal</h3>
              <span className="text-xs text-muted">{stats.weeklyCompleted} / {stats.weeklyGoal}</span>
            </div>
            <ProgressBar value={weeklyPercent} className="mt-3" barClassName="bg-emerald-500" label="Weekly goal" />
            <p className="mt-3 text-xs leading-relaxed text-muted">
              {weeklyPercent >= 100 ? 'Weekly goal met. Protect the streak with something light.' : `${Math.max(0, stats.weeklyGoal - stats.weeklyCompleted)} more task${stats.weeklyGoal - stats.weeklyCompleted === 1 ? '' : 's'} to hit this week's target.`}
            </p>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink">Learning activity</h2>
              <p className="text-xs text-muted">Minutes recorded over the last 14 days</p>
            </div>
            <Badge tone="bg-canvas text-ink/70 ring-line">{formatMinutes(stats.weeklyMinutes)} this week</Badge>
          </div>
          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashMinutes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(13 118 110)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="rgb(13 118 110)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(226 232 230)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'rgb(107 119 118)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: 'rgb(107 119 118)' }} tickLine={false} axisLine={false} width={40} />
                <ChartTooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid rgb(226 232 230)', fontSize: 12 }}
                  formatter={(value: number) => [`${value} min`, 'Learning']}
                />
                <Area type="monotone" dataKey="minutes" stroke="rgb(13 118 110)" strokeWidth={2} fill="url(#dashMinutes)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Active roadmaps</h2>
            <Link to="/my-roadmaps" className="text-xs font-medium text-brand hover:underline">Manage</Link>
          </div>
          <div className="mt-4 space-y-4">
            {data.roadmaps.filter((roadmap) => roadmap.status === 'active').length === 0 ? (
              <p className="rounded-xl bg-canvas/70 p-4 text-sm text-muted">No active enrollments. <Link to="/explore" className="font-medium text-brand hover:underline">Find a roadmap</Link>.</p>
            ) : (
              data.roadmaps
                .filter((roadmap) => roadmap.status === 'active')
                .slice(0, 4)
                .map((roadmap) => (
                  <div key={roadmap.enrollmentId}>
                    <div className="flex items-center justify-between gap-3">
                      <Link to={`/workspace/${roadmap.enrollmentId}`} className="truncate text-sm font-medium text-ink hover:text-brand">{roadmap.roadmap.title}</Link>
                      <span className="shrink-0 text-xs font-semibold text-ink">{Math.round(roadmap.percent)}%</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted">{roadmap.completedTasks} / {roadmap.totalTasks} tasks · {roadmap.paceMinutes} min/day</p>
                    <ProgressBar value={roadmap.percent} className="mt-1.5" label={`${roadmap.roadmap.title} progress`} />
                  </div>
                ))
            )}
          </div>
          <Button asChild variant="outline" className="mt-5 w-full"><Link to="/explore"><Plus /> Add another roadmap</Link></Button>
        </Card>
      </div>

      {plan.upcoming.length > 0 ? (
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink">Coming up next</h2>
              <p className="text-xs text-muted">Unlocked after the tasks above are completed</p>
            </div>
            <Button asChild variant="ghost" size="sm"><Link to="/tasks">All tasks <ArrowRight /></Link></Button>
          </div>
          <div className="mt-3 grid gap-1 md:grid-cols-2">
            {plan.upcoming.slice(0, 4).map((task) => (
              <div key={task.id} className="flex items-center gap-3 rounded-xl border border-line/60 px-3 py-2.5">
                <span className="flex size-7 items-center justify-center rounded-full bg-canvas text-muted"><Clock3 className="size-3.5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{task.title}</p>
                  <p className="text-[11px] text-muted">{task.roadmapTitle} · {formatMinutes(task.estimatedDuration)}</p>
                </div>
                <Badge tone="bg-canvas text-ink/60 ring-line">Locked</Badge>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Recent completions</h2>
            <Button asChild variant="ghost" size="sm"><Link to="/history">History <ArrowRight /></Link></Button>
          </div>
          {data.recentCompletions.length === 0 ? (
            <p className="mt-4 rounded-xl bg-canvas/70 p-4 text-sm text-muted">Nothing completed yet. Your first task will appear here with a timestamp.</p>
          ) : (
            <div className="mt-3 divide-y divide-line/70">
              {data.recentCompletions.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex size-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                    <p className="text-[11px] text-muted">{item.roadmapTitle} · {new Date(item.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                  </div>
                  <TaskTypeBadge type={item.type} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">Achievements</h2>
              <Button asChild variant="ghost" size="sm"><Link to="/achievements">All <ArrowRight /></Link></Button>
            </div>
            {data.recentAchievements.length === 0 ? (
              <p className="mt-4 rounded-xl bg-canvas/70 p-4 text-sm text-muted">Complete your first task to unlock <span className="font-medium text-ink">First Steps</span>.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.recentAchievements.slice(0, 4).map((achievement) => (
                  <span key={achievement.key} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs font-medium text-amber-900">
                    <Award className="size-3.5" /> {achievement.title}
                  </span>
                ))}
              </div>
            )}
          </Card>
          {data.upcomingMilestones.length > 0 ? (
            <Card className="p-5">
              <h2 className="text-base font-semibold text-ink">Next milestone</h2>
              {data.upcomingMilestones.slice(0, 2).map((milestone) => (
                <div key={milestone.moduleId} className="mt-3 rounded-xl bg-canvas/70 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">{milestone.moduleTitle}</p>
                    <span className="text-xs font-semibold text-brand">{Math.round(milestone.percent)}%</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted">{milestone.roadmapTitle} · {milestone.completedTasks}/{milestone.totalTasks} tasks · ≈{formatMinutes(milestone.remainingMinutes)} left</p>
                  <ProgressBar value={milestone.percent} className="mt-2" label={`${milestone.moduleTitle} progress`} />
                  <Button asChild variant="ghost" size="sm" className="mt-2 px-0 text-brand hover:bg-transparent">
                    <Link to={`/workspace/${milestone.enrollmentId}/modules/${milestone.moduleId}`}>Open module <ArrowRight /></Link>
                  </Button>
                </div>
              ))}
            </Card>
          ) : null}
        </div>
      </div>

      <Card className="flex flex-col items-start justify-between gap-4 bg-gradient-to-br from-brand-soft/60 to-canvas p-5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-surface text-brand shadow-card"><Sparkles className="size-5" /></span>
          <div>
            <p className="text-sm font-semibold text-ink">Small sessions compound.</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">Every completion is timestamped and counted toward your streak. Reopening a task recalculates progress honestly.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/calendar"><CalendarCheck /> Calendar</Link></Button>
          <Button asChild size="sm"><Link to="/today"><BookOpen /> Today's plan</Link></Button>
        </div>
      </Card>

      {quickTask ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Complete task">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-lift">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">Complete task</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">{quickTask.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">Log the minutes you actually spent. This updates progress, streaks and today’s remaining budget.</p>
            <label className="mt-4 block text-xs font-medium text-muted" htmlFor="quick-duration">Minutes spent</label>
            <input
              id="quick-duration"
              type="number"
              min={1}
              max={600}
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
              className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setQuickTask(null)}>Cancel</Button>
              <Button loading={complete.isPending} onClick={() => complete.mutate(quickTask)}><CheckCircle2 /> Mark complete</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
