import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Clock3,
  Flame,
  Lock,
  Play,
  Route,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Badge, Button, Card, ProgressBar, Skeleton } from './ui';
import { cn, difficultyTone, formatMinutes, paceLabel, statusTone, taskTypeMeta } from '@/lib/utils';
import type { EnrollmentSummary, RoadmapSummary, Task, TaskType } from '@/lib/types';

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link to="/" className={cn('group flex items-center gap-2.5', className)} aria-label="PathForge home">
      <span className="relative flex size-9 items-center justify-center rounded-xl bg-brand text-white shadow-sm transition group-hover:rotate-3">
        <Route className="size-[18px]" strokeWidth={2.2} aria-hidden />
        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-accent ring-2 ring-canvas" aria-hidden />
      </span>
      {!compact ? (
        <span className="text-[17px] font-semibold tracking-tight text-ink">
          Path<span className="text-brand">Forge</span>
        </span>
      ) : null}
    </Link>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="max-w-3xl">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="text-[26px] font-semibold leading-tight text-ink sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 text-sm leading-relaxed text-muted sm:text-[15px]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'brand' | 'accent' | 'sky' | 'rose';
}) {
  const tones = {
    brand: 'bg-brand-soft text-brand-deep',
    accent: 'bg-amber-50 text-amber-700',
    sky: 'bg-sky-50 text-sky-700',
    rose: 'bg-rose-50 text-rose-700',
  } as const;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">{value}</p>
          {hint ? <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p> : null}
        </div>
        {icon ? <span className={cn('flex size-10 items-center justify-center rounded-xl', tones[tone])}>{icon}</span> : null}
      </div>
    </Card>
  );
}

export function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  label,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  className?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const safe = Math.min(100, Math.max(0, value));
  const offset = circumference - (safe / 100) * circumference;
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgb(var(--line))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(var(--brand))"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="absolute text-[11px] font-semibold text-ink">{label ?? `${Math.round(safe)}%`}</span>
    </div>
  );
}

export function TaskTypeBadge({ type, className }: { type: TaskType; className?: string }) {
  const meta = taskTypeMeta[type] ?? taskTypeMeta.practice;
  return (
    <Badge tone={meta.tone} className={className}>
      {meta.label}
    </Badge>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: string }) {
  return <Badge tone={difficultyTone(difficulty)}>{difficulty}</Badge>;
}

export function PaceBadge({ pace }: { pace: string }) {
  return <Badge tone="bg-canvas text-ink/70 ring-line">{paceLabel(pace)}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{status.replace('_', ' ')}</Badge>;
}

