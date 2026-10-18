import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

// ------------------------------------------------------------------ Card / Panel

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('surface', className)}>{children}</div>;
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('surface overflow-hidden', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

// ------------------------------------------------------------------ Badges

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const tones: Record<Tone, string> = {
  neutral: 'bg-canvas text-ink-soft border-line',
  brand: 'bg-brand-50 text-brand-700 border-brand-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-2xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  approved: 'success',
  published: 'success',
  active: 'success',
  resolved: 'success',
  accepted: 'success',
  upheld: 'success',
  completed: 'success',
  ok: 'success',
  pending_review: 'warning',
  pending: 'warning',
  reviewing: 'warning',
  in_progress: 'info',
  changes_requested: 'warning',
  draft: 'neutral',
  rejected: 'danger',
  failed: 'danger',
  down: 'danger',
  suspended: 'danger',
  unpublished: 'neutral',
  dismissed: 'neutral',
  hidden: 'neutral',
  running: 'info',
  degraded: 'warning',
};

export function StatusBadge({ status, label }: { status: string | null | undefined; label?: string }) {
  if (!status) return <Badge tone="neutral">—</Badge>;
  const tone = STATUS_TONE[status] ?? 'neutral';
  const text = label ?? status.replace(/_/g, ' ');
  return <Badge tone={tone}>{text}</Badge>;
}

export function Coin({ value, withSign = false }: { value: number; withSign?: boolean }) {
  return (
    <span className={cn('tabular-nums', value > 0 ? 'text-emerald-700' : value < 0 ? 'text-ink' : 'text-ink-muted')}>
      {withSign && value > 0 ? '+' : ''}
      {value}
    </span>
  );
}

// ------------------------------------------------------------------ Metric

export function Metric({
  label,
  value,
  hint,
  definition,
  children,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  definition?: string;
  children?: ReactNode;
}) {
  return (
    <div className="surface p-4" title={definition}>
      <div className="text-xs font-medium text-ink-muted">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums tracking-[-0.02em] text-ink">{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-muted">{hint}</div>}
      {children}
    </div>
  );
}

// ------------------------------------------------------------------ Definition list

export function DetailList({
  items,
  columns = 2,
  className,
}: {
  items: { label: string; value: ReactNode; title?: string }[];
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        'grid gap-x-6 gap-y-3',
        columns === 1 && 'grid-cols-1',
        columns === 2 && 'grid-cols-1 sm:grid-cols-2',
        columns === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs text-ink-muted" title={item.title}>
            {item.label}
          </dt>
          <dd className="mt-0.5 break-words text-[13px] text-ink">{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

// ------------------------------------------------------------------ Tabs

export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: { id: string; label: string; count?: number | null }[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1 border-b border-line', className)} role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-[13px] font-medium transition-colors',
              isActive
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-ink-muted hover:border-line-strong hover:text-ink',
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count !== null && (
              <span
                className={cn(
                  'ml-1.5 rounded px-1 py-0.5 text-2xs tabular-nums',
                  isActive ? 'bg-brand-100 text-brand-700' : 'bg-canvas text-ink-muted',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ misc

export function PageHeading({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-5 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[13px] text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Separator({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-line', className)} />;
}

export function KeyValueInline({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-[13px]">
      <span className="text-ink-muted">{label}</span>
      <span className="text-right text-ink">{children}</span>
    </div>
  );
}
