import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import {
  Archive,
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Eye,
  FilePlus2,
  Gauge,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Users,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge, Button, Card, Dialog, DialogContent, DialogFooter, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, EmptyState, Field, Input, Select, Skeleton, Textarea } from '@/components/ui';
import { ErrorBlock, PageHeader, StatCard } from '@/components/common';
import { apiDelete, apiGet, apiPatch, apiPost, fieldErrors, getApiError } from '@/lib/api';
import type { AdminRoadmap } from '@/lib/types';

/* ── Overview ────────────────────────────────────────────────────────────── */

interface AdminOverviewResponse {
  metrics: {
    totalUsers: number;
    newUsers: number;
    totalRoadmaps: number;
    publishedRoadmaps: number;
    totalEnrollments: number;
    activeEnrollments: number;
    completedTasks: number;
    activeLearners: number;
    unreadNotifications: number;
    contentErrors: number;
    contentWarnings: number;
  };
  contentValidation: { roadmaps: number; publishedRoadmaps: number; errors: number; warnings: number; infos: number; roadmapsWithErrors: number };
  completionTrend: { date: string; completions: number }[];
  topRoadmaps: { id: string; title: string; slug: string; category: string; published: boolean; version: number; stats?: { moduleCount: number; topicCount: number; taskCount: number }; enrollmentCount: number }[];
  recentEnrollments: { id: string; status: string; enrolledAt: string; user: { name: string; email: string } | null; roadmap: { title: string; slug: string } | null }[];
  recentUsers: { _id: string; name: string; email: string; role: string; createdAt: string }[];
}

