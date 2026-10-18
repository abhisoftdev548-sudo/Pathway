import { useState, type ReactNode } from 'react';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Primitives';
import { FilterBar } from './FilterBar';
import { usePagedQuery } from '@/lib/queries';
import { formatDateTime, truncate } from '@/lib/format';

export interface LogRow {
  id: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface LogFilterDef {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

/**
 * Self-contained filterable log table. Owns its own page/search/filter state
 * and the data query, so pages stay short.
 */
export function LogTable<T extends LogRow>({
  queryKey,
  pathBuilder,
  columns,
  filters = [],
  searchPlaceholder = 'Search',
  emptyTitle = 'No entries yet',
  emptyDescription,
  pageSize = 25,
  extraActions,
}: {
  queryKey: readonly unknown[];
  pathBuilder: (state: { page: number; pageSize: number; search: string; filters: Record<string, string> }) => string;
  columns: Column<T>[];
  filters?: LogFilterDef[];
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  pageSize?: number;
  extraActions?: ReactNode;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(filters.map((f) => [f.key, 'all'])),
  );

  const path = pathBuilder({ page, pageSize, search, filters: filterValues });
  const query = usePagedQuery<T>([...queryKey, path], path);

  const reset = () => {
    setSearch('');
    setFilterValues(Object.fromEntries(filters.map((f) => [f.key, 'all'])));
    setPage(1);
  };

  const isFiltered = search !== '' || Object.values(filterValues).some((v) => v !== 'all');

  return (
    <>
      <FilterBar
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder={searchPlaceholder}
        filters={filters.map((filter) => ({
          key: filter.key,
          label: filter.label,
          options: filter.options,
          value: filterValues[filter.key] ?? 'all',
          onChange: (value) => {
            setFilterValues((current) => ({ ...current, [filter.key]: value }));
            setPage(1);
          },
        }))}
      >
        {extraActions}
        {isFiltered && (
          <button type="button" onClick={reset} className="px-1 pb-2 text-xs text-brand-600 hover:underline">
            Reset filters
          </button>
        )}
      </FilterBar>

      <DataTable
        columns={columns}
        rows={query.data?.items}
        loading={query.isLoading || query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        rowKey={(row) => row.id}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
      />

      {query.data && query.data.total > 0 && (
        <Pagination
          page={query.data.page}
          pageSize={query.data.pageSize}
          total={query.data.total}
          onPage={(next) => {
            setPage(next);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}
    </>
  );
}

export function MetadataCell({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '{}') return <span className="text-ink-faint">—</span>;
  let parsed: Record<string, unknown> = {};
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as Record<string, unknown>;
    } catch {
      return <span className="text-ink-muted">{truncate(value, 60)}</span>;
    }
  } else if (typeof value === 'object') {
    parsed = value as Record<string, unknown>;
  }
  const entries = Object.entries(parsed).slice(0, 3);
  if (!entries.length) return <span className="text-ink-faint">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {entries.map(([key, val]) => (
        <Badge key={key} tone="neutral">
          {key}: {String(val)}
        </Badge>
      ))}
    </span>
  );
}

export function JsonViewer({ value }: { value: unknown }) {
  let text = '';
  try {
    text = JSON.stringify(typeof value === 'string' ? JSON.parse(value) : value, null, 2);
  } catch {
    text = String(value ?? '');
  }
  if (!text || text === '{}') return <span className="text-ink-faint">No additional data recorded.</span>;
  return (
    <pre className="max-h-64 overflow-auto rounded-md border border-line bg-canvas p-3 text-2xs leading-relaxed text-ink-soft scroll-area">
      {text}
    </pre>
  );
}

export function TimestampCell({ value }: { value: string | null | undefined }) {
  return <span className="whitespace-nowrap tabular-nums text-ink-muted">{formatDateTime(value)}</span>;
}
