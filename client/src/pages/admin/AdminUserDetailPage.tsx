import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import endpoints from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { Avatar, Badge, StatCard, Table, Td } from '@/components/ui/Data';
import { Card, CardBody, CardHeader, ErrorState, PageHeader, SkeletonList } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { formatDate, formatNumber } from '@/utils/format';
import { TX_TYPE_LABELS } from '@/utils/constants';
import { apiErrorMessage } from '@/services/api';

/** Authorized user detail: activity, reports, transactions, and wallet reconciliation. */
export function AdminUserDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'user-detail', id],
    queryFn: () => endpoints.admin.userDetail(id),
    enabled: Boolean(id),
  });

  useDocumentTitle(data?.user?.name ? `User: ${data.user.name}` : 'User detail');

  if (isLoading) return <SkeletonList count={3} />;

  if (isError || !data) {
    return (
      <ErrorState
        title="Could not load user"
        description={apiErrorMessage(error)}
        action={<Button onClick={() => refetch()}>Try again</Button>}
      />
    );
  }

  const { user, activity, reports, recentTransactions, reconciliation } = data;

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar name={user.name} src={user.avatar?.url} size="lg" />
            {user.name}
          </span>
        }
        description={user.email}
        actions={
          <Link to="/admin/user-management">
            <Button variant="outline">Manage user</Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Quizzes created" value={formatNumber(activity.quizzes)} />
        <StatCard label="Polls created" value={formatNumber(activity.polls)} />
        <StatCard label="Quiz attempts" value={formatNumber(activity.attempts)} tone="brand" />
        <StatCard label="Poll votes" value={formatNumber(activity.votes)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Wallet reconciliation"
            subtitle="Counters vs immutable ledger (discrepancies are never auto-fixed)."
            actions={
              reconciliation.consistent ? (
                <Badge tone="success">
                  <CheckCircle2 className="h-3 w-3" /> Consistent
                </Badge>
              ) : (
                <Badge tone="danger">
                  <AlertTriangle className="h-3 w-3" /> Discrepancy
                </Badge>
              )
            }
          />
          <CardBody>
            <Table head={['Metric', 'Wallet', 'Ledger', 'Difference']}>
              <tr>
                <Td>Balance</Td>
                <Td>{formatNumber(reconciliation.wallet.balance)}</Td>
                <Td>{formatNumber(reconciliation.ledger.balance)}</Td>
                <Td>{formatNumber(reconciliation.discrepancy.balance)}</Td>
              </tr>
              <tr>
                <Td>Total earned</Td>
                <Td>{formatNumber(reconciliation.wallet.totalEarned)}</Td>
                <Td>{formatNumber(reconciliation.ledger.totalEarned)}</Td>
                <Td>{formatNumber(reconciliation.discrepancy.totalEarned)}</Td>
              </tr>
              <tr>
                <Td>Total spent</Td>
                <Td>{formatNumber(reconciliation.wallet.totalSpent)}</Td>
                <Td>{formatNumber(reconciliation.ledger.totalSpent)}</Td>
                <Td>{formatNumber(reconciliation.discrepancy.totalSpent)}</Td>
              </tr>
            </Table>
            <p className="mt-3 text-xs text-muted">
              {reconciliation.ledger.transactionCount} ledger entries recorded.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Reports involving this user" subtitle="Filed by them or against them." />
          <CardBody>
            {reports.length === 0 ? (
              <p className="text-sm text-body">No reports recorded.</p>
            ) : (
              <div className="space-y-2">
                {reports.map((report) => (
                  <div key={report._id} className="rounded-lg border border-line px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-heading">{report.reason.replace(/_/g, ' ').toLowerCase()}</p>
                      <Badge tone={report.status === 'OPEN' ? 'warning' : report.status === 'RESOLVED' ? 'success' : 'neutral'}>
                        {report.status}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {report.targetType} · {formatDate(report.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Recent transactions" />
        <CardBody className="p-0">
          {recentTransactions.length === 0 ? (
            <p className="px-5 py-4 text-sm text-body">No transactions yet.</p>
          ) : (
            <Table head={['Tx ID', 'Type', 'Amount', 'Balance after', 'Date']}>
              {recentTransactions.map((tx) => (
                <tr key={tx._id} className="hover:bg-surface-muted/70">
                  <Td>
                    <span className="font-mono text-xs text-body">{tx.txId}</span>
                  </Td>
                  <Td>{TX_TYPE_LABELS[tx.type] ?? tx.type}</Td>
                  <Td>
                    <span className={tx.amount > 0 ? 'text-success' : 'text-heading'}>
                      {tx.amount > 0 ? '+' : ''}
                      {formatNumber(tx.amount)}
                    </span>
                  </Td>
                  <Td>{formatNumber(tx.balanceAfter)}</Td>
                  <Td className="text-body">{formatDate(tx.createdAt)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export default AdminUserDetailPage;
