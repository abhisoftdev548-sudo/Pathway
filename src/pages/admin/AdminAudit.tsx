import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Coins, ShieldCheck } from 'lucide-react';
import { api, buildQuery, type Page } from '@/lib/api';
import { qk } from '@/lib/queries';
import { PageHeading, Badge } from '@/components/ui/Primitives';
import { TextInput, Select } from '@/components/ui/Field';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { ErrorState } from '@/components/ui/States';
import { MetadataCell, TimestampCell, JsonViewer } from '@/components/patterns/LogTable';
import { titleCase } from '@/lib/format';

interface AuditRow {
  id: string;
  actor_label: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: unknown;
  ip: string | null;
  created_at: string;
}

interface SecurityRow {
  id: string;
  event: string;
  outcome: string;
  ip: string | null;
  user_agent: string | null;
  metadata: unknown;
  created_at: string;
  username: string | null;
}

const OUTCOME_TONE: Record<string, 'success' | 'danger' | 'warning' | 'neutral'> = {
  success: 'success',
  failure: 'danger',
  blocked: 'warning',
};

function AuditFilters({
  action,
  setAction,
  actor,
  setActor,
  from,
  setFrom,
  to,
  setTo,
  actionOptions,
}: {
  action: string;
  setAction: (value: string) => void;
  actor: string;
  setActor: (value: string) => void;
  from: string;
  setFrom: (value: string) => void;
  to: string;
  setTo: (value: string) => void;
  actionOptions: { value: string; label: string }[];
}) {
  return (
    <div className="surface mb-4 flex flex-wrap items-end gap-2 p-3">
      <Select wrapperClassName="w-56" aria-label="Action" value={action} onChange={(event) => setAction(event.target.value)} options={actionOptions} />
      <div className="w-48">
        <TextInput aria-label="Actor" placeholder="Filter by actor" value={actor} onChange={(event) => setActor(event.target.value)} />
      </div>
      <div className="w-40">
        <TextInput aria-label="From date" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
      </div>
      <div className="w-40">
        <TextInput aria-label="To date" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
      </div>
    </div>
  );
}

export function AdminAuditLogs() {
  const [action, setAction] = useState('all');
  const [actor, setActor] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const query = useQuery<Page<AuditRow> & { actions: { action: string; total: number }[] }>({
    queryKey: qk.adminAuditLogs({ action, actor, from, to, page }),
    queryFn: () => api.get(`/admin/audit/logs${buildQuery({ action, actor, from, to, page, pageSize: 50 })}`),
    placeholderData: (prev) => prev,
  });

  const columns: Column<AuditRow>[] = [
    { key: 'when', header: 'When', render: (row) => <TimestampCell value={row.created_at} /> },
    { key: 'actor', header: 'Actor', render: (row) => <span className="truncate text-ink">{row.actor_label}</span> },
    { key: 'action', header: 'Action', render: (row) => <span className="text-ink-soft">{titleCase(row.action.replace(/\./g, ' '))}</span> },
    {
      key: 'target',
      header: 'Target',
      render: (row) =>
        row.target_type ? (
          <span className="text-2xs text-ink-faint">
            {row.target_type}
            {row.target_id ? ` · ${row.target_id.slice(0, 8)}…` : ''}
          </span>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    { key: 'metadata', header: 'Details', render: (row) => <MetadataCell value={row.metadata} /> },
    { key: 'ip', header: 'IP', align: 'right', render: (row) => <span className="text-2xs text-ink-faint">{row.ip ?? '—'}</span> },
  ];

  const options = [
    { value: 'all', label: 'All actions' },
    ...(query.data?.actions ?? []).map((item) => ({
      value: item.action,
      label: `${titleCase(item.action.replace(/\./g, ' '))} (${item.total})`,
    })),
  ];

  return (
    <>
      <PageHeading
        title="Admin action logs"
        description="Every privileged action taken on the platform, with the actor, the target, the metadata and the source address. Entries are append-only."
      />
      <AuditFilters
        action={action}
        setAction={(value) => {
          setAction(value);
          setPage(1);
        }}
        actor={actor}
        setActor={(value) => {
          setActor(value);
          setPage(1);
        }}
        from={from}
        setFrom={(value) => {
          setFrom(value);
          setPage(1);
        }}
        to={to}
        setTo={(value) => {
          setTo(value);
          setPage(1);
        }}
        actionOptions={options}
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
            emptyIcon={<ClipboardList className="h-4 w-4" />}
            emptyTitle="No admin actions logged"
            emptyDescription="Actions such as approvals, suspensions, role changes and configuration edits appear here."
          />
          {query.data && query.data.total > 0 && (
            <Pagination page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPage={setPage} />
          )}
        </>
      )}
    </>
  );
}

