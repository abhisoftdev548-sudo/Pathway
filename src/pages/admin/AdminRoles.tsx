import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { api, ApiError, buildQuery, type Page } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useToast } from '@/components/ui/Toast';
import { PageHeading, Panel, Badge } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { Select, TextArea } from '@/components/ui/Field';
import { DataTable, type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { useAuth } from '@/lib/auth';
import { formatDate, formatNumber } from '@/lib/format';

interface RoleRow {
  id: string;
  email: string;
  username: string;
  display_name: string;
  role: string;
  account_status: string;
  created_at: string;
  last_active_at: string | null;
  quiz_count: number;
  poll_count: number;
  attempt_count: number;
  report_count: number;
}

const CAPABILITIES = [
  { capability: 'Take quizzes and vote in polls', user: true, creator: true, admin: true },
  { capability: 'Create and submit quizzes and polls', user: false, creator: true, admin: true },
  { capability: 'Access creator analytics and submission tracking', user: false, creator: true, admin: true },
  { capability: 'Review and moderate submissions', user: false, creator: false, admin: true },
  { capability: 'Manage users, roles and suspensions', user: false, creator: false, admin: true },
  { capability: 'Manage QCoin ledger, refunds and adjustments', user: false, creator: false, admin: true },
  { capability: 'Change platform configuration', user: false, creator: false, admin: true },
  { capability: 'Export reports and read audit logs', user: false, creator: false, admin: true },
];

export function AdminRoles() {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [role, setRole] = useState('all');
  const [pending, setPending] = useState<{ user: RoleRow; nextRole: string } | null>(null);
  const [reason, setReason] = useState('');

  const query = useQuery<Page<RoleRow>>({
    queryKey: qk.adminUsers({ role, pageSize: 50 }),
    queryFn: () => api.get(`/admin/users${buildQuery({ role, pageSize: 50 })}`),
    placeholderData: (prev) => prev,
  });

  const changeRole = useMutation({
    mutationFn: ({ user, nextRole }: { user: RoleRow; nextRole: string }) =>
      api.post(`/admin/users/${user.id}/role`, { role: nextRole, reason }),
    onSuccess: () => {
      setPending(null);
      setReason('');
      queryClient.invalidateQueries();
      toast.success('Role updated and recorded in the audit log.');
    },
    onError: (err) => {
      setPending(null);
      toast.error(err instanceof ApiError ? err.message : 'Could not change the role.');
    },
  });

  const columns: Column<RoleRow>[] = [
    {
      key: 'user',
      header: 'User',
      render: (row) => (
        <div className="min-w-0">
          <span className="block truncate font-medium text-ink">{row.display_name}</span>
          <span className="text-2xs text-ink-faint">@{row.username}</span>
        </div>
      ),
    },
    { key: 'role', header: 'Current role', render: (row) => <Badge tone={row.role === 'admin' ? 'brand' : row.role === 'creator' ? 'info' : 'neutral'}>{row.role}</Badge> },
    {
      key: 'change',
      header: 'Change to',
      align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-1">
          {(['user', 'creator', 'admin'] as const)
            .filter((next) => next !== row.role)
            .map((next) => (
              <Button
                key={next}
                size="sm"
                variant={next === 'admin' ? 'secondary' : 'ghost'}
                disabled={row.id === currentUser?.id}
                onClick={() => setPending({ user: row, nextRole: next })}
              >
                {next}
              </Button>
            ))}
        </div>
      ),
    },
    {
      key: 'activity',
      header: 'Content / attempts',
      align: 'right',
      render: (row) => (
        <span className="tabular-nums text-ink-muted">
          {formatNumber(row.quiz_count + row.poll_count)} / {formatNumber(row.attempt_count)}
        </span>
      ),
    },
    { key: 'joined', header: 'Joined', align: 'right', render: (row) => <span className="whitespace-nowrap text-ink-muted">{formatDate(row.created_at)}</span> },
  ];

  const admins = (query.data?.items ?? []).filter((row) => row.role === 'admin');

  return (
    <>
      <PageHeading
        title="Role and permission management"
        description="Roles are enforced on the server. Changing a role is a privileged action requiring a reason."
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Current administrators" className="lg:col-span-1">
          {admins.length === 0 ? (
            <p className="text-[13px] text-ink-muted">No administrators found.</p>
          ) : (
            <ul className="space-y-2">
              {admins.map((admin) => (
                <li key={admin.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-[13px] text-ink">{admin.display_name}</span>
                  <span className="text-2xs text-ink-faint">@{admin.username}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink-muted">
            At least one active administrator must remain. Demoting the last administrator is blocked.
          </p>
        </Panel>

        <Panel title="Capability matrix" className="lg:col-span-2">
          <div className="overflow-x-auto scroll-area">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="table-th">Capability</th>
                  <th className="table-th text-center">User</th>
                  <th className="table-th text-center">Creator</th>
                  <th className="table-th text-center">Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {CAPABILITIES.map((row) => (
                  <tr key={row.capability}>
                    <td className="table-td">{row.capability}</td>
                    {[row.user, row.creator, row.admin].map((allowed, index) => (
                      <td key={index} className="table-td text-center">
                        {allowed ? (
                          <ShieldCheck className="mx-auto h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <ShieldAlert className="mx-auto h-3.5 w-3.5 text-ink-faint" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div className="mb-3">
        <Select
          wrapperClassName="w-48"
          aria-label="Filter by role"
          value={role}
          onChange={(event) => setRole(event.target.value)}
          options={[
            { value: 'all', label: 'All roles' },
            { value: 'user', label: 'User' },
            { value: 'creator', label: 'Creator' },
            { value: 'admin', label: 'Admin' },
          ]}
        />
      </div>

      {query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={query.data?.items}
          loading={query.isLoading || query.isFetching}
          rowKey={(row) => row.id}
          emptyIcon={<Users className="h-4 w-4" />}
          emptyTitle="No accounts match this role filter"
          emptyDescription="Select a different role to see more accounts."
        />
      )}

      <ConfirmDialog
        open={pending !== null}
        title={`Change ${pending?.user.display_name} to ${pending?.nextRole}?`}
        description={
          pending?.nextRole === 'admin'
            ? 'This grants full administrative access: moderation, user management, QCoin management and platform configuration.'
            : 'The change takes effect immediately and is recorded in the audit log.'
        }
        confirmLabel={`Make ${pending?.nextRole}`}
        tone={pending?.nextRole === 'admin' ? 'danger' : 'primary'}
        loading={changeRole.isPending}
        onConfirm={() => pending && changeRole.mutate(pending)}
        onCancel={() => {
          setPending(null);
          setReason('');
        }}
      >
        <TextArea
          label="Reason"
          required
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          hint="At least 5 characters. Stored with the audit entry."
        />
      </ConfirmDialog>
    </>
  );
}
