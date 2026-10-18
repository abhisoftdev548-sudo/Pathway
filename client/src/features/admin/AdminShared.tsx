import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, MessageSquare, X } from 'lucide-react';
import endpoints, { type ModerationInput } from '@/services/endpoints';
import { apiErrorMessage } from '@/services/api';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/Button';
import { Select, Textarea } from '@/components/ui/Form';
import { Modal, ConfirmDialog } from '@/components/ui/Overlay';
import { Pagination, Table, Td } from '@/components/ui/Data';
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  SkeletonTable,
} from '@/components/ui/Feedback';

/**
 * Shared admin list page: real paginated table with search + status filters.
 * Every instance hits a genuine admin endpoint — no placeholder rows.
 */
export function AdminTablePage<T>({
  title,
  description,
  queryKey,
  fetcher,
  head,
  renderRow,
  searchPlaceholder = 'Search…',
  statusOptions,
  extraActions,
  emptyTitle = 'Nothing here yet',
  emptyDescription = 'Data will appear here once it exists on the platform.',
}: {
  title: string;
  description: string;
  queryKey: (string | number | undefined)[];
  fetcher: (params: Record<string, unknown>) => Promise<{ items: T[]; meta?: { page: number; totalPages: number; total: number } }>;
  head: ReactNode[];
  renderRow: (item: T) => ReactNode;
  searchPlaceholder?: string;
  statusOptions?: { value: string; label: string }[];
  extraActions?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: [...queryKey, search, status, page],
    queryFn: () => fetcher({ search: search || undefined, status: status || undefined, page, limit: 20 }),
    placeholderData: (prev) => prev,
  });

  const items = query.data?.items ?? [];
  const meta = query.data?.meta;

  return (
    <div>
      <PageHeader title={title} description={description} actions={extraActions} />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder={searchPlaceholder}
          className="field-input max-w-xs"
          aria-label={searchPlaceholder}
        />
        {statusOptions && (
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="w-44"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        )}
      </div>

      {query.isLoading ? (
        <SkeletonTable rows={6} cols={head.length} />
      ) : query.isError ? (
        <ErrorState
          title="Could not load data"
          description={apiErrorMessage(query.error)}
          action={<Button onClick={() => query.refetch()}>Try again</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="surface overflow-hidden">
          <Table head={head}>{items.map((item) => renderRow(item))}</Table>
          {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />}
        </div>
      )}
    </div>
  );
}

/** Moderation decision panel for quiz/poll review queues. */
export function ModerationActions({
  targetType,
  targetId,
  status,
  onDone,
  compact = false,
}: {
  targetType: 'quiz' | 'poll';
  targetId: string;
  status?: string;
  onDone?: () => void;
  compact?: boolean;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'UNPUBLISH' | null>(null);
  const [notes, setNotes] = useState('');
  const [qualityRating, setQualityRating] = useState('');

  const mutation = useMutation({
    mutationFn: (input: ModerationInput) => endpoints.admin.moderate(targetType, targetId, input),
    onSuccess: (_result, input) => {
      toast.success(`Decision recorded: ${input.action.toLowerCase().replace('_', ' ')}`);
      setMode(null);
      setNotes('');
      setQualityRating('');
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      void queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      void queryClient.invalidateQueries({ queryKey: ['polls'] });
      onDone?.();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Moderation action failed')),
  });

  const isPublished = status === 'APPROVED';

  return (
    <>
      <div className={compact ? 'flex flex-wrap gap-1.5' : 'flex flex-wrap gap-2'}>
        {!isPublished && (
          <Button size="sm" onClick={() => setMode('APPROVE')} icon={<Check className="h-3.5 w-3.5" />}>
            Approve
          </Button>
        )}
        {!isPublished && (
          <Button size="sm" variant="outline" onClick={() => setMode('REQUEST_CHANGES')} icon={<MessageSquare className="h-3.5 w-3.5" />}>
            Request changes
          </Button>
        )}
        {!isPublished && (
          <Button size="sm" variant="ghost" onClick={() => setMode('REJECT')} icon={<X className="h-3.5 w-3.5" />}>
            Reject
          </Button>
        )}
        {isPublished && (
          <Button size="sm" variant="outline" onClick={() => setMode('UNPUBLISH')}>
            Unpublish
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            mutation.mutate({
              action: 'QUALITY_RATE',
              notes,
              qualityRating: qualityRating ? Number(qualityRating) : null,
            })
          }
          disabled={!qualityRating}
        >
          Save quality rating
        </Button>
      </div>

      <Modal
        open={mode !== null}
        onClose={() => setMode(null)}
        title={
          mode === 'APPROVE'
            ? 'Approve & publish'
            : mode === 'REJECT'
              ? 'Reject submission'
              : mode === 'REQUEST_CHANGES'
                ? 'Request changes'
                : 'Unpublish content'
        }
        description="This decision is recorded in the moderation history and audited."
        footer={
          <>
            <Button variant="outline" onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button
              variant={mode === 'REJECT' || mode === 'UNPUBLISH' ? 'danger' : 'primary'}
              loading={mutation.isPending}
              onClick={() =>
                mode &&
                mutation.mutate({
                  action: mode,
                  notes,
                  qualityRating: qualityRating ? Number(qualityRating) : null,
                })
              }
            >
              Confirm {mode?.toLowerCase().replace('_', ' ')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {mode === 'REQUEST_CHANGES' && (
            <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
              Explain clearly what the creator should fix — this note is shown to them.
            </p>
          )}
          <Textarea
            label="Moderation notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes for the creator and the audit trail…"
            maxLength={2000}
          />
          <Select
            label="Admin quality rating (optional)"
            value={qualityRating}
            onChange={(e) => setQualityRating(e.target.value)}
          >
            <option value="">Not rated</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} / 5
              </option>
            ))}
          </Select>
        </div>
      </Modal>
    </>
  );
}

/** Card wrapper for admin sections. */
export function AdminCard({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader title={title} subtitle={subtitle} actions={actions} />
      <CardBody className={className ? undefined : undefined}>{children}</CardBody>
    </Card>
  );
}

/** Confirmation-based action button pair (approve/deny) used by refund queues. */
export function ApproveDenyButtons({
  onApprove,
  onDeny,
  loading = false,
}: {
  onApprove: () => void;
  onDeny: () => void;
  loading?: boolean;
}) {
  return (
    <div className="flex gap-1.5">
      <Button size="sm" onClick={onApprove} loading={loading}>
        Approve
      </Button>
      <Button size="sm" variant="outline" onClick={onDeny} loading={loading}>
        Deny
      </Button>
    </div>
  );
}

export function AdminEmpty({ title, description }: { title: string; description: string }) {
  return <EmptyState title={title} description={description} />;
}

export { ConfirmDialog, Td, useQueryClient };
