import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock3,
  Compass,
  ExternalLink,
  Layers,
  Lock,
  Play,
  Sparkles,
  Target,
} from 'lucide-react';
import { Badge, Button, Card, EmptyState, ProgressBar, Skeleton } from '@/components/ui';
import { ErrorBlock, PaceBadge, ProgressRing, TaskTypeBadge } from '@/components/common';
import { apiGet, getApiError } from '@/lib/api';
import { cn, formatMinutes } from '@/lib/utils';
import type { ModuleProgress, Task, TopicProgress, Workspace as WorkspaceData } from '@/lib/types';

function useWorkspace(enrollmentId: string) {
  return useQuery({
    queryKey: ['me', 'workspace', enrollmentId],
    queryFn: () => apiGet<WorkspaceData>(`/me/roadmaps/${enrollmentId}`),
    enabled: Boolean(enrollmentId),
  });
}

function WorkspaceHeader({ data, enrollmentId }: { data: WorkspaceData; enrollmentId: string }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <Link to="/my-roadmaps" className="inline-flex items-center gap-1 hover:text-ink"><ArrowLeft className="size-3.5" /> My roadmaps</Link>
        <span aria-hidden>/</span>
        <Link to={`/roadmaps/${data.roadmap.slug}`} className="hover:text-ink">{data.roadmap.title}</Link>
      </div>
      <div className="flex flex-col justify-between gap-5 rounded-3xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="bg-canvas text-ink/70 ring-line">{data.roadmap.category}</Badge>
            <PaceBadge pace={data.enrollment.learningPace} />
            <Badge tone="bg-canvas text-ink/70 ring-line" className="capitalize">{data.enrollment.status}</Badge>
          </div>
          <h1 className="mt-2.5 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{data.roadmap.title}</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">{data.roadmap.tagline}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1"><Layers className="size-3.5" /> {data.modules.length} modules</span>
            <span className="inline-flex items-center gap-1"><BookOpen className="size-3.5" /> {data.progress.totalTasks} tasks</span>
            <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" /> {formatMinutes(data.progress.completedMinutes)} / {formatMinutes(data.progress.totalMinutes)}</span>
            <span className="inline-flex items-center gap-1"><Sparkles className="size-3.5" /> {data.enrollment.paceMinutes} min/day pace</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <ProgressRing value={data.progress.percent} size={78} stroke={7} />
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Progress</p>
            <p className="text-sm font-semibold text-ink">{data.progress.completedTasks} / {data.progress.totalTasks} tasks</p>
            <p className="mt-0.5 text-[11px] text-muted">{data.progress.completedToday} completed today</p>
            {data.progress.nextTask ? (
              <Button asChild size="sm" className="mt-2">
                <Link to={`/workspace/${enrollmentId}/tasks/${data.progress.nextTask.id}`}><Play /> Continue</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ModuleNav({ data, enrollmentId, activeModuleId }: { data: WorkspaceData; enrollmentId: string; activeModuleId?: string }) {
  return (
    <aside className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Modules</p>
        <span className="text-[11px] text-muted">{data.modules.length}</span>
      </div>
      <div className="space-y-1.5">
        {data.modules.map((module, index) => {
          const active = module.id === activeModuleId;
          return (
            <Link
              key={module.id}
              to={`/workspace/${enrollmentId}/modules/${module.id}`}
              className={cn(
                'group flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition',
                active ? 'border-brand/30 bg-brand-soft/60' : 'border-transparent hover:border-line hover:bg-surface',
                module.locked && 'opacity-70',
              )}
            >
              <span className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold', active ? 'bg-brand text-white' : 'bg-canvas text-muted ring-1 ring-inset ring-line')}>
                {module.locked ? <Lock className="size-3" /> : String(index + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate text-[13px] font-medium', active ? 'text-brand-deep' : 'text-ink/80')}>{module.title}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted">
                  <span>{module.completedTasks}/{module.totalTasks}</span>
                  <span aria-hidden>·</span>
                  <span>{Math.round(module.percent)}%</span>
                </span>
                <ProgressBar value={module.percent} className="mt-1.5 h-1" label={`${module.title} progress`} />
              </span>
            </Link>
          );
        })}
      </div>
      <Card className="mt-4 p-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-ink"><Target className="size-3.5 text-brand" /> Honest progress</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">Only completed, published and non-archived tasks count. Reopening a task reduces the percentage immediately and keeps its audit entries.</p>
        <Link to={`/roadmaps/${data.roadmap.slug}`} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline">Roadmap details <ArrowRight className="size-3" /></Link>
      </Card>
    </aside>
  );
}

function TaskList({ tasks, enrollmentId }: { tasks: Task[]; enrollmentId: string }) {
  return (
    <div className="space-y-1.5">
      {tasks.map((task) => (
        <Link
          key={task.id}
          to={`/workspace/${enrollmentId}/tasks/${task.id}`}
          className="group flex items-center gap-3 rounded-xl border border-line/70 bg-surface px-3 py-3 transition hover:border-brand/30 hover:bg-canvas/40"
        >
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full ring-1 ring-inset',
              task.status === 'completed' ? 'bg-emerald-50 text-emerald-600 ring-emerald-200' : task.locked ? 'bg-canvas text-muted ring-line' : 'bg-brand-soft text-brand ring-brand/20',
            )}
          >
            {task.status === 'completed' ? <CheckCircle2 className="size-4" /> : task.locked ? <Lock className="size-3.5" /> : <CircleDot className="size-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className={cn('truncate text-sm font-medium', task.status === 'completed' ? 'text-muted' : 'text-ink')}>{task.title}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
              <span className="inline-flex items-center gap-1"><Clock3 className="size-3" /> {formatMinutes(task.estimatedDuration)}</span>
              <TaskTypeBadge type={task.type} />
              {task.locked && task.lockReason ? <span className="text-amber-700">{task.lockReason}</span> : null}
            </p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand" />
        </Link>
      ))}
    </div>
  );
}

function ModuleDetail({ module, tasks, enrollmentId }: { module: ModuleProgress; tasks: Task[]; enrollmentId: string }) {
  const [openTopics, setOpenTopics] = useState<Record<string, boolean>>(() => {
    const first = module.topics?.[0]?.id;
    return first ? { [first]: true } : {};
  });
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Module {module.order}</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">{module.title}</h2>
          </div>
          <div className="flex items-center gap-3">
            <ProgressRing value={module.percent} size={54} stroke={5} />
            <div className="text-xs text-muted">
              <p className="font-semibold text-ink">{module.completedTasks} / {module.totalTasks}</p>
              <p>{formatMinutes(module.estimatedMinutes)}</p>
              {module.locked ? <Badge tone="bg-amber-50 text-amber-800 ring-amber-200" className="mt-1">Locked</Badge> : null}
            </div>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">{module.description}</p>
        {module.learningOutcomes?.length ? (
          <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
            {module.learningOutcomes.map((outcome) => (
              <p key={outcome} className="flex items-start gap-2 text-xs leading-relaxed text-muted"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" /> {outcome}</p>
            ))}
          </div>
        ) : null}
        {module.locked ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs leading-relaxed text-amber-900">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            Complete the preceding module to unlock its tasks. You can still read the outcomes and preview the topic list.
          </div>
        ) : null}
      </Card>

      <div className="space-y-3">
        {(module.topics ?? []).map((topic: TopicProgress) => {
          const topicTasks = tasks.filter((task) => task.topicId === topic.id);
          const open = openTopics[topic.id] ?? false;
          return (
            <Card key={topic.id} className="overflow-hidden">
              <button
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-canvas/40"
                onClick={() => setOpenTopics((current) => ({ ...current, [topic.id]: !open }))}
                aria-expanded={open}
              >
                <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-xl text-[11px] font-semibold', topic.locked ? 'bg-canvas text-muted ring-1 ring-inset ring-line' : 'bg-brand-soft text-brand-deep')}>
                  {topic.locked ? <Lock className="size-3.5" /> : String(topic.order).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{topic.title}</span>
                  <span className="mt-0.5 block text-[11px] text-muted">{topic.completedTasks}/{topic.totalTasks} tasks · {formatMinutes(topic.estimatedDuration)} · {Math.round(topic.percent)}%</span>
                </span>
                <div className="hidden w-24 sm:block"><ProgressBar value={topic.percent} label={`${topic.title} progress`} /></div>
                <ChevronDown className={cn('size-4 shrink-0 text-muted transition', open && 'rotate-180')} />
              </button>
              {open ? (
                <div className="border-t border-line/70 bg-canvas/20 px-4 py-4">
                  <p className="text-xs leading-relaxed text-muted">{topic.description}</p>
                  {topic.resources?.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {topic.resources.map((resource) => (
                        <a key={resource.url} href={resource.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-1 text-[11px] font-medium text-brand ring-1 ring-inset ring-line hover:bg-brand-soft/40">
                          {resource.title} <ExternalLink className="size-3" />
                        </a>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-3"><TaskList tasks={topicTasks} enrollmentId={enrollmentId} /></div>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function WorkspaceView({ enrollmentId, moduleId }: { enrollmentId: string; moduleId?: string }) {
  const query = useWorkspace(enrollmentId);

  if (query.isLoading) {
    return <div className="space-y-5"><Skeleton className="h-40 w-full" /><div className="grid gap-5 lg:grid-cols-[260px_1fr]"><Skeleton className="h-96" /><Skeleton className="h-96" /></div></div>;
  }
  if (query.isError || !query.data) {
    return <ErrorBlock message={getApiError(query.error).message} onRetry={() => void query.refetch()} />;
  }

  const data = query.data;
  const selected = moduleId ? data.modules.find((module) => module.id === moduleId) : undefined;

  if (moduleId && !selected) {
    return (
      <div className="space-y-5">
        <WorkspaceHeader data={data} enrollmentId={enrollmentId} />
        <EmptyState icon={<Compass className="size-6" />} title="Module not found" description="This module may have been archived or removed during a curriculum update." action={<Button asChild><Link to={`/workspace/${enrollmentId}`}>Back to workspace <ArrowRight /></Link></Button>} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <WorkspaceHeader data={data} enrollmentId={enrollmentId} />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <ModuleNav data={data} enrollmentId={enrollmentId} activeModuleId={moduleId} />
        <div className="min-w-0">
          {selected ? (
            <ModuleDetail module={selected} tasks={data.tasks.filter((task) => task.moduleId === selected.id)} enrollmentId={enrollmentId} />
          ) : (
            <div className="space-y-5">
              <Card className="p-5">
                <h2 className="text-base font-semibold text-ink">Where you are</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">{data.roadmap.description}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: 'Modules', value: data.modules.length },
                    { label: 'Tasks complete', value: data.progress.completedTasks },
                    { label: 'Minutes spent', value: formatMinutes(data.progress.completedMinutes) },
                    { label: 'Remaining', value: formatMinutes(Math.max(0, data.progress.totalMinutes - data.progress.completedMinutes)) },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-canvas/70 p-3">
                      <p className="text-lg font-semibold text-ink">{item.value}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted">{item.label}</p>
                    </div>
                  ))}
                </div>
                {data.progress.nextTask ? (
                  <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-2xl bg-brand-soft/50 p-4 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-deep/70">Next unlocked task</p>
                      <p className="mt-0.5 text-sm font-semibold text-ink">{data.progress.nextTask.title}</p>
                      <p className="text-[11px] text-muted">{data.progress.nextTask.moduleTitle} · {formatMinutes(data.progress.nextTask.estimatedDuration)}</p>
                    </div>
                    <Button asChild>
                      <Link to={`/workspace/${enrollmentId}/tasks/${data.progress.nextTask.id}`}><Play /> Start task</Link>
                    </Button>
                  </div>
                ) : null}
              </Card>

              <div className="grid gap-3 sm:grid-cols-2">
                {data.modules.map((module) => (
                  <Link
                    key={module.id}
                    to={`/workspace/${enrollmentId}/modules/${module.id}`}
                    className="group rounded-2xl border border-line bg-surface p-4 transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-card"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Module {module.order}</span>
                      {module.locked ? <Lock className="size-3.5 text-muted" /> : <span className="text-[11px] font-semibold text-brand">{Math.round(module.percent)}%</span>}
                    </div>
                    <p className="mt-1.5 text-sm font-semibold leading-snug text-ink group-hover:text-brand">{module.title}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted">{module.description}</p>
                    <ProgressBar value={module.percent} className="mt-3" label={`${module.title} progress`} />
                    <p className="mt-1.5 text-[10px] text-muted">{module.completedTasks}/{module.totalTasks} tasks · {formatMinutes(module.estimatedMinutes)}</p>
                  </Link>
                ))}
              </div>

              {data.roadmap.learningOutcomes?.length ? (
                <Card className="p-5">
                  <h2 className="flex items-center gap-2 text-base font-semibold text-ink"><Target className="size-4 text-brand" /> What this roadmap builds</h2>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {data.roadmap.learningOutcomes.map((outcome) => (
                      <p key={outcome} className="flex items-start gap-2 text-xs leading-relaxed text-muted"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" /> {outcome}</p>
                    ))}
                  </div>
                </Card>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Workspace() {
  const { enrollmentId = '' } = useParams();
  return <WorkspaceView enrollmentId={enrollmentId} />;
}

export function ModuleView() {
  const { enrollmentId = '', moduleId } = useParams();
  return <WorkspaceView enrollmentId={enrollmentId} moduleId={moduleId} />;
}
