import { Link, useNavigate } from 'react-router-dom';
import { Bell, Coins, LogOut, Shield, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Primitives';
import { useAuth } from '@/lib/auth';
import { formatCoins } from '@/lib/format';

export function Topbar({ mode }: { mode: 'user' | 'admin' }) {
  const { user, wallet, unreadNotifications, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {user && (
          <>
            {wallet && mode === 'user' && (
              <Link
                to="/app/wallet"
                className="hidden items-center gap-1.5 rounded-md border border-line bg-canvas px-2 py-1 text-xs font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink sm:inline-flex"
              >
                <Coins className="h-3.5 w-3.5 text-ink-faint" />
                <span className="tabular-nums">{formatCoins(wallet.balance)}</span>
                <span className="text-ink-faint">QCoin</span>
              </Link>
            )}
            {mode === 'admin' && (
              <Badge tone="brand">
                <Shield className="h-3 w-3" />
                Administrator
              </Badge>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-1">
        {user ? (
          <>
            {mode === 'user' && (
              <Link
                to="/app/notifications"
                aria-label={`Notifications${unreadNotifications ? ` (${unreadNotifications} unread)` : ''}`}
                className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
              >
                <Bell className="h-4 w-4" />
                {unreadNotifications > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold tabular-nums text-white">
                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                  </span>
                )}
              </Link>
            )}
            {mode === 'admin' && (
              <Button variant="ghost" size="sm" to="/app" icon={<UserIcon className="h-3.5 w-3.5" />}>
                Back to app
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              icon={<LogOut className="h-3.5 w-3.5" />}
              onClick={async () => {
                await signOut();
                navigate('/');
              }}
            >
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" size="sm" to="/login">
              Sign in
            </Button>
            <Button variant="primary" size="sm" to="/register">
              Create account
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
