import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { qk } from '@/lib/queries';
import { PageHeading, Panel, Badge } from '@/components/ui/Primitives';
import { DataTable, type Column } from '@/components/ui/Table';
import { ErrorState } from '@/components/ui/States';
import { formatCoins, formatDateTime, formatNumber } from '@/lib/format';

interface Anomalies {
  negativeBalances: { user_id: string; username: string; balance: number }[];
  mismatched: { user_id: string; username: string; stored: number; computed: number }[];
  duplicateRewards: { user_id: string; username: string; reference_id: string; times: number; total: number }[];
  repeatedRefunds: { user_id: string; username: string; times: number; total: number }[];
  farming: { user_id: string; username: string; attempts: number; earned: number }[];
  generatedAt: string;
}

const SECTIONS: {
  key: keyof Omit<Anomalies, 'generatedAt'>;
  title: string;
  definition: string;
}[] = [
  {
    key: 'negativeBalances',
    title: 'Negative balances',
    definition: 'Wallet accounts whose stored balance is below zero. Should be impossible; investigate immediately.',
  },
  {
    key: 'mismatched',
    title: 'Stored balance does not match the ledger',
    definition: 'Accounts where the stored balance differs from the sum of their ledger entries. Repair from the reconciliation page.',
  },
  {
    key: 'duplicateRewards',
    title: 'Duplicate quiz rewards',
    definition: 'More than one quiz_reward ledger entry recorded against the same attempt reference.',
  },
  {
    key: 'repeatedRefunds',
    title: 'Repeated refunds',
    definition: 'Accounts with three or more refund entries in the ledger.',
  },
  {
    key: 'farming',
    title: 'Possible reward farming',
    definition: 'Accounts with ten or more quiz attempts submitted in the last 24 hours.',
  },
];

const userCell = (userId: string, username: string) => (
  <Link to={`/admin/users/${userId}`} className="truncate font-medium text-ink hover:text-brand-700">
    @{username}
  </Link>
);

export function AdminAnomalies() {
  const query = useQuery<Anomalies>({ queryKey: qk.adminAnomalies, queryFn: () => api.get('/admin/qcoin/anomalies') });

  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const data = query.data;
  const total = data
    ? data.negativeBalances.length +
      data.mismatched.length +
      data.duplicateRewards.length +
      data.repeatedRefunds.length +
      data.farming.length
    : 0;

  const columns: Record<keyof Omit<Anomalies, 'generatedAt'>, Column<any>[]> = {
    negativeBalances: [
      { key: 'user', header: 'Account', render: (row) => userCell(row.user_id, row.username) },
      {
        key: 'balance',
        header: 'Balance',
        align: 'right',
        render: (row) => <span className="tabular-nums font-medium text-red-600">{formatCoins(row.balance)}</span>,
      },
    ],
    mismatched: [
      { key: 'user', header: 'Account', render: (row) => userCell(row.user_id, row.username) },
      { key: 'stored', header: 'Stored', align: 'right', render: (row) => <span className="tabular-nums text-ink">{formatCoins(row.stored)}</span> },
      {
        key: 'computed',
        header: 'Ledger sum',
        align: 'right',
        render: (row) => <span className="tabular-nums text-ink">{formatCoins(row.computed)}</span>,
      },
      {
        key: 'difference',
        header: 'Difference',
        align: 'right',
        render: (row) => (
          <span className="tabular-nums font-medium text-amber-700">{formatCoins(row.computed - row.stored, true)}</span>
        ),
      },
    ],
    duplicateRewards: [
      { key: 'user', header: 'Account', render: (row) => userCell(row.user_id, row.username) },
      {
        key: 'reference',
        header: 'Reference',
        render: (row) => <span className="font-mono text-2xs text-ink-muted">{row.reference_id}</span>,
      },
      { key: 'times', header: 'Entries', align: 'right', render: (row) => <span className="tabular-nums text-ink">{formatNumber(row.times)}</span> },
      { key: 'total', header: 'Total paid', align: 'right', render: (row) => <span className="tabular-nums text-ink">{formatCoins(row.total)}</span> },
    ],
    repeatedRefunds: [
      { key: 'user', header: 'Account', render: (row) => userCell(row.user_id, row.username) },
      { key: 'times', header: 'Refunds', align: 'right', render: (row) => <span className="tabular-nums text-ink">{formatNumber(row.times)}</span> },
      { key: 'total', header: 'Total refunded', align: 'right', render: (row) => <span className="tabular-nums text-ink">{formatCoins(row.total)}</span> },
    ],
    farming: [
      { key: 'user', header: 'Account', render: (row) => userCell(row.user_id, row.username) },
      {
        key: 'attempts',
        header: 'Attempts (24h)',
        align: 'right',
        render: (row) => <span className="tabular-nums text-ink">{formatNumber(row.attempts)}</span>,
      },
      { key: 'earned', header: 'Earned', align: 'right', render: (row) => <span className="tabular-nums text-ink">{formatCoins(row.earned)}</span> },
    ],
  };

  return (
    <>
      <PageHeading
        title="Suspicious transactions"
        description="Automated scans of the live ledger for the failure modes the wallet is designed to prevent. Nothing here is simulated."
        actions={
          data ? (
            <Badge tone={total === 0 ? 'success' : 'warning'}>
              {total === 0 ? 'No anomalies detected' : `${total} item(s) to review`}
            </Badge>
          ) : null
        }
      />

      {query.isLoading ? (
        <div className="surface p-6 text-[13px] text-ink-muted">Scanning the ledger…</div>
      ) : total === 0 ? (
        <div className="surface flex flex-col items-center gap-2 px-4 py-12 text-center">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <p className="text-[13px] font-medium text-ink">No anomalies detected</p>
          <p className="max-w-md text-[13px] text-ink-muted">
            No negative balances, ledger mismatches, duplicate rewards, repeated refunds or reward-farming patterns were found.
          </p>
          {data && <p className="mt-1 text-2xs text-ink-faint">Last scan: {formatDateTime(data.generatedAt)}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {SECTIONS.map((section) => {
            const rows = data ? (data[section.key] as unknown as Record<string, unknown>[]) : [];
            if (rows.length === 0) return null;
            return (
              <Panel
                key={section.key}
                title={section.title}
                description={section.definition}
                actions={<Badge tone="warning">{rows.length}</Badge>}
                bodyClassName="p-0"
              >
                <div className="p-4">
                  <DataTable
                    columns={columns[section.key]}
                    rows={rows}
                    rowKey={(row) => `${section.key}-${String(row.user_id)}-${String(row.reference_id ?? '')}`}
                  />
                </div>
              </Panel>
            );
          })}
          {data && (
            <p className="text-xs text-ink-faint">
              Scan generated {formatDateTime(data.generatedAt)}. Results are recalculated from the database on every request.
            </p>
          )}
          <p className="flex items-center gap-1.5 text-xs text-ink-muted">
            <ShieldAlert className="h-3.5 w-3.5" />
            Do not edit balances directly. Use reconciliation or a manual adjustment so the change is audited.
          </p>
        </div>
      )}
    </>
  );
}
