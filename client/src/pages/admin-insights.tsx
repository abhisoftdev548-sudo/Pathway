import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Info,
  RefreshCcw,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { Badge, Button, Card, EmptyState, Skeleton } from '@/components/ui';
import { ErrorBlock, PageHeader, StatCard } from '@/components/common';
import { apiGet, getApiError } from '@/lib/api';
import { cn, percent } from '@/lib/utils';
import type { AdminIssue } from '@/lib/types';

/* ── Enrollment analytics ────────────────────────────────────────────────── */

interface EnrollmentAnalyticsResponse {
  totals: { roadmaps: number; enrollments: number; learners: number; completedEnrollments: number; activeEnrollments: number };
  byRoadmap: {
    roadmapId: string;
    title: string;
    slug: string;
    category: string;
    published: boolean;
    taskCount: number;
    moduleCount: number;
    enrollments: { total: number; active: number; paused: number; completed: number; archived: number };
    completionRate: number;
    averageProgress: number;
  }[];
  recentEnrollments: { id: string; status: string; learningPace: string; enrolledAt: string; roadmapTitle: string; roadmapSlug: string; userName: string; userEmail: string }[];
}

export function AdminAnalytics() {
  const query = useQuery({ queryKey: ['admin', 'analytics', 'enrollments'], queryFn: () => apiGet<EnrollmentAnalyticsResponse>('/admin/analytics/enrollments') });

  if (query.isLoading) return <div className="space-y-5"><Skeleton className="h-24 w-full" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-80" /></div>;
  if (query.isError || !query.data) return <ErrorBlock message={getApiError(query.error).message} onRetry={() => void query.refetch()} />;

  const { totals, byRoadmap, recentEnrollments } = query.data;
  const chartData = byRoadmap
    .filter((roadmap) => roadmap.enrollments.total > 0)
    .sort((a, b) => b.enrollments.total - a.enrollments.total)
    .slice(0, 8)
    .map((roadmap) => ({ name: roadmap.title.length > 22 ? `${roadmap.title.slice(0, 20)}…` : roadmap.title, active: roadmap.enrollments.active, paused: roadmap.enrollments.paused, completed: roadmap.enrollments.completed }));
  const learnersPerRoadmap = totals.roadmaps > 0 ? totals.enrollments / totals.roadmaps : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
        <Link to="/admin" className="inline-flex items-center gap-1 hover:text-ink"><ArrowLeft className="size-3.5" /> Admin</Link>
        <span aria-hidden>/</span>
        <span className="text-ink/70">Enrollment analytics</span>
      </div>

      <PageHeader
        eyebrow="Admin analytics"
        title="Enrollment analytics"
        description="How learners distribute across roadmaps, how far they get and how many finish. Progress is calculated from published task completions."
        actions={<Button asChild variant="outline"><Link to="/admin/validation"><ShieldCheck /> Validation</Link></Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Enrollments" value={totals.enrollments} hint={`${totals.activeEnrollments} active`} icon={<BookOpen className="size-5" />} />
        <StatCard label="Unique learners" value={totals.learners} hint={`${learnersPerRoadmap.toFixed(1)} per roadmap on average`} icon={<Users className="size-5" />} tone="sky" />
        <StatCard label="Completed roadmaps" value={totals.completedEnrollments} hint={totals.enrollments > 0 ? `${percent(totals.completedEnrollments, totals.enrollments)}% completion rate` : 'No enrollments yet'} icon={<CheckCircle2 className="size-5" />} tone="accent" />
        <StatCard label="Published roadmaps" value={`${byRoadmap.filter((roadmap) => roadmap.published).length} / ${byRoadmap.length}`} hint="Available in the explorer" icon={<BarChart3 className="size-5" />} tone="rose" />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink">Enrollments by roadmap</h2>
            <p className="text-xs text-muted">Top eight roadmaps with at least one enrollment</p>
          </div>
          <Badge tone="bg-canvas text-ink/70 ring-line">{totals.roadmaps} roadmaps</Badge>
        </div>
        {chartData.length === 0 ? (
          <p className="mt-6 rounded-xl bg-canvas/70 p-6 text-center text-xs text-muted">No enrollments yet. Once learners enroll, distribution appears here.</p>
        ) : (
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(226 232 230)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'rgb(107 119 118)' }} tickLine={false} axisLine={false} angle={-18} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10, fill: 'rgb(107 119 118)' }} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                <ChartTooltip contentStyle={{ borderRadius: 12, border: '1px solid rgb(226 232 230)', fontSize: 12 }} />
                <Bar dataKey="active" name="Active" stackId="a" fill="#0d766e" radius={[0, 0, 0, 0]} maxBarSize={34} />
                <Bar dataKey="paused" name="Paused" stackId="a" fill="#c66c11" maxBarSize={34} />
                <Bar dataKey="completed" name="Completed" stackId="a" fill="#4f86c6" radius={[4, 4, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card className="overflow-x-auto">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-base font-semibold text-ink">Per-roadmap detail</h2>
          <span className="text-xs text-muted">{byRoadmap.length} roadmaps</span>
        </div>
        <table className="mt-3 w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas/40 text-[10px] uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5 font-medium">Roadmap</th>
              <th className="px-3 py-2.5 text-right font-medium">Enrollments</th>
              <th className="px-3 py-2.5 text-right font-medium">Active</th>
              <th className="px-3 py-2.5 text-right font-medium">Completed</th>
              <th className="px-3 py-2.5 text-right font-medium">Avg progress</th>
              <th className="px-3 py-2.5 text-right font-medium">Completion rate</th>
              <th className="px-3 py-2.5 text-right font-medium">Tasks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {byRoadmap.map((roadmap) => (
              <tr key={roadmap.roadmapId} className="hover:bg-canvas/30">
                <td className="px-4 py-2.5">
                  <Link to={`/admin/roadmaps/${roadmap.roadmapId}/curriculum`} className="font-medium text-ink hover:text-brand">{roadmap.title}</Link>
                  <p className="text-[10px] text-muted">{roadmap.category} · {roadmap.published ? 'published' : 'draft'}</p>
                </td>
                <td className="px-3 py-2.5 text-right font-medium text-ink">{roadmap.enrollments.total}</td>
                <td className="px-3 py-2.5 text-right text-muted">{roadmap.enrollments.active}</td>
                <td className="px-3 py-2.5 text-right text-muted">{roadmap.enrollments.completed}</td>
                <td className="px-3 py-2.5 text-right">
                  <div className="ml-auto flex w-24 items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full bg-brand" style={{ width: `${roadmap.averageProgress}%` }} /></div>
                    <span className="w-8 text-right text-[11px] text-muted">{roadmap.averageProgress}%</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right text-muted">{roadmap.completionRate}%</td>
                <td className="px-3 py-2.5 text-right text-muted">{roadmap.taskCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="overflow-x-auto">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-base font-semibold text-ink">Recent enrollments</h2>
          <span className="text-xs text-muted">Latest 15</span>
        </div>
        <table className="mt-3 w-full min-w-[700px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas/40 text-[10px] uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5 font-medium">Learner</th>
              <th className="px-4 py-2.5 font-medium">Roadmap</th>
              <th className="px-4 py-2.5 font-medium">Pace</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Enrolled</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {recentEnrollments.map((enrollment) => (
              <tr key={enrollment.id}>
                <td className="px-4 py-2.5">
                  <p className="font-medium text-ink">{enrollment.userName}</p>
                  <p className="text-[10px] text-muted">{enrollment.userEmail}</p>
                </td>
                <td className="px-4 py-2.5"><Link to={`/roadmaps/${enrollment.roadmapSlug}`} className="text-muted hover:text-brand">{enrollment.roadmapTitle}</Link></td>
                <td className="px-4 py-2.5 capitalize text-muted">{enrollment.learningPace}</td>
                <td className="px-4 py-2.5"><Badge tone="bg-canvas text-ink/70 ring-line" className="capitalize">{enrollment.status}</Badge></td>
                <td className="px-4 py-2.5 text-right text-muted">{new Date(enrollment.enrolledAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {recentEnrollments.length === 0 ? (
              <tr><td colSpan={5}><EmptyState icon={<Users className="size-6" />} title="No enrollments yet" description="Share the explorer with learners to start collecting enrollment data." action={<Button asChild size="sm" variant="outline"><Link to="/explore">Open explorer</Link></Button>} /></td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ── Validation ──────────────────────────────────────────────────────────── */

interface ValidationRoadmap {
  roadmapId: string;
  title: string;
  slug: string;
  published: boolean;
  moduleCount: number;
  topicCount: number;
  taskCount: number;
  publishedTaskCount: number;
  errors: number;
  warnings: number;
  issues: AdminIssue[];
}

interface ValidationResponse {
  summary: { roadmaps: number; publishedRoadmaps: number; errors: number; warnings: number; infos: number; roadmapsWithErrors: number };
  roadmaps: ValidationRoadmap[];
}

const severityTone: Record<string, string> = {
  error: 'bg-rose-50 text-rose-700 ring-rose-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
};

export function AdminValidation() {
  const [includeInfo, setIncludeInfo] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [severity, setSeverity] = useState<'all' | 'error' | 'warning' | 'info'>('all');

  const query = useQuery({
    queryKey: ['admin', 'validation', includeInfo],
    queryFn: () => apiGet<ValidationResponse>('/admin/validation', { params: { ...(includeInfo ? { includeInfo: 'true' } : {}) } }),
  });

  const filtered = useMemo(() => {
    if (!query.data) return [];
    if (severity === 'all') return query.data.roadmaps;
    return query.data.roadmaps.filter((roadmap) => roadmap.issues.some((issue) => issue.severity === severity) || (severity === 'error' && roadmap.errors > 0) || (severity === 'warning' && roadmap.warnings > 0));
  }, [query.data, severity]);

  if (query.isLoading) return <div className="space-y-5"><Skeleton className="h-24 w-full" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-96" /></div>;
  if (query.isError || !query.data) return <ErrorBlock message={getApiError(query.error).message} onRetry={() => void query.refetch()} />;

  const { summary } = query.data;
  const clean = summary.errors === 0 && summary.warnings === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
        <Link to="/admin" className="inline-flex items-center gap-1 hover:text-ink"><ArrowLeft className="size-3.5" /> Admin</Link>
        <span aria-hidden>/</span>
        <span className="text-ink/70">Validation report</span>
      </div>

      <PageHeader
        eyebrow="Content integrity"
        title="Validation report"
        description="Server-side checks for broken prerequisites, empty tasks, unpublished content and thin topics. Run it anytime; it reads the live database."
        actions={
          <>
            <Button variant="outline" loading={query.isFetching} onClick={() => void query.refetch()}><RefreshCcw /> Re-run</Button>
            <Button asChild variant="outline"><Link to="/admin/roadmaps"><BookOpen /> Roadmaps</Link></Button>
          </>
        }
      />

      <div className={cn('rounded-2xl border p-5', clean ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60')}>
        <div className="flex items-start gap-3">
          <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', clean ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800')}>
            {clean ? <CheckCircle2 className="size-5" /> : <AlertTriangle className="size-5" />}
          </span>
          <div>
            <h2 className={cn('text-sm font-semibold', clean ? 'text-emerald-900' : 'text-amber-900')}>{clean ? 'Curriculum is consistent' : `${summary.errors} error(s) and ${summary.warnings} warning(s) found`}</h2>
            <p className={cn('mt-0.5 text-xs leading-relaxed', clean ? 'text-emerald-800/80' : 'text-amber-900/80')}>
              {summary.roadmaps} roadmaps checked · {summary.publishedRoadmaps} published · {summary.infos} informational notes · {summary.roadmapsWithErrors} roadmap(s) with errors.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Errors" value={summary.errors} hint="Must be zero before publishing" icon={<XCircle className="size-5" />} tone="rose" />
        <StatCard label="Warnings" value={summary.warnings} hint="Review, but not blocking" icon={<AlertTriangle className="size-5" />} tone="accent" />
        <StatCard label="Info notes" value={summary.infos} hint="Optional improvements" icon={<Info className="size-5" />} tone="sky" />
        <StatCard label="Roadmaps checked" value={summary.roadmaps} hint={`${summary.publishedRoadmaps} published`} icon={<ShieldCheck className="size-5" />} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'error', 'warning', 'info'] as const).map((value) => (
          <Button key={value} size="sm" variant={severity === value ? 'default' : 'outline'} onClick={() => setSeverity(value)} className="capitalize">
            {value === 'all' ? 'All roadmaps' : `${value}s`}
          </Button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={includeInfo} onChange={(event) => setIncludeInfo(event.target.checked)} className="size-4 rounded border-line accent-[rgb(var(--brand))]" />
          Include informational checks
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="size-6" />} title="No roadmaps match this severity" description="Switch back to “All roadmaps” to see the full report." action={<Button variant="outline" onClick={() => setSeverity('all')}>Show all</Button>} />
      ) : (
        <div className="space-y-3">
          {filtered.map((roadmap) => {
            const open = expanded[roadmap.roadmapId] ?? (roadmap.errors > 0 || roadmap.warnings > 0);
            return (
              <Card key={roadmap.roadmapId} className="overflow-hidden">
                <button className="flex w-full flex-wrap items-center gap-3 px-4 py-3.5 text-left hover:bg-canvas/30" onClick={() => setExpanded((current) => ({ ...current, [roadmap.roadmapId]: !open }))} aria-expanded={open}>
                  <ChevronDown className={cn('size-4 shrink-0 text-muted transition', open && 'rotate-180')} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-semibold text-ink">{roadmap.title}</p>
                      <Badge tone={roadmap.published ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-canvas text-muted ring-line'}>{roadmap.published ? 'Published' : 'Draft'}</Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted">{roadmap.moduleCount} modules · {roadmap.topicCount} topics · {roadmap.taskCount} tasks ({roadmap.publishedTaskCount} published)</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {roadmap.errors > 0 ? <Badge tone={severityTone.error}>{roadmap.errors} errors</Badge> : null}
                    {roadmap.warnings > 0 ? <Badge tone={severityTone.warning}>{roadmap.warnings} warnings</Badge> : null}
                    {roadmap.errors === 0 && roadmap.warnings === 0 ? <Badge tone="bg-emerald-50 text-emerald-700 ring-emerald-200"><CheckCircle2 className="size-3" /> Clean</Badge> : null}
                    <Button asChild variant="ghost" size="sm" onClick={(event) => event.stopPropagation()}><Link to={`/admin/roadmaps/${roadmap.roadmapId}/curriculum`}>Edit <ArrowRight /></Link></Button>
                  </div>
                </button>
                {open ? (
                  <div className="border-t border-line/70 bg-canvas/20 px-4 py-3">
                    {roadmap.issues.length === 0 ? (
                      <p className="text-xs text-muted">No issues recorded for this roadmap.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {roadmap.issues
                          .filter((issue) => severity === 'all' || issue.severity === severity)
                          .map((issue, index) => (
                            <li key={`${issue.code}-${index}`} className="flex flex-wrap items-start gap-2 rounded-lg bg-surface px-3 py-2 text-xs">
                              <Badge tone={severityTone[issue.severity] ?? 'bg-canvas text-muted ring-line'} className="uppercase">{issue.severity}</Badge>
                              <span className="min-w-0 flex-1 leading-relaxed text-ink/75">{issue.message}</span>
                              <span className="font-mono text-[10px] text-muted">{issue.code}</span>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
