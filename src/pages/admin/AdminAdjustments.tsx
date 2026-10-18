import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, ShieldCheck } from 'lucide-react';
import { api, ApiError, buildQuery, type Page } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth';
import { PageHeading, Panel, Badge } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { TextInput, TextArea, Select } from '@/components/ui/Field';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { ErrorState, EmptyState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { cn } from '@/lib/cn';
import { formatCoins, formatDateTime, formatNumber, titleCase } from '@/lib/format';

interface UserChoice {
  id: string;
  username: string;
  display_name: string;
  email: string;
  role: string;
  account_status: string;
}

interface LedgerRow {
  id: string;
  created_at: string;
  amount: number;
  balance_after: number;
  description: string;
  username: string;
  display_name: string;
  user_id: string;
}

export function AdminAdjustments() {
  const location = useLocation();
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const presetUserId = new URLSearchParams(location.search).get('userId') ?? '';
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(presetUserId);
  const [direction, setDirection] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);

  const usersQuery = useQuery<Page<UserChoice>>({
    queryKey: qk.adminUsers({ q: userSearch, pageSize: 10 }),
    queryFn: () => api.get(`/admin/users${buildQuery({ q: userSearch, pageSize: 10 })}`),
    placeholderData: (prev) => prev,
  });

  const walletQuery = useQuery<{
    wallet: { balance: number; lifetimeEarned: number; lifetimeSpent: number };
    transactions: LedgerRow[];
    total: number;
    reconciliation: { stored: number; computed: number; matches: boolean };
  }>({
    queryKey: ['admin', 'qcoin', 'user-wallet', selectedUserId],
    queryFn: () => api.get(`/admin/qcoin/users/${selectedUserId}/wallet`),
    enabled: Boolean(selectedUserId),
  });

  const recentQuery = useQuery<Page<LedgerRow>>({
    queryKey: qk.adminTransactions({ type: 'manual_adjustment', page }),
    queryFn: () => api.get(`/admin/qcoin/transactions${buildQuery({ type: 'manual_adjustment', page, pageSize: 25 })}`),
    placeholderData: (prev) => prev,
  });

  const limitsQuery = useQuery<{ rewards: Record<string, number> }>({
    queryKey: qk.adminPolicies,
    queryFn: () => api.get('/admin/qcoin/policies'),
  });

  const selectedUser = useMemo(
    () => (usersQuery.data?.items ?? []).find((item) => item.id === selectedUserId) ?? null,
    [usersQuery.data, selectedUserId],
  );

  const maxAdjustment = limitsQuery.data?.rewards?.max_manual_adjustment ?? null;
  const parsedAmount = Number.parseInt(amount, 10);
  const amountValue = Number.isFinite(parsedAmount) ? parsedAmount : 0;

  const submit = useMutation({
    mutationFn: () =>
      api.post('/admin/qcoin/adjustments', { userId: selectedUserId, amount: amountValue, direction, reason }),
    onSuccess: () => {
      setConfirming(false);
      setAmount('');
      setReason('');
      setFieldErrors({});
      queryClient.invalidateQueries();
      toast.success(`${direction === 'credit' ? 'Credit' : 'Debit'} of ${amountValue} QCoin posted and audited.`);
    },
    onError: (err) => {
      setConfirming(false);
      if (err instanceof ApiError && err.status === 422 && Object.keys(err.fieldErrors).length > 0) {
        setFieldErrors(err.fieldErrors);
      }
      toast.error(err instanceof ApiError ? err.message : 'Could not post the adjustment.');
    },
  });

  const historyColumns: Column<LedgerRow>[] = [
    { key: 'date', header: 'When', render: (row) => <span className="whitespace-nowrap text-ink-muted">{formatDateTime(row.created_at)}</span> },
    {
      key: 'user',
      header: 'Account',
      render: (row) => (
        <span className="block truncate text-ink">
          {row.display_name} <span className="text-2xs text-ink-faint">@{row.username}</span>
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => <span className="block max-w-[28rem] truncate text-ink-soft">{row.description}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (row) => (
        <span className={`tabular-nums font-medium ${row.amount >= 0 ? 'text-emerald-700' : 'text-ink'}`}>
          {formatCoins(row.amount, true)}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Balance after',
      align: 'right',
      render: (row) => <span className="tabular-nums text-ink-muted">{formatCoins(row.balance_after)}</span>,
    },
  ];

  const canSubmit =
    Boolean(selectedUserId) &&
    amountValue > 0 &&
    reason.trim().length >= 10 &&
    (maxAdjustment === null || amountValue <= maxAdjustment);

  return (
    <>
      <PageHeading
        title="Manual QCoin adjustments"
        description="Every adjustment needs an account, an amount, a direction and a reason. The change is posted as a ledger entry and recorded in the audit log — balances are never edited silently."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="New adjustment" description="Search for the account, then record the adjustment.">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canSubmit) return;
              setConfirming(true);
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput
                label="Find account"
                placeholder="Username, display name or email"
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                hint="Search runs against registered accounts."
              />
              <Select
                label="Account"
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
                options={[
                  { value: '', label: 'Select an account' },
                  ...(usersQuery.data?.items ?? []).map((item) => ({
                    value: item.id,
                    label: `${item.display_name} (@${item.username})`,
                  })),
                ]}
                error={fieldErrors.userId}
              />
            </div>

            {selectedUserId && (
              <div className="rounded-md border border-line bg-canvas px-3 py-2.5">
                {walletQuery.isLoading ? (
                  <p className="text-xs text-ink-muted">Loading wallet…</p>
                ) : walletQuery.error ? (
                  <p className="text-xs text-red-700">Could not load this wallet.</p>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-muted">
                    <span>
                      Balance{' '}
                      <span className="font-medium tabular-nums text-ink">
                        {formatCoins(walletQuery.data?.wallet.balance ?? 0)}
                      </span>
                    </span>
                    <span>
                      Lifetime earned{' '}
                      <span className="font-medium tabular-nums text-ink">
                        {formatCoins(walletQuery.data?.wallet.lifetimeEarned ?? 0)}
                      </span>
                    </span>
                    <span>
                      Lifetime spent{' '}
                      <span className="font-medium tabular-nums text-ink">
                        {formatCoins(walletQuery.data?.wallet.lifetimeSpent ?? 0)}
                      </span>
                    </span>
                    <span>
                      {walletQuery.data?.reconciliation.matches ? (
                        <Badge tone="success">Ledger consistent</Badge>
                      ) : (
                        <Badge tone="warning">Ledger mismatch — reconcile first</Badge>
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="mb-1 text-xs font-medium text-ink-soft">Direction</p>
                <div className="flex gap-2">
                  {(['credit', 'debit'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setDirection(option)}
                      className={cn(
                        'flex-1 rounded-md border px-3 py-2 text-[13px] transition-colors duration-fast',
                        direction === option
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-line bg-surface text-ink-soft hover:border-line-strong',
                      )}
                    >
                      {option === 'credit' ? 'Credit (+)' : 'Debit (−)'}
                    </button>
                  ))}
                </div>
              </div>
              <TextInput
                label="Amount (QCoin)"
                type="number"
                min={1}
                step={1}
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                error={fieldErrors.amount}
                hint={maxAdjustment !== null ? `Maximum single adjustment: ${maxAdjustment}` : undefined}
              />
              <div className="flex items-end">
                {direction === 'debit' && walletQuery.data && amountValue > walletQuery.data.wallet.balance && (
                  <p className="pb-2 text-xs text-red-700">
                    This exceeds the current balance of {formatCoins(walletQuery.data.wallet.balance)}.
                  </p>
                )}
              </div>
            </div>

            <TextArea
              label="Reason"
              required
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              error={fieldErrors.reason}
              hint={`At least 10 characters. Recorded in the ledger description and the audit log as ${currentUser?.displayName ?? 'the acting administrator'}.`}
              placeholder="Why is this adjustment being made?"
            />

            <div className="flex items-center gap-2">
              <Button type="submit" variant="primary" disabled={!canSubmit || submit.isPending}>
                Review and post adjustment
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setAmount('');
                  setReason('');
                  setFieldErrors({});
                }}
              >
                Clear
              </Button>
            </div>
          </form>
        </Panel>

        <div className="space-y-4">
          <Panel title="Rules enforced">
            <ul className="space-y-2 text-[13px] text-ink-soft">
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                A reason of at least 10 characters is required.
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                The amount must be a whole number of QCoins and cannot exceed the configured maximum.
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                A debit cannot take a balance below zero; the write is rejected by the database constraint.
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                Each adjustment posts one ledger entry and one audit record naming the administrator.
              </li>
            </ul>
            <p className="mt-3 text-xs text-ink-muted">
              Maximum single adjustment:{' '}
              <span className="font-medium text-ink">
                {maxAdjustment !== null ? formatNumber(maxAdjustment) : 'not configured'}
              </span>
            </p>
            <Button to="/admin/config/reward_limits" size="sm" variant="ghost" className="mt-2">
              Change limit
            </Button>
          </Panel>

          {walletQuery.data && (
            <Panel title={`Recent entries for ${walletQuery.data.transactions[0]?.display_name ?? 'this account'}`}>
              {walletQuery.data.transactions.length === 0 ? (
                <p className="text-[13px] text-ink-muted">No ledger entries for this account.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {walletQuery.data.transactions.slice(0, 8).map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] text-ink-soft">{row.description}</p>
                        <p className="text-2xs text-ink-faint">{formatDateTime(row.created_at)}</p>
                      </div>
                      <span className={`shrink-0 tabular-nums ${row.amount >= 0 ? 'text-emerald-700' : 'text-ink'}`}>
                        {formatCoins(row.amount, true)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>
      </div>

      <Panel
        className="mt-4"
        title="Adjustment history"
        description="Every manual adjustment ever posted, newest first."
        bodyClassName="p-0"
      >
        <div className="p-4">
          {recentQuery.error ? (
            <ErrorState error={recentQuery.error} onRetry={() => recentQuery.refetch()} />
          ) : (recentQuery.data?.items.length ?? 0) === 0 ? (
            <EmptyState
              compact
              icon={<History className="h-4 w-4" />}
              title="No manual adjustments recorded"
              description="Manual credits and debits posted by administrators appear here with the reason and the acting administrator."
            />
          ) : (
            <>
              <DataTable columns={historyColumns} rows={recentQuery.data?.items} rowKey={(row) => row.id} />
              {recentQuery.data && recentQuery.data.total > 0 && (
                <Pagination
                  page={recentQuery.data.page}
                  pageSize={recentQuery.data.pageSize}
                  total={recentQuery.data.total}
                  onPage={setPage}
                />
              )}
            </>
          )}
        </div>
      </Panel>

      <ConfirmDialog
        open={confirming}
        title={`Post this ${direction}?`}
        description="This writes a ledger entry immediately and notifies the account holder. It cannot be undone except by an opposite, equally audited adjustment."
        confirmLabel={`Post ${direction} of ${amountValue} QCoin`}
        tone="primary"
        loading={submit.isPending}
        onConfirm={() => submit.mutate()}
        onCancel={() => setConfirming(false)}
      >
        <dl className="space-y-2 text-[13px]">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Account</dt>
            <dd className="truncate text-ink">
              {selectedUser ? `${selectedUser.display_name} (@${selectedUser.username})` : selectedUserId}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Direction</dt>
            <dd className="text-ink">{titleCase(direction)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Amount</dt>
            <dd className="tabular-nums text-ink">
              {formatCoins(direction === 'credit' ? amountValue : -amountValue, true)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Balance after</dt>
            <dd className="tabular-nums text-ink">
              {walletQuery.data
                ? formatCoins(
                    walletQuery.data.wallet.balance + (direction === 'credit' ? amountValue : -amountValue),
                  )
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">Reason</dt>
            <dd className="mt-0.5 whitespace-pre-line text-ink">{reason}</dd>
          </div>
        </dl>
      </ConfirmDialog>
    </>
  );
}
