import { useQuery } from '@tanstack/react-query';
import { Gauge } from 'lucide-react';
import { api } from '@/lib/api';
import { qk } from '@/lib/queries';
import { PageHeading, Panel, Badge, Metric } from '@/components/ui/Primitives';
import { DataTable, type Column } from '@/components/ui/Table';
import { ErrorState } from '@/components/ui/States';
import { formatBytes, formatDateTime, formatDuration, formatNumber } from '@/lib/format';

interface Health {
  checks: { name: string; status: 'ok' | 'degraded' | 'down'; detail: string }[];
  uptime: { since: string; seconds: number };
  process: { nodeVersion: string; platform: string; memoryUsedMb: number; loadAverage: number[]; cpus: number };
  database: { path: string; sizeBytes: number | null; tables: { table: string; rows: number }[] };
  jobStats: { pending: number; running: number; completed: number; failed: number };
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger'> = {
  ok: 'success',
  degraded: 'warning',
  down: 'danger',
};

export function AdminHealth() {
  const query = useQuery<Health>({ queryKey: qk.adminHealth, queryFn: () => api.get('/admin/system/health'), refetchInterval: 30_000 });

  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (query.isLoading) return <div className="surface p-6 text-[13px] text-ink-muted">Checking services…</div>;

  const data = query.data!;
  const worst = data.checks.some((check) => check.status === 'down')
    ? 'down'
    : data.checks.some((check) => check.status === 'degraded')
      ? 'degraded'
      : 'ok';

  const tableColumns: Column<Health['database']['tables'][number]>[] = [
    { key: 'table', header: 'Table', render: (row) => <span className="font-mono text-xs text-ink">{row.table}</span> },
    { key: 'rows', header: 'Rows', align: 'right', render: (row) => <span className="tabular-nums text-ink-soft">{formatNumber(row.rows)}</span> },
  ];

  return (
    <>
      <PageHeading
        title="API and service health"
        description="Live checks against the database, the background job queue and recent application errors. Refreshes every 30 seconds."
        actions={<Badge tone={STATUS_TONE[worst]}>{worst === 'ok' ? 'All services healthy' : worst === 'degraded' ? 'Degraded' : 'Service down'}</Badge>}
      />

      <Panel title="Service checks" bodyClassName="p-0">
        <ul className="divide-y divide-line">
          {data.checks.map((check) => (
            <li key={check.name} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink">{check.name}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{check.detail}</p>
              </div>
              <Badge tone={STATUS_TONE[check.status]}>{check.status}</Badge>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Process uptime" value={formatDuration(data.uptime.seconds)} hint={`Since ${formatDateTime(data.uptime.since)}`} />
        <Metric label="Memory (RSS)" value={`${formatNumber(data.process.memoryUsedMb)} MB`} definition="Resident set size of the API process." />
        <Metric
          label="Load average"
          value={data.process.loadAverage.map((value) => value.toFixed(2)).join(' · ')}
          hint={`${data.process.cpus} CPU core(s) · ${data.process.platform}`}
        />
        <Metric label="Database size" value={formatBytes(data.database.sizeBytes)} hint={data.database.path} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Background jobs" description="State of the job queue.">
          <dl className="grid grid-cols-2 gap-3">
            {[
              { label: 'Queued', value: data.jobStats.pending },
              { label: 'Running', value: data.jobStats.running },
              { label: 'Completed', value: data.jobStats.completed },
              { label: 'Failed', value: data.jobStats.failed },
            ].map((item) => (
              <div key={item.label}>
                <dt className="text-xs text-ink-muted">{item.label}</dt>
                <dd className="text-[15px] font-semibold tabular-nums text-ink">{formatNumber(item.value)}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel className="lg:col-span-2" title="Runtime" description="Node and platform details for this process.">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-ink-muted">Node version</dt>
              <dd className="text-[13px] text-ink">{data.process.nodeVersion}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Platform</dt>
              <dd className="text-[13px] text-ink">{data.process.platform}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Database path</dt>
              <dd className="break-all font-mono text-xs text-ink">{data.database.path}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">CPU cores</dt>
              <dd className="text-[13px] text-ink">{formatNumber(data.process.cpus)}</dd>
            </div>
          </dl>
        </Panel>
      </div>

      <Panel className="mt-4" title="Table sizes" description="Row counts read directly from the database.">
        <DataTable columns={tableColumns} rows={data.database.tables} rowKey={(row) => row.table} />
        <p className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
          <Gauge className="h-3.5 w-3.5" />
          Counts are exact, not estimates, and come from live COUNT queries.
        </p>
      </Panel>
    </>
  );
}
