import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, Coins } from 'lucide-react';
import { api, buildQuery } from '@/lib/api';
import { qk } from '@/lib/queries';
import { PageHeading, Metric, Panel, Badge } from '@/components/ui/Primitives';
import { TimeSeriesChart, seriesColor } from '@/components/ui/Chart';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/Table';
import { ErrorState } from '@/components/ui/States';
import { formatCoins, formatDate, formatNumber, titleCase } from '@/lib/format';

interface ByTypeRow {
  entry_type: string;
  entries: number;
  issued: number;
  spent: number;
}

interface Overview {
  range: { from: string; to: string; days: number };
  circulation: { totalOutstanding: number; fundedAccounts: number; zeroBalanceAccounts: number };
  issuedInRange: number;
  spentInRange: number;
  entriesInRange: number;
  byType: ByTypeRow[];
  pending: { refunds: number; rewardDisputes: number };
  anomalyCounts: {
    negativeBalances: number;
    mismatched: number;
    duplicateRewards: number;
    repeatedRefunds: number;
    farming: number;
  };
  limits: Record<string, number>;
}

const ANOMALY_LINKS: { key: keyof Overview['anomalyCounts']; label: string; to: string; definition: string }[] = [
  { key: 'negativeBalances', label: 'Negative balances', to: '/admin/qcoin/anomalies', definition: 'Wallet accounts whose stored balance is below zero.' },
  { key: 'mismatched', label: 'Balance mismatches', to: '/admin/qcoin/reconciliation', definition: 'Stored balances that differ from the sum of their ledger entries.' },
  { key: 'duplicateRewards', label: 'Duplicate rewards', to: '/admin/qcoin/anomalies', definition: 'More than one quiz reward recorded against the same attempt.' },
  { key: 'repeatedRefunds', label: 'Repeated refunds', to: '/admin/qcoin/refunds', definition: 'Accounts with three or more approved refunds.' },
  { key: 'farming', label: 'Possible reward farming', to: '/admin/qcoin/anomalies', definition: 'Accounts with ten or more quiz attempts in a 24 hour period.' },
];

