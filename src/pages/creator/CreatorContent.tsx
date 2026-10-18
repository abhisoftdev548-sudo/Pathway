import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, Megaphone, Plus } from 'lucide-react';
import { api, buildQuery, type Page } from '@/lib/api';
import { qk } from '@/lib/queries';
import { PageHeading, Badge } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { formatCoins, formatDate, titleCase } from '@/lib/format';

interface Row {
  id: string;
  title: string;
  status: string;
  published_at: string | null;
  submitted_at: string | null;
  updated_at: string;
  review_notes: string | null;
  engagement: number;
  entry_fee?: number;
  reward_coins?: number;
}

const CONFIG: Record<
  string,
  { kind: 'quiz' | 'poll'; status: string; title: string; description: string; emptyTitle: string; emptyDescription: string }
> = {
  '/app/creator/quizzes': {
    kind: 'quiz',
    status: 'approved',
    title: 'My published quizzes',
    description: 'Quizzes that have been approved and are visible to players.',
    emptyTitle: 'No published quizzes yet',
    emptyDescription: 'Once a submission is approved it appears here with its live engagement figures.',
  },
  '/app/creator/polls': {
    kind: 'poll',
    status: 'published',
    title: 'My published polls',
    description: 'Polls that have been approved and are open or closed for voting.',
    emptyTitle: 'No published polls yet',
    emptyDescription: 'Approved polls appear here with their vote counts.',
  },
  '/app/creator/drafts': {
    kind: 'quiz',
    status: 'draft',
    title: 'Drafts',
    description: 'Content you have started but not submitted for review.',
    emptyTitle: 'No drafts',
    emptyDescription: 'Quizzes and polls you save without submitting appear here.',
  },
  '/app/creator/pending': {
    kind: 'quiz',
    status: 'pending_review',
    title: 'Pending reviews',
    description: 'Submissions currently waiting for a moderation decision.',
    emptyTitle: 'Nothing awaiting review',
    emptyDescription: 'Submissions appear here from the moment you submit them until a moderator decides.',
  },
  '/app/creator/changes': {
    kind: 'quiz',
    status: 'changes_requested',
    title: 'Changes requested',
    description: 'Submissions a moderator has asked you to revise.',
    emptyTitle: 'No changes requested',
    emptyDescription: 'When a reviewer asks for changes, the request and its reason show up here.',
  },
};

export function CreatorContent() {
  const location = useLocation();
  const config = CONFIG[location.pathname] ?? CONFIG['/app/creator/quizzes'];
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState<'quiz' | 'poll'>(config.kind);

  const path = `/creator/content?type=${kind}&status=${config.status}&page=${page}&pageSize=20`;
  const query = useQuery<Page<Row>>({
    queryKey: qk.creatorContent({ type: kind, status: config.status, page }),
    queryFn: () => api.get(path),
    placeholderData: (prev) => prev,
  });

  const columns: Column<Row>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (row) => (
        <a
          href={`/app/${kind === 'quiz' ? 'quizzes' : 'polls'}/${row.id}`}
          className="block max-w-[26rem] truncate font-medium text-ink hover:text-brand-700"
        >
          {row.title}
        </a>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge tone="neutral">{titleCase(row.status)}</Badge>,
    },
    {
      key: 'engagement',
      header: kind === 'poll' ? 'Votes' : 'Attempts',
      align: 'right',
      render: (row) => <span className="tabular-nums text-ink-soft">{row.engagement}</span>,
    },
    ...(kind === 'quiz'
      ? [
          {
            key: 'economy',
            header: 'Entry / reward',
            align: 'right' as const,
            render: (row: Row) => (
              <span className="tabular-nums text-ink-muted">
                {formatCoins(row.entry_fee ?? 0)} / {formatCoins(row.reward_coins ?? 0)}
              </span>
            ),
          },
        ]
      : []),
    {
      key: 'date',
      header: 'Last updated',
      align: 'right',
      render: (row) => <span className="whitespace-nowrap text-ink-muted">{formatDate(row.updated_at)}</span>,
    },
  ];

  const emptyAction =
    config.status === 'draft' ? (
      <div className="flex gap-2">
        <Button to="/app/quizzes/new" size="sm" variant="primary">
          New quiz
        </Button>
        <Button to="/app/polls/new" size="sm" variant="secondary">
          New poll
        </Button>
      </div>
    ) : undefined;

  return (
    <>
      <PageHeading
        title={config.title}
        description={config.description}
        actions={
          <>
            {config.status === 'draft' && (
              <div className="flex overflow-hidden rounded-md border border-line-strong">
                <button
                  type="button"
                  onClick={() => {
                    setKind('quiz');
                    setPage(1);
                  }}
                  className={`px-2.5 py-1.5 text-xs ${kind === 'quiz' ? 'bg-brand-50 font-medium text-brand-700' : 'bg-white text-ink-muted'}`}
                >
                  Quizzes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setKind('poll');
                    setPage(1);
                  }}
                  className={`border-l border-line-strong px-2.5 py-1.5 text-xs ${kind === 'poll' ? 'bg-brand-50 font-medium text-brand-700' : 'bg-white text-ink-muted'}`}
                >
                  Polls
                </button>
              </div>
            )}
            <Button to="/app/quizzes/new" size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />}>
              New content
            </Button>
          </>
        }
      />

      {query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={query.data?.items}
            loading={query.isLoading || query.isFetching}
            rowKey={(row) => row.id}
            emptyIcon={kind === 'poll' ? <Megaphone className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
            emptyTitle={config.emptyTitle}
            emptyDescription={config.emptyDescription}
            emptyAction={emptyAction}
          />
          {query.data && query.data.total > 0 && (
            <Pagination page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPage={setPage} />
          )}
        </>
      )}
    </>
  );
}
