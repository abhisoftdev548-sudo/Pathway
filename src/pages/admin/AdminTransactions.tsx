import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import { api, buildQuery, type Page } from '@/lib/api';
import { qk } from '@/lib/queries';
import { PageHeading, Badge } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { TextInput, Select } from '@/components/ui/Field';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { ErrorState } from '@/components/ui/States';
import { formatCoins, formatDate, formatDateTime, titleCase } from '@/lib/format';

interface LedgerRow {
  id: string;
  created_at: string;
  entry_type: string;
  amount: number;
  balance_after: number;
  description: string;
  username: string;
  display_name: string;
  user_id: string;
  reference_type: string | null;
  reference_id: string | null;
}

const TYPE_OPTIONS = [
  { value: 'all', label: 'All entry types' },
  { value: 'signup_bonus', label: 'Sign-up bonus' },
  { value: 'quiz_reward', label: 'Quiz reward' },
  { value: 'entry_fee', label: 'Entry fee' },
  { value: 'manual_adjustment', label: 'Manual adjustment' },
  { value: 'refund', label: 'Refund' },
  { value: 'reversal', label: 'Reversal / repair' },
  { value: 'poll_reward', label: 'Poll reward' },
];

export function AdminTransactions() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [minAmount, setMinAmount] = useState('');

  const query = useQuery<Page<LedgerRow>>({
    queryKey: qk.adminTransactions({ page, type, search, userId, from, to, minAmount }),
    queryFn: () =>
      api.get(`/admin/qcoin/transactions${buildQuery({ page, pageSize: 50, type, search, userId, from, to, minAmount })}`),
    placeholderData: (prev) => prev,
  });

  const columns: Column<LedgerRow>[] = [
    { key: 'date', header: 'Date', render: (row) => <span className="whitespace-nowrap text-ink-muted">{formatDateTime(row.created_at)}</span> },
    {
      key: 'user',
      header: 'Account',
      render: (row) => (
        <Link to={`/admin/users/${row.user_id}`} className="block min-w-0 truncate font-medium text-ink hover:text-brand-700">
          {row.display_name}
          <span className="ml-1 text-2xs font-normal text-ink-faint">@{row.username}</span>
        </Link>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => (
        <div className="min-w-0">
          <span className="block max-w-[28rem] truncate text-ink-soft">{row.description}</span>
          <span className="text-2xs text-ink-faint">{titleCase(row.entry_type.replace(/_/g, ' '))}</span>
        </div>
      ),
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

  const totals = query.data?.items ?? [];
  const issued = totals.reduce((sum, row) => (row.amount > 0 ? sum + row.amount : sum), 0);
  const spent = totals.reduce((sum, row) => (row.amount < 0 ? sum - row.amount : sum), 0);

  return (
    <>
      <PageHeading
        title="QCoin transaction history"
        description="The full ledger. Entries are append-only: a balance change always has a row here and a reason attached."
        actions={<Button to="/admin/qcoin" size="sm" variant="ghost">Ledger overview</Button>}
      />

      <div className="surface mb-4 flex flex-wrap items-end gap-2 p-3">
        <div className="min-w-[200px] flex-1">
          <TextInput
            aria-label="Search transactions"
            placeholder="Search description or account"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          wrapperClassName="w-48"
          aria-label="Entry type"
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            setPage(1);
          }}
          options={TYPE_OPTIONS}
        />
        <TextInput
          wrapperClassName="w-40"
          aria-label="From date"
          type="date"
          value={from}
          onChange={(event) => {
            setFrom(event.target.value);
            setPage(1);
          }}
        />
        <TextInput
          wrapperClassName="w-40"
          aria-label="To date"
          type="date"
          value={to}
          onChange={(event) => {
            setTo(event.target.value);
            setPage(1);
          }}
        />
        <TextInput
          wrapperClassName="w-32"
          aria-label="Minimum amount"
          type="number"
          min={0}
          placeholder="Min amount"
          value={minAmount}
          onChange={(event) => {
            setMinAmount(event.target.value);
            setPage(1);
          }}
        />
        <Button
          variant="ghost"
          size="md"
          onClick={() => {
            setSearch('');
            setType('all');
            setFrom('');
            setTo('');
            setMinAmount('');
            setUserId('');
            setPage(1);
          }}
        >
          Clear
        </Button>
      </div>

      {userId && (
        <div className="mb-3 flex items-center gap-2 text-xs text-ink-muted">
          <Badge tone="brand">Filtered to one account</Badge>
          <button type="button" className="underline hover:text-ink" onClick={() => { setUserId(''); setPage(1); }}>
            show all accounts
          </button>
        </div>
      )}

      {query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
          {totals.length > 0 && (
            <p className="mb-3 text-xs text-ink-muted">
              This page: <span className="font-medium text-emerald-700">{formatCoins(issued)} issued</span> ·{' '}
              <span className="font-medium text-ink">{formatCoins(spent)} spent</span> · {totals.length} entries
              {from || to ? ` · ${from ? formatDate(from) : 'start'} to ${to ? formatDate(to) : 'now'}` : ''}
            </p>
          )}
          <DataTable
            columns={columns}
            rows={query.data?.items}
            loading={query.isLoading || query.isFetching}
            rowKey={(row) => row.id}
            emptyIcon={<Wallet className="h-4 w-4" />}
            emptyTitle="No ledger entries match these filters"
            emptyDescription="Ledger entries are created when users earn rewards, pay entry fees, receive refunds or are adjusted manually."
          />
          {query.data && query.data.total > 0 && (
            <Pagination page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPage={setPage} />
          )}
        </>
      )}
    </>
  );
}
