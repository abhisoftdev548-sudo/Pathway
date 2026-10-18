import { useState } from 'react';
import { Megaphone, Plus } from 'lucide-react';
import { PageHeading } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Table';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { FilterBar } from '@/components/patterns/FilterBar';
import { CardGrid, PollCard, type PollCardData, CardGridSkeleton } from '@/components/patterns/ContentCards';
import { usePagedQuery, qk } from '@/lib/queries';
import { useBootstrap } from '@/lib/bootstrap';
import { buildQuery } from '@/lib/api';

export function PollBrowse() {
  const { categories } = useBootstrap();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [open, setOpen] = useState('all');
  const [sort, setSort] = useState('newest');

  const path = `/polls${buildQuery({ page, pageSize: 12, q: search, category, open, sort })}`;
  const query = usePagedQuery<PollCardData>(qk.polls({ page, search, category, open, sort }), path);

  return (
    <>
      <PageHeading
        title="Explore polls"
        description="Open and closed polls. Vote once per poll unless the creator allowed multiple choices."
        actions={
          <Button to="/app/polls/new" size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />}>
            Create a poll
          </Button>
        }
      />

      <FilterBar
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search polls"
        filters={[
          {
            key: 'category',
            label: 'Category',
            value: category,
            onChange: (value) => {
              setCategory(value);
              setPage(1);
            },
            options: [{ value: 'all', label: 'All categories' }, ...categories.map((c) => ({ value: c.slug, label: c.name }))],
          },
          {
            key: 'open',
            label: 'Status',
            value: open,
            onChange: (value) => {
              setOpen(value);
              setPage(1);
            },
            options: [
              { value: 'all', label: 'All polls' },
              { value: 'open', label: 'Open' },
              { value: 'closed', label: 'Closed' },
            ],
          },
          {
            key: 'sort',
            label: 'Sort',
            value: sort,
            onChange: setSort,
            options: [
              { value: 'newest', label: 'Newest' },
              { value: 'popular', label: 'Most votes' },
              { value: 'closing', label: 'Closing soonest' },
            ],
          },
        ]}
      />

      {query.isLoading ? (
        <CardGridSkeleton />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !query.data?.items.length ? (
        <EmptyState
          icon={<Megaphone className="h-4 w-4" />}
          title="There are no published polls at the moment"
          description="No polls match these filters. Create one and submit it for review to see it listed here."
          action={
            <Button to="/app/polls/new" size="sm" variant="primary">
              Create a poll
            </Button>
          }
        />
      ) : (
        <>
          <CardGrid>
            {query.data.items.map((poll) => (
              <PollCard key={poll.id} poll={poll} />
            ))}
          </CardGrid>
          <Pagination
            page={query.data.page}
            pageSize={query.data.pageSize}
            total={query.data.total}
            onPage={(next) => {
              setPage(next);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </>
      )}
    </>
  );
}
