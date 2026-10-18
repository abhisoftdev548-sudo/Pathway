import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Flag, Star } from 'lucide-react';
import { api, buildQuery, type Page } from '@/lib/api';
import { qk } from '@/lib/queries';
import { PageHeading, Badge, StatusBadge, Tabs } from '@/components/ui/Primitives';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { formatDate, formatRelative, titleCase } from '@/lib/format';

interface ReportedContentRow {
  target_type: 'quiz' | 'poll';
  target_id: string;
  contentTitle: string;
  report_count: number;
  open_reports: number;
  last_reported_at: string;
}

interface ReportRow {
  id: string;
  target_type: string;
  target_id: string;
  targetTitle: string;
  reason: string;
  details: string | null;
  status: string;
  reporter_username: string;
  created_at: string;
}

export function AdminReportedContent() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isReviews = location.pathname.endsWith('/reported-reviews');
  const [type, setType] = useState(searchParams.get('type') ?? 'all');
  const [page, setPage] = useState(1);

  const contentQuery = useQuery<Page<ReportedContentRow>>({
    queryKey: qk.adminReportedContent({ page }),
    queryFn: () => api.get(`/admin/moderation/reported-content${buildQuery({ page, pageSize: 50 })}`),
    placeholderData: (prev) => prev,
    enabled: !isReviews,
  });

  const reviewQuery = useQuery<Page<ReportRow>>({
    queryKey: qk.adminReports({ targetType: 'review', page }),
    queryFn: () => api.get(`/admin/moderation/reports${buildQuery({ targetType: 'review', status: 'all', page, pageSize: 50 })}`),
    enabled: isReviews,
    placeholderData: (prev) => prev,
  });

  if (isReviews) {
    const rows = reviewQuery.data?.items ?? [];
    const columns: Column<ReportRow>[] = [
      {
        key: 'review',
        header: 'Reported review',
        render: (row) => (
          <div className="min-w-0">
            <span className="block max-w-[26rem] truncate text-ink">{row.targetTitle || 'Review'}</span>
            {row.details && <span className="block truncate text-2xs text-ink-faint">{row.details}</span>}
          </div>
        ),
      },
      {
        key: 'reason',
        header: 'Reason',
        render: (row) => <span className="text-ink-soft">{titleCase(row.reason.replace(/_/g, ' '))}</span>,
      },
      {
        key: 'reporter',
        header: 'Reported by',
        render: (row) => <span className="text-ink-muted">@{row.reporter_username}</span>,
      },
      { key: 'status', header: 'Report status', render: (row) => <StatusBadge status={row.status} /> },
      {
        key: 'filed',
        header: 'Filed',
        align: 'right',
        render: (row) => <span className="whitespace-nowrap text-ink-muted">{formatDate(row.created_at)}</span>,
      },
    ];

    return (
      <>
        <PageHeading
          title="Reported reviews"
          description="Reports filed against ratings and written reviews. Resolve them here; the linked content page can hide a review that breaks the guidelines."
        />
        {reviewQuery.error ? (
          <ErrorState error={reviewQuery.error} onRetry={() => reviewQuery.refetch()} />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            loading={reviewQuery.isLoading || reviewQuery.isFetching}
            rowKey={(row) => row.id}
            emptyIcon={<Star className="h-4 w-4" />}
            emptyTitle="No reported reviews"
            emptyDescription="Reviews reported by users appear here. Nothing has been reported yet."
          />
        )}
      </>
    );
  }

  const all = contentQuery.data?.items ?? [];
  const rows = type === 'all' ? all : all.filter((row) => row.target_type === type);

  const columns: Column<ReportedContentRow>[] = [
    {
      key: 'content',
      header: 'Content',
      render: (row) => (
        <div className="min-w-0">
          <Link
            to={`/admin/${row.target_type === 'quiz' ? 'quizzes' : 'polls'}/${row.target_id}`}
            className="block max-w-[26rem] truncate font-medium text-ink hover:text-brand-700"
          >
            {row.contentTitle}
          </Link>
          <span className="text-2xs text-ink-faint">{row.target_type}</span>
        </div>
      ),
    },
    {
      key: 'open',
      header: 'Open',
      render: (row) =>
        row.open_reports > 0 ? <Badge tone="warning">{row.open_reports} awaiting</Badge> : <Badge tone="success">None open</Badge>,
    },
    {
      key: 'total',
      header: 'Total reports',
      align: 'right',
      render: (row) => <span className="tabular-nums text-ink-muted">{row.report_count}</span>,
    },
    {
      key: 'last',
      header: 'Last reported',
      align: 'right',
      render: (row) => (
        <span className="whitespace-nowrap text-ink-muted" title={formatDate(row.last_reported_at)}>
          {formatRelative(row.last_reported_at)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeading
        title="Reported content"
        description="Quizzes and polls grouped by how many reports they have received, with the items still awaiting a decision first."
      />

      <Tabs
        className="mb-4"
        tabs={[
          { id: 'all', label: 'All reported content', count: contentQuery.data?.total ?? 0 },
          { id: 'quiz', label: 'Quizzes' },
          { id: 'poll', label: 'Polls' },
        ]}
        active={type}
        onChange={(next) => {
          setType(next);
          setPage(1);
        }}
      />

      {contentQuery.error ? (
        <ErrorState error={contentQuery.error} onRetry={() => contentQuery.refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            loading={contentQuery.isLoading || contentQuery.isFetching}
            rowKey={(row) => `${row.target_type}-${row.target_id}`}
            emptyIcon={<Flag className="h-4 w-4" />}
            emptyTitle="No reported content"
            emptyDescription="Quizzes and polls reported by users appear here, most reported first."
          />
          {contentQuery.data && contentQuery.data.total > 0 && (
            <Pagination
              page={contentQuery.data.page}
              pageSize={contentQuery.data.pageSize}
              total={contentQuery.data.total}
              onPage={setPage}
            />
          )}
        </>
      )}

      <p className="mt-3 text-xs text-ink-muted">
        {titleCase('reports are resolved from the Reports page')} — every decision is written to the moderation audit trail.
      </p>
    </>
  );
}
