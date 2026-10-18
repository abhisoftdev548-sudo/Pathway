import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Coins, Download, Info, Wallet } from 'lucide-react';
import endpoints, { type LedgerDto } from '@/services/endpoints';
import { useAuth } from '@/context/AuthContext';
import { useDocumentTitle } from '@/hooks';
import { Badge, Pagination, StatCard, Table, Td } from '@/components/ui/Data';
import { EmptyState, ErrorState, PageHeader, SkeletonTable, Card, CardBody, CardHeader } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Form';
import { formatDate, formatNumber } from '@/utils/format';
import { TX_TYPE, TX_TYPE_LABELS } from '@/utils/constants';
import { apiErrorMessage } from '@/services/api';

/** QCoin wallet: balance, totals, and the immutable transaction ledger. */
export function WalletPage() {
  useDocumentTitle('QCoin wallet');
  const { user, refreshUser } = useAuth();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['wallet-transactions', typeFilter, page],
    queryFn: () => endpoints.wallet.transactions({ type: typeFilter || undefined, page, limit: 15 }),
    placeholderData: (prev) => prev,
  });

  const { data: policy } = useQuery({
    queryKey: ['wallet-policy'],
    queryFn: () => endpoints.wallet.policy(),
    staleTime: 600000,
  });

  const items = data?.items ?? [];
  const meta = data?.meta;
  const wallet = user?.wallet;

  return (
    <div>
      <PageHeader
        title="QCoin wallet"
        description="Internal platform credits — earned, spent, and tracked in an immutable ledger."
      />

      {/* Balance cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Available balance"
          value={formatNumber(wallet?.balance ?? 0)}
          icon={<Coins className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Total earned"
          value={formatNumber(wallet?.totalEarned ?? 0)}
          icon={<Download className="h-5 w-5" />}
          tone="brand"
        />
        <StatCard
          label="Total spent"
          value={formatNumber(wallet?.totalSpent ?? 0)}
          icon={<Wallet className="h-5 w-5" />}
        />
      </div>

      {/* Policy notice — documented rules from the API */}
      {policy && (
        <div className="mt-5 flex items-start gap-3 rounded-lg border border-brand-100 bg-brand-50/60 px-4 py-3.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <div className="text-sm text-brand-900">
            <p className="font-medium">QCoins are not money</p>
            <p className="mt-0.5 text-brand-800/90">{policy.description}</p>
          </div>
        </div>
      )}

      {/* Ledger */}
      <Card className="mt-6">
        <CardHeader
          title="Transaction history"
          subtitle="Every credit and debit with its unique transaction ID."
          actions={
            <Select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-44"
              aria-label="Filter by type"
            >
              <option value="">All types</option>
              {Object.values(TX_TYPE).map((t) => (
                <option key={t} value={t}>
                  {TX_TYPE_LABELS[t] ?? t}
                </option>
              ))}
            </Select>
          }
        />
        {isLoading ? (
          <SkeletonTable rows={6} cols={5} />
        ) : isError ? (
          <ErrorState
            title="Could not load transactions"
            description={apiErrorMessage(error)}
            action={<Button onClick={() => refetch()}>Try again</Button>}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            description={
              typeFilter
                ? 'No transactions of this type have been recorded.'
                : 'Your ledger will fill up as you participate — entry fees, rewards, refunds, and bonuses all appear here.'
            }
            className="py-8"
          />
        ) : (
          <>
            <Table head={['Transaction', 'Type', 'Activity', 'Date', 'Amount', 'Balance']}>
              {items.map((tx: LedgerDto) => (
                <tr key={tx._id} className="hover:bg-surface-muted/70">
                  <Td>
                    <span className="font-mono text-xs text-body">{tx.txId}</span>
                  </Td>
                  <Td>
                    <Badge tone={tx.type === 'REWARD' ? 'success' : tx.type === 'REFUND' ? 'info' : 'neutral'}>
                      {TX_TYPE_LABELS[tx.type] ?? tx.type}
                    </Badge>
                  </Td>
                  <Td className="max-w-[180px] truncate text-body">{tx.reason || tx.activityType || '—'}</Td>
                  <Td className="text-body">{formatDate(tx.createdAt)}</Td>
                  <Td>
                    <span className={tx.amount > 0 ? 'font-medium text-success' : 'font-medium text-heading'}>
                      {tx.amount > 0 ? '+' : ''}
                      {formatNumber(tx.amount)}
                    </span>
                  </Td>
                  <Td className="text-body">{formatNumber(tx.balanceAfter)}</Td>
                </tr>
              ))}
            </Table>
            {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />}
          </>
        )}
      </Card>

      {/* Documented rules */}
      {policy && (
        <Card className="mt-6">
          <CardHeader title="Wallet rules" subtitle="How QCoins work across the platform." />
          <CardBody>
            <dl className="space-y-3">
              {Object.entries(policy.rules).map(([key, value]) => (
                <div key={key} className="rounded-lg border border-line px-4 py-3">
                  <dt className="text-sm font-medium capitalize text-heading">
                    {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </dt>
                  <dd className="mt-1 text-sm text-body">{value}</dd>
                </div>
              ))}
            </dl>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => void refreshUser()}>
              Refresh balance
            </Button>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

export default WalletPage;
