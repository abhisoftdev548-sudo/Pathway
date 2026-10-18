import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Scale } from 'lucide-react';
import { api, ApiError, buildQuery, type Page } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useToast } from '@/components/ui/Toast';
import { PageHeading, Badge, Panel } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { TextArea, Switch } from '@/components/ui/Field';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { ErrorState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { formatCoins, formatDate, formatNumber } from '@/lib/format';

interface ReconRow {
  user_id: string;
  username: string;
  display_name: string;
  stored_balance: number;
  computed_balance: number;
  entry_count: number;
  updated_at: string | null;
}

export function AdminReconciliation() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [onlyMismatched, setOnlyMismatched] = useState(true);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ReconRow | null>(null);
  const [reason, setReason] = useState('');

  const query = useQuery<Page<ReconRow> & { mismatchedTotal: number }>({
    queryKey: qk.adminReconciliation({ onlyMismatched, page }),
    queryFn: () => api.get(`/admin/qcoin/reconciliation${buildQuery({ onlyMismatched, page, pageSize: 50 })}`),
    placeholderData: (prev) => prev,
  });

  const repair = useMutation({
    mutationFn: () => api.post(`/admin/qcoin/reconciliation/${selected?.user_id ?? ''}/repair`, { reason }),
    onSuccess: () => {
      setSelected(null);
      setReason('');
      queryClient.invalidateQueries();
      toast.success('Balance recomputed from the ledger and the repair was audited.');
    },
    onError: (err) => {
      setSelected(null);
      toast.error(err instanceof ApiError ? err.message : 'Could not repair that balance.');
    },
  });

  const columns: Column<ReconRow>[] = [
    {
      key: 'user',
      header: 'Account',
      render: (row) => (
        <div className="min-w-0">
          <Link to={`/admin/users/${row.user_id}`} className="block truncate font-medium text-ink hover:text-brand-700">
            {row.display_name}
          </Link>
          <span className="text-2xs text-ink-faint">@{row.username}</span>
        </div>
      ),
    },
    {
      key: 'stored',
      header: 'Stored balance',
      align: 'right',
      render: (row) => <span className="tabular-nums text-ink">{formatCoins(row.stored_balance)}</span>,
    },
    {
      key: 'computed',
      header: 'Ledger sum',
      align: 'right',
      render: (row) => <span className="tabular-nums text-ink">{formatCoins(row.computed_balance)}</span>,
    },
    {
      key: 'difference',
      header: 'Difference',
      align: 'right',
      render: (row) => {
        const diff = row.computed_balance - row.stored_balance;
        return (
          <span className={`tabular-nums font-medium ${diff === 0 ? 'text-ink-muted' : 'text-amber-700'}`}>
            {formatCoins(diff, true)}
          </span>
        );
      },
    },
    {
      key: 'entries',
      header: 'Ledger entries',
      align: 'right',
      render: (row) => <span className="tabular-nums text-ink-muted">{formatNumber(row.entry_count)}</span>,
    },
    {
      key: 'updated',
      header: 'Wallet updated',
      align: 'right',
      render: (row) => <span className="whitespace-nowrap text-ink-muted">{formatDate(row.updated_at)}</span>,
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (row) =>
        row.computed_balance === row.stored_balance ? (
          <Badge tone="success">Matches</Badge>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setSelected(row);
              setReason('');
            }}
          >
            Repair
          </Button>
        ),
    },
  ];

  const mismatched = query.data?.mismatchedTotal ?? 0;

  return (
    <>
      <PageHeading
        title="Balance reconciliation"
        description="Compares each stored wallet balance with the sum of its ledger entries. Repairing recomputes the cached balance from the ledger and records the change in the audit log — it never edits a balance silently."
      />

      <Panel className="mb-4" title="Scope">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Switch
            checked={onlyMismatched}
            onChange={(next) => {
              setOnlyMismatched(next);
              setPage(1);
            }}
            label="Show only accounts where the balance does not match the ledger"
          />
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <span>{formatNumber(mismatched)} account(s) out of balance</span>
            {mismatched === 0 && <Badge tone="success">Ledger is consistent</Badge>}
          </div>
        </div>
      </Panel>

      {query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={query.data?.items}
            loading={query.isLoading || query.isFetching}
            rowKey={(row) => row.user_id}
            emptyIcon={<Scale className="h-4 w-4" />}
            emptyTitle={onlyMismatched ? 'Every balance matches its ledger' : 'No wallets to reconcile'}
            emptyDescription={
              onlyMismatched
                ? 'No stored balance differs from the sum of its ledger entries.'
                : 'Wallets are created the first time a user earns or spends QCoin.'
            }
          />
          {query.data && query.data.total > 0 && (
            <Pagination page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPage={setPage} />
          )}
        </>
      )}

      <ConfirmDialog
        open={selected !== null}
        title={`Repair ${selected?.display_name}'s balance?`}
        description="The stored balance is recomputed from the ledger, which is the source of truth. No new ledger entry is created: posting one would move both figures by the same amount and leave the difference in place. The repair is written to the audit log with before, after and your reason."
        confirmLabel="Recompute balance from ledger"
        tone="primary"
        loading={repair.isPending}
        onConfirm={() => repair.mutate()}
        onCancel={() => {
          setSelected(null);
          setReason('');
        }}
      >
        <div className="space-y-3">
          {selected && (
            <dl className="grid grid-cols-3 gap-3 rounded-md border border-line bg-canvas px-3 py-2">
              <div>
                <dt className="text-2xs uppercase tracking-wide text-ink-faint">Stored</dt>
                <dd className="text-[13px] tabular-nums text-ink">{formatCoins(selected.stored_balance)}</dd>
              </div>
              <div>
                <dt className="text-2xs uppercase tracking-wide text-ink-faint">Ledger</dt>
                <dd className="text-[13px] tabular-nums text-ink">{formatCoins(selected.computed_balance)}</dd>
              </div>
              <div>
                <dt className="text-2xs uppercase tracking-wide text-ink-faint">Balance set to ledger sum</dt>
                <dd className="text-[13px] font-medium tabular-nums text-amber-700">
                  {formatCoins(selected.computed_balance)}
                </dd>
              </div>
            </dl>
          )}
          <TextArea
            label="Reason"
            required
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            hint="At least 10 characters. Stored in the audit record with the before and after balances."
          />
        </div>
      </ConfirmDialog>
    </>
  );
}
