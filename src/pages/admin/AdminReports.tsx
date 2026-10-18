import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { Eye, Flag } from 'lucide-react';
import { api, ApiError, buildQuery, type Page } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useToast } from '@/components/ui/Toast';
import { PageHeading, Badge, StatusBadge, Tabs } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Select, TextArea } from '@/components/ui/Field';
import { cn } from '@/lib/cn';
import { formatDate, formatRelative, titleCase } from '@/lib/format';

interface ReportRow {
  id: string;
  target_type: 'user' | 'quiz' | 'poll' | 'review';
  target_id: string;
  targetTitle: string;
  reason: string;
  details: string | null;
  resolution: string | null;
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  reporter_name: string;
  reporter_username: string;
  resolved_by_username: string | null;
  created_at: string;
  resolved_at: string | null;
}

const TARGET_TABS = [
  { id: 'all', label: 'All targets' },
  { id: 'content', label: 'Content' },
  { id: 'quiz', label: 'Quizzes' },
  { id: 'poll', label: 'Polls' },
  { id: 'review', label: 'Reviews' },
  { id: 'user', label: 'Users' },
];

/** The route decides which slice of reports this page starts on. */
function defaultTargetType(pathname: string): string {
  if (pathname.endsWith('/user-reports') || pathname.endsWith('/reported-users')) return 'user';
  if (pathname.endsWith('/content-reports')) return 'content';
  if (pathname.endsWith('/reported-reviews')) return 'review';
  return 'all';
}

function headingFor(pathname: string): { title: string; description: string } {
  if (pathname.endsWith('/user-reports') || pathname.endsWith('/reported-users')) {
    return {
      title: 'User reports',
      description: 'Reports filed against accounts. Open the account to see its activity, content and report history before deciding.',
    };
  }
  if (pathname.endsWith('/content-reports')) {
    return {
      title: 'Content reports',
      description: 'Reports filed against quizzes and polls. Resolving records the outcome against the report and the audit log.',
    };
  }
  if (pathname.endsWith('/reported-reviews')) {
    return {
      title: 'Reported reviews',
      description: 'Reports filed against ratings and written reviews.',
    };
  }
  return {
    title: 'Reports',
    description: 'Reports filed by users against content, reviews and accounts. Resolving a report records who decided and why.',
  };
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'all', label: 'All statuses' },
];

function targetLink(report: ReportRow) {
  if (report.target_type === 'quiz') return `/admin/quizzes/${report.target_id}`;
  if (report.target_type === 'poll') return `/admin/polls/${report.target_id}`;
  if (report.target_type === 'user') return `/admin/users/${report.target_id}`;
  return null;
}

