import { useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, Filter } from 'lucide-react';
import { api, buildQuery, type Page } from '@/lib/api';
import { qk } from '@/lib/queries';
import { PageHeading, Tabs } from '@/components/ui/Primitives';
import { ContentTable, type ContentRow } from '@/components/patterns/ContentTable';
import { FilterBar } from '@/components/patterns/FilterBar';
import { useBootstrap } from '@/lib/bootstrap';

const QUIZ_TABS = [
  { id: 'all', label: 'All quizzes' },
  { id: 'pending_review', label: 'Pending approval' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'draft', label: 'Drafts' },
  { id: 'unpublished', label: 'Unpublished' },
];

const POLL_TABS = [
  { id: 'all', label: 'All polls' },
  { id: 'pending_review', label: 'Pending approval' },
  { id: 'published', label: 'Published' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'draft', label: 'Drafts' },
  { id: 'unpublished', label: 'Unpublished' },
];

export function AdminContentList() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isPoll = location.pathname.startsWith('/admin/polls');
  const { categories } = useBootstrap();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [creator, setCreator] = useState('');
  const [category, setCategory] = useState('all');
  const status = searchParams.get('status') ?? 'all';

  const setStatus = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('status');
    else params.set('status', next);
    setSearchParams(params, { replace: true });
    setPage(1);
  };

  const path = isPoll
    ? `/admin/polls${buildQuery({ page, pageSize: 25, status, q: search, creator, category })}`
    : `/admin/quizzes${buildQuery({ page, pageSize: 25, status, q: search, creator, category })}`;

  const query = useQuery<Page<ContentRow>>({
    queryKey: isPoll ? qk.adminPolls({ page, status, search, creator, category }) : qk.adminQuizzes({ page, status, search, creator, category }),
    queryFn: () => api.get(path),
    placeholderData: (prev) => prev,
  });

  return (
    <>
      <PageHeading
        title={isPoll ? 'All polls' : 'All quizzes'}
        description="Server-side search, filtering and pagination. Click a row to open the full moderation review."
      />

      <Tabs
        className="mb-4"
        tabs={(isPoll ? POLL_TABS : QUIZ_TABS).map((tab) => ({ ...tab, count: null }))}
        active={status}
        onChange={setStatus}
      />

      <FilterBar
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder={isPoll ? 'Search poll questions' : 'Search quiz titles'}
        filters={[
          {
            key: 'creator',
            label: 'Creator',
            value: creator,
            onChange: (value) => {
              setCreator(value === 'all' ? '' : value);
              setPage(1);
            },
            options: [{ value: 'all', label: 'Any creator' }],
          },
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
        ]}
      >
        <span className="flex items-center gap-1.5 px-1 pb-2 text-xs text-ink-faint">
          <Filter className="h-3.5 w-3.5" />
          Type a creator name in the search box to filter by author
        </span>
      </FilterBar>

      <ContentTable
        data={query.data}
        loading={query.isLoading || query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        onPage={setPage}
        showCreator
        showPreviousDecision
        linkTo={(row) => (isPoll ? `/admin/polls/${row.id}` : `/admin/quizzes/${row.id}`)}
        emptyTitle={isPoll ? 'No polls match these filters' : 'No quizzes match these filters'}
        emptyDescription="Try a different status tab or clear the search."
      />
    </>
  );
}
