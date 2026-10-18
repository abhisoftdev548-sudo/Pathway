import { Link } from 'react-router-dom';
import endpoints, { type AdminUserDto } from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { Avatar, Badge, Td } from '@/components/ui/Data';
import { AdminTablePage } from '@/features/admin/AdminShared';
import { formatDate, formatNumber } from '@/utils/format';

/** All users directory — search, filter, and inspect (read-only view). */
export function AdminUsersPage() {
  useDocumentTitle('All users');

  return (
    <AdminTablePage<AdminUserDto>
      title="All users"
      description="Every registered account with role, status, and wallet state."
      queryKey={['admin', 'users']}
      fetcher={(params) => endpoints.admin.users(params)}
      searchPlaceholder="Search by name or email…"
      statusOptions={[
        { value: 'ACTIVE', label: 'Active' },
        { value: 'SUSPENDED', label: 'Suspended' },
      ]}
      head={['User', 'Role', 'Status', 'QCoins', 'Joined', '']}
      renderRow={(user) => (
        <tr key={user._id} className="hover:bg-zinc-50/70">
          <Td>
            <div className="flex items-center gap-3">
              <Avatar name={user.name} src={user.avatar?.url} size="sm" />
              <div>
                <p className="font-medium text-zinc-900">{user.name}</p>
                <p className="text-xs text-zinc-400">{user.email}</p>
              </div>
            </div>
          </Td>
          <Td>
            <Badge tone={user.role === 'ADMIN' ? 'brand' : 'neutral'}>{user.role}</Badge>
          </Td>
          <Td>
            <Badge tone={user.status === 'ACTIVE' ? 'success' : 'danger'}>{user.status}</Badge>
          </Td>
          <Td>{formatNumber(user.wallet?.balance ?? 0)}</Td>
          <Td className="text-zinc-500">{formatDate(user.createdAt)}</Td>
          <Td>
            <Link to={`/admin/users/${user._id}`} className="text-sm font-medium text-brand-600 hover:text-brand-700">
              View
            </Link>
          </Td>
        </tr>
      )}
      emptyTitle="No users found"
      emptyDescription="Accounts matching your filters will appear here."
    />
  );
}

export default AdminUsersPage;