export function AdminOverview() {
  const query = useQuery({ queryKey: ['admin', 'overview'], queryFn: () => apiGet<AdminOverviewResponse>('/admin/overview') });

  if (query.isLoading) {
    return <div className="space-y-5"><Skeleton className="h-24 w-full" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-80" /></div>;
  }
  if (query.isError || !query.data) return <ErrorBlock message={getApiError(query.error).message} onRetry={() => void query.refetch()} />;

  const { metrics, contentValidation } = query.data;
  const trend = query.data.completionTrend.map((entry) => ({
    ...entry,
    label: new Date(`${entry.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Admin console"
        title="Platform overview"
        description="Content health, learner activity and enrollment flow in one place. All metrics are computed from live collections."
        actions={
          <>
            <Button asChild variant="outline"><Link to="/admin/validation"><ShieldCheck /> Validation</Link></Button>
            <Button asChild><Link to="/admin/roadmaps"><BookOpen /> Manage roadmaps</Link></Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total users" value={metrics.totalUsers} hint={`${metrics.newUsers} new in 7 days`} icon={<Users className="size-5" />} />
        <StatCard label="Active learners" value={metrics.activeLearners} hint="Recorded activity in 7 days" icon={<Gauge className="size-5" />} tone="sky" />
        <StatCard label="Enrollments" value={metrics.totalEnrollments} hint={`${metrics.activeEnrollments} active`} icon={<BookOpen className="size-5" />} tone="accent" />
        <StatCard label="Task completions" value={metrics.completedTasks} hint="All time, all learners" icon={<CheckCircle2 className="size-5" />} tone="rose" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink">Completion trend</h2>
              <p className="text-xs text-muted">Task completions per day · last 14 days</p>
            </div>
            <Badge tone="bg-canvas text-ink/70 ring-line">{metrics.publishedRoadmaps} published roadmaps</Badge>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="adminCompletions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d766e" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#0d766e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(226 232 230)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'rgb(107 119 118)' }} tickLine={false} axisLine={false} minTickGap={18} />
                <YAxis tick={{ fontSize: 10, fill: 'rgb(107 119 118)' }} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                <ChartTooltip contentStyle={{ borderRadius: 12, border: '1px solid rgb(226 232 230)', fontSize: 12 }} />
                <Area type="monotone" dataKey="completions" stroke="#0d766e" strokeWidth={2} fill="url(#adminCompletions)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><ShieldCheck className="size-4 text-brand" /> Content health</h2>
              <Badge tone={contentValidation.errors > 0 ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'}>
                {contentValidation.errors > 0 ? `${contentValidation.errors} errors` : 'No errors'}
              </Badge>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-canvas/70 p-3">
                <p className="text-lg font-semibold text-ink">{contentValidation.warnings}</p>
                <p className="text-[10px] uppercase text-muted">Warnings</p>
              </div>
              <div className="rounded-xl bg-canvas/70 p-3">
                <p className="text-lg font-semibold text-ink">{contentValidation.roadmaps}</p>
                <p className="text-[10px] uppercase text-muted">Roadmaps</p>
              </div>
              <div className="rounded-xl bg-canvas/70 p-3">
                <p className="text-lg font-semibold text-ink">{contentValidation.roadmapsWithErrors}</p>
                <p className="text-[10px] uppercase text-muted">With errors</p>
              </div>
            </div>
            <Button asChild variant="outline" size="sm" className="mt-3 w-full"><Link to="/admin/validation">Open validation report <ArrowRight /></Link></Button>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink">Recent enrollments</h2>
            <div className="mt-2 space-y-2">
              {query.data.recentEnrollments.slice(0, 4).map((enrollment) => (
                <div key={enrollment.id} className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-xs">
                  <span className="flex size-6 items-center justify-center rounded-full bg-brand-soft text-[10px] font-semibold text-brand-deep">{enrollment.user?.name?.slice(0, 1) ?? '?'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{enrollment.user?.name ?? 'Learner'} · {enrollment.roadmap?.title ?? 'Roadmap'}</p>
                    <p className="text-[10px] text-muted">{new Date(enrollment.enrolledAt).toLocaleDateString()} · {enrollment.status}</p>
                  </div>
                </div>
              ))}
              {query.data.recentEnrollments.length === 0 ? <p className="text-xs text-muted">No enrollments yet.</p> : null}
            </div>
          </Card>
        </div>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink">Roadmaps by enrollment</h2>
            <p className="text-xs text-muted">Top six, with content counts</p>
          </div>
          <Button asChild variant="ghost" size="sm"><Link to="/admin/roadmaps">All roadmaps <ArrowRight /></Link></Button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-wide text-muted">
                <th className="py-2 pr-3 font-medium">Roadmap</th>
                <th className="py-2 pr-3 text-right font-medium">Modules</th>
                <th className="py-2 pr-3 text-right font-medium">Topics</th>
                <th className="py-2 pr-3 text-right font-medium">Tasks</th>
                <th className="py-2 pr-3 text-right font-medium">Enrollments</th>
                <th className="py-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {query.data.topRoadmaps.map((roadmap) => (
                <tr key={roadmap.id}>
                  <td className="py-2.5 pr-3">
                    <Link to={`/admin/roadmaps/${roadmap.id}/curriculum`} className="font-medium text-ink hover:text-brand">{roadmap.title}</Link>
                    <p className="text-[10px] text-muted">{roadmap.category} · v{roadmap.version}</p>
                  </td>
                  <td className="py-2.5 pr-3 text-right text-muted">{roadmap.stats?.moduleCount ?? '—'}</td>
                  <td className="py-2.5 pr-3 text-right text-muted">{roadmap.stats?.topicCount ?? '—'}</td>
                  <td className="py-2.5 pr-3 text-right text-muted">{roadmap.stats?.taskCount ?? '—'}</td>
                  <td className="py-2.5 pr-3 text-right font-medium text-ink">{roadmap.enrollmentCount}</td>
                  <td className="py-2.5 text-right">
                    <Badge tone={roadmap.published ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-canvas text-muted ring-line'}>{roadmap.published ? 'Published' : 'Draft'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { title: 'Curriculum editor', description: 'Modules, topics, tasks, publishing and safe archives.', href: '/admin/roadmaps', icon: Layers },
          { title: 'Enrollment analytics', description: 'Completion rates and progress by roadmap.', href: '/admin/analytics', icon: BarChart3 },
          { title: 'Validation report', description: 'Broken prerequisites, missing content, thin topics.', href: '/admin/validation', icon: ShieldCheck },
          { title: 'Learner explorer', description: 'Preview exactly what guests and learners see.', href: '/explore', icon: Eye },
        ].map((item) => (
          <Link key={item.title} to={item.href} className="group rounded-2xl border border-line bg-surface p-4 transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-card">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-soft text-brand"><item.icon className="size-4.5" /></span>
            <p className="mt-3 text-sm font-semibold text-ink group-hover:text-brand">{item.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{item.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Roadmap management ──────────────────────────────────────────────────── */

interface AdminRoadmapsResponse {
  items: AdminRoadmap[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface RoadmapFormState {
  title: string;
  tagline: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  minWeeks: number;
  maxWeeks: number;
  totalHours: number;
}

const emptyRoadmapForm: RoadmapFormState = {
  title: '',
  tagline: '',
  description: '',
  category: 'Programming',
  difficulty: 'beginner',
  minWeeks: 6,
  maxWeeks: 10,
  totalHours: 80,
};

export function AdminRoadmaps() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [published, setPublished] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminRoadmap | null>(null);
  const [form, setForm] = useState<RoadmapFormState>(emptyRoadmapForm);

  const query = useQuery({
    queryKey: ['admin', 'roadmaps', { search, published, includeArchived, page }],
    queryFn: () => apiGet<AdminRoadmapsResponse>('/admin/roadmaps', { params: { search: search || undefined, published: published || undefined, includeArchived: includeArchived ? 'true' : undefined, page, limit: 20 } }),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin'] });
    void queryClient.invalidateQueries({ queryKey: ['roadmaps'] });
  };

  const mutate = useMutation({
    mutationFn: ({ method, path, body }: { method: 'post' | 'patch' | 'delete'; path: string; body?: unknown }) =>
      method === 'post' ? apiPost(path, body) : method === 'patch' ? apiPatch(path, body) : apiDelete(path),
    onSuccess: () => {
      toast.success('Roadmap updated');
      refresh();
    },
    onError: (error) => {
      const parsed = getApiError(error);
      toast.error(parsed.message, { description: Object.values(fieldErrors(parsed.details))[0] });
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyRoadmapForm);
    setFormOpen(true);
  }

  function openEdit(roadmap: AdminRoadmap) {
    setEditing(roadmap);
    setForm({
      title: roadmap.title,
      tagline: roadmap.tagline,
      description: roadmap.description,
      category: roadmap.category,
      difficulty: roadmap.difficulty,
      minWeeks: roadmap.estimatedDuration.minWeeks,
      maxWeeks: roadmap.estimatedDuration.maxWeeks,
      totalHours: roadmap.estimatedDuration.totalHours,
    });
    setFormOpen(true);
  }

  const saveRoadmap = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(),
        tagline: form.tagline.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        difficulty: form.difficulty,
        estimatedDuration: { minWeeks: form.minWeeks, maxWeeks: form.maxWeeks, totalHours: form.totalHours },
      };
      return editing ? apiPatch(`/admin/roadmaps/${editing.id}`, body) : apiPost('/admin/roadmaps', body);
    },
    onSuccess: () => {
      toast.success(editing ? 'Roadmap saved' : 'Draft roadmap created', { description: editing ? undefined : 'Add modules, topics and tasks before publishing.' });
      setFormOpen(false);
      refresh();
    },
    onError: (error) => {
      const parsed = getApiError(error);
      toast.error(parsed.message, { description: Object.values(fieldErrors(parsed.details))[0] });
    },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Curriculum"
        title="Roadmaps"
        description="Create drafts, publish when the curriculum validates, and archive safely. Archiving never deletes enrollments or progress."
        actions={<Button onClick={openCreate}><FilePlus2 /> New roadmap</Button>}
      />

      <Card className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
        <form
          className="flex flex-1 gap-2"
          onSubmit={(event) => { event.preventDefault(); setPage(1); }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search title, slug or category…" className="pl-9" aria-label="Search roadmaps" />
          </div>
        </form>
        <Select value={published} onChange={(event) => { setPublished(event.target.value); setPage(1); }} className="w-36" aria-label="Publish state">
          <option value="">Any state</option>
          <option value="true">Published</option>
          <option value="false">Draft</option>
        </Select>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={includeArchived} onChange={(event) => { setIncludeArchived(event.target.checked); setPage(1); }} className="size-4 rounded border-line accent-[rgb(var(--brand))]" />
          Include archived
        </label>
      </Card>

      {query.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div>
      ) : query.isError ? (
        <ErrorBlock message={getApiError(query.error).message} onRetry={() => void query.refetch()} />
      ) : !query.data || query.data.items.length === 0 ? (
        <EmptyState icon={<BookOpen className="size-6" />} title="No roadmaps match" description="Adjust the filters, or create a new draft roadmap and build its curriculum." action={<Button onClick={openCreate}><Plus /> New roadmap</Button>} />
      ) : (
        <>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas/40 text-[10px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5 font-medium">Roadmap</th>
                  <th className="px-3 py-2.5 text-right font-medium">Modules</th>
                  <th className="px-3 py-2.5 text-right font-medium">Topics</th>
                  <th className="px-3 py-2.5 text-right font-medium">Tasks</th>
                  <th className="px-3 py-2.5 text-right font-medium">Enrollments</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {query.data.items.map((roadmap) => (
                  <tr key={roadmap.id} className="hover:bg-canvas/30">
                    <td className="px-4 py-3">
                      <Link to={`/admin/roadmaps/${roadmap.id}/curriculum`} className="font-medium text-ink hover:text-brand">{roadmap.title}</Link>
                      <p className="text-[10px] text-muted">{roadmap.category} · {roadmap.difficulty} · v{roadmap.version}{roadmap.seedVersion ? ` · seed ${roadmap.seedVersion}` : ''}</p>
                    </td>
                    <td className="px-3 py-3 text-right text-muted">{roadmap.stats?.moduleCount ?? '—'}</td>
                    <td className="px-3 py-3 text-right text-muted">{roadmap.stats?.topicCount ?? '—'}</td>
                    <td className="px-3 py-3 text-right text-muted">{roadmap.stats?.taskCount ?? '—'}</td>
                    <td className="px-3 py-3 text-right font-medium text-ink">{roadmap.enrollmentCount ?? 0}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={roadmap.published ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-canvas text-muted ring-line'}>{roadmap.published ? 'Published' : 'Draft'}</Badge>
                        {roadmap.archivedAt ? <Badge tone="bg-rose-50 text-rose-700 ring-rose-200">Archived</Badge> : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${roadmap.title}`}><MoreHorizontal /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => openEdit(roadmap)}><Pencil /> Edit details</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => navigate(`/admin/roadmaps/${roadmap.id}/curriculum`)}><Layers /> Curriculum editor</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => navigate(`/admin/roadmaps/${roadmap.id}/preview`)}><Eye /> Preview</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {!roadmap.published ? (
                            <DropdownMenuItem onSelect={() => mutate.mutate({ method: 'post', path: `/admin/roadmaps/${roadmap.id}/publish` })}>
                              <UploadCloud /> Publish
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onSelect={() => mutate.mutate({ method: 'post', path: `/admin/roadmaps/${roadmap.id}/unpublish` })}>
                              <XCircle /> Unpublish
                            </DropdownMenuItem>
                          )}
                          {roadmap.archivedAt ? (
                            <DropdownMenuItem onSelect={() => mutate.mutate({ method: 'post', path: `/admin/roadmaps/${roadmap.id}/restore` })}><RefreshCcw /> Restore</DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem className="text-rose-700" onSelect={() => mutate.mutate({ method: 'post', path: `/admin/roadmaps/${roadmap.id}/archive` })}><Archive /> Archive</DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-rose-700" onSelect={() => mutate.mutate({ method: 'delete', path: `/admin/roadmaps/${roadmap.id}` })}><Trash2 /> Safe delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">Page {query.data.pagination.page} of {query.data.pagination.totalPages} · {query.data.pagination.total} roadmaps</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= query.data.pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent title={editing ? 'Edit roadmap details' : 'Create a draft roadmap'} description={editing ? 'Changing details does not affect learner progress.' : 'Drafts are invisible to learners until published with full content.'} size="lg">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Title" htmlFor="roadmap-title"><Input id="roadmap-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Data Engineering Foundations" /></Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Tagline" htmlFor="roadmap-tagline" hint="One sentence"><Input id="roadmap-tagline" value={form.tagline} onChange={(event) => setForm((current) => ({ ...current, tagline: event.target.value }))} /></Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Description" htmlFor="roadmap-description"><Textarea id="roadmap-description" rows={4} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></Field>
            </div>
            <Field label="Category" htmlFor="roadmap-category"><Input id="roadmap-category" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} /></Field>
            <Field label="Difficulty" htmlFor="roadmap-difficulty">
              <Select id="roadmap-difficulty" value={form.difficulty} onChange={(event) => setForm((current) => ({ ...current, difficulty: event.target.value as RoadmapFormState['difficulty'] }))}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </Select>
            </Field>
            <Field label="Min weeks" htmlFor="min-weeks"><Input id="min-weeks" type="number" min={1} max={104} value={form.minWeeks} onChange={(event) => setForm((current) => ({ ...current, minWeeks: Number(event.target.value) }))} /></Field>
            <Field label="Max weeks" htmlFor="max-weeks"><Input id="max-weeks" type="number" min={1} max={104} value={form.maxWeeks} onChange={(event) => setForm((current) => ({ ...current, maxWeeks: Number(event.target.value) }))} /></Field>
            <Field label="Total hours" htmlFor="total-hours"><Input id="total-hours" type="number" min={1} max={2000} value={form.totalHours} onChange={(event) => setForm((current) => ({ ...current, totalHours: Number(event.target.value) }))} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button loading={saveRoadmap.isPending} disabled={form.title.trim().length < 3 || form.tagline.trim().length < 3 || form.description.trim().length < 10} onClick={() => saveRoadmap.mutate()}>
              {editing ? 'Save changes' : 'Create draft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
