import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Coins } from 'lucide-react';
import endpoints, { type LedgerDto } from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { Badge, Pagination, Table, Td, StatCard } from '@/components/ui/Data';
import { Card, CardHeader, EmptyState, ErrorState, PageHeader, SkeletonTable } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Form';
import { formatDate, formatNumber } from '@/utils/format';
import { TX_TYPE, TX_TYPE_LABELS } from '@/utils/constants';
import { apiErrorMessage } from '@/services/api';

/**
 * QCoin ledger inspector: every transaction on the platform.
 * Ledger entries are immutable — corrections happen as new adjustment entries.
 */
export function AdminLedgerPage() {
  useDocumentTitle('QCoin ledger');
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'ledger', type, page],
    queryFn: () => endpoints.admin.ledger({ type: type || undefined, page, limit: 20 }),
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];
  const meta = data?.meta;

  const totalCredits = items.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalDebits = items.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div>
      <PageHeader
        title="QCoin ledger"
        description="Immutable record of every credit and debit. Entries are never edited or deleted."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Credits (page)" value={formatNumber(totalCredits)} icon={<Coins className="h-5 w-5" />} tone="success" />
        <StatCard label="Debits (page)" value={formatNumber(totalDebits)} icon={<Coins className="h-5 w-5" />} />
        <StatCard
          label="Transactions (page)"
          value={formatNumber(items.length)}
          hint={meta ? `${formatNumber(meta.total)} total` : undefined}
        />
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Transactions"
          actions={
            <Select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
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
          <SkeletonTable rows={8} cols={6} />
        ) : isError ? (
          <ErrorState
            title="Could not load ledger"
            description={apiErrorMessage(error)}
            action={<Button onClick={() => refetch()}>Try again</Button>}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="No transactions found"
            description="Ledger entries matching your filter will appear here."
            className="py-8"
          />
        ) : (
          <>
            <Table head={['Tx ID', 'User', 'Type', 'Amount', 'Balance after', 'Reason', 'When']}>
              {items.map((tx: LedgerDto) => (
                <tr key={tx._id} className="hover:bg-zinc-50/70">
                  <Td>
                    <span className="font-mono text-xs text-zinc-500">{tx.txId}</span>
                  </Td>
                  <Td className="text-zinc-700">{tx.user?.name ?? '—'}</Td>
                  <Td>
                    <Badge
                      tone={tx.type === 'REWARD' ? 'success' : tx.type === 'ADJUSTMENT' ? 'warning' : 'neutral'}
                    >
                      {TX_TYPE_LABELS[tx.type] ?? tx.type}
                    </Badge>
                  </Td>
                  <Td>
                    <span className={tx.amount > 0 ? 'font-medium text-emerald-600' : 'font-medium text-zinc-800'}>
                      {tx.amount > 0 ? '+' : ''}
                      {formatNumber(tx.amount)}
                    </span>
                  </Td>
                  <Td>{formatNumber(tx.balanceAfter)}</Td>
                  <Td className="max-w-[200px] truncate text-zinc-500">{tx.reason || '—'}</Td>
                  <Td className="text-zinc-500">{formatDate(tx.createdAt)}</Td>
                </tr>
              ))}
            </Table>
            {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />}
          </>
        )}
      </Card>
    </div>
  );
}

export default AdminLedgerPage;
