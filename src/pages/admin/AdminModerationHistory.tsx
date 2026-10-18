import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Eye, History } from 'lucide-react';
import { api, buildQuery, type Page } from '@/lib/api';
import { qk } from '@/lib/queries';
import { PageHeading, Badge, StatusBadge, Tabs } from '@/components/ui/Primitives';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Modal } from '@/components/ui/Dialog';
import { TextInput } from '@/components/ui/Field';
import { JsonViewer } from '@/components/patterns/LogTable';
import { formatDate, titleCase } from '@/lib/format';

interface DecisionRow {
  id: string;
  content_type: 'quiz' | 'poll';
  content_id: string;
  contentTitle: string;
  version: number;
  decision: string;
  reason: string | null;
  notes: string | null;
  quality_rating: number | null;
  reviewer_name: string | null;
  reviewer_username: string | null;
  created_at: string;
}

export function AdminModerationHistory() {
  const [contentType, setContentType] = useState('all');
  const [decision, setDecision] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const path = `/admin/moderation/history${buildQuery({ page, pageSize: 25, contentType, decision, reviewer: search })}`;
  const query = useQuery<Page<DecisionRow>>({
    queryKey: qk.adminModerationHistory({ page, contentType, decision, search }),
    queryFn: () => api.get(path),
    placeholderData: (prev) => prev,
  });

  const columns: Column<DecisionRow>[] = [
    {
      key: 'content',
      header: 'Content',
      render: (row) => (
        <div className="min-w-0">
          <Link
            to={`/admin/${row.content_type === 'quiz' ? 'quizzes' : 'polls'}/${row.content_id}`}
            className="block max-w-[22rem] truncate font-medium text-ink hover:text-brand-700"
          >
            {row.contentTitle}
          </Link>
          <span className="text-2xs text-ink-faint">
            {row.content_type} · v{row.version}
          </span>
        </div>
      ),
    },
    { key: 'decision', header: 'Decision', render: (row) => <StatusBadge status={row.decision} /> },
    { key: 'rating', header: 'Quality', align: 'right', render: (row) => (row.quality_rating !== null ? <Badge tone="brand">{row.quality_rating}/5</Badge> : <span className="text-ink-faint">—</span>) },
    {
      key: 'reason',
      header: 'Reason',
      render: (row) => (
        <span className="block max-w-[20rem] truncate text-ink-muted">{row.reason ?? row.notes ?? 'No reason recorded'}</span>
      ),
    },
    { key: 'reviewer', header: 'Reviewer', render: (row) => <span className="text-ink-soft">@{row.reviewer_username}</span> },
    {
      key: 'date',
      header: 'Decided',
      align: 'right',
      render: (row) => <span className="whitespace-nowrap text-ink-muted">{formatDate(row.created_at)}</span>,
    },
    {
      key: 'open',
      header: '',
      align: 'right',
      render: (row) => (
        <button
          type="button"
          onClick={() => setOpenId(row.id)}
          className="rounded-md p-1.5 text-ink-faint transition-colors duration-fast hover:bg-canvas hover:text-ink"
          aria-label="View decision detail"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ];

  const openRow = (query.data?.items ?? []).find((row) => row.id === openId) ?? null;

  return (
    <>
      <PageHeading
        title="Moderation history"
        description="Every approve, reject and change request recorded on quizzes and polls, with the reviewer and reason."
      />

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Tabs
          tabs={[
            { id: 'all', label: 'All content' },
            { id: 'quiz', label: 'Quizzes' },
            { id: 'poll', label: 'Polls' },
          ]}
          active={contentType}
          onChange={(next) => {
            setContentType(next);
            setPage(1);
          }}
        />
        <div className="min-w-[180px] flex-1">
          <TextInput
            aria-label="Search by title"
            placeholder="Search content title"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          aria-label="Decision"
          value={decision}
          onChange={(event) => {
            setDecision(event.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-line bg-surface px-2.5 text-[13px] text-ink"
        >
          <option value="all">All decisions</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="changes_requested">Changes requested</option>
          <option value="unpublished">Unpublished</option>
        </select>
      </div>

      {query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={query.data?.items}
            loading={query.isLoading || query.isFetching}
            rowKey={(row) => row.id}
            emptyIcon={<History className="h-4 w-4" />}
            emptyTitle="No moderation decisions recorded"
            emptyDescription="Approvals, rejections and change requests appear here once content has been reviewed."
          />
          {query.data && query.data.total > 0 && (
            <Pagination page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPage={setPage} />
          )}
        </>
      )}

      <Modal open={openRow !== null} onClose={() => setOpenId(null)} title="Decision detail" size="lg">
        {openRow && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={openRow.decision} />
              {openRow.quality_rating !== null && <Badge tone="brand">Quality {openRow.quality_rating}/5</Badge>}
              <span className="text-2xs text-ink-faint">
                v{openRow.version} · {formatDate(openRow.created_at)}
              </span>
            </div>
            <dl className="space-y-2">
              <div>
                <dt className="text-2xs uppercase tracking-wide text-ink-faint">Content</dt>
                <dd className="text-[13px] text-ink">
                  <Link
                    to={`/admin/${openRow.content_type === 'quiz' ? 'quizzes' : 'polls'}/${openRow.content_id}`}
                    className="hover:text-brand-700"
                  >
                    {openRow.contentTitle}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-2xs uppercase tracking-wide text-ink-faint">Reviewer</dt>
                <dd className="text-[13px] text-ink">
                  {openRow.reviewer_name ?? 'System'}
                  {openRow.reviewer_username ? ` (@${openRow.reviewer_username})` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-2xs uppercase tracking-wide text-ink-faint">Reason</dt>
                <dd className="text-[13px] text-ink">{openRow.reason ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-2xs uppercase tracking-wide text-ink-faint">Internal notes</dt>
                <dd className="whitespace-pre-line text-[13px] text-ink">{openRow.notes ?? '—'}</dd>
              </div>
            </dl>
            <p className="text-2xs text-ink-faint">
              {titleCase(openRow.content_type)} · version {openRow.version}
            </p>
            <details className="rounded-md border border-line">
              <summary className="cursor-pointer px-3 py-2 text-xs text-ink-muted">Raw record</summary>
              <div className="border-t border-line px-3 py-2">
                <JsonViewer value={openRow} />
              </div>
            </details>
          </div>
        )}
      </Modal>
    </>
  );
}
