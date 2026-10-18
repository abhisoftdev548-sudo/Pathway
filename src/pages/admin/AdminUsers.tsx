import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { api, buildQuery, type Page } from '@/lib/api';
import { qk } from '@/lib/queries';
import { PageHeading, Badge, StatusBadge, Tabs } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { TextInput, Select } from '@/components/ui/Field';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { ErrorState } from '@/components/ui/States';
import { formatDate, formatNumber } from '@/lib/format';

interface UserRow {
  id: string;
  email: string;
  username: string;
  display_name: string;
  role: string;
  account_status: string;
  email_verified_at: string | null;
  created_at: string;
  last_active_at: string | null;
  quiz_count: number;
  quiz_published_count: number;
  poll_count: number;
  attempt_count: number;
  report_count: number;
}

export function AdminUsers() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState(searchParams.get('status') ?? 'all');
  const [sort, setSort] = useState(searchParams.get('sort') ?? 'newest');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const focusedSearch = searchParams.get('view') === 'search';

  const heading =
    status === 'suspended'
      ? { title: 'Suspended users', description: 'Accounts blocked from signing in, with the reason recorded at suspension time.' }
      : status === 'pending_verification'
        ? {
            title: 'Account verification',
            description:
              'Accounts with no verified email address. Open an account to mark its address verified after checking it; the action is recorded in the audit log.',
          }
        : sort === 'activity'
          ? { title: 'User profiles and activity', description: 'Accounts ordered by most recent activity. Open a row for the full profile, content, wallet and moderation record.' }
          : { title: 'All users', description: 'Server-side search and pagination. Open a row for the full profile, activity and moderation record.' };

  const path = `/admin/users${buildQuery({ page, pageSize: 25, q: search, role, status, sort, from, to })}`;
  const query = useQuery<Page<UserRow>>({
    queryKey: qk.adminUsers({ page, search, role, status, sort, from, to }),
    queryFn: () => api.get(path),
    placeholderData: (prev) => prev,
  });

  const columns: Column<UserRow>[] = [
    {
      key: 'user',
      header: 'User',
      render: (row) => (
        <div className="min-w-0">
          <span className="block truncate font-medium text-ink">{row.display_name}</span>
          <span className="text-2xs text-ink-faint">
            @{row.username} · {row.email}
          </span>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => <Badge tone={row.role === 'admin' ? 'brand' : row.role === 'creator' ? 'info' : 'neutral'}>{row.role}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.account_status} />,
    },
    {
      key: 'content',
      header: 'Content',
      align: 'right',
      render: (row) => (
        <span className="tabular-nums text-ink-muted">
          {formatNumber(row.quiz_published_count)}/{formatNumber(row.quiz_count)} quizzes · {formatNumber(row.poll_count)} polls
        </span>
      ),
    },
    {
      key: 'attempts',
      header: 'Attempts',
      align: 'right',
      render: (row) => <span className="tabular-nums text-ink-muted">{formatNumber(row.attempt_count)}</span>,
    },
    {
      key: 'reports',
      header: 'Reports',
      align: 'right',
      render: (row) =>
        row.report_count > 0 ? (
          <Badge tone="warning">{formatNumber(row.report_count)}</Badge>
        ) : (
          <span className="text-ink-faint">0</span>
        ),
    },
    {
      key: 'registered',
      header: 'Registered',
      align: 'right',
      render: (row) => <span className="whitespace-nowrap text-ink-muted">{formatDate(row.created_at)}</span>,
    },
  ];

  return (
    <>
      <PageHeading title={heading.title} description={heading.description} />

      <Tabs
        className="mb-4"
        tabs={[
          { id: 'all', label: 'All users' },
          { id: 'active', label: 'Active' },
          { id: 'pending_verification', label: 'Unverified' },
          { id: 'suspended', label: 'Suspended' },
          { id: 'admin', label: 'Administrators' },
        ]}
        active={status === 'admin' ? 'admin' : status}
        onChange={(next) => {
          setStatus(next === 'admin' ? 'all' : next);
          setRole(next === 'admin' ? 'admin' : 'all');
          setPage(1);
        }}
      />

      <div className="surface mb-4 flex flex-wrap items-end gap-2 p-3">
        <div className="min-w-[200px] flex-1">
          <TextInput
            autoFocus={focusedSearch}
            aria-label="Search users"
            placeholder="Search by username, display name or email"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          wrapperClassName="w-40"
          aria-label="Role"
          value={role}
          onChange={(event) => {
            setRole(event.target.value);
            setPage(1);
          }}
          options={[
            { value: 'all', label: 'All roles' },
            { value: 'user', label: 'User' },
            { value: 'creator', label: 'Creator' },
            { value: 'admin', label: 'Admin' },
          ]}
        />
        <Select
          wrapperClassName="w-44"
          aria-label="Account status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          options={[
            { value: 'all', label: 'Any status' },
            { value: 'active', label: 'Active' },
            { value: 'suspended', label: 'Suspended' },
            { value: 'pending_verification', label: 'Unverified' },
          ]}
        />
        <Select
          wrapperClassName="w-44"
          aria-label="Sort order"
          value={sort}
          onChange={(event) => {
            setSort(event.target.value);
            setPage(1);
          }}
          options={[
            { value: 'newest', label: 'Newest first' },
            { value: 'oldest', label: 'Oldest first' },
            { value: 'activity', label: 'Most recently active' },
            { value: 'username', label: 'Username (A–Z)' },
          ]}
        />
        <TextInput wrapperClassName="w-40" aria-label="Registered from" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
        <TextInput wrapperClassName="w-40" aria-label="Registered to" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
        <Button
          variant="ghost"
          size="md"
          onClick={() => {
            setSearch('');
            setRole('all');
            setStatus('all');
            setSort('newest');
            setFrom('');
            setTo('');
            setPage(1);
          }}
        >
          Clear
        </Button>
      </div>

      {query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={query.data?.items}
            loading={query.isLoading || query.isFetching}
            rowKey={(row) => row.id}
            onRowClick={(row) => navigate(`/admin/users/${row.id}`)}
            emptyIcon={<Users className="h-4 w-4" />}
            emptyTitle={
              status === 'suspended'
                ? 'No suspended accounts'
                : status === 'pending_verification'
                  ? 'Every account is verified'
                  : 'No users match these filters'
            }
            emptyDescription={
              status === 'suspended'
                ? 'No account is currently suspended.'
                : status === 'pending_verification'
                  ? 'Every registered account has a verified email address.'
                  : 'Clear the filters to see every registered account.'
            }
          />
          {query.data && query.data.total > 0 && (
            <Pagination page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPage={setPage} />
          )}
        </>
      )}
    </>
  );
}