export function AdminQcoinOverview() {
  const days = 30;

  const query = useQuery<Overview>({
    queryKey: qk.adminQcoinOverview({ days }),
    queryFn: () => api.get(`/admin/qcoin/overview${buildQuery({ days })}`),
  });

  const flowQuery = useQuery<{ series: { day: string; coinsIssued: number; coinsSpent: number }[] }>({
    queryKey: qk.adminAnalytics(days),
    queryFn: () => api.get(`/admin/analytics${buildQuery({ days })}`),
  });

  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (query.isLoading) return <div className="surface p-6 text-[13px] text-ink-muted">Loading ledger overview…</div>;

  const data = query.data!;
  const hasEntries = data.entriesInRange > 0;
  const anomalyTotal = Object.values(data.anomalyCounts).reduce((sum, value) => sum + value, 0);

  const columns: Column<ByTypeRow>[] = [
    {
      key: 'type',
      header: 'Entry type',
      render: (row) => <span className="text-ink">{titleCase(row.entry_type.replace(/_/g, ' '))}</span>,
    },
    { key: 'entries', header: 'Entries', align: 'right', render: (row) => <span className="tabular-nums text-ink-soft">{formatNumber(row.entries)}</span> },
    {
      key: 'issued',
      header: 'Issued',
      align: 'right',
      render: (row) => <span className="tabular-nums text-emerald-700">{formatCoins(row.issued)}</span>,
    },
    { key: 'spent', header: 'Spent', align: 'right', render: (row) => <span className="tabular-nums text-ink">{formatCoins(row.spent)}</span> },
  ];

  return (
    <>
      <PageHeading
        title="QCoin wallet and ledger overview"
        description="Balances are derived from the append-only ledger. Every figure below is read from the database for the selected range."
        actions={
          <>
            <Button to="/admin/qcoin/transactions" size="sm">
              Transaction history
            </Button>
            <Button to="/admin/qcoin/adjustments" size="sm" variant="secondary">
              Manual adjustment
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="QCoin in circulation"
          value={formatCoins(data.circulation.totalOutstanding)}
          definition="SUM(balance) across all wallet accounts — the total QCoin currently held by users."
          hint={`${formatNumber(data.circulation.fundedAccounts)} accounts · ${formatNumber(data.circulation.zeroBalanceAccounts)} at zero`}
        />
        <Metric
          label={`Issued (last ${data.range.days} days)`}
          value={formatCoins(data.issuedInRange)}
          definition="SUM of positive ledger entries created inside the selected date range."
          hint={`${formatNumber(data.entriesInRange)} ledger entries in range`}
        />
        <Metric
          label={`Spent (last ${data.range.days} days)`}
          value={formatCoins(data.spentInRange)}
          definition="Absolute SUM of negative ledger entries created inside the selected date range."
          hint={`${formatDate(data.range.from)} – ${formatDate(data.range.to)}`}
        />
        <Metric
          label="Awaiting action"
          value={formatNumber(data.pending.refunds + data.pending.rewardDisputes)}
          definition="Refund requests and reward disputes that have not yet been decided."
          hint={`${data.pending.refunds} refunds · ${data.pending.rewardDisputes} disputes`}
        />
      </div>

      <Panel
        title="Integrity checks"
        description="Automated scans for the failure modes this ledger guards against."
        className="mb-4"
        actions={
          anomalyTotal > 0 ? (
            <Button to="/admin/qcoin/anomalies" size="sm" variant="secondary" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
              Investigate
            </Button>
          ) : null
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {ANOMALY_LINKS.map((item) => {
            const count = data.anomalyCounts[item.key];
            return (
              <Link
                key={item.key}
                to={item.to}
                title={item.definition}
                className="rounded-md border border-line bg-canvas px-3 py-2.5 transition-colors duration-fast hover:border-line-strong"
              >
                <p className="text-2xs uppercase tracking-wide text-ink-faint">{item.label}</p>
                <p className={`mt-1 text-lg font-semibold tabular-nums ${count > 0 ? 'text-amber-700' : 'text-ink'}`}>{count}</p>
              </Link>
            );
          })}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Flow by entry type"
          description="Issued and spent totals grouped by ledger entry type, for the selected range."
          className="lg:col-span-2"
        >
          {hasEntries ? (
            <DataTable columns={columns} rows={data.byType} rowKey={(row) => row.entry_type} />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <Coins className="h-5 w-5 text-ink-faint" />
              <p className="text-[13px] font-medium text-ink">No QCoin movement yet</p>
              <p className="max-w-sm text-[13px] text-ink-muted">
                Ledger entries appear here as users earn rewards, pay entry fees and receive refunds.
              </p>
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Configured limits" description="Read from platform settings. Change them under Reward Limits.">
            <dl className="space-y-2">
              {Object.entries(data.limits ?? {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <dt className="min-w-0 truncate text-xs text-ink-muted" title={titleCase(key.replace(/_/g, ' '))}>
                    {titleCase(key.replace(/_/g, ' '))}
                  </dt>
                  <dd className="shrink-0 text-[13px] font-medium tabular-nums text-ink">
                    {typeof value === 'number' ? value : String(value)}
                  </dd>
                </div>
              ))}
              {Object.keys(data.limits ?? {}).length === 0 && (
                <p className="text-[13px] text-ink-muted">No reward limits configured.</p>
              )}
            </dl>
            <Button to="/admin/config/reward_limits" size="sm" variant="ghost" className="mt-3">
              Edit reward limits
            </Button>
          </Panel>

          <Panel title="Daily flow" description="Issued versus spent per day across the range.">
            <TimeSeriesChart
              data={flowQuery.data?.series ?? []}
              series={[
                { key: 'coinsIssued', label: 'Issued', color: seriesColor(1) },
                { key: 'coinsSpent', label: 'Spent', color: seriesColor(3) },
              ]}
              height={200}
              area={false}
            />
          </Panel>
        </div>
      </div>

      <p className="mt-4 flex items-center gap-2 text-xs text-ink-muted">
        <Badge tone="neutral">Ledger is append-only</Badge>
        Balances can only change through a posted ledger entry; manual adjustments require a reason and an audit record.
      </p>
    </>
  );
}
