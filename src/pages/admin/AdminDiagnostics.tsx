import { useQuery } from '@tanstack/react-query';
import { Database } from 'lucide-react';
import { api } from '@/lib/api';
import { qk } from '@/lib/queries';
import { PageHeading, Panel, Badge } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/Table';
import { ErrorState } from '@/components/ui/States';
import { formatBytes, formatDateTime, formatNumber, titleCase } from '@/lib/format';

interface Diagnostics {
  pragmas: Record<string, unknown>;
  indexes: { name: string; tbl_name: string; sql: string }[];
  files: { name: string; sizeBytes: number }[];
  tableCounts: { table: string; rows: number }[];
  collectedAt: string;
}

export function AdminDiagnostics() {
  const query = useQuery<Diagnostics>({
    queryKey: qk.adminDiagnostics,
    queryFn: () => api.get('/admin/system/diagnostics'),
  });

  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (query.isLoading) return <div className="surface p-6 text-[13px] text-ink-muted">Collecting diagnostics…</div>;

  const data = query.data!;

  const tableColumns: Column<Diagnostics['tableCounts'][number]>[] = [
    { key: 'table', header: 'Table', render: (row) => <span className="font-mono text-xs text-ink">{row.table}</span> },
    { key: 'rows', header: 'Rows', align: 'right', render: (row) => <span className="tabular-nums text-ink-soft">{formatNumber(row.rows)}</span> },
  ];

  const indexColumns: Column<Diagnostics['indexes'][number]>[] = [
    { key: 'name', header: 'Index', render: (row) => <span className="font-mono text-xs text-ink">{row.name}</span> },
    { key: 'table', header: 'Table', render: (row) => <span className="font-mono text-2xs text-ink-muted">{row.tbl_name}</span> },
    { key: 'sql', header: 'Definition', render: (row) => <span className="block max-w-[32rem] truncate text-2xs text-ink-faint" title={row.sql}>{row.sql}</span> },
  ];

  return (
    <>
      <PageHeading
        title="Database and operational diagnostics"
        description="SQLite settings, indexes, files and row counts, read live from the database."
        actions={
          <Button size="sm" variant="secondary" onClick={() => query.refetch()}>
            Re-run diagnostics
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="SQLite settings" description="PRAGMA values for the active connection.">
          <dl className="space-y-2">
            {Object.entries(data.pragmas).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-0 last:pb-0">
                <dt className="font-mono text-xs text-ink-muted">{key}</dt>
                <dd className="text-[13px] tabular-nums text-ink">{value === null ? '—' : String(value)}</dd>
              </div>
            ))}
          </dl>
          {data.pragmas.journal_mode === 'wal' && <Badge tone="success">Write-ahead logging enabled</Badge>}
        </Panel>

        <Panel title="Database files" description="Files belonging to the active database.">
          {data.files.length === 0 ? (
            <p className="text-[13px] text-ink-muted">
              The database is running in memory, so there are no files to inspect.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {data.files.map((file) => (
                <li key={file.name} className="flex items-center justify-between gap-3 py-2">
                  <span className="break-all font-mono text-xs text-ink">{file.name}</span>
                  <span className="shrink-0 text-[13px] tabular-nums text-ink-soft">{formatBytes(file.sizeBytes)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
            <Database className="h-3.5 w-3.5" />
            Collected {formatDateTime(data.collectedAt)}
          </p>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Table row counts" bodyClassName="p-0">
          <div className="p-4">
            <DataTable columns={tableColumns} rows={data.tableCounts} rowKey={(row) => row.table} />
          </div>
        </Panel>

        <Panel className="lg:col-span-2" title={`Indexes (${data.indexes.length})`} description="Indexes created by the migration scripts.">
          <DataTable columns={indexColumns} rows={data.indexes} rowKey={(row) => row.name} />
          <p className="mt-3 text-xs text-ink-muted">
            {data.indexes.length === 0
              ? 'No indexes found. Run the database migrations to create them.'
              : `${formatNumber(data.indexes.length)} index definitions, including ${titleCase('unique constraints')} defined in the schema.`}
          </p>
        </Panel>
      </div>
    </>
  );
}
