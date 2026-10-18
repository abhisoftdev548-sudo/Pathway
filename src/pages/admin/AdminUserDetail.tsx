import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, KeyRound, ShieldCheck, ShieldOff, UserCheck, Users } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth';
import { PageHeading, Panel, Badge, StatusBadge, DetailList, Tabs } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { TextArea, Select } from '@/components/ui/Field';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { DataTable, type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState, FullPageLoader, InlineError } from '@/components/ui/States';
import { JsonViewer, TimestampCell } from '@/components/patterns/LogTable';
import { formatCoins, formatDate, formatDateTime, formatNumber, titleCase } from '@/lib/format';

interface UserDetail {
  user: {
    id: string;
    email: string;
    username: string;
    display_name: string;
    role: string;
    account_status: string;
    suspended_at: string | null;
    suspended_reason: string | null;
    bio: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    last_active_at: string | null;
    emailVerified: boolean;
    quiz_count: number;
    quiz_published_count: number;
    poll_count: number;
    attempt_count: number;
    report_count: number;
  };
  wallet: { balance: number; lifetimeEarned: number; lifetimeSpent: number; updatedAt: string | null };
  recentTransactions: { id: string; amount: number; balanceAfter: number; entryType: string; description: string; createdAt: string }[];
  performance: { attempts: number; passes: number; average_score: number | null; best_score: number | null; fees_paid: number; rewards_earned: number };
  content: {
    quizzes: { id: string; title: string; status: string; submitted_at: string | null; published_at: string | null; total_attempts: number; entry_fee: number; reward_coins: number }[];
    polls: { id: string; title: string; status: string; published_at: string | null; closes_at: string | null; votes: number }[];
  };
  moderationHistory: { id: string; content_type: string; content_id: string; decision: string; reason: string | null; created_at: string; quality_rating: number | null }[];
  reportsAgainst: { id: string; target_type: string; target_id: string; reason: string; details: string; status: string; created_at: string; reporter: string }[];
  reportsBy: { id: string; target_type: string; target_id: string; reason: string; status: string; created_at: string }[];
  auditTrail: { id: string; action: string; target_type: string | null; target_id: string | null; metadata: unknown; created_at: string }[];
  sessions: { id: string; created_at: string; expires_at: string; last_used_at: string | null; ip: string | null; user_agent: string | null }[];
}

type Action = 'suspend' | 'restore' | 'role' | 'verify' | 'revoke';

