import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/cn';
import { ApiError } from '@/lib/api';

/** Honest empty state — never filled with invented content. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-line-strong bg-canvas/60 text-center',
        compact ? 'px-4 py-6' : 'px-6 py-12',
        className,
      )}
    >
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-surface text-ink-faint ring-1 ring-line">
        {icon ?? <Inbox className="h-4 w-4" />}
      </div>
      <p className="text-[13px] font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs leading-relaxed text-ink-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Recoverable error state with a retry button. Never falls back to fake data. */
export function ErrorState({
  error,
  onRetry,
  className,
  compact,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}) {
  const message =
    error instanceof ApiError
      ? error.message
      : error instanceof Error
        ? error.message
        : 'Something went wrong while loading this.';
  const isMaintenance = error instanceof ApiError && error.code === 'maintenance';

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-red-100 bg-red-50/50 text-center',
        compact ? 'px-4 py-6' : 'px-6 py-12',
        className,
      )}
    >
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-red-500 ring-1 ring-red-200">
        <AlertTriangle className="h-4 w-4" />
      </div>
      <p className="text-[13px] font-medium text-ink">{isMaintenance ? 'Temporarily unavailable' : "This didn't load"}</p>
      <p className="mt-1 max-w-md text-xs leading-relaxed text-ink-muted">{message}</p>
      {onRetry && (
        <Button className="mt-4" size="sm" onClick={onRetry} icon={<RefreshCw className="h-3.5 w-3.5" />}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export function LoadingBlock({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4', i === 0 ? 'w-1/3' : i % 2 ? 'w-2/3' : 'w-1/2')} />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className={cn('h-3.5', c === 0 ? 'w-1/4' : c === columns - 1 ? 'w-16' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface space-y-3 p-4">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function FullPageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-ink-muted">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      <span className="text-[13px]">{label}…</span>
    </div>
  );
}

export function InlineError({ message, className }: { message: string; className?: string }) {
  return (
    <div
      role="alert"
      className={cn('rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700', className)}
    >
      {message}
    </div>
  );
}

export function InlineSuccess({ message, className }: { message: string; className?: string }) {
  return (
    <div
      role="status"
      className={cn('rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700', className)}
    >
      {message}
    </div>
  );
}
