import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Play, RotateCcw } from 'lucide-react';
import { api, ApiError, buildQuery, type Page } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useToast } from '@/components/ui/Toast';
import { PageHeading, Badge, StatusBadge, Tabs, Metric } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { ErrorState } from '@/components/ui/States';
import { JsonViewer, TimestampCell } from '@/components/patterns/LogTable';
import { formatNumber, titleCase } from '@/lib/format';

interface JobRow {
  id: string;
  type: string;
  payload: unknown;
  status: 'pending' | 'running' | 'completed' | 'failed';
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  run_at: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'success' | 'danger'> = {
  pending: 'neutral',
  running: 'info',
  completed: 'success',
  failed: 'danger',
};

export function AdminJobs() {
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(searchParams.get('status') ?? 'all');
  const [type, setType] = useState('all');
  const [page, setPage] = useState(1);

  const query = useQuery<Page<JobRow> & { stats: { pending: number; running: number; completed: number; failed: number }; types: string[] }>({
    queryKey: qk.adminJobs({ status, type, page }),
    queryFn: () => api.get(`/admin/system/jobs${buildQuery({ status, type, page, pageSize: 25 })}`),
    placeholderData: (prev) => prev,
    refetchInterval: 15_000,
  });

  const retry = useMutation({
    mutationFn: (id: string) => api.post(`/admin/system/jobs/${id}/retry`),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Job queued for another attempt.');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'That job could not be retried.'),
  });

  const runNow = useMutation({
    mutationFn: (id: string) => api.post(`/admin/system/jobs/${id}/run`),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Job run requested.');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'That job could not be run.'),
  });

  const enqueue = useMutation({
    mutationFn: (jobType: string) => api.post('/admin/system/jobs', { type: jobType }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Job queued.');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'That job could not be queued.'),
  });

  const columns: Column<JobRow>[] = [
    {
      key: 'type',
      header: 'Job',
      render: (row) => (
        <div className="min-w-0">
          <span className="block truncate font-medium text-ink">{titleCase(row.type.replace(/_/g, ' '))}</span>
          <span className="font-mono text-2xs text-ink-faint">{row.id.slice(0, 12)}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge tone={STATUS_TONE[row.status] ?? 'neutral'}>{titleCase(row.status)}</Badge>,
    },
    {
      key: 'attempts',
      header: 'Attempts',
      align: 'right',
      render: (row) => (
        <span className="tabular-nums text-ink-muted">
          {row.attempts} / {row.max_attempts}
        </span>
      ),
    },
    { key: 'created', header: 'Created', render: (row) => <TimestampCell value={row.created_at} /> },
    { key: 'finished', header: 'Finished', render: (row) => <TimestampCell value={row.finished_at} /> },
    {
      key: 'error',
      header: 'Last error',
      render: (row) =>
        row.last_error ? (
          <span className="block max-w-[24rem] truncate text-xs text-red-700" title={row.last_error}>
            {row.last_error}
          </span>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      key: 'payload',
      header: 'Payload',
      align: 'right',
      render: (row) => <div className="flex justify-end"><JsonViewer value={row.payload} /></div>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-1">
          {row.status === 'failed' && (
            <Button size="sm" variant="secondary" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => retry.mutate(row.id)}>
              Retry
            </Button>
          )}
          {row.status !== 'running' && (
            <Button size="sm" variant="ghost" icon={<Play className="h-3.5 w-3.5" />} onClick={() => runNow.mutate(row.id)}>
              Run now
            </Button>
          )}
        </div>
      ),
    },
  ];

  const stats = query.data?.stats;

  return (
    <>
      <PageHeading
        title="Background jobs"
        description="Scheduled and queued maintenance work: session cleanup, attempt expiry, poll close notifications and database integrity checks."
      />

      {stats && (
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <Metric label="Queued" value={formatNumber(stats.pending)} definition="Jobs waiting for their scheduled run time." />
          <Metric label="Running" value={formatNumber(stats.running)} definition="Jobs currently executing." />
          <Metric label="Completed" value={formatNumber(stats.completed)} definition="Jobs that finished successfully." />
          <Metric label="Failed" value={formatNumber(stats.failed)} definition="Jobs that exhausted their attempts or threw an error." />
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <Tabs
          tabs={[
            { id: 'all', label: 'All jobs' },
            { id: 'pending', label: 'Queued' },
            { id: 'running', label: 'Running' },
            { id: 'failed', label: 'Failed' },
            { id: 'completed', label: 'Completed' },
          ]}
          active={status}
          onChange={(next) => {
            setStatus(next);
            setPage(1);
          }}
        />
        <div className="flex items-end gap-2">
          <Select
            wrapperClassName="w-56"
            aria-label="Job type filter"
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setPage(1);
            }}
            options={[
              { value: 'all', label: 'All job types' },
              ...(query.data?.types ?? []).map((item) => ({ value: item, label: titleCase(item.replace(/_/g, ' ')) })),
            ]}
          />
          {query.data?.types?.map((item) => (
            <Button key={item} size="sm" variant="ghost" onClick={() => enqueue.mutate(item)} disabled={enqueue.isPending}>
              Queue {titleCase(item.replace(/_/g, ' '))}
            </Button>
          ))}
        </div>
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
            emptyIcon={<RotateCcw className="h-4 w-4" />}
            emptyTitle="No jobs recorded"
            emptyDescription="Background jobs appear here once the worker has queued or run one."
          />
          {query.data && query.data.total > 0 && (
            <Pagination page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPage={setPage} />
          )}
        </>
      )}

      <p className="mt-3 text-xs text-ink-muted">
        Retrying or running a job is recorded in the audit log. Failed jobs keep their last error so the cause stays visible.
      </p>
    </>
  );
}
