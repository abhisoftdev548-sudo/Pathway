import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Flame,
  History as HistoryIcon,
  RotateCcw,
  Search,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { Badge, Button, Card, EmptyState, Input, Select, Skeleton } from '@/components/ui';
import { ErrorBlock, PageHeader, StatCard } from '@/components/common';
import { apiGet, getApiError } from '@/lib/api';
import { cn, downloadText, formatMinutes, todayIso } from '@/lib/utils';
import type { ActivityItem, DailyPlan, StreakData } from '@/lib/types';

interface HistoryResponse {
  items: ActivityItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function startOfMonthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  return new Date(first.getFullYear(), first.getMonth(), first.getDate() - offset);
}

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const activityMeta: Record<string, { label: string; icon: typeof CheckCircle2; tone: string }> = {
  task_completed: { label: 'Completed', icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  task_reopened: { label: 'Reopened', icon: RotateCcw, tone: 'bg-amber-50 text-amber-800 ring-amber-200' },
  roadmap_completed: { label: 'Roadmap completed', icon: Trophy, tone: 'bg-brand-soft text-brand-deep ring-brand/20' },
};

export function CalendarPage() {
  const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [selected, setSelected] = useState(todayIso());

  const streak = useQuery({ queryKey: ['me', 'streaks'], queryFn: () => apiGet<StreakData>('/me/streaks') });
  const history = useQuery({ queryKey: ['me', 'history', 'calendar'], queryFn: () => apiGet<HistoryResponse>('/me/tasks/history', { params: { limit: 100 } }) });
  const today = useQuery({ queryKey: ['me', 'today'], queryFn: () => apiGet<{ plan: DailyPlan }>('/me/tasks/today') });

  const historyByDate = useMemo(() => {
    const map = new Map<string, ActivityItem[]>();
    for (const item of history.data?.items ?? []) {
      const list = map.get(item.localDate) ?? [];
      list.push(item);
      map.set(item.localDate, list);
    }
    return map;
  }, [history.data]);

  const heatmapByDate = useMemo(() => new Map((streak.data?.heatmap ?? []).map((day) => [day.date, day])), [streak.data]);

  const gridStart = startOfMonthGrid(month);
  const days = Array.from({ length: 42 }, (_, index) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index));
  const selectedItems = historyByDate.get(selected) ?? [];
  const selectedHeat = heatmapByDate.get(selected);
  const isCurrentMonth = month.getMonth() === new Date().getMonth() && month.getFullYear() === new Date().getFullYear();

  const monthStats = useMemo(() => {
    let minutes = 0;
    let tasks = 0;
    let activeDays = 0;
    for (const day of days) {
      if (day.getMonth() !== month.getMonth()) continue;
      const record = heatmapByDate.get(isoDate(day));
      if (!record) continue;
      minutes += record.learningMinutes;
      tasks += record.completedTasks;
      if (record.learningMinutes > 0) activeDays += 1;
    }
    return { minutes, tasks, activeDays };
  }, [days, month, heatmapByDate]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Consistency"
        title="Calendar"
        description="Completions, reopens and recorded minutes by day. The calendar is built from your audit trail, not from page views."
        actions={<Button asChild variant="outline"><Link to="/history"><HistoryIcon /> Full history</Link></Button>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="This month" value={`${monthStats.tasks} tasks`} hint={`${monthStats.activeDays} active days`} icon={<CalendarDays className="size-5" />} />
        <StatCard label="Minutes recorded" value={formatMinutes(monthStats.minutes)} hint="From activity logs" icon={<Clock3 className="size-5" />} tone="sky" />
        <StatCard label="Current streak" value={`${streak.data?.currentStreak ?? 0} days`} hint={`Best ${streak.data?.longestStreak ?? 0} · ${streak.data?.totalActiveDays ?? 0} active days`} icon={<Flame className="size-5" />} tone="accent" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
              <p className="text-xs text-muted">{monthStats.tasks} tasks · {formatMinutes(monthStats.minutes)}</p>
            </div>
            <div className="flex items-center gap-1">
              {!isCurrentMonth ? <Button variant="ghost" size="sm" onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); }}>Today</Button> : null}
              <Button variant="outline" size="icon-sm" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft /></Button>
              <Button variant="outline" size="icon-sm" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight /></Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center">
            {weekdayLabels.map((label) => <div key={label} className="pb-1 text-[10px] font-medium uppercase tracking-wide text-muted">{label}</div>)}
            {days.map((day) => {
              const iso = isoDate(day);
              const record = heatmapByDate.get(iso);
              const items = historyByDate.get(iso) ?? [];
              const inMonth = day.getMonth() === month.getMonth();
              const isToday = iso === todayIso();
              const isSelected = iso === selected;
              const intensity = record ? Math.min(4, Math.ceil(record.learningMinutes / 25)) : 0;
              return (
                <button
                  key={iso}
                  onClick={() => setSelected(iso)}
                  className={cn(
                    'relative flex aspect-square flex-col items-center justify-center rounded-lg border text-xs transition',
                    inMonth ? 'border-transparent text-ink hover:border-brand/30' : 'border-transparent text-muted/40',
                    isSelected && 'ring-2 ring-brand ring-offset-1',
                    isToday && !isSelected && 'border-brand/40',
                    intensity === 1 && 'bg-brand-soft/50',
                    intensity === 2 && 'bg-brand-soft/80',
                    intensity === 3 && 'bg-brand/25',
                    intensity === 4 && 'bg-brand/40',
                  )}
                  aria-label={`${iso}${record ? `, ${record.completedTasks} completed, ${record.learningMinutes} minutes` : ''}`}
                >
                  <span className={cn('text-[11px] font-medium', isToday && 'text-brand-deep')}>{day.getDate()}</span>
                  {items.length > 0 ? (
                    <span className="mt-0.5 flex gap-0.5">
                      {items.slice(0, 3).map((item) => (
                        <span key={item.id} className={cn('size-1 rounded-full', item.activityType === 'task_completed' ? 'bg-emerald-600' : 'bg-amber-500')} />
                      ))}
                    </span>
                  ) : record && record.learningMinutes > 0 ? (
                    <span className="mt-0.5 text-[9px] text-brand-deep/70">{record.learningMinutes}m</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-line/70 pt-3 text-[10px] text-muted">
            <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-brand-soft" /> Light day</span>
            <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-brand/40" /> Heavy day</span>
            <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-emerald-600" /> Completion</span>
            <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-amber-500" /> Reopen</span>
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">{new Date(`${selected}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
              {selected === todayIso() ? <Badge tone="bg-brand-soft text-brand-deep ring-brand/20">Today</Badge> : null}
            </div>
            {selectedHeat ? (
              <p className="mt-1 text-xs text-muted">{selectedHeat.completedTasks} tasks · {formatMinutes(selectedHeat.learningMinutes)} recorded</p>
            ) : <p className="mt-1 text-xs text-muted">No recorded activity</p>}

            <div className="mt-3 space-y-2">
              {selectedItems.length === 0 ? (
                <div className="rounded-xl bg-canvas/70 p-4 text-center">
                  <p className="text-xs leading-relaxed text-muted">Nothing logged on this day. Rest days are part of a sustainable pace.</p>
                  {selected === todayIso() ? (
                    <Button asChild size="sm" variant="outline" className="mt-2"><Link to="/today"><Sparkles /> Open today's plan</Link></Button>
                  ) : null}
                </div>
              ) : (
                selectedItems.map((item) => (
                  <div key={item.id} className="flex items-start gap-2.5 rounded-xl border border-line/70 p-3">
                    <span className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ring-1 ring-inset', activityMeta[item.activityType]?.tone ?? 'bg-canvas text-muted ring-line')}>
                      {item.activityType === 'task_completed' ? <CheckCircle2 className="size-3.5" /> : item.activityType === 'task_reopened' ? <RotateCcw className="size-3.5" /> : <Trophy className="size-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-ink">{item.task?.title ?? item.roadmap?.title ?? 'Activity'}</p>
                      <p className="mt-0.5 text-[10px] text-muted">{activityMeta[item.activityType]?.label ?? item.activityType} · {new Date(item.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}{item.minutes ? ` · ${item.minutes} min` : ''}</p>
                      {item.task ? <Link to={`/tasks/${item.task.id}`} className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-brand hover:underline">Open task <ArrowRight className="size-2.5" /></Link> : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><CalendarDays className="size-4 text-brand" /> Today's plan</h2>
            <div className="mt-2 space-y-1.5">
              {(today.data?.plan.recommendations ?? []).length === 0 ? (
                <p className="text-xs text-muted">Nothing queued. {today.data?.plan.remainingBudgetMinutes ?? 0} minutes left in today's budget.</p>
              ) : (
                today.data?.plan.recommendations.slice(0, 4).map((task) => (
                  <Link key={task.id} to={`/tasks/${task.id}`} className="flex items-center gap-2 rounded-lg px-1 py-1 text-xs text-muted hover:bg-canvas hover:text-ink">
                    <span className="size-1.5 rounded-full bg-brand" />
                    <span className="min-w-0 flex-1 truncate">{task.title}</span>
                    <span className="text-[10px]">{formatMinutes(task.estimatedDuration)}</span>
                  </Link>
                ))
              )}
            </div>
            <Button asChild variant="outline" size="sm" className="mt-3 w-full"><Link to="/today">Open today <ArrowRight /></Link></Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ── History ─────────────────────────────────────────────────────────────── */

const typeFilters = [
  { value: '', label: 'All activity' },
  { value: 'task_completed', label: 'Completions' },
  { value: 'task_reopened', label: 'Reopens' },
  { value: 'roadmap_completed', label: 'Roadmap completions' },
];

export function HistoryPage() {
  const [activityType, setActivityType] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const query = useQuery({
    queryKey: ['me', 'history', { activityType, page }],
    queryFn: () => apiGet<HistoryResponse>('/me/tasks/history', { params: { activityType: activityType || undefined, page, limit: 30 } }),
  });

  const filtered = useMemo(() => {
    const items = query.data?.items ?? [];
    if (!search.trim()) return items;
    const needle = search.toLowerCase();
    return items.filter((item) => (item.task?.title ?? '').toLowerCase().includes(needle) || (item.roadmap?.title ?? '').toLowerCase().includes(needle));
  }, [query.data, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, ActivityItem[]>();
    for (const item of filtered) {
      const list = map.get(item.localDate) ?? [];
      list.push(item);
      map.set(item.localDate, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  function exportCsv() {
    const rows = [['date', 'time', 'activity', 'task', 'roadmap', 'minutes']];
    for (const item of query.data?.items ?? []) {
      rows.push([item.localDate, new Date(item.timestamp).toISOString(), item.activityType, item.task?.title ?? '', item.roadmap?.title ?? '', String(item.minutes ?? 0)]);
    }
    downloadText(`pathforge-history-${todayIso()}.csv`, rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n'));
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Audit trail"
        title="History"
        description="Every completion and reopen, timestamped in your timezone. Reopening never erases the record — it adds a new entry and recalculates progress."
        actions={<Button variant="outline" onClick={exportCsv} disabled={!query.data?.items.length}><Download /> Export CSV</Button>}
      />

      <Card className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
        <Select value={activityType} onChange={(event) => { setActivityType(event.target.value); setPage(1); }} className="w-52" aria-label="Activity type">
          {typeFilters.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
        </Select>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter the loaded page by task or roadmap…" className="pl-9" aria-label="Filter history" />
        </div>
        <p className="text-xs text-muted">{query.data?.pagination.total ?? 0} entries</p>
      </Card>

      {query.isLoading ? (
        <div className="space-y-3">{[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-20 w-full" />)}</div>
      ) : query.isError ? (
        <ErrorBlock message={getApiError(query.error).message} onRetry={() => void query.refetch()} />
      ) : grouped.length === 0 ? (
        <EmptyState icon={<HistoryIcon className="size-6" />} title="No activity yet" description="Complete your first task and it will appear here with a timestamp and the minutes you recorded." action={<Button asChild><Link to="/today">Open today's plan <ArrowRight /></Link></Button>} />
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, items]) => (
            <div key={date}>
              <div className="mb-2 flex items-center gap-3">
                <h2 className="text-sm font-semibold text-ink">{new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h2>
                <span className="text-[11px] text-muted">{items.length} event{items.length === 1 ? '' : 's'}</span>
                <span className="h-px flex-1 bg-line" />
              </div>
              <Card className="divide-y divide-line/60">
                {items.map((item) => {
                  const meta = activityMeta[item.activityType] ?? { label: item.activityType, icon: CheckCircle2, tone: 'bg-canvas text-muted ring-line' };
                  const Icon = meta.icon;
                  return (
                    <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                      <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset', meta.tone)}><Icon className="size-4" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="text-sm font-medium text-ink">{item.task?.title ?? item.roadmap?.title ?? 'Activity'}</p>
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                          {item.minutes ? <span className="text-[11px] text-muted">{item.minutes} min</span> : null}
                        </div>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
                          <span>{item.roadmap?.title ?? '—'}</span>
                          {item.task ? <><span aria-hidden>·</span><span className="capitalize">{item.task.type}</span></> : null}
                          <span aria-hidden>·</span>
                          <span>{new Date(item.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                        </p>
                      </div>
                      {item.task ? (
                        <Button asChild variant="ghost" size="sm"><Link to={`/tasks/${item.task.id}`}>Open <ArrowRight /></Link></Button>
                      ) : item.roadmap ? (
                        <Button asChild variant="ghost" size="sm"><Link to={`/roadmaps/${item.roadmap.slug}`}>Roadmap <ArrowRight /></Link></Button>
                      ) : null}
                    </div>
                  );
                })}
              </Card>
            </div>
          ))}

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">Page {query.data?.pagination.page} of {query.data?.pagination.totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= (query.data?.pagination.totalPages ?? 1)} onClick={() => setPage((value) => value + 1)}>Next</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