export function RoadmapCard({
  roadmap,
  enrollment,
  footer,
}: {
  roadmap: RoadmapSummary;
  enrollment?: EnrollmentSummary | null;
  footer?: ReactNode;
}) {
  return (
    <Card className="group flex h-full flex-col overflow-hidden transition duration-300 hover:-translate-y-0.5 hover:shadow-lift">
      <div className="relative h-1.5 w-full bg-gradient-to-r from-brand via-brand/60 to-accent/70" aria-hidden />
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <Badge tone="bg-canvas text-ink/70 ring-line">{roadmap.category}</Badge>
          <DifficultyBadge difficulty={roadmap.difficulty} />
          {enrollment ? <StatusBadge status={enrollment.status} /> : null}
        </div>
        <h3 className="text-lg font-semibold leading-snug tracking-tight text-ink">
          <Link to={`/roadmaps/${roadmap.slug}`} className="hover:text-brand">
            {roadmap.title}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{roadmap.tagline || roadmap.description}</p>

        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-canvas/70 px-2 py-2">
            <dt className="text-[10px] uppercase tracking-wide text-muted">Modules</dt>
            <dd className="text-sm font-semibold text-ink">{roadmap.stats?.moduleCount ?? roadmap.moduleCount ?? '—'}</dd>
          </div>
          <div className="rounded-xl bg-canvas/70 px-2 py-2">
            <dt className="text-[10px] uppercase tracking-wide text-muted">Tasks</dt>
            <dd className="text-sm font-semibold text-ink">{roadmap.stats?.taskCount ?? roadmap.taskCount ?? '—'}</dd>
          </div>
          <div className="rounded-xl bg-canvas/70 px-2 py-2">
            <dt className="text-[10px] uppercase tracking-wide text-muted">Weeks</dt>
            <dd className="text-sm font-semibold text-ink">
              {roadmap.estimatedDuration?.minWeeks ?? '—'}–{roadmap.estimatedDuration?.maxWeeks ?? '—'}
            </dd>
          </div>
        </dl>

        {enrollment ? (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
              <span>{enrollment.completedTasks} of {enrollment.totalTasks} tasks complete</span>
              <span className="font-semibold text-ink">{Math.round(enrollment.percent)}%</span>
            </div>
            <ProgressBar value={enrollment.percent} label={`${roadmap.title} progress`} />
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {(roadmap.skills ?? []).slice(0, 3).map((skill) => (
              <span key={skill} className="rounded-md bg-canvas px-2 py-1 text-[11px] font-medium text-muted">
                {skill}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-5">{footer ?? null}</div>
      </div>
    </Card>
  );
}

export function TaskRow({
  task,
  href,
  onComplete,
  completing,
  showRoadmap = false,
  compact = false,
}: {
  task: Task;
  href: string;
  onComplete?: () => void;
  completing?: boolean;
  showRoadmap?: boolean;
  compact?: boolean;
}) {
  const isCompleted = task.status === 'completed';
  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-xl border border-transparent px-3 py-3 transition hover:border-line hover:bg-canvas/50',
        compact && 'py-2.5',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ring-1 ring-inset',
          isCompleted
            ? 'bg-emerald-50 text-emerald-600 ring-emerald-200'
            : task.locked
              ? 'bg-canvas text-muted ring-line'
              : 'bg-brand-soft text-brand ring-brand/20',
        )}
        aria-hidden
      >
        {isCompleted ? <CheckCircle2 className="size-4" /> : task.locked ? <Lock className="size-3.5" /> : <CircleDot className="size-4" />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            to={href}
            className={cn('text-sm font-semibold text-ink transition hover:text-brand', isCompleted && 'text-ink/60')}
          >
            {task.title}
          </Link>
          <TaskTypeBadge type={task.type} />
          {task.status === 'in_progress' ? <Badge tone="bg-amber-50 text-amber-800 ring-amber-200">In progress</Badge> : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <Clock3 className="size-3.5" aria-hidden /> {formatMinutes(task.estimatedDuration)}
          </span>
          {showRoadmap && task.roadmapTitle ? <span>{task.roadmapTitle}</span> : null}
          {!showRoadmap && task.topicTitle ? <span>{task.topicTitle}</span> : null}
          {task.locked && task.lockReason ? <span className="text-amber-700">{task.lockReason}</span> : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {onComplete && !isCompleted && !task.locked ? (
          <Button size="sm" variant="secondary" onClick={onComplete} loading={completing} className="hidden sm:inline-flex">
            <CheckCircle2 /> Complete
          </Button>
        ) : null}
        <Button asChild variant="ghost" size="icon-sm" aria-label={`Open ${task.title}`}>
          <Link to={href}>
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function ContinueCard({
  enrollmentId,
  roadmapTitle,
  percent,
  nextTask,
}: {
  enrollmentId: string;
  roadmapTitle: string;
  percent: number;
  nextTask: Task | null;
}) {
  return (
    <Card className="relative overflow-hidden bg-brand-deep p-6 text-white">
      <div className="absolute -right-16 -top-16 size-48 rounded-full bg-white/5" aria-hidden />
      <div className="absolute -bottom-20 -right-8 size-40 rounded-full bg-accent/10" aria-hidden />
      <div className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">Continue learning</p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight">{roadmapTitle}</h3>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${Math.min(100, percent)}%` }} />
          </div>
          <span className="text-xs font-medium text-white/70">{Math.round(percent)}%</span>
        </div>
        <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-white/80">
          {nextTask ? nextTask.title : 'Every published task is complete. Revisit your notes or explore a new roadmap.'}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button asChild variant="secondary" className="bg-white text-brand-deep hover:bg-white/90">
            <Link to={nextTask ? `/workspace/${enrollmentId}/tasks/${nextTask.id}` : `/workspace/${enrollmentId}`}>
              <Play /> {nextTask ? `Start · ${formatMinutes(nextTask.estimatedDuration)}` : 'Open workspace'}
            </Link>
          </Button>
          <Button asChild variant="ghost" className="text-white/80 hover:bg-white/10 hover:text-white">
            <Link to={`/workspace/${enrollmentId}`}>View roadmap</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function StreakCard({
  current,
  longest,
  todayMinutes,
  goalMinutes,
}: {
  current: number;
  longest: number;
  todayMinutes: number;
  goalMinutes: number;
}) {
  const ratio = goalMinutes > 0 ? Math.min(100, (todayMinutes / goalMinutes) * 100) : 0;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Flame className="size-5" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-muted">Current streak</p>
            <p className="text-lg font-semibold text-ink">
              {current} {current === 1 ? 'day' : 'days'}
            </p>
          </div>
        </div>
        <span className="text-xs text-muted">Best {longest}</span>
      </div>
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
          <span>Today's focus</span>
          <span className="font-medium text-ink">
            {todayMinutes} / {goalMinutes} min
          </span>
        </div>
        <ProgressBar value={ratio} barClassName="bg-accent" label="Today's learning goal" />
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs leading-relaxed text-muted">
        <Sparkles className="size-3.5 text-accent" aria-hidden />
        {ratio >= 100 ? "Daily goal met — anything else is a bonus." : `${Math.max(0, goalMinutes - todayMinutes)} minutes to hit today's goal.`}
      </p>
    </Card>
  );
}

export function TrendPill({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
      <TrendingUp className="size-3" /> {value}%
    </span>
  );
}

export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="border-rose-200 bg-rose-50/50 p-6">
      <p className="text-sm font-semibold text-rose-900">Something went wrong</p>
      <p className="mt-1 text-sm leading-relaxed text-rose-800/80">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </Card>
  );
}

export function PaginationControls({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 pt-4">
      <p className="text-xs text-muted">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
