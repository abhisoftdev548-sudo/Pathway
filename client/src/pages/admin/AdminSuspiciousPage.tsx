import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle } from 'lucide-react';
import endpoints, { type SuspiciousDto } from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { Badge, Table, Td } from '@/components/ui/Data';
import { Card, CardHeader, EmptyState, ErrorState, PageHeader, SkeletonTable } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { formatDate, formatNumber } from '@/utils/format';
import { apiErrorMessage } from '@/services/api';

/**
 * Suspicious transaction review. These are heuristics that flag real ledger
 * rows for human investigation — nothing is modified automatically.
 */
export function AdminSuspiciousPage() {
  useDocumentTitle('Suspicious transactions');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'suspicious'],
    queryFn: () => endpoints.admin.suspicious({ limit: 25 }),
    refetchInterval: 60000,
  });

  const farming = data?.rewardFarming ?? [];
  const adjustments = data?.largeAdjustments ?? [];
  const isEmpty = farming.length === 0 && adjustments.length === 0;

  return (
    <div>
      <PageHeader
        title="Suspicious transactions"
        description="Reward-farming velocity and large manual adjustments in the last 24 hours — flagged for review, never auto-punished."
      />

      {isLoading ? (
        <SkeletonTable rows={5} cols={4} />
      ) : isError ? (
        <ErrorState
          title="Could not run analysis"
          description={apiErrorMessage(error)}
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      ) : isEmpty ? (
        <EmptyState
          icon={<Activity className="h-6 w-6" />}
          title="Nothing suspicious detected"
          description="Accounts claiming unusually many rewards, and large QCoin adjustments, will be listed here for investigation."
        />
      ) : (
        <div className="space-y-6">
          {farming.length > 0 && (
            <Card>
              <CardHeader
                title="High reward velocity (24h)"
                subtitle="Accounts with 5+ reward payouts in 24 hours — possible reward farming."
                actions={<Badge tone="warning"><AlertTriangle className="h-3 w-3" /> {farming.length}</Badge>}
              />
              <Table head={['User', 'Rewards claimed', 'Total rewarded', 'Window']}>
                {farming.map((row, i) => (
                  <tr key={i} className="hover:bg-zinc-50/70">
                    <Td className="text-zinc-700">{row.user?.name ?? 'Unknown'}</Td>
                    <Td className="font-medium text-zinc-900">{formatNumber(row.rewardCount)}</Td>
                    <Td>{formatNumber(row.totalRewarded)} QCoins</Td>
                    <Td className="text-zinc-500">{row.window}</Td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}

          {adjustments.length > 0 && (
            <Card>
              <CardHeader
                title="Large manual adjustments"
                subtitle="Adjustments of ±500 QCoins or more — verify the recorded reasons."
                actions={<Badge tone="warning"><AlertTriangle className="h-3 w-3" /> {adjustments.length}</Badge>}
              />
              <Table head={['Tx ID', 'User', 'Amount', 'Reason', 'By', 'When']}>
                {adjustments.map((tx) => (
                  <tr key={tx.txId} className="hover:bg-zinc-50/70">
                    <Td>
                      <span className="font-mono text-xs text-zinc-500">{tx.txId}</span>
                    </Td>
                    <Td className="text-zinc-700">{tx.user?.name ?? '—'}</Td>
                    <Td>
                      <span className={tx.amount > 0 ? 'font-medium text-emerald-600' : 'font-medium text-red-600'}>
                        {tx.amount > 0 ? '+' : ''}
                        {formatNumber(tx.amount)}
                      </span>
                    </Td>
                    <Td className="max-w-[220px] truncate text-zinc-500">{tx.reason || '—'}</Td>
                    <Td className="text-zinc-500">{tx.performedBy?.name ?? '—'}</Td>
                    <Td className="text-zinc-500">{formatDate(tx.createdAt)}</Td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminSuspiciousPage;
