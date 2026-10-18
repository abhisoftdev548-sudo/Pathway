import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, Coins, Receipt, RefreshCw } from 'lucide-react';
import { api, ApiError, buildQuery, type Page } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useToast } from '@/components/ui/Toast';
import { PageHeading, Metric, Panel, Badge, StatusBadge, Tabs } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { TextArea, Select } from '@/components/ui/Field';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/States';
import { Modal, ConfirmDialog } from '@/components/ui/Dialog';
import { formatCoins, formatDateTime, titleCase } from '@/lib/format';

interface WalletData {
  wallet: {
    balance: number;
    lifetimeEarned: number;
    lifetimeSpent: number;
    updatedAt: string | null;
    earnedThisMonth: number;
    spentThisMonth: number;
  };
}

interface Transaction {
  id: string;
  amount: number;
  balanceAfter: number;
  entryType: string;
  description: string;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
}

interface RefundRow {
  id: string;
  amount: number;
  reason: string;
  status: string;
  decision_note: string;
  created_at: string;
  quiz_title: string | null;
  score_percent: number | null;
}

interface RefundableAttempt {
  id: string;
  entry_fee_charged: number;
  submitted_at: string;
  score_percent: number | null;
  quiz_title: string;
}

const TYPE_OPTIONS = [
  { value: 'all', label: 'All transaction types' },
  { value: 'signup_bonus', label: 'Welcome bonus' },
  { value: 'entry_fee', label: 'Entry fees' },
  { value: 'quiz_reward', label: 'Quiz rewards' },
  { value: 'refund', label: 'Refunds' },
  { value: 'manual_adjustment', label: 'Manual adjustments' },
  { value: 'reversal', label: 'Reconciliation' },
];

