import { useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import { PageHeading } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Table';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { FilterBar } from '@/components/patterns/FilterBar';
import { CardGrid, QuizCard, type QuizCardData, CardGridSkeleton } from '@/components/patterns/ContentCards';
import { usePagedQuery, qk } from '@/lib/queries';
import { useBootstrap } from '@/lib/bootstrap';
import { buildQuery } from '@/lib/api';

export function QuizBrowse() {
  const { categories, difficulties, tags } = useBootstrap();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [tag, setTag] = useState('all');
  const [fee, setFee] = useState('any');
  const [sort, setSort] = useState('newest');

  const path = `/quizzes${buildQuery({ page, pageSize: 12, q: search, category, difficulty, tag, fee, sort })}`;
  const query = usePagedQuery<QuizCardData>(qk.quizzes({ page, search, category, difficulty, tag, fee, sort }), path);

  return (
    <>
      <PageHeading
        title="Explore quizzes"
        description="Published quizzes from the community. Every card below is a real record from the database."
        actions={
          <Button to="/app/quizzes/new" size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />}>
            Create a quiz
          </Button>
        }
      />

      <FilterBar
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search quiz titles and descriptions"
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
            key: 'difficulty',
            label: 'Difficulty',
            value: difficulty,
            onChange: (value) => {
              setDifficulty(value);
              setPage(1);
            },
            options: [{ value: 'all', label: 'Any difficulty' }, ...difficulties.map((d) => ({ value: d.slug, label: d.name }))],
          },
          {
            key: 'tag',
            label: 'Tag',
            value: tag,
            onChange: (value) => {
              setTag(value);
              setPage(1);
            },
            options: [{ value: 'all', label: 'All tags' }, ...tags.map((t) => ({ value: t.slug, label: t.name }))],
          },
          {
            key: 'fee',
            label: 'Entry fee',
            value: fee,
            onChange: (value) => {
              setFee(value);
              setPage(1);
            },
            options: [
              { value: 'any', label: 'Any fee' },
              { value: 'free', label: 'Free' },
              { value: 'paid', label: 'Paid entry' },
            ],
          },
          {
            key: 'sort',
            label: 'Sort',
            value: sort,
            onChange: setSort,
            options: [
              { value: 'newest', label: 'Newest' },
              { value: 'popular', label: 'Most attempted' },
              { value: 'rating', label: 'Highest rated' },
              { value: 'reward', label: 'Highest reward' },
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
          icon={<FileText className="h-4 w-4" />}
          title="No quizzes have been published yet"
          description="There are no published quizzes matching these filters. Be the first to create one and submit it for review."
          action={
            <Button to="/app/quizzes/new" size="sm" variant="primary">
              Create a quiz
            </Button>
          }
        />
      ) : (
        <>
          <CardGrid>
            {query.data.items.map((quiz) => (
              <QuizCard key={quiz.id} quiz={quiz} />
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
