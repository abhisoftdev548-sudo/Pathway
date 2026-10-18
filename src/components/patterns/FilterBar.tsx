import { useState, type ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { Select } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDef {
  key: string;
  label?: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function FilterBar({
  search,
  onSearch,
  searchPlaceholder = 'Search',
  filters = [],
  children,
  className,
}: {
  search?: string;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterDef[];
  children?: ReactNode;
  className?: string;
}) {
  const hasFilters = Boolean(onSearch || filters.length || children);
  if (!hasFilters) return null;

  return (
    <div className={cn('surface mb-4 flex flex-wrap items-end gap-2 p-3', className)}>
      {onSearch && (
        <div className="min-w-[200px] flex-1">
          <label className="sr-only" htmlFor="filter-search">
            {searchPlaceholder}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
            <input
              id="filter-search"
              className="input pl-8"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(event) => onSearch(event.target.value)}
            />
          </div>
        </div>
      )}
      {filters.map((filter) => (
        <Select
          key={filter.key}
          className={cn('min-w-[130px] sm:w-auto', filter.className)}
          wrapperClassName="w-auto sm:w-auto"
          value={filter.value}
          onChange={(event) => filter.onChange(event.target.value)}
          options={filter.options}
          aria-label={filter.label}
        />
      ))}
      {children}
      {(search || filters.some((f) => f.value !== 'all' && f.value !== '')) && (
        <Button
          variant="ghost"
          size="sm"
          icon={<X className="h-3.5 w-3.5" />}
          onClick={() => {
            onSearch?.('');
            filters.forEach((f) => f.onChange('all'));
          }}
        >
          Clear
        </Button>
      )}
    </div>
  );
}

/** Small helper for the local filter state used by list pages. */
export function useFilterState<T extends Record<string, string>>(initial: T) {
  const [state, setState] = useState<T>(initial);
  const set = (key: keyof T, value: string) => setState((current) => ({ ...current, [key]: value }));
  const reset = () => setState(initial);
  return { state, set, reset, setState };
}