export function AdminReports() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  const heading = headingFor(location.pathname);
  const [targetType, setTargetType] = useState(defaultTargetType(location.pathname));
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ReportRow | null>(null);
  const [decision, setDecision] = useState<'resolved' | 'dismissed'>('resolved');
  const [note, setNote] = useState('');

  const query = useQuery<Page<ReportRow> & { summary: Record<string, number> }>({
    queryKey: qk.adminReports({ targetType, status, page }),
    queryFn: () => api.get(`/admin/moderation/reports${buildQuery({ targetType, status, page, pageSize: 25 })}`),
    placeholderData: (prev) => prev,
  });

  const resolve = useMutation({
    mutationFn: () => api.post(`/admin/moderation/reports/${selected?.id ?? ''}/resolve`, { status: decision, resolution: note }),
    onSuccess: () => {
      setSelected(null);
      setNote('');
      queryClient.invalidateQueries();
      toast.success('Report updated.');
    },
    onError: (err) => {
      setSelected(null);
      toast.error(err instanceof ApiError ? err.message : 'Could not update the report.');
    },
  });

  const columns: Column<ReportRow>[] = [
    {
      key: 'target',
      header: 'Reported item',
      render: (row) => {
        const href = targetLink(row);
        return (
          <div className="min-w-0">
            {href ? (
              <Link to={href} className="block max-w-[22rem] truncate font-medium text-ink hover:text-brand-700">
                {row.targetTitle}
              </Link>
            ) : (
              <span className="block max-w-[22rem] truncate font-medium text-ink">{row.targetTitle}</span>
            )}
            <span className="text-2xs text-ink-faint">{row.target_type}</span>
          </div>
        );
      },
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (row) => (
        <div className="min-w-0">
          <span className="block truncate text-ink-soft">{titleCase(row.reason.replace(/_/g, ' '))}</span>
          {row.details && <span className="block truncate text-2xs text-ink-faint">{row.details}</span>}
          {row.resolution && row.status !== 'pending' && (
            <span className="block truncate text-2xs text-ink-faint">Outcome: {row.resolution}</span>
          )}
        </div>
      ),
    },
    {
      key: 'reporter',
      header: 'Reported by',
      render: (row) => <span className="text-ink-muted">@{row.reporter_username}</span>,
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'filed',
      header: 'Filed',
      align: 'right',
      render: (row) => (
        <span className="whitespace-nowrap text-ink-muted" title={formatDate(row.created_at)}>
          {formatRelative(row.created_at)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) =>
        row.status === 'pending' ? (
          <Button size="sm" variant="secondary" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => { setSelected(row); setDecision('resolved'); setNote(''); }}>
            Review
          </Button>
        ) : (
          <span className="text-2xs text-ink-faint">{row.resolved_by_username ? `by @${row.resolved_by_username}` : 'Resolved'}</span>
        ),
    },
  ];

  const rows = query.data?.items ?? [];
  const summary = query.data?.summary;

  return (
    <>
      <PageHeading title={heading.title} description={heading.description} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Tabs
          tabs={TARGET_TABS}
          active={targetType}
          onChange={(next) => {
            setTargetType(next);
            setPage(1);
          }}
        />
        <div className="flex items-center gap-2">
          <Select
            wrapperClassName="w-40"
            aria-label="Status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            options={STATUS_OPTIONS}
          />
        </div>
      </div>

      {summary && (
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          {[
            { label: 'Pending', value: summary.pending ?? 0, tone: 'text-amber-700' },
            { label: 'Reviewing', value: summary.reviewing ?? 0, tone: 'text-ink' },
            { label: 'Resolved', value: summary.resolved ?? 0, tone: 'text-emerald-700' },
            { label: 'Dismissed', value: summary.dismissed ?? 0, tone: 'text-ink-muted' },
          ].map((item) => (
            <div key={item.label} className="surface p-3">
              <p className="text-2xs uppercase tracking-wide text-ink-faint">{item.label}</p>
              <p className={`mt-0.5 text-lg font-semibold tabular-nums ${item.tone}`}>{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            loading={query.isLoading || query.isFetching}
            rowKey={(row) => row.id}
            emptyIcon={<Flag className="h-4 w-4" />}
            emptyTitle="No reports here"
            emptyDescription="Reports filed by users against quizzes, polls, reviews and accounts appear here. Nothing matches this filter right now."
          />
          {query.data && query.data.total > 0 && (
            <Pagination page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPage={setPage} />
          )}
        </>
      )}

      <ConfirmDialog
        open={selected !== null}
        title={selected ? `${decision === 'resolved' ? 'Resolve' : 'Dismiss'} report on ${selected.targetTitle}?` : ''}
        description="The report status and your decision are stored in the moderation audit trail."
        confirmLabel={decision === 'resolved' ? 'Resolve report' : 'Dismiss report'}
        tone="primary"
        loading={resolve.isPending}
        onConfirm={() => resolve.mutate()}
        onCancel={() => {
          setSelected(null);
          setNote('');
        }}
      >
        <div className="space-y-3">
          {selected?.details && (
            <p className="rounded-md border border-line bg-canvas px-3 py-2 text-[13px] text-ink-soft">{selected.details}</p>
          )}
          <div className="flex gap-2">
            {(['resolved', 'dismissed'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDecision(option)}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-[13px] transition-colors duration-fast',
                  decision === option
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-line bg-surface text-ink-soft hover:border-line-strong',
                )}
              >
                {option === 'resolved' ? 'Upheld' : 'Dismissed'}
              </button>
            ))}
          </div>
          <TextArea
            label="Outcome"
            required
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            hint="At least 5 characters. Stored with the report and sent to the reporter."
            placeholder="What you found and what action followed"
          />
        </div>
      </ConfirmDialog>
    </>
  );
}
