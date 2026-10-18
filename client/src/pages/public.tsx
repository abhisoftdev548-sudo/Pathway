import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@radix-ui/react-accordion';
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Compass,
  Gauge,
  GraduationCap,
  Layers,
  ListChecks,
  LockKeyhole,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
} from 'lucide-react';
import { Badge, Button, Card, EmptyState, Field, Input, SectionHeading, Select, Skeleton, Dialog, DialogContent, DialogFooter } from '@/components/ui';
import { DifficultyBadge, ErrorBlock, Logo, PageHeader, ProgressRing, RoadmapCard } from '@/components/common';
import { PublicLayout } from '@/components/layout';
import { apiGet, apiPost, getApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, formatMinutes } from '@/lib/utils';
import type { RoadmapDetail as RoadmapDetailType, RoadmapSummary } from '@/lib/types';

interface RoadmapListResponse {
  items: (RoadmapSummary & { stats?: RoadmapSummary['stats']; enrollment?: { enrollmentId: string; status: string; percent: number } | null })[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface Facets {
  categories: { name: string; count: number }[];
  difficulties: { name: string; count: number }[];
  totals: { roadmaps: number };
}

interface StatsResponse {
  roadmaps: number;
  tasks: number;
  topics: number;
  learners: number;
  completions: number;
}

/* ── Landing ─────────────────────────────────────────────────────────────── */

export function Landing() {
  const { user } = useAuth();
  const stats = useQuery({ queryKey: ['public', 'stats'], queryFn: () => apiGet<StatsResponse>('/stats') });
  const featured = useQuery({
    queryKey: ['public', 'featured'],
    queryFn: () => apiGet<RoadmapListResponse>('/roadmaps', { params: { limit: 6, sort: 'recommended' } }),
  });

  return (
    <PublicLayout>
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 grid-lines opacity-[0.35]" aria-hidden />
        <div className="absolute -left-40 top-10 size-[420px] rounded-full bg-brand-soft/60 blur-3xl" aria-hidden />
        <div className="absolute -right-32 top-40 size-[360px] rounded-full bg-amber-100/50 blur-3xl" aria-hidden />
        <div className="container-page relative grid gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
          <div className="animate-fade-up">
            <Badge tone="bg-surface text-brand-deep ring-brand/15" className="mb-5 px-3 py-1">
              <Sparkles className="size-3.5" /> Structured learning, not another video queue
            </Badge>
            <h1 className="font-display text-[42px] leading-[1.04] tracking-tight text-ink sm:text-6xl">
              Forge a path.
              <br />
              <span className="text-brand">Keep the momentum.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted sm:text-lg">
              PathForge turns ambitious goals into ordered roadmaps, honest progress tracking and a daily plan that fits the time you actually have.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="group">
                <Link to={user ? '/explore' : '/register'}>
                  {user ? 'Find your next roadmap' : 'Start your first roadmap'}
                  <ArrowRight className="transition group-hover:translate-x-0.5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/explore">Browse all roadmaps</Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-4 text-brand" /> Progress you can audit</span>
              <span className="inline-flex items-center gap-1.5"><Timer className="size-4 text-brand" /> 20 / 45 / 90 minute paces</span>
              <span className="inline-flex items-center gap-1.5"><LockKeyhole className="size-4 text-brand" /> Server-enforced access</span>
            </div>
          </div>

          <div className="relative animate-fade-up [animation-delay:120ms]">
            <div className="absolute -inset-4 rounded-[32px] bg-gradient-to-br from-brand/10 via-transparent to-amber-200/30 blur-2xl" aria-hidden />
            <div className="relative rounded-3xl border border-line bg-surface p-5 shadow-lift sm:p-6">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div className="flex items-center gap-2">
                  <Logo compact />
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Today · Wednesday</p>
                    <p className="text-sm font-semibold text-ink">Your learning plan</p>
                  </div>
                </div>
                <Badge tone="bg-emerald-50 text-emerald-700 ring-emerald-200">
                  <CheckCircle2 className="size-3" /> On pace
                </Badge>
              </div>
              <div className="mt-4 flex items-center gap-4 rounded-2xl bg-canvas/70 p-4">
                <ProgressRing value={42} size={72} stroke={7} />
                <div>
                  <p className="text-sm font-semibold text-ink">Frontend Web Development</p>
                  <p className="mt-1 text-xs text-muted">42% complete · 2 of 5 tasks today</p>
                  <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-brand">
                    <TrendingUp className="size-3.5" /> 9-day streak
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {[
                  { title: 'Build an accessible dialog', meta: 'Project · 45 min', done: false, active: true },
                  { title: 'Practice React state updates', meta: 'Practice · 20 min', done: false, active: false },
                  { title: 'Study the browser rendering path', meta: 'Learn · 25 min', done: true, active: false },
                ].map((item) => (
                  <div key={item.title} className="flex items-center gap-3 rounded-xl border border-line/70 bg-surface px-3 py-3">
                    <span
                      className={cn(
                        'flex size-7 items-center justify-center rounded-full',
                        item.done ? 'bg-emerald-50 text-emerald-600' : item.active ? 'bg-brand text-white' : 'bg-canvas text-muted',
                      )}
                    >
                      {item.done ? <CheckCircle2 className="size-4" /> : item.active ? <Target className="size-4" /> : <Clock3 className="size-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn('truncate text-sm font-medium', item.done ? 'text-muted line-through' : 'text-ink')}>{item.title}</p>
                      <p className="text-[11px] text-muted">{item.meta}</p>
                    </div>
                    {item.active ? <Badge tone="bg-brand-soft text-brand-deep ring-brand/15">Next</Badge> : null}
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl bg-brand px-4 py-3 text-white">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Daily goal</p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
                    <div className="h-full w-[64%] rounded-full bg-white" />
                  </div>
                  <span className="text-xs font-semibold">29 / 45 min</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-surface/70">
        <div className="container-page grid grid-cols-2 gap-6 py-8 sm:grid-cols-4">
          {[
            { label: 'Curated roadmaps', value: stats.data?.roadmaps ?? '—', icon: Route },
            { label: 'Actionable tasks', value: stats.data?.tasks?.toLocaleString() ?? '—', icon: ListChecks },
            { label: 'Topics covered', value: stats.data?.topics?.toLocaleString() ?? '—', icon: BookOpen },
            { label: 'Tasks completed', value: stats.data?.completions?.toLocaleString() ?? '—', icon: CheckCircle2 },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <item.icon className="size-5" />
              </span>
              <div>
                <p className="text-xl font-semibold tracking-tight text-ink">{item.value}</p>
                <p className="text-[11px] uppercase tracking-wide text-muted">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page py-16 sm:py-20">
        <SectionHeading
          eyebrow="Choose a destination"
          title="Roadmaps that respect the distance"
          description="Every roadmap is broken into modules, topics and three or more concrete tasks per topic. No filler lessons, no mystery progress bars."
          action={
            <Button asChild variant="outline">
              <Link to="/explore">View all {stats.data?.roadmaps ?? ''} roadmaps <ArrowRight /></Link>
            </Button>
          }
        />
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.isLoading
            ? Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-[340px]" />)
            : featured.data?.items.map((roadmap) => (
                <RoadmapCard
                  key={roadmap.id}
                  roadmap={roadmap}
                  footer={
                    <Button asChild variant="outline" className="w-full">
                      <Link to={`/roadmaps/${roadmap.slug}`}>See the path <ArrowRight /></Link>
                    </Button>
                  }
                />
              ))}
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="container-page grid gap-10 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center sm:py-20">
          <div>
            <p className="eyebrow mb-2">A pace that survives real life</p>
            <h2 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Plans that bend, not break.</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              Choose a comfortable pace, or set your own minutes. The scheduler recommends only unlocked, published tasks and caps the day at your budget. Miss a day? The plan recalculates instead of guilting you.
            </p>
            <div className="mt-6 space-y-3">
              {[
                { icon: Gauge, title: 'Transparent scheduling', text: 'Round-robin across active roadmaps, ordered within each path, capped by your daily minutes.' },
                { icon: ShieldCheck, title: 'No fake progress', text: 'Percentages come from completed published tasks only — weighted by task minutes across active roadmaps.' },
                { icon: CalendarClock, title: 'Reopens are honest', text: 'Reopen a task and progress recalculates immediately; completion history stays intact.' },
              ].map((item) => (
                <div key={item.title} className="flex gap-3">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <item.icon className="size-4.5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{item.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { name: 'Relaxed', minutes: 20, desc: 'A steady habit for busy weeks.', tone: 'border-emerald-200 bg-emerald-50/50' },
              { name: 'Standard', minutes: 45, desc: 'The balanced default for most learners.', tone: 'border-brand/25 bg-brand-soft/40', featured: true },
              { name: 'Intensive', minutes: 90, desc: 'Career switches and deadline sprints.', tone: 'border-amber-200 bg-amber-50/50' },
            ].map((pace) => (
              <Card key={pace.name} className={cn('relative p-5', pace.tone)}>
                {pace.featured ? <Badge tone="bg-brand text-white ring-brand" className="absolute -top-2.5 left-4">Most popular</Badge> : null}
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">{pace.name}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{pace.minutes}<span className="ml-1 text-sm font-medium text-muted">min/day</span></p>
                <p className="mt-2 text-xs leading-relaxed text-muted">{pace.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-16 sm:py-20">
        <SectionHeading eyebrow="How it works" title="Four steps, then momentum" description="PathForge keeps the mechanics visible so you can trust the plan." />
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { step: '01', title: 'Pick a roadmap', text: 'Compare duration, modules, prerequisites and outcomes before committing.', icon: Compass },
            { step: '02', title: 'Set your pace', text: 'Choose 20, 45 or 90 minutes a day, or enter a custom daily goal.', icon: Timer },
            { step: '03', title: 'Follow the plan', text: 'Today shows the next unlocked tasks that fit your time budget.', icon: Target },
            { step: '04', title: 'Track real progress', text: 'Every completion is timestamped, auditable and reflected in analytics.', icon: TrendingUp },
          ].map((item) => (
            <Card key={item.step} className="relative overflow-hidden p-5">
              <span className="absolute right-4 top-3 text-4xl font-semibold text-line/80">{item.step}</span>
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <item.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-ink">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="container-page pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-brand-deep px-6 py-12 text-white sm:px-12 sm:py-16">
          <div className="absolute -right-20 -top-20 size-72 rounded-full bg-white/5" aria-hidden />
          <div className="absolute -bottom-24 left-24 size-64 rounded-full bg-accent/10" aria-hidden />
          <div className="relative max-w-2xl">
            <Badge tone="bg-white/10 text-white ring-white/20">Ready when you are</Badge>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">The next task is small. The path is not.</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-white/75">
              Start with one focused session. PathForge remembers where you left off, protects your progress through curriculum updates, and shows you what to do next.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" variant="secondary" className="bg-white text-brand-deep hover:bg-white/90">
                <Link to={user ? '/explore' : '/register'}>{user ? 'Explore roadmaps' : 'Create your free account'} <ArrowRight /></Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="text-white/85 hover:bg-white/10 hover:text-white">
                <Link to="/about">How progress is calculated</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

/* ── Explore ─────────────────────────────────────────────────────────────── */

const sortOptions = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'shortest', label: 'Shortest first' },
  { value: 'longest', label: 'Longest first' },
  { value: 'newest', label: 'Newest' },
];

export function Explore() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const search = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const difficulty = params.get('difficulty') ?? '';
  const sort = params.get('sort') ?? 'recommended';
  const page = Number(params.get('page') ?? '1');
  const [searchInput, setSearchInput] = useState(search);

  const query = useQuery({
    queryKey: ['roadmaps', { search, category, difficulty, sort, page }],
    queryFn: () =>
      apiGet<RoadmapListResponse>('/roadmaps', {
        params: { search: search || undefined, category: category || undefined, difficulty: difficulty || undefined, sort, page, limit: 9 },
      }),
  });
  const facets = useQuery({ queryKey: ['roadmaps', 'facets'], queryFn: () => apiGet<Facets>('/roadmaps/facets') });
  const myRoadmaps = useQuery({
    queryKey: ['me', 'roadmaps', 'list'],
    queryFn: () => apiGet<{ items: { enrollmentId: string; status: string; roadmap: { id: string } }[] }>('/me/roadmaps'),
    enabled: Boolean(user),
  });

  const enrollmentByRoadmap = useMemo(() => {
    const map = new Map<string, { enrollmentId: string; status: string }>();
    for (const item of myRoadmaps.data?.items ?? []) map.set(item.roadmap.id, { enrollmentId: item.enrollmentId, status: item.status });
    return map;
  }, [myRoadmaps.data]);

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }

  const activeFilters = [search, category, difficulty].filter(Boolean).length;

  return (
    <PublicLayout>
      <div className="border-b border-line bg-surface">
        <div className="container-page py-10 sm:py-14">
          <PageHeader
            eyebrow="Explore"
            title="Find the roadmap that fits your next move"
            description={`Every roadmap lists its modules, tasks and honest time estimate. ${facets.data?.totals.roadmaps ?? ''} curated paths, from first principles to production systems.`}
          />
          <form
            className="mt-6 flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              update('q', searchInput.trim());
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search topics, skills or outcomes — e.g. React, MongoDB, algorithms"
                className="h-12 pl-10"
                aria-label="Search roadmaps"
              />
            </div>
            <Button type="submit" size="lg" className="sm:w-32">Search</Button>
          </form>
        </div>
      </div>

      <div className="container-page py-8">
        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="lg:w-60 lg:shrink-0">
            <div className="space-y-5 rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">Filters</p>
                {activeFilters > 0 ? (
                  <button
                    className="text-xs font-medium text-brand hover:underline"
                    onClick={() => {
                      setSearchInput('');
                      setParams(new URLSearchParams(), { replace: true });
                    }}
                  >
                    Clear all
                  </button>
                ) : null}
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Category</p>
                <div className="space-y-1">
                  <button onClick={() => update('category', '')} className={cn('block w-full rounded-lg px-2 py-1.5 text-left text-sm', !category ? 'bg-brand-soft font-medium text-brand-deep' : 'text-muted hover:bg-canvas')}>
                    All categories
                  </button>
                  {facets.isLoading
                    ? Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-7" />)
                    : facets.data?.categories.map((item) => (
                        <button
                          key={item.name}
                          onClick={() => update('category', item.name)}
                          className={cn('flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm', category === item.name ? 'bg-brand-soft font-medium text-brand-deep' : 'text-muted hover:bg-canvas')}
                        >
                          <span className="truncate">{item.name}</span>
                          <span className="text-[11px]">{item.count}</span>
                        </button>
                      ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Difficulty</p>
                <div className="flex flex-wrap gap-1.5">
                  {['beginner', 'intermediate', 'advanced'].map((level) => (
                    <button
                      key={level}
                      onClick={() => update('difficulty', difficulty === level ? '' : level)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition',
                        difficulty === level ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-muted hover:border-brand/30',
                      )}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Sort by</p>
                <Select value={sort} onChange={(event) => update('sort', event.target.value)} aria-label="Sort roadmaps">
                  {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </Select>
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted">
                {query.data ? <><span className="font-semibold text-ink">{query.data.pagination.total}</span> roadmap{query.data.pagination.total === 1 ? '' : 's'}</> : 'Loading roadmaps…'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {category ? <Badge tone="bg-brand-soft text-brand-deep ring-brand/15">{category}</Badge> : null}
                {difficulty ? <DifficultyBadge difficulty={difficulty} /> : null}
                {search ? <Badge tone="bg-canvas text-ink/70 ring-line">“{search}”</Badge> : null}
              </div>
            </div>

            {query.isLoading ? (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-[330px]" />)}
              </div>
            ) : query.isError ? (
              <ErrorBlock message={getApiError(query.error).message} onRetry={() => void query.refetch()} />
            ) : query.data && query.data.items.length > 0 ? (
              <>
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {query.data.items.map((roadmap) => {
                    const enrolled = enrollmentByRoadmap.get(roadmap.id);
                    return (
                      <RoadmapCard
                        key={roadmap.id}
                        roadmap={roadmap}
                        footer={
                          <div className="flex gap-2">
                            <Button asChild variant="outline" className="flex-1">
                              <Link to={`/roadmaps/${roadmap.slug}`}>Details</Link>
                            </Button>
                            <Button asChild className="flex-1">
                              <Link to={enrolled ? `/workspace/${enrolled.enrollmentId}` : `/roadmaps/${roadmap.slug}`}>
                                {enrolled ? 'Continue' : 'Start'} <ArrowRight />
                              </Link>
                            </Button>
                          </div>
                        }
                      />
                    );
                  })}
                </div>
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-xs text-muted">Page {query.data.pagination.page} of {query.data.pagination.totalPages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => update('page', String(page - 1))}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={page >= query.data.pagination.totalPages} onClick={() => update('page', String(page + 1))}>Next</Button>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState
                icon={<Search className="size-6" />}
                title="No roadmaps match those filters"
                description="Try a broader search, or clear the filters to see the full catalogue."
                action={<Button variant="outline" onClick={() => { setSearchInput(''); setParams(new URLSearchParams()); }}>Clear filters</Button>}
              />
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

/* ── Roadmap detail ──────────────────────────────────────────────────────── */

export function RoadmapDetail() {
  const { slug = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pace, setPace] = useState<'relaxed' | 'standard' | 'intensive' | 'custom'>('standard');
  const [customMinutes, setCustomMinutes] = useState(30);

  const query = useQuery({
    queryKey: ['roadmap', slug],
    queryFn: () => apiGet<RoadmapDetailType>(`/roadmaps/${slug}`),
    enabled: Boolean(slug),
  });

  const enroll = useMutation({
    mutationFn: () =>
      apiPost<{ enrollmentId: string }>(`/roadmaps/${query.data!.roadmap.id}/enroll`, {
        learningPace: pace,
        customDailyGoal: pace === 'custom' ? customMinutes : undefined,
      }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['roadmap', slug] });
      void queryClient.invalidateQueries({ queryKey: ['me', 'dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['me', 'roadmaps'] });
      navigate(`/workspace/${data.enrollmentId}`);
    },
  });

  if (query.isLoading) {
    return <PublicLayout><div className="container-page py-12"><Skeleton className="h-64 w-full" /><div className="mt-6 grid gap-4 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}</div></div></PublicLayout>;
  }
  if (query.isError || !query.data) {
    return <PublicLayout><div className="container-page py-16"><ErrorBlock message={getApiError(query.error).message} onRetry={() => void query.refetch()} /></div></PublicLayout>;
  }

  const { roadmap, modules, enrollment, relatedRoadmaps } = query.data;
  const budget = pace === 'relaxed' ? 20 : pace === 'standard' ? 45 : pace === 'intensive' ? 90 : Math.max(5, customMinutes);
  const totalMinutes = roadmap.stats?.totalMinutes ?? roadmap.estimatedDuration.totalHours * 60;
  const days = Math.max(1, Math.ceil(totalMinutes / budget));
  const weeks = Math.ceil(days / 7);
  const tasksPerDay = Math.max(1, Math.round(roadmap.stats?.taskCount ? roadmap.stats.taskCount / days : 1));

  return (
    <PublicLayout>
      <section className="border-b border-line bg-surface">
        <div className="container-page py-10 sm:py-14">
          <nav className="mb-5 flex items-center gap-1.5 text-xs text-muted" aria-label="Breadcrumb">
            <Link to="/explore" className="hover:text-ink">Explore</Link>
            <span>/</span>
            <span className="truncate text-ink/70">{roadmap.category}</span>
          </nav>
          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="bg-brand-soft text-brand-deep ring-brand/15">{roadmap.category}</Badge>
                <DifficultyBadge difficulty={roadmap.difficulty} />
                <Badge tone="bg-canvas text-ink/70 ring-line"><Clock3 className="size-3" /> {roadmap.estimatedDuration.minWeeks}–{roadmap.estimatedDuration.maxWeeks} weeks</Badge>
              </div>
              <h1 className="mt-4 font-display text-4xl leading-tight tracking-tight text-ink sm:text-5xl">{roadmap.title}</h1>
              <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted sm:text-base">{roadmap.description}</p>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Modules', value: roadmap.stats?.moduleCount ?? modules.length, icon: Layers },
                  { label: 'Topics', value: roadmap.stats?.topicCount ?? modules.reduce((sum, m) => sum + m.topicCount, 0), icon: BookOpen },
                  { label: 'Tasks', value: roadmap.stats?.taskCount ?? modules.reduce((sum, m) => sum + m.taskCount, 0), icon: ListChecks },
                  { label: 'Est. hours', value: Math.round(roadmap.estimatedDuration.totalHours), icon: GraduationCap },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-line bg-canvas/50 px-3 py-3">
                    <item.icon className="size-4 text-brand" />
                    <p className="mt-2 text-xl font-semibold text-ink">{item.value}</p>
                    <p className="text-[11px] uppercase tracking-wide text-muted">{item.label}</p>
                  </div>
                ))}
              </div>
              {roadmap.skills?.length ? (
                <div className="mt-6 flex flex-wrap gap-1.5">
                  {roadmap.skills.map((skill) => <span key={skill} className="rounded-md bg-canvas px-2 py-1 text-[11px] font-medium text-muted">{skill}</span>)}
                </div>
              ) : null}
            </div>

            <Card className="h-fit p-5 lg:sticky lg:top-24">
              {enrollment ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">You're enrolled</p>
                  <div className="mt-3 flex items-center gap-4">
                    <ProgressRing value={enrollment.percent} size={68} />
                    <div>
                      <p className="text-sm font-semibold text-ink">{enrollment.completedTasks} of {enrollment.totalTasks} tasks</p>
                      <p className="mt-1 text-xs text-muted">{formatMinutes(enrollment.completedMinutes)} studied</p>
                      <Badge tone="bg-canvas text-ink/70 ring-line" className="mt-2">{enrollment.status}</Badge>
                    </div>
                  </div>
                  {enrollment.nextTask ? <p className="mt-4 rounded-xl bg-canvas/70 p-3 text-xs leading-relaxed text-muted">Next up: <span className="font-semibold text-ink">{enrollment.nextTask.title}</span></p> : null}
                  <Button asChild className="mt-4 w-full" size="lg">
                    <Link to={`/workspace/${enrollment.enrollmentId}`}>Open workspace <ArrowRight /></Link>
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Start this roadmap</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">Pick a pace now. You can change it any time without losing progress.</p>
                  <div className="mt-4 space-y-2">
                    {[
                      { id: 'relaxed', label: 'Relaxed', minutes: '20 min/day' },
                      { id: 'standard', label: 'Standard', minutes: '45 min/day' },
                      { id: 'intensive', label: 'Intensive', minutes: '90 min/day' },
                      { id: 'custom', label: 'Custom', minutes: 'Your own budget' },
                    ].map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setPace(option.id as typeof pace)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition',
                          pace === option.id ? 'border-brand bg-brand-soft/50' : 'border-line hover:border-brand/30',
                        )}
                      >
                        <span className="text-sm font-medium text-ink">{option.label}</span>
                        <span className="text-xs text-muted">{option.minutes}</span>
                      </button>
                    ))}
                  </div>
                  {pace === 'custom' ? (
                    <div className="mt-3">
                      <Field label="Daily minutes" htmlFor="custom-minutes" hint="5–300">
                        <Input id="custom-minutes" type="number" min={5} max={300} value={customMinutes} onChange={(event) => setCustomMinutes(Number(event.target.value))} />
                      </Field>
                    </div>
                  ) : null}
                  <div className="mt-4 rounded-xl bg-canvas/70 p-3 text-xs leading-relaxed text-muted">
                    <p><span className="font-semibold text-ink">≈ {tasksPerDay} task{tasksPerDay === 1 ? '' : 's'} per day</span> at {budget} minutes, finishing in about {weeks} week{weeks === 1 ? '' : 's'}.</p>
                    <p className="mt-1">Based on {Math.round(totalMinutes / 60)} hours of estimated work. Your plan adapts to real progress.</p>
                  </div>
                  {user ? (
                    <Button className="mt-4 w-full" size="lg" onClick={() => setDialogOpen(true)}>Enroll with this pace</Button>
                  ) : (
                    <Button asChild className="mt-4 w-full" size="lg">
                      <Link to="/register" state={{ from: `/roadmaps/${slug}` }}>Create an account to enroll</Link>
                    </Button>
                  )}
                </>
              )}
              <p className="mt-3 text-center text-[11px] text-muted">No card required · Progress is saved automatically</p>
            </Card>
          </div>
        </div>
      </section>

      <section className="container-page grid gap-10 py-10 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-ink">Curriculum</h2>
            <span className="text-xs text-muted">{modules.length} modules · {roadmap.stats?.taskCount ?? modules.reduce((sum, m) => sum + m.taskCount, 0)} tasks</span>
          </div>
          <Accordion type="multiple" className="mt-4 space-y-3" defaultValue={modules.slice(0, 1).map((module) => module.id)}>
            {modules.map((module, moduleIndex) => (
              <AccordionItem key={module.id} value={module.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
                <AccordionTrigger className="group flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-canvas/40">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-sm font-semibold text-brand-deep">{(moduleIndex + 1).toString().padStart(2, '0')}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{module.title}</span>
                    <span className="mt-0.5 block text-xs text-muted">{module.topicCount} topics · {module.taskCount} tasks · {formatMinutes(module.estimatedMinutes)}</span>
                  </span>
                  <ChevronDown className="size-4 shrink-0 text-muted transition group-data-[state=open]:rotate-180" />
                </AccordionTrigger>
                <AccordionContent className="border-t border-line/70 px-5 pb-5 pt-4">
                  <p className="text-sm leading-relaxed text-muted">{module.description}</p>
                  <div className="mt-4 space-y-1">
                    {module.topics.map((topic, topicIndex) => (
                      <div key={topic.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-canvas/60">
                        <span className="w-6 text-[11px] font-mono text-muted">{(topicIndex + 1).toString().padStart(2, '0')}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{topic.title}</p>
                          <p className="text-[11px] text-muted">{topic.taskCount} tasks · {formatMinutes(topic.estimatedDuration)}</p>
                        </div>
                        {enrollment ? (
                          <Button asChild variant="ghost" size="icon-sm" aria-label={`Open ${topic.title}`}>
                            <Link to={`/workspace/${enrollment.enrollmentId}/modules/${module.id}`}><ArrowRight /></Link>
                          </Button>
                        ) : (
                          <LockKeyhole className="size-3.5 text-muted/60" aria-label="Enroll to unlock" />
                        )}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <Card className="p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><Target className="size-4 text-brand" /> What you'll be able to do</h3>
              <ul className="mt-3 space-y-2">
                {roadmap.learningOutcomes?.map((outcome) => (
                  <li key={outcome} className="flex gap-2 text-sm leading-relaxed text-muted">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> {outcome}
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><ListChecks className="size-4 text-brand" /> Before you start</h3>
              {roadmap.prerequisites?.length ? (
                <ul className="mt-3 space-y-2">
                  {roadmap.prerequisites.map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-relaxed text-muted">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" /> {item}
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-3 text-sm text-muted">No formal prerequisites. Curiosity and consistent practice are enough.</p>}
              <div className="mt-4 rounded-xl bg-canvas/70 p-3 text-xs leading-relaxed text-muted">
                <p className="flex items-center gap-1.5 font-semibold text-ink"><ShieldCheck className="size-3.5 text-brand" /> How progress works</p>
                <p className="mt-1.5">Each completion counts only for published, non-archived tasks. Reopening a task recalculates percentages immediately and keeps the audit trail.</p>
              </div>
            </Card>
          </div>
        </div>

        <aside className="space-y-5">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-ink">At a glance</h3>
            <dl className="mt-3 space-y-3 text-sm">
              {[
                ['Category', roadmap.category],
                ['Difficulty', roadmap.difficultyLabel || roadmap.difficulty],
                ['Duration', `${roadmap.estimatedDuration.minWeeks}–${roadmap.estimatedDuration.maxWeeks} weeks`],
                ['Estimated hours', `${Math.round(roadmap.estimatedDuration.totalHours)} hours`],
                ['Modules', String(roadmap.stats?.moduleCount ?? modules.length)],
                ['Tasks', String(roadmap.stats?.taskCount ?? modules.reduce((sum, m) => sum + m.taskCount, 0))],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-3">
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-right font-medium text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
          {relatedRoadmaps?.length ? (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-ink">Continue the theme</h3>
              <div className="mt-3 space-y-3">
                {relatedRoadmaps.slice(0, 3).map((item) => (
                  <Link key={item.id} to={`/roadmaps/${item.slug}`} className="group block rounded-xl border border-line p-3 transition hover:border-brand/30 hover:bg-canvas/50">
                    <p className="text-sm font-medium text-ink group-hover:text-brand">{item.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">{item.tagline}</p>
                  </Link>
                ))}
              </div>
            </Card>
          ) : null}
        </aside>
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent title="Confirm your pace" description={`You're about to start ${roadmap.title}. You can change pace later without losing progress.`}>
          <div className="rounded-xl bg-canvas/70 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Daily budget</span>
              <span className="font-semibold text-ink">{budget} minutes</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted">Estimated finish</span>
              <span className="font-semibold text-ink">≈ {weeks} week{weeks === 1 ? '' : 's'}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted">Recommended pace</span>
              <span className="font-semibold text-ink">{tasksPerDay} task{tasksPerDay === 1 ? '' : 's'} / day</span>
            </div>
          </div>
          {enroll.isError ? <div className="mt-4"><ErrorBlock message={getApiError(enroll.error).message} /></div> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button loading={enroll.isPending} onClick={() => enroll.mutate()}>Enroll and open workspace</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PublicLayout>
  );
}

/* ── About ───────────────────────────────────────────────────────────────── */

export function About() {
  return (
    <PublicLayout>
      <section className="border-b border-line bg-surface">
        <div className="container-narrow py-14 sm:py-20">
          <Badge tone="bg-brand-soft text-brand-deep ring-brand/15">About PathForge</Badge>
          <h1 className="mt-4 font-display text-4xl leading-tight tracking-tight text-ink sm:text-5xl">Learning should feel like a path, not a pile.</h1>
          <p className="mt-5 text-[15px] leading-relaxed text-muted sm:text-lg">
            PathForge is a roadmap-based learning platform built around three commitments: a clear sequence, an honest pace, and progress you can verify. It is designed for people who want depth without losing the thread.
          </p>
        </div>
      </section>

      <section className="container-page py-14">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink">What makes a roadmap different from a playlist?</h2>
            <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted">
              <p>A playlist gives you volume. A roadmap gives you order, prerequisites and a definition of done. Every PathForge roadmap is structured as modules → topics → tasks, with each topic producing at least three concrete pieces of work: learn it, practise it, apply it.</p>
              <p>Tasks carry a type, an estimate, learning objectives, instructions and acceptance criteria. That is enough structure for the platform to plan your day, and for you to know when something is genuinely finished.</p>
              <p>Generated curricula are seeded with stable keys, so curriculum updates can add published tasks without resetting progress. Removed content is archived, never silently deleted.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: ShieldCheck, title: 'Progress you can trust', text: 'Percentages count completed published tasks only, weighted by estimated minutes. Archived and unpublished content is excluded.' },
              { icon: Timer, title: 'Pace without guilt', text: 'Relaxed (20), Standard (45), Intensive (90) or a custom daily goal. The scheduler never suggests more than your remaining budget.' },
              { icon: LockKeyhole, title: 'Access enforced server-side', text: 'Guests see published roadmaps. Learners see their own progress. Admins manage content. Roles are checked on the API, not just hidden in the UI.' },
              { icon: ShieldCheck, title: 'Audit-friendly by design', text: 'Completions, reopens and progress changes are timestamped. Your history remains available even after reopening a task.' },
            ].map((item) => (
              <Card key={item.title} className="p-5">
                <span className="flex size-9 items-center justify-center rounded-xl bg-brand-soft text-brand"><item.icon className="size-4.5" /></span>
                <h3 className="mt-3 text-sm font-semibold text-ink">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="container-page py-14">
          <SectionHeading eyebrow="The mechanics" title="How the numbers are calculated" description="No mystery percentages. Here is the arithmetic behind the interface." />
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand">Overall progress</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">Time-weighted across active, paused and completed enrollments: completed task minutes ÷ total eligible published task minutes. Archived roadmaps are excluded. Zero eligible tasks safely returns 0%.</p>
              <div className="mt-4 rounded-xl bg-canvas p-3 font-mono text-[11px] leading-relaxed text-ink/70">percent = completedMinutes / totalMinutes × 100</div>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand">Roadmap progress</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">Completed eligible tasks ÷ total eligible tasks in that roadmap. Unlocking respects module and task prerequisites; daily plans only include unlocked tasks.</p>
              <div className="mt-4 rounded-xl bg-canvas p-3 font-mono text-[11px] leading-relaxed text-ink/70">percent = completedTasks / eligibleTasks × 100</div>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand">Daily plan</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">Published, unlocked tasks in curriculum order, spread round-robin across active roadmaps, capped by your pace budget and remaining minutes for today.</p>
              <div className="mt-4 rounded-xl bg-canvas p-3 font-mono text-[11px] leading-relaxed text-ink/70">budget = paceMinutes − minutesAlreadyLearnedToday</div>
            </Card>
          </div>
        </div>
      </section>

      <section className="container-page py-14">
        <div className="rounded-3xl border border-line bg-surface p-8 sm:p-10">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-ink">Ready to give your effort a shape?</h2>
              <p className="mt-2 text-sm text-muted">Pick a roadmap, set a pace, and let today's plan be small and specific.</p>
            </div>
            <Button asChild size="lg"><Link to="/explore">Explore roadmaps <ArrowRight /></Link></Button>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
