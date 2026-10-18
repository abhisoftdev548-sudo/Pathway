import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { EmptyState, ErrorState, TableSkeleton } from './States';
import { Button } from './Button';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  align?: 'left' | 'right' | 'center';
}

export function DataTable<T>({
  columns,
  rows,
  loading,
  error,
  onRetry,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  emptyIcon,
  rowKey,
  onRowClick,
  className,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  emptyIcon?: ReactNode;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  className?: string;
}) {
  if (error) {
    return (
      <div className="surface p-4">
        <ErrorState error={error} onRetry={onRetry} />
      </div>
    );
  }

  if (loading && !rows) {
    return (
      <div className="surface overflow-hidden">
        <TableSkeleton columns={columns.length} />
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="surface p-4">
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} icon={emptyIcon} />
      </div>
    );
  }

  return (
    <div className={cn('surface overflow-hidden', className)}>
      <div className="overflow-x-auto scroll-area">
        <table className="w-full border-collapse">
          <thead className="border-b border-line bg-canvas/60">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'table-th whitespace-nowrap',
                    column.align === 'right' && 'text-right',
                    column.align === 'center' && 'text-center',
                    column.headerClassName,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'bg-surface transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-canvas/70',
                  loading && 'opacity-60',
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'table-td',
                      column.align === 'right' && 'text-right',
                      column.align === 'center' && 'text-center',
                      column.className,
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  className?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 px-1 py-3', className)}>
      <p className="text-xs text-ink-muted">
        Showing <span className="tabular-nums text-ink-soft">{from}</span>–
        <span className="tabular-nums text-ink-soft">{to}</span> of{' '}
        <span className="tabular-nums text-ink-soft">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          icon={<ChevronLeft className="h-3.5 w-3.5" />}
        >
          Previous
        </Button>
        <span className="px-2 text-xs tabular-nums text-ink-muted">
          {page} / {totalPages}
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
