import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { api, ApiError, buildQuery, type Page } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useToast } from '@/components/ui/Toast';
import { PageHeading, Badge, Metric } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { TimestampCell } from '@/components/patterns/LogTable';
import { formatNumber } from '@/lib/format';

interface ErrorRow {
  id: string;
  method: string;
  path: string;
  status: number;
  message: string;
  stack: string | null;
  created_at: string;
  username: string | null;
}

export function AdminErrors() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const query = useQuery<Page<ErrorRow> & { last24h: number }>({
    queryKey: qk.adminErrors({ page }),
    queryFn: () => api.get(`/admin/system/errors${buildQuery({ page, pageSize: 25 })}`),
    placeholderData: (prev) => prev,
    refetchInterval: 60_000,
  });

  const clear = useMutation({
    mutationFn: () => api.del<{ deleted: number }>('/admin/system/errors'),
    onSuccess: (result) => {
      setConfirmClear(false);
      queryClient.invalidateQueries();
      toast.success(`${result.deleted} error record(s) cleared.`);
    },
    onError: (err) => {
      setConfirmClear(false);
      toast.error(err instanceof ApiError ? err.message : 'Could not clear the error log.');
    },
  });

  const columns: Column<ErrorRow>[] = [
    { key: 'when', header: 'When', render: (row) => <TimestampCell value={row.created_at} /> },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge tone={row.status >= 500 ? 'danger' : row.status >= 400 ? 'warning' : 'neutral'}>{row.status}</Badge>
      ),
    },
    {
      key: 'request',
      header: 'Request',
      render: (row) => (
        <span className="font-mono text-2xs text-ink-soft">
          {row.method} {row.path}
        </span>
      ),
    },
    {
      key: 'message',
      header: 'Message',
      render: (row) => <span className="block max-w-[26rem] truncate text-ink" title={row.message}>{row.message}</span>,
    },
    {
      key: 'user',
      header: 'Account',
      render: (row) => <span className="text-ink-muted">{row.username ? `@${row.username}` : '—'}</span>,
    },
    {
      key: 'stack',
      header: '',
      align: 'right',
      render: (row) => (
        <Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === row.id ? null : row.id)}>
          {expanded === row.id ? 'Hide trace' : 'Show trace'}
        </Button>
      ),
    },
  ];

  const total = query.data?.total ?? 0;
  const last24h = query.data?.last24h ?? 0;

  return (
    <>
      <PageHeading
        title="Application error monitoring"
        description="Unhandled errors recorded by the API, newest first. Each entry keeps the request, the status and the stack trace."
        actions={
          total > 0 ? (
            <Button size="sm" variant="danger" onClick={() => setConfirmClear(true)}>
              Clear error log
            </Button>
          ) : null
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Errors recorded" value={formatNumber(total)} definition="Every row currently stored in the error log." />
        <Metric label="Last 24 hours" value={formatNumber(last24h)} definition="Errors created within the last 24 hours." />
        <Metric
          label="Current state"
          value={last24h === 0 ? 'No recent errors' : `${last24h} in 24h`}
          definition="Derived from the count of errors created in the last 24 hours."
        />
      </div>

      {query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : total === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-4 w-4" />}
          title="No application errors recorded"
          description="Nothing has thrown an unhandled error since the log was last cleared."
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={query.data?.items}
            loading={query.isLoading || query.isFetching}
            rowKey={(row) => row.id}
            emptyIcon={<AlertTriangle className="h-4 w-4" />}
            emptyTitle="No errors recorded"
            emptyDescription="Unhandled application errors appear here."
          />
          {expanded && (
            <div className="surface mt-3 p-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-ink-faint">Stack trace</p>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-canvas p-3 text-2xs text-ink-soft">
                {(query.data?.items ?? []).find((row) => row.id === expanded)?.stack ?? 'No stack trace stored.'}
              </pre>
            </div>
          )}
          {query.data && query.data.total > 0 && (
            <Pagination page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPage={setPage} />
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="Clear the error log?"
        description="This deletes every stored error record, including stack traces. The deletion itself is written to the audit log."
        confirmLabel="Delete all error records"
        tone="danger"
        loading={clear.isPending}
        onConfirm={() => clear.mutate()}
        onCancel={() => setConfirmClear(false)}
      />
    </>
  );
}
