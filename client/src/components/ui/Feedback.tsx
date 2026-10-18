import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Inbox, AlertTriangle, Lock, SearchX } from 'lucide-react';
import { cn } from '@/utils/cn';

export function Card({
  children,
  className,
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      whileHover={hover && !reduceMotion ? { y: -2 } : undefined}
      transition={{ duration: 0.15 }}
      className={cn('surface', hover && 'transition-shadow hover:shadow-md', className)}
    >
      {children}
    </motion.div>
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4', className)}>
      <div>
        <h3 className="text-base font-semibold text-heading">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-body">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>;
}

/** Consistent page header: modest heading + description + actions. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-4', className)}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-heading">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-body">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-muted">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <h3 className="text-sm font-semibold text-heading">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-body">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}
      role="alert"
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold text-heading">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-body">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ForbiddenState({ description }: { description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-body">
        <Lock className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold text-heading">Not available</h3>
      <p className="mt-1 max-w-sm text-sm text-body">
        {description ?? 'You do not have access to this content.'}
      </p>
    </div>
  );
}

export function NoResultsState({ query, action }: { query: string; action?: ReactNode }) {
  return (
    <EmptyState
      icon={<SearchX className="h-6 w-6" />}
      title="No matches found"
      description={query ? `Nothing matched “${query}”. Try a different search or filter.` : 'Try different filters.'}
      action={action}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="surface space-y-3 p-5">
      <Skeleton className="h-5 w-2/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-3.5 w-full" />
      ))}
      <Skeleton className="h-3.5 w-1/3" />
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="surface overflow-hidden">
      <div className="border-b border-line px-5 py-3">
        <Skeleton className="h-4 w-1/4" />
      </div>
      <div className="divide-y divide-line">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="grid gap-4 px-5 py-3.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {Array.from({ length: cols }).map((__, c) => (
              <Skeleton key={c} className="h-4" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function InlineSpinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-sm text-body">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
        className="h-4 w-4 rounded-full border-2 border-brand-200 border-t-brand-600"
        aria-hidden
      />
      {label ?? 'Loading…'}
    </div>
  );
}
