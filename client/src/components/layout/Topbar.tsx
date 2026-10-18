import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Coins, LogOut, Menu, Search, User as UserIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import endpoints from '@/services/endpoints';
import { Avatar, Badge } from '@/components/ui/Data';
import { formatNumber } from '@/utils/format';

/** Application top bar: search, wallet balance, notifications, account menu. */
export function Topbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchOpen] = useState(false);

  // Real unread count — omitted when zero (no fake badges).
  const { data: notifications } = useQuery({
    queryKey: ['notifications', 'badge'],
    queryFn: () => endpoints.notifications.list({ limit: 1 }),
    enabled: Boolean(user),
    refetchInterval: 60000,
  });

  const unread = notifications?.unreadCount ?? 0;

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-zinc-200/80 bg-white/90 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onOpenMobileNav}
        className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={() => navigate('/explore/quizzes')}
        className="hidden items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-400 hover:border-zinc-300 hover:text-zinc-600 sm:flex sm:w-64"
      >
        <Search className="h-4 w-4" />
        <span>Search quizzes & polls…</span>
      </button>

      <div className="flex-1" />

      {user && (
        <>
          <Link
            to="/wallet"
            className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 sm:flex"
            title="QCoin balance"
          >
            <Coins className="h-4 w-4 text-amber-500" />
            <span>{formatNumber(user.wallet?.balance ?? 0)}</span>
          </Link>

          <Link
            to="/notifications"
            className="relative rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
            aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Link>

          <div className="group relative">
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-zinc-100"
              aria-label="Account menu"
            >
              <Avatar name={user.name} src={user.avatar?.url} size="sm" />
            </button>
            <div className="invisible absolute right-0 top-full z-50 w-52 rounded-lg border border-zinc-200 bg-white py-1 opacity-0 shadow-pop transition-all group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              <div className="border-b border-zinc-100 px-3.5 py-2">
                <p className="truncate text-sm font-medium text-zinc-900">{user.name}</p>
                <p className="truncate text-xs text-zinc-500">{user.email}</p>
                {user.role === 'ADMIN' && (
                  <Badge tone="brand" className="mt-1">
                    Admin
                  </Badge>
                )}
              </div>
              <Link to="/profile" className="flex items-center gap-2 px-3.5 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
                <UserIcon className="h-4 w-4 text-zinc-400" /> My Profile
              </Link>
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  toast.success('Signed out');
                  navigate('/');
                }}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </div>
        </>
      )}

      {!user && !searchOpen && (
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Get started
          </Link>
        </div>
      )}
    </header>
  );
}

export default Topbar;
