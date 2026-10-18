import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, SlidersHorizontal } from 'lucide-react';
import endpoints from '@/services/endpoints';
import { PageHeader, EmptyState, ErrorState, SkeletonList, NoResultsState } from '@/components/ui/Feedback';
import { Pagination, Badge } from '@/components/ui/Data';
import { Input, Select } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { QuizCard } from '@/features/quizzes/QuizCard';
import { useDebounce, useDocumentTitle } from '@/hooks';
import { apiErrorMessage } from '@/services/api';
import { DIFFICULTY_LABELS } from '@/utils/constants';

/** Public quiz discovery — real API data with search, filters, and pagination. */
export function ExploreQuizzesPage() {
  useDocumentTitle('Explore quizzes');
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 350);

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => endpoints.public.categories(),
    staleTime: 300000,
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['quizzes', 'explore', debouncedSearch, difficulty, category, sort, page],
    queryFn: () =>
      endpoints.quizzes.list({
        search: debouncedSearch || undefined,
        difficulty: difficulty || undefined,
        category: category || undefined,
        sort,
        page,
        limit: 12,
      }),
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];
  const meta = data?.meta;
  const filtersActive = Boolean(debouncedSearch || difficulty || category);

  return (
    <div>
      <PageHeader
        title="Explore quizzes"
        description="Published, moderator-approved quizzes from the community."
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by title, description, or tag…"
            className="field-input pl-9"
            aria-label="Search quizzes"
          />
        </div>
        <Select
          value={difficulty}
          onChange={(e) => {
            setDifficulty(e.target.value);
            setPage(1);
          }}
          className="w-36"
          aria-label="Filter by difficulty"
        >
          <option value="">All levels</option>
          {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="w-44"
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {(categoriesData?.items ?? []).map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
          className="w-36"
          aria-label="Sort"
        >
          <option value="newest">Newest</option>
          <option value="popular">Most attempted</option>
          <option value="topRated">Top rated</option>
        </Select>
        {filtersActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              setDifficulty('');
              setCategory('');
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {isLoading && items.length === 0 ? (
        <SkeletonList count={4} />
      ) : isError ? (
        <ErrorState
          title="Could not load quizzes"
          description={apiErrorMessage(error, 'The server did not respond. Please try again.')}
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      ) : items.length === 0 ? (
        filtersActive ? (
          <NoResultsState query={debouncedSearch} />
        ) : (
          <EmptyState
            title="No published quizzes yet"
            description="There are no approved quizzes to show right now. Once moderators approve submissions, they will appear here."
            action={
              <a href="/register">
                <Button variant="outline">Create the first quiz</Button>
              </a>
            }
          />
        )
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((quiz) => (
              <QuizCard key={quiz._id} quiz={quiz} />
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

export default ExploreQuizzesPage;
