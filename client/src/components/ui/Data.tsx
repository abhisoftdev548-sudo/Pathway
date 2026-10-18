import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { cn } from '@/utils/cn';
import { STATUS_LABELS } from '@/utils/constants';

export { STATUS_LABELS };

// ── Badge ────────────────────────────────────────────────────────────────────

const badgeTones: Record<string, string> = {
  neutral: 'bg-surface-muted text-body',
  brand: 'bg-brand-50 text-brand-700',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof badgeTones | string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        badgeTones[tone] ?? badgeTones.neutral,
        className
      )}
    >
      {children}
    </span>
  );
}

export function statusTone(status?: string): string {
  switch (status) {
    case 'APPROVED':
      return 'success';
    case 'PENDING_REVIEW':
      return 'warning';
    case 'CHANGES_REQUESTED':
      return 'warning';
    case 'REJECTED':
    case 'SUSPENDED':
      return 'danger';
    case 'UNPUBLISHED':
    case 'ARCHIVED':
      return 'neutral';
    case 'DRAFT':
      return 'info';
    default:
      return 'neutral';
  }
}

// ── StatCard ─────────────────────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'neutral' | 'brand' | 'success' | 'warning';
}) {
  const iconTone = {
    neutral: 'bg-surface-muted text-body',
    brand: 'bg-brand-50 text-brand-600',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
  }[tone];
  return (
    <div className="surface flex items-start gap-3.5 p-4">
      {icon && <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', iconTone)}>{icon}</div>}
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-body">{label}</p>
        <p className="mt-1 truncate text-xl font-semibold text-heading">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-body">{hint}</p>}
      </div>
    </div>
  );
}

// ── Avatar ───────────────────────────────────────────────────────────────────

export function Avatar({
  name,
  src,
  size = 'md',
}: {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass = { sm: 'h-7 w-7 text-xs', md: 'h-9 w-9 text-sm', lg: 'h-14 w-14 text-lg' }[size];
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover ring-1 ring-line', sizeClass)}
        onError={(e) => {
          // Sensible image-error state: fall back to initials on broken images.
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-brand-100 font-medium text-brand-700 ring-1 ring-brand-200',
        sizeClass
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}

// ── Rating stars ─────────────────────────────────────────────────────────────

export function RatingStars({ value, count, size = 'sm' }: { value?: number | null; count?: number; size?: 'sm' | 'md' }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const starSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4.5 w-4.5';
  return (
    <span className="inline-flex items-center gap-1">
      <Star className={cn(starSize, 'fill-amber-400 text-amber-400')} aria-hidden />
      <span className="text-xs font-medium text-heading">{value.toFixed(1)}</span>
      {count !== undefined && count > 0 && <span className="text-xs text-muted">({count})</span>}
    </span>
  );
}

// ── ProgressBar ──────────────────────────────────────────────────────────────

export function ProgressBar({
  value,
  max = 100,
  label,
  tone = 'brand',
  animated = true,
}: {
  value: number;
  max?: number;
  label?: ReactNode;
  tone?: 'brand' | 'success' | 'warning' | 'danger';
  animated?: boolean;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const toneClass = {
    brand: 'bg-brand-600',
    success: 'bg-success-soft0',
    warning: 'bg-warning-soft0',
    danger: 'bg-danger-soft0',
  }[tone];
  return (
    <div>
      {label && (
        <div className="mb-1 flex items-center justify-between text-xs text-body">
          <span>{label}</span>
          <span>{Math.round(pct)}%</span>
        </div>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
        <div
          className={cn('h-full rounded-full transition-all duration-500', toneClass)}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          {...(animated ? {} : { style: { width: `${pct}%`, transition: 'none' } })}
        />
      </div>
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

export interface TabItem {
  key: string;
  label: ReactNode;
  count?: number;
}

export function Tabs({
  items,
  active,
  onChange,
  className,
}: {
  items: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex gap-1 overflow-x-auto border-b border-line', className)} role="tablist">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          aria-selected={active === item.key}
          onClick={() => onChange(item.key)}
          className={cn(
            'relative whitespace-nowrap px-3.5 py-2.5 text-sm font-medium transition-colors',
            active === item.key ? 'text-brand-700' : 'text-body hover:text-heading'
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  active === item.key ? 'bg-brand-100 text-brand-700' : 'bg-surface-muted text-body'
                )}
              >
                {item.count}
              </span>
            )}
          </span>
          {active === item.key && (
            <motion.span
              layoutId="tab-underline"
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600"
              aria-hidden
            />
          )}
        </button>
      ))}
    </div>
  );
}

// ── Pagination ───────────────────────────────────────────────────────────────

export function Pagination({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
      <p className="text-xs text-body">
        Page {page} of {totalPages} · {total} total
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="rounded-md p-1.5 text-body hover:bg-surface-muted disabled:opacity-40 disabled:hover:bg-transparent"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="rounded-md p-1.5 text-body hover:bg-surface-muted disabled:opacity-40 disabled:hover:bg-transparent"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Table ────────────────────────────────────────────────────────────────────

export function Table({ head, children, className }: { head: ReactNode[]; children: ReactNode; className?: string }) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full min-w-[560px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line">
            {head.map((h, i) => (
              <th key={i} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-body">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3 align-middle text-body', className)}>{children}</td>;
}

export function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th className={cn('px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-body', className)}>
      {children}
    </th>
  );
}