export function AdminUserDetail() {
  const { id = '' } = useParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState('overview');
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [confirm, setConfirm] = useState(false);

  const query = useQuery<UserDetail>({
    queryKey: qk.adminUser(id),
    queryFn: () => api.get(`/admin/users/${id}`),
  });

  const run = useMutation({
    mutationFn: async () => {
      if (action === 'suspend') return api.post(`/admin/users/${id}/suspend`, { reason });
      if (action === 'restore') return api.post(`/admin/users/${id}/restore`, { reason });
      if (action === 'role') return api.post(`/admin/users/${id}/role`, { role: newRole, reason });
      if (action === 'verify') return api.post(`/admin/users/${id}/verify`, {});
      return api.post(`/admin/users/${id}/revoke-sessions`, {});
    },
    onSuccess: () => {
      setAction(null);
      setConfirm(false);
      setReason('');
      queryClient.invalidateQueries({ queryKey: qk.adminUser(id) });
      queryClient.invalidateQueries({ queryKey: qk.adminUsers({}) });
      toast.success('Action completed and recorded in the audit log.');
    },
    onError: (err) => {
      setConfirm(false);
      toast.error(err instanceof ApiError ? err.message : 'Could not complete that action.');
    },
  });

  if (query.isLoading) return <FullPageLoader />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const data = query.data!;
  const isSelf = data.user.id === currentUser?.id;

  const quizColumns: Column<UserDetail['content']['quizzes'][number]>[] = [
    {
      key: 'title',
      header: 'Quiz',
      render: (row) => (
        <Link to={`/admin/quizzes/${row.id}`} className="block max-w-[22rem] truncate font-medium text-ink hover:text-brand-700">
          {row.title}
        </Link>
      ),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'attempts', header: 'Attempts', align: 'right', render: (row) => <span className="tabular-nums">{formatNumber(row.total_attempts)}</span> },
    {
      key: 'economy',
      header: 'Entry / reward',
      align: 'right',
      render: (row) => (
        <span className="tabular-nums text-ink-muted">
          {row.entry_fee} / {row.reward_coins}
        </span>
      ),
    },
    { key: 'date', header: 'Submitted', align: 'right', render: (row) => <span className="whitespace-nowrap text-ink-muted">{formatDate(row.submitted_at ?? row.published_at)}</span> },
  ];

  const ledgerColumns: Column<UserDetail['recentTransactions'][number]>[] = [
    { key: 'date', header: 'Date', render: (row) => <TimestampCell value={row.createdAt} /> },
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
        <span className={`tabular-nums ${row.amount >= 0 ? 'text-emerald-700' : 'text-ink'}`}>{formatCoins(row.amount, true)}</span>
      ),
    },
    { key: 'balance', header: 'Balance', align: 'right', render: (row) => <span className="tabular-nums text-ink-soft">{formatCoins(row.balanceAfter)}</span> },
  ];

  return (
    <>
      <Link to="/admin/users" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to users
      </Link>

      <PageHeading
        title={data.user.display_name}
        description={`@${data.user.username} · ${data.user.email} · joined ${formatDate(data.user.created_at)}`}
        actions={
          <>
            {data.user.account_status === 'suspended' ? (
              <Button size="sm" variant="secondary" icon={<UserCheck className="h-3.5 w-3.5" />} disabled={isSelf} onClick={() => { setAction('restore'); setConfirm(true); }}>
                Restore access
              </Button>
            ) : (
              <Button size="sm" variant="danger" icon={<ShieldOff className="h-3.5 w-3.5" />} disabled={isSelf} onClick={() => { setAction('suspend'); setConfirm(true); }}>
                Suspend account
              </Button>
            )}
            <Button size="sm" variant="secondary" disabled={isSelf} onClick={() => { setAction('role'); setNewRole(data.user.role); setConfirm(true); }}>
              Change role
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setAction('revoke'); setConfirm(true); }}>
              Revoke sessions
            </Button>
          </>
        }
      />

      {isSelf && (
        <div className="mb-4">
          <InlineError message="This is your own account. Self-service suspension and role changes are blocked." />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel bodyClassName="p-0">
            <Tabs
              className="px-3"
              tabs={[
                { id: 'overview', label: 'Overview' },
                { id: 'content', label: 'Content', count: data.content.quizzes.length + data.content.polls.length },
                { id: 'wallet', label: 'QCoin', count: data.recentTransactions.length },
                { id: 'reports', label: 'Reports', count: data.reportsAgainst.length + data.reportsBy.length },
                { id: 'audit', label: 'Audit trail', count: data.auditTrail.length },
              ]}
              active={tab}
              onChange={setTab}
            />

            <div className="p-4">
              {tab === 'overview' && (
                <>
                  <DetailList
                    columns={2}
                    items={[
                      { label: 'Role', value: <Badge tone={data.user.role === 'admin' ? 'brand' : data.user.role === 'creator' ? 'info' : 'neutral'}>{data.user.role}</Badge> },
                      { label: 'Status', value: <StatusBadge status={data.user.account_status} /> },
                      { label: 'Email verified', value: data.user.emailVerified ? `Yes (${formatDate(data.user.email_verified_at ?? null)})` : 'No' },
                      { label: 'Last active', value: data.user.last_active_at ? formatDateTime(data.user.last_active_at) : 'Never recorded' },
                      { label: 'Quizzes created', value: `${formatNumber(data.user.quiz_count)} (${formatNumber(data.user.quiz_published_count)} approved)` },
                      { label: 'Polls created', value: formatNumber(data.user.poll_count) },
                      { label: 'Attempts completed', value: formatNumber(data.user.attempt_count) },
                      { label: 'Reports against', value: formatNumber(data.user.report_count) },
                    ]}
                  />

                  {data.user.suspended_reason && (
                    <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                      <p className="text-2xs font-semibold uppercase tracking-wide text-red-700">Suspended</p>
                      <p className="mt-1 text-[13px] text-red-900">{data.user.suspended_reason}</p>
                      {data.user.suspended_at && (
                        <p className="mt-1 text-2xs text-red-700">{formatDateTime(data.user.suspended_at)}</p>
                      )}
                    </div>
                  )}

                  {data.user.bio && (
                    <div className="mt-4">
                      <p className="text-2xs uppercase tracking-wide text-ink-faint">Bio</p>
                      <p className="mt-1 whitespace-pre-line text-[13px] text-ink-soft">{data.user.bio}</p>
                    </div>
                  )}

                  <div className="mt-5">
                    <h3 className="mb-2 text-[13px] font-semibold text-ink">Quiz performance</h3>
                    <DetailList
                      columns={3}
                      items={[
                        { label: 'Attempts', value: formatNumber(data.performance.attempts) },
                        { label: 'Passed', value: formatNumber(data.performance.passes) },
                        {
                          label: 'Average score',
                          value: data.performance.average_score !== null ? `${data.performance.average_score}%` : '—',
                        },
                        {
                          label: 'Best score',
                          value: data.performance.best_score !== null ? `${data.performance.best_score}%` : '—',
                        },
                        { label: 'Entry fees paid', value: `${formatCoins(data.performance.fees_paid)} QCoin` },
                        { label: 'Rewards earned', value: `${formatCoins(data.performance.rewards_earned)} QCoin` },
                      ]}
                    />
                  </div>

                  <div className="mt-5">
                    <h3 className="mb-2 text-[13px] font-semibold text-ink">Active sessions</h3>
                    {data.sessions.length === 0 ? (
                      <p className="text-[13px] text-ink-muted">No active sessions.</p>
                    ) : (
                      <ul className="divide-y divide-line rounded-md border border-line">
                        {data.sessions.map((session) => (
                          <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                            <span className="min-w-0 truncate text-xs text-ink-soft">
                              {session.user_agent ? String(session.user_agent).slice(0, 50) : 'Unknown device'}
                            </span>
                            <span className="text-2xs text-ink-faint">
                              {session.ip ?? '—'} · last used {formatDateTime(session.last_used_at ?? session.created_at)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}

              {tab === 'content' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="mb-2 text-[13px] font-semibold text-ink">Quizzes</h3>
                    {data.content.quizzes.length === 0 ? (
                      <EmptyState compact icon={<Users className="h-4 w-4" />} title="No quizzes created" />
                    ) : (
                      <DataTable columns={quizColumns} rows={data.content.quizzes} rowKey={(row) => row.id} />
                    )}
                  </div>
                  <div>
                    <h3 className="mb-2 text-[13px] font-semibold text-ink">Polls</h3>
                    {data.content.polls.length === 0 ? (
                      <EmptyState compact title="No polls created" />
                    ) : (
                      <ul className="divide-y divide-line rounded-md border border-line">
                        {data.content.polls.map((poll) => (
                          <li key={poll.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                            <Link to={`/admin/polls/${poll.id}`} className="min-w-0 truncate text-[13px] font-medium text-ink hover:text-brand-700">
                              {poll.title}
                            </Link>
                            <div className="flex items-center gap-2">
                              <span className="text-2xs text-ink-faint">{formatNumber(poll.votes)} votes</span>
                              <StatusBadge status={poll.status} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h3 className="mb-2 text-[13px] font-semibold text-ink">Moderation history</h3>
                    {data.moderationHistory.length === 0 ? (
                      <EmptyState compact title="No moderation decisions on this user's content" />
                    ) : (
                      <ul className="divide-y divide-line rounded-md border border-line">
                        {data.moderationHistory.map((entry) => (
                          <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                            <div className="min-w-0">
                              <span className="text-xs text-ink-faint">
                                {entry.content_type} · {formatDate(entry.created_at)}
                              </span>
                              {entry.reason && <p className="text-[13px] text-ink-soft">{entry.reason}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              {entry.quality_rating !== null && <Badge tone="brand">{entry.quality_rating}/5</Badge>}
                              <StatusBadge status={entry.decision} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {tab === 'wallet' && (
                <div className="space-y-4">
                  <DetailList
                    columns={3}
                    items={[
                      { label: 'Balance', value: `${formatCoins(data.wallet.balance)} QCoin` },
                      { label: 'Lifetime earned', value: `${formatCoins(data.wallet.lifetimeEarned)} QCoin` },
                      { label: 'Lifetime spent', value: `${formatCoins(data.wallet.lifetimeSpent)} QCoin` },
                    ]}
                  />
                  {data.recentTransactions.length === 0 ? (
                    <EmptyState compact title="No QCoin transactions recorded" description="This account has no ledger entries yet." />
                  ) : (
                    <DataTable columns={ledgerColumns} rows={data.recentTransactions} rowKey={(row) => row.id} />
                  )}
                  <Button to={`/admin/qcoin/transactions?userId=${data.user.id}`} size="sm" variant="secondary">
                    Open full ledger for this user
                  </Button>
                </div>
              )}

              {tab === 'reports' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="mb-2 text-[13px] font-semibold text-ink">Reports against this user</h3>
                    {data.reportsAgainst.length === 0 ? (
                      <EmptyState compact title="No reports against this account" />
                    ) : (
                      <ul className="space-y-2">
                        {data.reportsAgainst.map((report) => (
                          <li key={report.id} className="rounded-md border border-line p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[13px] font-medium text-ink">{report.reason}</span>
                              <StatusBadge status={report.status} />
                            </div>
                            {report.details && <p className="mt-1 text-[13px] text-ink-soft">{report.details}</p>}
                            <p className="mt-1 text-2xs text-ink-faint">by @{report.reporter} · {formatDate(report.created_at)}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h3 className="mb-2 text-[13px] font-semibold text-ink">Reports submitted by this user</h3>
                    {data.reportsBy.length === 0 ? (
                      <EmptyState compact title="No reports submitted" />
                    ) : (
                      <ul className="divide-y divide-line rounded-md border border-line">
                        {data.reportsBy.map((report) => (
                          <li key={report.id} className="flex items-center justify-between gap-2 px-3 py-2">
                            <span className="min-w-0 truncate text-[13px] text-ink-soft">
                              {report.target_type}: {report.reason}
                            </span>
                            <StatusBadge status={report.status} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {tab === 'audit' &&
                (data.auditTrail.length === 0 ? (
                  <EmptyState compact icon={<ShieldCheck className="h-4 w-4" />} title="No audit entries for this user" />
                ) : (
                  <ul className="divide-y divide-line">
                    {data.auditTrail.map((entry) => (
                      <li key={entry.id} className="py-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[13px] font-medium text-ink">{titleCase(entry.action.replace(/\./g, ' '))}</span>
                          <TimestampCell value={entry.created_at} />
                        </div>
                        <div className="mt-1">
                          <JsonViewer value={entry.metadata} />
                        </div>
                      </li>
                    ))}
                  </ul>
                ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Account actions">
            <div className="space-y-2">
              <Button
                size="sm"
                variant="secondary"
                block
                icon={<ShieldCheck className="h-3.5 w-3.5" />}
                disabled={data.user.emailVerified}
                onClick={() => {
                  setAction('verify');
                  setConfirm(true);
                }}
              >
                {data.user.emailVerified ? 'Email verified' : 'Mark email verified'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                block
                icon={<KeyRound className="h-3.5 w-3.5" />}
                onClick={() => {
                  setAction('revoke');
                  setConfirm(true);
                }}
              >
                Sign out all sessions
              </Button>
              <Button to={`/admin/qcoin/adjustments?userId=${data.user.id}`} size="sm" variant="ghost" block>
                Adjust QCoin balance
              </Button>
            </div>
          </Panel>

          <Panel title="Summary">
            <DetailList
              columns={1}
              items={[
                { label: 'User ID', value: <span className="font-mono text-2xs">{data.user.id}</span> },
                { label: 'Balance', value: `${formatCoins(data.wallet.balance)} QCoin` },
                { label: 'Attempts', value: formatNumber(data.user.attempt_count) },
                { label: 'Approved quizzes', value: formatNumber(data.user.quiz_published_count) },
                { label: 'Reports against', value: formatNumber(data.user.report_count) },
              ]}
            />
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        title={
          action === 'suspend'
            ? 'Suspend this account?'
            : action === 'restore'
              ? 'Restore access?'
              : action === 'role'
                ? 'Change role?'
                : action === 'verify'
                  ? 'Mark email as verified?'
                  : 'Sign out every session?'
        }
        description={
          action === 'suspend'
            ? 'The user is signed out everywhere and cannot sign back in until restored.'
            : action === 'revoke'
              ? 'Every device signed in to this account will need to sign in again.'
              : 'This action is written to the audit log.'
        }
        confirmLabel={
          action === 'suspend' ? 'Suspend account' : action === 'restore' ? 'Restore' : action === 'role' ? 'Change role' : 'Confirm'
        }
        tone={action === 'suspend' ? 'danger' : 'primary'}
        loading={run.isPending}
        onConfirm={() => run.mutate()}
        onCancel={() => {
          setConfirm(false);
          setAction(null);
          setReason('');
        }}
      >
        <div className="space-y-3">
          {action === 'role' && (
            <Select
              label="New role"
              value={newRole}
              onChange={(event) => setNewRole(event.target.value)}
              options={[
                { value: 'user', label: 'User' },
                { value: 'creator', label: 'Creator' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
          )}
          {action !== 'revoke' && action !== 'verify' && (
            <TextArea
              label="Reason"
              required
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              hint="Recorded in the audit log."
            />
          )}
        </div>
      </ConfirmDialog>
    </>
  );
}