export function AdminQcoinAudit() {
  const [action, setAction] = useState('all');
  const [actor, setActor] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const query = useQuery<Page<AuditRow> & { actions: { action: string; total: number }[] }>({
    queryKey: qk.adminAuditLogs({ action, actor, from, to, page, targetType: 'qcoin' }),
    queryFn: () =>
      api.get(
        `/admin/audit/logs${buildQuery({
          action: action === 'all' ? undefined : action,
          actor,
          from,
          to,
          page,
          pageSize: 50,
        })}`,
      ),
    placeholderData: (prev) => prev,
  });

  const rows = (query.data?.items ?? []).filter(
    (row) => row.action.startsWith('qcoin.') || row.target_type === 'ledger_entry',
  );

  const columns: Column<AuditRow>[] = [
    { key: 'when', header: 'When', render: (row) => <TimestampCell value={row.created_at} /> },
    { key: 'actor', header: 'Administrator', render: (row) => <span className="truncate text-ink">{row.actor_label}</span> },
    { key: 'action', header: 'Action', render: (row) => <span className="text-ink-soft">{titleCase(row.action.replace(/\./g, ' '))}</span> },
    { key: 'target', header: 'Account', render: (row) => <span className="font-mono text-2xs text-ink-faint">{row.target_id ?? '—'}</span> },
    { key: 'metadata', header: 'Amount / reason', render: (row) => <JsonViewer value={row.metadata} /> },
  ];

  const options = [
    { value: 'all', label: 'All QCoin actions' },
    { value: 'qcoin.manual_adjustment', label: 'Manual adjustments' },
    { value: 'qcoin.refund_decided', label: 'Refund decisions' },
    { value: 'qcoin.reward_dispute_decided', label: 'Reward dispute decisions' },
    { value: 'qcoin.balance_repaired', label: 'Balance repairs' },
  ];

  return (
    <>
      <PageHeading
        title="QCoin audit logs"
        description="Every action that moved, refunded or repaired QCoin. Each row is the audit record written at the same time as the ledger entry."
      />
      <AuditFilters
        action={action}
        setAction={(value) => {
          setAction(value);
          setPage(1);
        }}
        actor={actor}
        setActor={(value) => {
          setActor(value);
          setPage(1);
        }}
        from={from}
        setFrom={(value) => {
          setFrom(value);
          setPage(1);
        }}
        to={to}
        setTo={(value) => {
          setTo(value);
          setPage(1);
        }}
        actionOptions={options}
      />
      {query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            loading={query.isLoading || query.isFetching}
            rowKey={(row) => row.id}
            emptyIcon={<Coins className="h-4 w-4" />}
            emptyTitle="No QCoin audit entries"
            emptyDescription="Manual adjustments, refund decisions, dispute outcomes and balance repairs appear here."
          />
          {query.data && query.data.total > 0 && (
            <Pagination page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPage={setPage} />
          )}
        </>
      )}
    </>
  );
}

export function AdminSecurityEvents() {
  const [event, setEvent] = useState('all');
  const [outcome, setOutcome] = useState('all');
  const [page, setPage] = useState(1);

  const query = useQuery<Page<SecurityRow> & { events: { event: string; outcome: string; total: number }[] }>({
    queryKey: qk.adminSecurityEvents({ event, outcome, page }),
    queryFn: () => api.get(`/admin/audit/security-events${buildQuery({ event, outcome, page, pageSize: 50 })}`),
    placeholderData: (prev) => prev,
  });

  const columns: Column<SecurityRow>[] = [
    { key: 'when', header: 'When', render: (row) => <TimestampCell value={row.created_at} /> },
    {
      key: 'event',
      header: 'Event',
      render: (row) => <span className="text-ink">{titleCase(row.event.replace(/\./g, ' '))}</span>,
    },
    {
      key: 'outcome',
      header: 'Outcome',
      render: (row) => <Badge tone={OUTCOME_TONE[row.outcome] ?? 'neutral'}>{titleCase(row.outcome)}</Badge>,
    },
    { key: 'user', header: 'Account', render: (row) => <span className="text-ink-soft">{row.username ? `@${row.username}` : 'Not signed in'}</span> },
    { key: 'ip', header: 'IP', render: (row) => <span className="text-2xs text-ink-faint">{row.ip ?? '—'}</span> },
    { key: 'metadata', header: 'Details', render: (row) => <MetadataCell value={row.metadata} /> },
  ];

  const options = [
    { value: 'all', label: 'All events' },
    ...Array.from(new Set((query.data?.events ?? []).map((item) => item.event))).map((item) => ({
      value: item,
      label: titleCase(item.replace(/\./g, ' ')),
    })),
  ];

  const summary = query.data?.events ?? [];
  const failures = summary.filter((item) => item.outcome === 'failure').reduce((sum, item) => sum + item.total, 0);
  const blocked = summary.filter((item) => item.outcome === 'blocked').reduce((sum, item) => sum + item.total, 0);

  return (
    <>
      <PageHeading
        title="Security events"
        description="Sign-in attempts, permission denials and other security-relevant events recorded by the server."
        actions={
          <>
            <Badge tone={failures > 0 ? 'warning' : 'neutral'}>{failures} failed sign-in(s)</Badge>
            <Badge tone={blocked > 0 ? 'warning' : 'neutral'}>{blocked} blocked request(s)</Badge>
          </>
        }
      />

      <div className="surface mb-4 flex flex-wrap items-end gap-2 p-3">
        <Select
          wrapperClassName="w-56"
          aria-label="Event"
          value={event}
          onChange={(value) => {
            setEvent(value.target.value);
            setPage(1);
          }}
          options={options}
        />
        <Select
          wrapperClassName="w-44"
          aria-label="Outcome"
          value={outcome}
          onChange={(value) => {
            setOutcome(value.target.value);
            setPage(1);
          }}
          options={[
            { value: 'all', label: 'Any outcome' },
            { value: 'success', label: 'Success' },
            { value: 'failure', label: 'Failure' },
            { value: 'blocked', label: 'Blocked' },
          ]}
        />
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
            emptyIcon={<ShieldCheck className="h-4 w-4" />}
            emptyTitle="No security events recorded"
            emptyDescription="Sign-in attempts, permission denials and rate-limit blocks appear here."
          />
          {query.data && query.data.total > 0 && (
            <Pagination page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPage={setPage} />
          )}
        </>
      )}
    </>
  );
}
