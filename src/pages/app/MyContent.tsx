import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ExternalLink,
  FileText,
  Megaphone,
  Pencil,
  Plus,
  Send,
  Trash2,
  Upload,
} from 'lucide-react';
import { api, ApiError, buildQuery, type Page } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useToast } from '@/components/ui/Toast';
import { PageHeading, Tabs } from '@/components/ui/Primitives';
import { Button, IconButton } from '@/components/ui/Button';
import { ContentTable, type ContentRow } from '@/components/patterns/ContentTable';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { formatDate } from '@/lib/format';

type Kind = 'quiz' | 'poll';

const TABS: Record<Kind, { id: string; label: string }[]> = {
  quiz: [
    { id: 'all', label: 'All' },
    { id: 'draft', label: 'Drafts' },
    { id: 'pending_review', label: 'Pending review' },
    { id: 'approved', label: 'Published' },
    { id: 'changes_requested', label: 'Changes requested' },
    { id: 'rejected', label: 'Rejected' },
    { id: 'unpublished', label: 'Unpublished' },
  ],
  poll: [
    { id: 'all', label: 'All' },
    { id: 'draft', label: 'Drafts' },
    { id: 'pending_review', label: 'Pending review' },
    { id: 'published', label: 'Published' },
    { id: 'changes_requested', label: 'Changes requested' },
    { id: 'rejected', label: 'Rejected' },
    { id: 'unpublished', label: 'Unpublished' },
  ],
};

export function MyContent() {
  const location = useLocation();
  const kind: Kind = location.pathname.includes('polls') ? 'poll' : 'quiz';
  const isPoll = kind === 'poll';
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [pendingAction, setPendingAction] = useState<{ type: string; row: ContentRow } | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const path = isPoll
    ? `/polls/mine/list${buildQuery({ page, pageSize: 20, status })}`
    : `/quizzes/mine/list${buildQuery({ page, pageSize: 20, status })}`;

  const query = useQuery<Page<ContentRow>>({
    queryKey: isPoll ? qk.myPolls({ page, status }) : qk.myQuizzes({ page, status }),
    queryFn: () => api.get(path),
    placeholderData: (prev) => prev,
  });

  const refresh = () => queryClient.invalidateQueries();

  const action = useMutation({
    mutationFn: async ({ type, row }: { type: string; row: ContentRow }) => {
      const base = isPoll ? `/polls/${row.id}` : `/quizzes/${row.id}`;
      if (type === 'submit') return api.post(`${base}/submit`, { changeNote: '' });
      if (type === 'unpublish') return api.post(`${base}/unpublish`, {});
      if (type === 'delete') return api.del(base);
      throw new Error('Unknown action');
    },
    onSuccess: (_data, variables) => {
      setPendingAction(null);
      refresh();
      toast.success(
        variables.type === 'submit'
          ? 'Submitted for review.'
          : variables.type === 'unpublish'
            ? 'Content unpublished. It is no longer visible to players.'
            : 'Content deleted.',
      );
    },
    onError: (err) => {
      setPendingAction(null);
      toast.error(err instanceof ApiError ? err.message : 'That action could not be completed.');
    },
  });

  return (
    <>
      <PageHeading
        title={isPoll ? 'My polls' : 'My quizzes'}
        description="Everything you have created, with its current moderation state."
        actions={
          <Button
            to={isPoll ? '/app/polls/new' : '/app/quizzes/new'}
            size="sm"
            variant="primary"
            icon={<Plus className="h-3.5 w-3.5" />}
          >
            {isPoll ? 'New poll' : 'New quiz'}
          </Button>
        }
      />

      <Tabs
        className="mb-4"
        tabs={TABS[kind].map((tab) => ({ ...tab, count: null }))}
        active={status}
        onChange={(next) => {
          setStatus(next);
          setPage(1);
        }}
      />

      <ContentTable
        data={query.data}
        loading={query.isLoading || query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        onPage={setPage}
        linkTo={(row) => (isPoll ? `/app/polls/${row.id}` : `/app/quizzes/${row.id}`)}
        emptyTitle={isPoll ? 'You have not created any polls yet' : 'You have not created any quizzes yet'}
        emptyDescription={
          isPoll
            ? 'Create a poll, submit it for review and track its moderation state here.'
            : 'Create a quiz, submit it for review and track its moderation state here.'
        }
        emptyAction={
          <Button to={isPoll ? '/app/polls/new' : '/app/quizzes/new'} size="sm" variant="primary">
            {isPoll ? 'Create a poll' : 'Create a quiz'}
          </Button>
        }
      />

      {query.data && query.data.items.length > 0 && (
        <div className="mt-4 surface overflow-hidden">
          <ul className="divide-y divide-line">
            {query.data.items.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-ink">{row.title}</p>
                  <p className="text-2xs text-ink-faint">
                    Updated {formatDate(row.updated_at)} · v{row.version ?? 1}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {['draft', 'changes_requested', 'rejected'].includes(row.status) && (
                    <>
                      <Button
                        to={isPoll ? `/app/polls/${row.id}/edit` : `/app/quizzes/${row.id}/edit`}
                        size="sm"
                        variant="ghost"
                        icon={<Pencil className="h-3.5 w-3.5" />}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Send className="h-3.5 w-3.5" />}
                        onClick={() => setPendingAction({ type: 'submit', row })}
                      >
                        Submit
                      </Button>
                      <IconButton
                        label="Delete"
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        onClick={() => setPendingAction({ type: 'delete', row })}
                      />
                    </>
                  )}
                  {(row.status === 'approved' || row.status === 'published') && (
                    <>
                      <Button
                        to={isPoll ? `/app/polls/${row.id}` : `/app/quizzes/${row.id}`}
                        size="sm"
                        variant="ghost"
                        icon={<ExternalLink className="h-3.5 w-3.5" />}
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Upload className="h-3.5 w-3.5" />}
                        onClick={() => setPendingAction({ type: 'unpublish', row })}
                      >
                        Unpublish
                      </Button>
                    </>
                  )}
                  {row.status === 'unpublished' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Send className="h-3.5 w-3.5" />}
                      onClick={() => setPendingAction({ type: 'submit', row })}
                    >
                      Resubmit
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ConfirmDialog
        open={pendingAction !== null}
        title={
          pendingAction?.type === 'delete'
            ? 'Delete this content?'
            : pendingAction?.type === 'unpublish'
              ? 'Unpublish this content?'
              : 'Submit for review?'
        }
        description={
          pendingAction?.type === 'delete'
            ? 'This permanently deletes the content. Submissions with recorded attempts cannot be deleted.'
            : pendingAction?.type === 'unpublish'
              ? 'It will no longer appear in Explore. Existing attempts and results are kept.'
              : 'A moderator will review it. You will be notified of the decision.'
        }
        confirmLabel={
          pendingAction?.type === 'delete' ? 'Delete' : pendingAction?.type === 'unpublish' ? 'Unpublish' : 'Submit'
        }
        tone={pendingAction?.type === 'delete' ? 'danger' : 'primary'}
        loading={action.isPending}
        onConfirm={() => pendingAction && action.mutate(pendingAction)}
        onCancel={() => setPendingAction(null)}
      />
    </>
  );
}

export { FileText, Megaphone };