export function WalletPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('transactions');
  const [type, setType] = useState('all');
  const [page, setPage] = useState(1);
  const [requestOpen, setRequestOpen] = useState(false);
  const [attemptId, setAttemptId] = useState('');
  const [reason, setReason] = useState('');
  const [cancelId, setCancelId] = useState<string | null>(null);

  const wallet = useQuery<WalletData>({ queryKey: qk.wallet, queryFn: () => api.get('/wallet') });
  const path = `/wallet/transactions${buildQuery({ page, pageSize: 25, type })}`;
  const transactions = useQuery<Page<Transaction>>({
    queryKey: qk.transactions({ page, type }),
    queryFn: () => api.get(path),
    placeholderData: (prev) => prev,
  });
  const refunds = useQuery<{ items: RefundRow[] }>({ queryKey: qk.refunds, queryFn: () => api.get('/wallet/refund-requests') });
  const refundable = useQuery<{ items: RefundableAttempt[]; windowHours: number }>({
    queryKey: qk.refundable,
    queryFn: () => api.get('/wallet/refundable-attempts'),
    enabled: requestOpen,
  });

  const requestRefund = useMutation({
    mutationFn: () => api.post('/wallet/refund-requests', { attemptId, reason }),
    onSuccess: () => {
      setRequestOpen(false);
      setAttemptId('');
      setReason('');
      queryClient.invalidateQueries({ queryKey: qk.refunds });
      queryClient.invalidateQueries({ queryKey: qk.refundable });
      toast.success('Refund request submitted. An administrator will review it.');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not submit the request.'),
  });

  const cancelRefund = useMutation({
    mutationFn: (id: string) => api.del(`/wallet/refund-requests/${id}`),
    onSuccess: () => {
      setCancelId(null);
      queryClient.invalidateQueries({ queryKey: qk.refunds });
      toast.info('Refund request withdrawn.');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not withdraw the request.'),
  });

  const columns: Column<Transaction>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (row) => <span className="whitespace-nowrap text-ink-muted">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => (
        <div className="min-w-0">
          <span className="block truncate text-ink">{row.description}</span>
          <span className="text-2xs text-ink-faint">{titleCase(row.entryType.replace(/_/g, ' '))}</span>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (row) => (
        <span className={`inline-flex items-center gap-1 tabular-nums ${row.amount >= 0 ? 'text-emerald-700' : 'text-ink'}`}>
          {row.amount >= 0 ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
          {formatCoins(row.amount, true)}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Balance after',
      align: 'right',
      render: (row) => <span className="tabular-nums text-ink-soft">{formatCoins(row.balanceAfter)}</span>,
    },
  ];

  return (
    <>
      <PageHeading
        title="My QCoin wallet"
        description="Every QCoin movement is written to an append-only ledger. Balances are calculated on the server."
        actions={
          <Button size="sm" variant="secondary" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => {
            wallet.refetch();
            transactions.refetch();
            refunds.refetch();
          }}>
            Refresh
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Current balance" value={formatCoins(wallet.data?.wallet.balance ?? 0)} definition="The balance stored for your account, derived from your ledger entries." />
        <Metric label="Earned in total" value={formatCoins(wallet.data?.wallet.lifetimeEarned ?? 0)} hint="All credits since your account was created" />
        <Metric label="Spent in total" value={formatCoins(wallet.data?.wallet.lifetimeSpent ?? 0)} hint="All debits, mainly quiz entry fees" />
        <Metric
          label="This month"
          value={formatCoins(wallet.data?.wallet.earnedThisMonth ?? 0)}
          hint={`${formatCoins(wallet.data?.wallet.spentThisMonth ?? 0)} spent`}
        />
      </div>

      <Tabs
        className="mt-5"
        tabs={[
          { id: 'transactions', label: 'Transactions', count: transactions.data?.total ?? 0 },
          { id: 'refunds', label: 'Refund requests', count: refunds.data?.items.length ?? 0 },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'transactions' && (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <Select
              wrapperClassName="w-56"
              value={type}
              onChange={(event) => {
                setType(event.target.value);
                setPage(1);
              }}
              options={TYPE_OPTIONS}
              aria-label="Transaction type"
            />
          </div>
          {transactions.error ? (
            <ErrorState error={transactions.error} onRetry={() => transactions.refetch()} />
          ) : (
            <>
              <DataTable
                columns={columns}
                rows={transactions.data?.items}
                loading={transactions.isLoading || transactions.isFetching}
                rowKey={(row) => row.id}
                emptyIcon={<Receipt className="h-4 w-4" />}
                emptyTitle="Your QCoin transaction history will appear here"
                emptyDescription="Rewards, entry fees and refunds are recorded as soon as they happen."
              />
              {transactions.data && transactions.data.total > 0 && (
                <Pagination
                  page={transactions.data.page}
                  pageSize={transactions.data.pageSize}
                  total={transactions.data.total}
                  onPage={setPage}
                />
              )}
            </>
          )}
        </div>
      )}

      {tab === 'refunds' && (
        <div className="mt-4 space-y-4">
          <Panel
            title="Request a refund"
            description="Refunds are reviewed by an administrator before any QCoin is returned."
            actions={
              <Button
                size="sm"
                variant="secondary"
                icon={<Coins className="h-3.5 w-3.5" />}
                onClick={() => setRequestOpen(true)}
                disabled={(refundable.data?.items.length ?? 0) === 0 && refundable.isFetched}
              >
                New request
              </Button>
            }
          >
            {refundable.isFetched && !refundable.data?.items.length && (
              <p className="text-[13px] text-ink-muted">
                You have no paid attempts inside the {refundable.data?.windowHours ?? 24}-hour refund window.
              </p>
            )}
          </Panel>

          <Panel title="Your refund requests">
            {refunds.isLoading ? (
              <LoadingBlock rows={3} />
            ) : refunds.error ? (
              <ErrorState error={refunds.error} onRetry={() => refunds.refetch()} compact />
            ) : !refunds.data?.items.length ? (
              <EmptyState
                compact
                icon={<Receipt className="h-4 w-4" />}
                title="You have not requested any refunds"
                description="If a paid quiz attempt did not work as expected, you can request a refund while it is inside the refund window."
              />
            ) : (
              <ul className="divide-y divide-line">
                {refunds.data.items.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-medium text-ink">{row.quiz_title ?? 'Quiz attempt'}</span>
                        <StatusBadge status={row.status} />
                        <Badge tone="neutral">{formatCoins(row.amount)} QCoin</Badge>
                      </div>
                      <p className="mt-1 text-xs text-ink-muted">{row.reason}</p>
                      {row.decision_note && (
                        <p className="mt-1 rounded border border-line bg-canvas px-2 py-1 text-xs text-ink-soft">
                          Reviewer: {row.decision_note}
                        </p>
                      )}
                      <p className="mt-1 text-2xs text-ink-faint">Requested {formatDateTime(row.created_at)}</p>
                    </div>
                    {row.status === 'pending' && (
                      <Button size="sm" variant="ghost" onClick={() => setCancelId(row.id)}>
                        Withdraw
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      <Modal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        title="Request an entry fee refund"
        description="Choose the attempt and explain what went wrong."
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setRequestOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={requestRefund.isPending}
              disabled={!attemptId || reason.trim().length < 10}
              onClick={() => requestRefund.mutate()}
            >
              Submit request
            </Button>
          </>
        }
      >
        {refundable.isLoading ? (
          <LoadingBlock rows={2} />
        ) : (
          <Select
            label="Attempt"
            value={attemptId}
            onChange={(event) => setAttemptId(event.target.value)}
            options={[
              { value: '', label: 'Select an attempt' },
              ...(refundable.data?.items ?? []).map((item) => ({
                value: item.id,
                label: `${item.quiz_title} — ${formatCoins(item.entry_fee_charged)} QCoin, scored ${item.score_percent ?? 0}%`,
              })),
            ]}
          />
        )}
        <TextArea
          className="mt-3"
          label="Reason"
          required
          rows={4}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          hint="At least 10 characters. Explain what went wrong with the attempt."
        />
      </Modal>

      <ConfirmDialog
        open={cancelId !== null}
        title="Withdraw this refund request?"
        description="You can submit a new request later while the attempt is still inside the refund window."
        confirmLabel="Withdraw request"
        loading={cancelRefund.isPending}
        onConfirm={() => cancelId && cancelRefund.mutate(cancelId)}
        onCancel={() => setCancelId(null)}
      />
    </>
  );
}
