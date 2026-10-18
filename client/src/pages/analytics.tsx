import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Flame,
  Target,
  Timer,
  TrendingUp,
} from 'lucide-react';
import { Badge, Button, Card, ProgressBar, Select, Skeleton } from '@/components/ui';
import { ErrorBlock, PageHeader, ProgressRing, StatCard, TaskTypeBadge } from '@/components/common';
import { apiGet, getApiError } from '@/lib/api';
import { formatHours, formatMinutes, percent, taskTypeMeta } from '@/lib/utils';
import type { AnalyticsData } from '@/lib/types';

const ranges = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
  { value: 365, label: 'Last year' },
];

const palette = ['#0d766e', '#c66c11', '#4f86c6', '#7c5cbf', '#2f9e6f', '#c0504d', '#7a8b99'];

export function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const query = useQuery({
    queryKey: ['me', 'analytics', days],
    queryFn: () => apiGet<AnalyticsData>('/me/analytics', { params: { days } }),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }
  if (query.isError || !query.data) return <ErrorBlock message={getApiError(query.error).message} onRetry={() => void query.refetch()} />;

  const data = query.data;
  const series = data.activity.series.map((entry) => ({
    ...entry,
    label: new Date(`${entry.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  }));
  const typeData = data.activity.byType.filter((entry) => entry.count > 0).map((entry) => ({
    name: taskTypeMeta[entry.type]?.label ?? entry.type,
    value: entry.count,
    type: entry.type,
  }));
  const difficultyData = data.activity.byDifficulty.filter((entry) => entry.count > 0).map((entry) => ({
    name: entry.difficulty,
    value: entry.count,
  }));
  const activeRoadmaps = data.roadmaps.filter((roadmap) => roadmap.status !== 'archived');

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Analytics"
        title="Where your time actually goes"
        description="Minutes, task mix and roadmap progress from your recorded activity. Every figure is derived from completion audit entries."
        actions={
          <>
            <Select value={days} onChange={(event) => setDays(Number(event.target.value))} className="w-40" aria-label="Analytics range">
              {ranges.map((range) => <option key={range.value} value={range.value}>{range.label}</option>)}
            </Select>
            <Button asChild variant="outline"><Link to="/history">Audit trail <ArrowRight /></Link></Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Overall progress" value={`${data.overall.percent.toFixed(1)}%`} hint={`${data.overall.completedTasks} of ${data.overall.totalTasks} eligible tasks`} icon={<TrendingUp className="size-5" />} />
        <StatCard label="Recorded minutes" value={formatMinutes(data.stats.recordedMinutes)} hint={`${data.stats.activeDays} active days in range`} icon={<Clock3 className="size-5" />} tone="sky" />
        <StatCard label="Daily average" value={`${data.stats.avgPerActiveDay} min`} hint={`Goal ${data.stats.dailyGoalMinutes} min/day`} icon={<Timer className="size-5" />} tone="accent" />
        <StatCard label="Projected finish" value={data.stats.projectedCompletionDate ? new Date(`${data.stats.projectedCompletionDate}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'} hint={data.stats.daysToFinish ? `≈ ${data.stats.daysToFinish} days at your current pace` : 'Complete a few tasks for a projection'} icon={<CalendarClock className="size-5" />} tone="rose" />
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-ink">Activity over time</h2>
            <p className="text-xs text-muted">Minutes studied and tasks completed · {data.range.startDate} → {data.range.endDate}</p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-brand" /> Minutes</span>
            <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-accent" /> Tasks</span>
          </div>
        </div>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="analyticsMinutes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0d766e" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#0d766e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(226 232 230)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'rgb(107 119 118)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
              <YAxis yAxisId="minutes" tick={{ fontSize: 10, fill: 'rgb(107 119 118)' }} tickLine={false} axisLine={false} width={44} />
              <YAxis yAxisId="tasks" orientation="right" tick={{ fontSize: 10, fill: 'rgb(107 119 118)' }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
              <ChartTooltip contentStyle={{ borderRadius: 12, border: '1px solid rgb(226 232 230)', fontSize: 12 }} />
              <Area yAxisId="minutes" type="monotone" dataKey="minutes" name="Minutes" stroke="#0d766e" strokeWidth={2} fill="url(#analyticsMinutes)" />
              <Bar yAxisId="tasks" dataKey="completedTasks" name="Tasks" fill="#c66c11" opacity={0.55} radius={[3, 3, 0, 0]} maxBarSize={18} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-base font-semibold text-ink">Task mix</h2>
          <p className="text-xs text-muted">Completed tasks by type in this range</p>
          {typeData.length === 0 ? (
            <p className="mt-6 rounded-xl bg-canvas/70 p-6 text-center text-xs text-muted">No completions in this range yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {typeData.map((entry) => {
                const max = Math.max(...typeData.map((item) => item.value));
                return (
                  <div key={entry.type}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-ink"><TaskTypeBadge type={entry.type} /></span>
                      <span className="text-muted">{entry.value}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-canvas">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${percent(entry.value, max)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line/70 pt-4 text-xs">
            <div className="rounded-xl bg-canvas/70 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted">Modules complete</p>
              <p className="mt-1 font-semibold text-ink">{data.stats.modulesCompleted} / {data.stats.modulesTotal}</p>
            </div>
            <div className="rounded-xl bg-canvas/70 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted">Remaining</p>
              <p className="mt-1 font-semibold text-ink">{formatMinutes(data.stats.remainingMinutes)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-ink">Difficulty balance</h2>
          <p className="text-xs text-muted">Are you stretching into harder material?</p>
          {difficultyData.length === 0 ? (
            <p className="mt-6 rounded-xl bg-canvas/70 p-6 text-center text-xs text-muted">Complete a task to see the balance.</p>
          ) : (
            <div className="mt-2 flex items-center gap-4">
              <div className="h-52 w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={difficultyData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={72} paddingAngle={3}>
                      {difficultyData.map((entry, index) => <Cell key={entry.name} fill={palette[index % palette.length]} />)}
                    </Pie>
                    <ChartTooltip contentStyle={{ borderRadius: 12, border: '1px solid rgb(226 232 230)', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {difficultyData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 capitalize text-ink"><span className="size-2 rounded-full" style={{ background: palette[index % palette.length] }} /> {entry.name}</span>
                    <span className="text-muted">{entry.value} task{entry.value === 1 ? '' : 's'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4 rounded-xl bg-brand-soft/50 p-3 text-xs leading-relaxed text-brand-deep/80">
            <p className="flex items-center gap-1.5 font-semibold text-brand-deep"><Target className="size-3.5" /> Stretch deliberately</p>
            <p className="mt-1">A healthy mix leans on practice and small projects. Difficulty badges reflect the task, not your ability.</p>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink">Roadmap progress</h2>
            <p className="text-xs text-muted">Weighted by eligible published task minutes</p>
          </div>
          <Badge tone="bg-canvas text-ink/70 ring-line">{activeRoadmaps.length} active</Badge>
        </div>
        <div className="mt-4 space-y-4">
          {activeRoadmaps.length === 0 ? (
            <p className="rounded-xl bg-canvas/70 p-5 text-center text-xs text-muted">No active roadmaps. <Link to="/explore" className="font-medium text-brand hover:underline">Explore the catalogue</Link>.</p>
          ) : (
            activeRoadmaps.map((roadmap) => (
              <div key={roadmap.enrollmentId} className="rounded-xl border border-line/70 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Link to={`/workspace/${roadmap.enrollmentId}`} className="text-sm font-semibold text-ink hover:text-brand">{roadmap.roadmap.title}</Link>
                    <Badge tone="bg-canvas text-ink/60 ring-line" className="capitalize">{roadmap.status}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted">
                    <span>{roadmap.completedTasks}/{roadmap.totalTasks} tasks</span>
                    <span className="font-semibold text-ink">{Math.round(roadmap.percent)}%</span>
                  </div>
                </div>
                <ProgressBar value={roadmap.percent} className="mt-2" label={`${roadmap.roadmap.title} progress`} />
                <p className="mt-1.5 text-[11px] text-muted">{formatHours(roadmap.completedMinutes)} of {formatHours(roadmap.totalMinutes)} · {roadmap.paceMinutes} min/day · {taskTypeSummary(roadmap)}</p>
              </div>
            ))
          )}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-base font-semibold text-ink">Module completion</h2>
          <p className="text-xs text-muted">Lowest progress first, so you can spot stalls</p>
          <div className="mt-3 space-y-3">
            {[...data.modules].sort((a, b) => a.percent - b.percent).slice(0, 8).map((module) => (
              <div key={module.id}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{module.title}</p>
                    <p className="text-[10px] text-muted">{module.roadmapTitle} · {module.completedTasks}/{module.totalTasks} tasks</p>
                  </div>
                  <span className="shrink-0 text-muted">{Math.round(module.percent)}%</span>
                </div>
                <ProgressBar value={module.percent} className="mt-1.5" label={`${module.title} progress`} />
              </div>
            ))}
            {data.modules.length === 0 ? <p className="rounded-xl bg-canvas/70 p-5 text-center text-xs text-muted">No modules to show yet.</p> : null}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-ink">Time by roadmap</h2>
          <p className="text-xs text-muted">Estimated versus recorded minutes</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-wide text-muted">
                  <th className="py-2 pr-2 font-medium">Roadmap</th>
                  <th className="py-2 pr-2 text-right font-medium">Recorded</th>
                  <th className="py-2 pr-2 text-right font-medium">Remaining</th>
                  <th className="py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {data.activity.timeByRoadmap.length === 0 ? (
                  <tr><td colSpan={4} className="py-6 text-center text-muted">No time recorded yet.</td></tr>
                ) : (
                  data.activity.timeByRoadmap.map((row) => (
                    <tr key={row.roadmapSlug}>
                      <td className="max-w-[160px] truncate py-2 pr-2 font-medium text-ink">{row.roadmapTitle}</td>
                      <td className="py-2 pr-2 text-right text-muted">{formatHours(row.recordedMinutes)}</td>
                      <td className="py-2 pr-2 text-right text-muted">{formatHours(row.remainingMinutes)}</td>
                      <td className="py-2 text-right text-muted">{formatHours(row.estimatedMinutes)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-canvas/70 p-3">
            <ProgressRing value={data.overall.percent} size={48} stroke={4} />
            <div className="text-xs">
              <p className="font-semibold text-ink">Overall {data.overall.percent.toFixed(1)}%</p>
              <p className="text-muted">Time-weighted across non-archived enrollments</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="flex flex-col items-start justify-between gap-3 bg-gradient-to-br from-brand-soft/50 to-canvas p-5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-surface text-brand shadow-card"><Flame className="size-5" /></span>
          <div>
            <p className="text-sm font-semibold text-ink">{data.streak.currentStreak}-day streak · {data.streak.totalActiveDays} active days all-time</p>
            <p className="mt-0.5 text-xs text-muted">Streaks count days with a completion or recorded learning minutes in your timezone ({data.range.timezone}).</p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm"><Link to="/achievements"><CheckCircle2 /> Achievements <ArrowRight /></Link></Button>
      </Card>
    </div>
  );
}

function taskTypeSummary(roadmap: AnalyticsData['roadmaps'][number]) {
  if (roadmap.nextTask) return `Next: ${roadmap.nextTask.title}`;
  return roadmap.status === 'completed' ? 'Complete' : 'No unlocked tasks';
}
