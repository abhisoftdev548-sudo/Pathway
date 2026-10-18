import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useToast } from '@/components/ui/Toast';
import { PageHeading, Panel, Badge } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { ErrorState, EmptyState } from '@/components/ui/States';
import { formatNumber } from '@/lib/format';

interface Counts {
  counts: Record<string, number>;
}

const EXPORTS: { type: string; label: string; description: string }[] = [
  { type: 'users', label: 'Users', description: 'Account records: id, username, display name, email, role, status and dates.' },
  { type: 'quizzes', label: 'Quizzes', description: 'Every quiz with its status, creator, category, difficulty, economics and attempt count.' },
  { type: 'polls', label: 'Polls', description: 'Every poll with its question, status, creator, closing time and vote count.' },
  { type: 'transactions', label: 'QCoin transactions', description: 'The full ledger: entries, amounts, balances after, references and descriptions.' },
  { type: 'audit', label: 'Audit log', description: 'Administrator actions with actor, target, metadata and IP.' },
  { type: 'moderation', label: 'Moderation decisions', description: 'Decisions recorded on quizzes and polls, including reasons and quality ratings.' },
  { type: 'ratings', label: 'Ratings', description: 'Ratings and reviews with score, status and content reference.' },
];

export function AdminExport() {
  const toast = useToast();
  const query = useQuery<Counts>({ queryKey: qk.adminExportCounts, queryFn: () => api.get('/admin/audit/reports/counts') });

  const download = async (type: string) => {
    try {
      const token = document.cookie.split('; ').find((row) => row.startsWith('qs_session='))?.split('=')[1];
      const res = await fetch(`/api/admin/audit/export/${type}`, {
        credentials: 'same-origin',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ message: 'The export could not be generated.' }));
        toast.error(payload.message ?? 'The export could not be generated.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `quizsphere-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(`${type} export downloaded.`);
    } catch {
      toast.error('The export could not be generated.');
    }
  };

  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const counts = query.data?.counts ?? {};
  const totalRows = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return (
    <>
      <PageHeading
        title="Exportable reports"
        description="Download real data as CSV. Row counts below are read from the database at the moment you open this page."
      />

      {query.isLoading ? (
        <div className="surface p-6 text-[13px] text-ink-muted">Counting rows…</div>
      ) : totalRows === 0 ? (
        <EmptyState
          icon={<Download className="h-4 w-4" />}
          title="There is nothing to export yet"
          description="Every export is generated from live database rows. Once users register, create content and transact, the exports here will contain data."
        />
      ) : (
        <Panel
          title="Available exports"
          description="Each export is capped at the server's export limit and generated on demand."
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-line">
            {EXPORTS.map((item) => {
              const rows = counts[item.type] ?? 0;
              return (
                <li key={item.type} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink">{item.label}</p>
                    <p className="mt-0.5 max-w-xl text-xs text-ink-muted">{item.description}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge tone={rows > 0 ? 'neutral' : 'neutral'}>{formatNumber(rows)} rows</Badge>
                    <Button size="sm" variant="secondary" icon={<Download className="h-3.5 w-3.5" />} onClick={() => download(item.type)}>
                      Download CSV
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      <p className="mt-3 text-xs text-ink-muted">
        Exports are generated server-side from live queries. Generating a report is itself recorded in the audit log.
      </p>
    </>
  );
}
