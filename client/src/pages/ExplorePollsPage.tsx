import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import endpoints from '@/services/endpoints';
import { PageHeader, EmptyState, ErrorState, SkeletonList, NoResultsState } from '@/components/ui/Feedback';
import { Pagination } from '@/components/ui/Data';
import { Select } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { PollCard } from '@/features/polls/PollCard';
import { useDebounce, useDocumentTitle } from '@/hooks';
import { apiErrorMessage } from '@/services/api';

/** Public poll discovery — only approved polls that accept votes are listed. */
export function ExplorePollsPage() {
  useDocumentTitle('Explore polls');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 350);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['polls', 'explore', debouncedSearch, sort, page],
    queryFn: () =>
      endpoints.polls.list({
        search: debouncedSearch || undefined,
        sort,
        page,
        limit: 12,
      }),
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div>
      <PageHeader title="Explore polls" description="Share your opinion on open community polls." />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search polls…"
            className="field-input pl-9"
            aria-label="Search polls"
          />
        </div>
        <Select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
          className="w-40"
          aria-label="Sort"
        >
          <option value="newest">Newest</option>
          <option value="endingSoon">Ending soon</option>
          <option value="popular">Most voters</option>
        </Select>
      </div>

      {isLoading && items.length === 0 ? (
        <SkeletonList count={3} />
      ) : isError ? (
        <ErrorState
          title="Could not load polls"
          description={apiErrorMessage(error, 'The server did not respond. Please try again.')}
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      ) : items.length === 0 ? (
        debouncedSearch ? (
          <NoResultsState query={debouncedSearch} />
        ) : (
          <EmptyState
            title="No open polls right now"
            description="There are no approved polls accepting votes at the moment. Check back later or create one yourself."
            action={
              <a href="/register">
                <Button variant="outline">Create a poll</Button>
              </a>
            }
          />
        )
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            {items.map((poll) => (
              <PollCard key={poll._id} poll={poll} />
            ))}
          </div>
          {meta && (
            <div className="mt-6">
              <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ExplorePollsPage;
