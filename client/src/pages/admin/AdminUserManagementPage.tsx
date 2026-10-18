import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import endpoints, { type AdminUserDto } from '@/services/endpoints';
import { useDocumentTitle } from '@/hooks';
import { useToast } from '@/context/ToastContext';
import { Avatar, Badge, Td } from '@/components/ui/Data';
import { AdminTablePage, ConfirmDialog } from '@/features/admin/AdminShared';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Form';
import { formatDate } from '@/utils/format';
import { apiErrorMessage } from '@/services/api';

/**
 * User management — authorized, audited account operations:
 * suspend/restore, role changes, and reasoned QCoin adjustments.
 */
export function AdminUserManagementPage() {
  useDocumentTitle('User management');
  const toast = useToast();
  const queryClient = useQueryClient();

  const [target, setTarget] = useState<AdminUserDto | null>(null);
  const [action, setAction] = useState<'SUSPEND' | 'RESTORE' | 'SET_ROLE' | 'ADJUST_COINS'>('SUSPEND');
  const [reason, setReason] = useState('');
  const [role, setRole] = useState<'USER' | 'ADMIN'>('USER');
  const [amount, setAmount] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      endpoints.admin.manageUser(target!._id, {
        action,
        reason: reason || undefined,
        role: action === 'SET_ROLE' ? role : undefined,
        amount: action === 'ADJUST_COINS' ? Number(amount) : undefined,
      }),
    onSuccess: () => {
      toast.success('User updated', 'The action was recorded in the audit log.');
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      setTarget(null);
      setReason('');
      setAmount('');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Action failed')),
  });

  return (
    <>
      <AdminTablePage<AdminUserDto>
        title="User management"
        description="Suspend, restore, adjust roles, or correct QCoins. Every action is audited with a mandatory reason."
        queryKey={['admin', 'user-management']}
        fetcher={(params) => endpoints.admin.users(params)}
        searchPlaceholder="Find a user to manage…"
        statusOptions={[
          { value: 'ACTIVE', label: 'Active' },
          { value: 'SUSPENDED', label: 'Suspended' },
        ]}
        head={['User', 'Status', 'Role', 'Joined', 'Actions']}
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
              <Badge tone={user.status === 'ACTIVE' ? 'success' : 'danger'}>{user.status}</Badge>
            </Td>
            <Td>
              <Badge tone={user.role === 'ADMIN' ? 'brand' : 'neutral'}>{user.role}</Badge>
            </Td>
            <Td className="text-zinc-500">{formatDate(user.createdAt)}</Td>
            <Td>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant={user.status === 'ACTIVE' ? 'outline' : 'secondary'}
                  onClick={() => {
                    setTarget(user);
                    setAction(user.status === 'ACTIVE' ? 'SUSPEND' : 'RESTORE');
                  }}
                >
                  {user.status === 'ACTIVE' ? 'Suspend' : 'Restore'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setTarget(user);
                    setAction('SET_ROLE');
                    setRole(user.role === 'ADMIN' ? 'USER' : 'ADMIN');
                  }}
                >
                  Change role
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setTarget(user);
                    setAction('ADJUST_COINS');
                  }}
                >
                  Adjust QCoins
                </Button>
              </div>
            </Td>
          </tr>
        )}
        emptyTitle="No users found"
        emptyDescription="Search for an account to manage it."
      />

      <ConfirmDialog
        open={target !== null}
        onClose={() => setTarget(null)}
        onConfirm={() => mutation.mutate()}
        loading={mutation.isPending}
        destructive={action === 'SUSPEND'}
        title={
          action === 'SUSPEND'
            ? `Suspend ${target?.name}?`
            : action === 'RESTORE'
              ? `Restore ${target?.name}?`
              : action === 'SET_ROLE'
                ? `Change role for ${target?.name}`
                : `Adjust QCoins for ${target?.name}`
        }
        confirmLabel={
          action === 'SUSPEND'
            ? 'Suspend account'
            : action === 'RESTORE'
              ? 'Restore account'
              : action === 'SET_ROLE'
                ? 'Save role'
                : 'Apply adjustment'
        }
        message={
          <div className="space-y-3">
            {action === 'SUSPEND' && (
              <p>
                The user will be signed out and blocked from signing in until restored. A reason is required and
                recorded permanently.
              </p>
            )}
            {action === 'SET_ROLE' && (
              <Select label="New role" value={role} onChange={(e) => setRole(e.target.value as 'USER' | 'ADMIN')}>
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
              </Select>
            )}
            {action === 'ADJUST_COINS' && (
              <>
                <Input
                  label="Amount (negative to deduct)"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 50 or -25"
                />
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Adjustments never edit history — they append a new ledger entry with your reason.
                </p>
              </>
            )}
            <Input
              label="Reason (required)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you doing this?"
              required
            />
          </div>
        }
      />
    </>
  );
}

export default AdminUserManagementPage;
