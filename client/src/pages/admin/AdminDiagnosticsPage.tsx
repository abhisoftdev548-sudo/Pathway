import { useQuery } from '@tanstack/react-query';
import { Database, HardDrive, RefreshCw, Server } from 'lucide-react';
import endpoints from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { Badge, StatCard, Table, Td } from '@/components/ui/Data';
import { Card, CardHeader, ErrorState, PageHeader, SkeletonList } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { formatNumber } from '@/utils/format';
import { apiErrorMessage } from '@/services/api';

/** System diagnostics: real runtime and database state (no fabricated health). */
export function AdminDiagnosticsPage() {
  useDocumentTitle('System diagnostics');

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'diagnostics'],
    queryFn: () => endpoints.admin.diagnostics(),
    refetchInterval: 30000,
  });

  const readyStateLabel = (state?: number) => {
    switch (state) {
      case 0:
        return 'Disconnected';
      case 1:
        return 'Connected';
      case 2:
        return 'Connecting';
      case 3:
        return 'Disconnecting';
      default:
        return 'Unknown';
    }
  };

  return (
    <div>
      <PageHeader
        title="System diagnostics"
        description="Live runtime and database health as reported by the API server."
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} loading={isFetching} icon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </Button>
        }
      />

      {isLoading ? (
        <SkeletonList count={2} />
      ) : isError ? (
        <ErrorState
          title="Diagnostics unavailable"
          description={apiErrorMessage(error)}
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Database"
              value={readyStateLabel(data.database.readyState)}
              hint={data.database.name}
              icon={<Database className="h-5 w-5" />}
              tone={data.database.readyState === 1 ? 'success' : 'warning'}
            />
            <StatCard label="Node.js" value={data.node.version} icon={<Server className="h-5 w-5" />} />
            <StatCard label="Uptime" value={`${Math.floor(data.node.uptimeSec / 60)} min`} icon={<HardDrive className="h-5 w-5" />} />
            <StatCard label="Memory" value={`${formatNumber(data.node.memoryMb)} MB`} />
          </div>

          <Card className="mt-6">
            <CardHeader
              title="Collections"
              subtitle="Document counts per collection (live from MongoDB)."
              actions={
                <Badge tone={data.database.readyState === 1 ? 'success' : 'warning'}>
                  {readyStateLabel(data.database.readyState)}
                </Badge>
              }
            />
            <Table head={['Collection', 'Documents']}>
              {Object.entries(data.collections)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([name, count]) => (
                  <tr key={name} className="hover:bg-surface-muted/70">
                    <Td className="font-mono text-xs text-body">{name}</Td>
                    <Td>{count === null ? <span className="text-muted">unavailable</span> : formatNumber(count)}</Td>
                  </tr>
                ))}
            </Table>
          </Card>
        </>
      ) : null}
    </div>
  );
}

export default AdminDiagnosticsPage;
