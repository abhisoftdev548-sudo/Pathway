import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Compass,
  Gauge,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Route,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
  X,
} from 'lucide-react';
import { Avatar, Badge, Button, Dialog, DialogContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui';
import { Logo } from './common';
import { useAuth } from '@/lib/auth';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';

const primaryNav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/my-roadmaps', label: 'My roadmaps', icon: Route },
  { to: '/today', label: 'Today', icon: Target },
  { to: '/tasks', label: 'All tasks', icon: ClipboardCheck },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/achievements', label: 'Achievements', icon: Award },
  { to: '/history', label: 'History', icon: History },
];

const secondaryNav = [
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/profile', label: 'Profile', icon: UserRound },
];

const adminNav = [
  { to: '/admin', label: 'Admin overview', icon: Gauge },
  { to: '/admin/roadmaps', label: 'Roadmaps', icon: BookOpen },
  { to: '/admin/analytics', label: 'Enrollment analytics', icon: BarChart3 },
  { to: '/admin/validation', label: 'Validation report', icon: ShieldCheck },
];

function NavItem({ to, label, icon: Icon, onClick, end = false }: { to: string; label: string; icon: typeof Route; onClick?: () => void; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
          isActive ? 'bg-brand-soft text-brand-deep shadow-sm' : 'text-ink/65 hover:bg-canvas hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn('size-[18px] shrink-0', isActive ? 'text-brand' : 'text-muted group-hover:text-ink/70')} strokeWidth={1.9} />
          <span className="truncate">{label}</span>
          {isActive ? <ChevronRight className="ml-auto size-3.5 text-brand/60" /> : null}
        </>
      )}
    </NavLink>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-5">
        <Logo />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        <p className="eyebrow px-3 pb-2">Learn</p>
        {primaryNav.map((item) => (
          <NavItem key={item.to} {...item} onClick={onNavigate} end={item.to === '/dashboard'} />
        ))}
        <p className="eyebrow px-3 pb-2 pt-5">Account</p>
        {secondaryNav.map((item) => (
          <NavItem key={item.to} {...item} onClick={onNavigate} />
        ))}
        {user?.role === 'admin' ? (
          <>
            <p className="eyebrow px-3 pb-2 pt-5">Administration</p>
            {adminNav.map((item) => (
              <NavItem key={item.to} {...item} onClick={onNavigate} end={item.to === '/admin'} />
            ))}
          </>
        ) : null}
      </nav>
      <div className="border-t border-line/70 p-4">
        <div className="rounded-xl bg-canvas/70 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
            <Sparkles className="size-3.5 text-accent" /> {user?.name.split(' ')[0] ?? 'Learner'}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">Small steps, tracked honestly. Your plan is ready whenever you are.</p>
          <Link to="/explore" onClick={onNavigate} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline">
            Browse roadmaps <ChevronRight className="size-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const { data: notifications } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => apiGet<{ unreadCount: number }>('/me/notifications', { params: { limit: 1 } }),
    staleTime: 60_000,
    enabled: Boolean(user),
  });

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8);
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const initialsName = user?.name ?? 'Learner';

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-surface lg:block">
        <SidebarContent />
      </aside>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent title="Navigation" className="left-0 top-0 h-full max-h-none w-72 max-w-[80vw] -translate-x-0 -translate-y-0 rounded-none border-r p-0" size="sm">
          <div className="absolute right-3 top-4 z-10">
            <button onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="rounded-lg p-2 text-muted hover:bg-canvas">
              <X className="size-4" />
            </button>
          </div>
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </DialogContent>
      </Dialog>

      <div className="lg:pl-64">
        <header
          className={cn(
            'sticky top-0 z-20 border-b bg-canvas/85 backdrop-blur transition',
            scrolled ? 'border-line shadow-[0_1px_0_rgb(0_0_0_/_0.02)]' : 'border-transparent',
          )}
        >
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              className="rounded-lg p-2 text-ink/70 transition hover:bg-surface lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </button>
            <div className="lg:hidden">
              <Logo compact />
            </div>
            <div className="hidden items-center gap-2 text-xs text-muted sm:flex">
              <Compass className="size-3.5" />
              <span>Learn deliberately, one task at a time.</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                <Link to="/explore">Explore</Link>
              </Button>
              <Button asChild variant="ghost" size="icon" className="relative" aria-label="Notifications">
                <Link to="/notifications">
                  <Bell className="size-[18px]" />
                  {(notifications?.unreadCount ?? 0) > 0 ? (
                    <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white ring-2 ring-canvas">
                      {notifications!.unreadCount > 9 ? '9+' : notifications!.unreadCount}
                    </span>
                  ) : null}
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full p-1 pr-2 transition hover:bg-surface" aria-label="Account menu">
                    <Avatar name={initialsName} src={user?.avatar || undefined} size={32} />
                    <span className="hidden max-w-[120px] truncate text-sm font-medium text-ink sm:block">{initialsName.split(' ')[0]}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-semibold text-ink">{user?.name}</p>
                    <p className="truncate text-xs text-muted">{user?.email}</p>
                    {user?.role === 'admin' ? <Badge tone="bg-brand-soft text-brand-deep ring-brand/20" className="mt-2">Admin</Badge> : null}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate('/profile')}>
                    <UserRound className="size-4" /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate('/achievements')}>
                    <Award className="size-4" /> Achievements
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate('/notifications')}>
                    <Bell className="size-4" /> Notifications
                  </DropdownMenuItem>
                  {user?.role === 'admin' ? (
                    <DropdownMenuItem onSelect={() => navigate('/admin')}>
                      <Settings className="size-4" /> Admin console
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-rose-700"
                    onSelect={() => {
                      void logout().then(() => navigate('/'));
                    }}
                  >
                    <LogOut className="size-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</main>

        <footer className="mx-auto flex w-full max-w-[1400px] flex-col items-center justify-between gap-2 border-t border-line/70 px-4 py-6 text-xs text-muted sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} PathForge. Keep the streak kind.</p>
          <div className="flex items-center gap-4">
            <Link to="/about" className="hover:text-ink">
              How it works
            </Link>
            <Link to="/explore" className="hover:text-ink">
              Roadmaps
            </Link>
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden /> Synced
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

export function PublicLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur">
        <div className="container-page flex h-16 items-center gap-6">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">
            {[
              { to: '/explore', label: 'Explore roadmaps' },
              { to: '/about', label: 'How it works' },
            ].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn('rounded-lg px-3 py-2 text-sm font-medium transition', isActive ? 'bg-brand-soft text-brand-deep' : 'text-ink/65 hover:bg-surface hover:text-ink')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            {user ? (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/dashboard">Dashboard</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/today">Today's plan</Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/register">Start learning</Link>
                </Button>
              </>
            )}
          </div>
          <button
            className="ml-auto rounded-lg p-2 text-ink/70 md:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-label="Toggle navigation"
            aria-expanded={open}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
        {open ? (
          <div className="border-t border-line bg-surface px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              <NavLink to="/explore" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-ink/70 hover:bg-canvas">
                Explore roadmaps
              </NavLink>
              <NavLink to="/about" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-ink/70 hover:bg-canvas">
                How it works
              </NavLink>
              <div className="mt-2 flex gap-2 border-t border-line pt-3">
                {user ? (
                  <Button asChild className="flex-1">
                    <Link to="/dashboard" onClick={() => setOpen(false)}>Dashboard</Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild variant="outline" className="flex-1">
                      <Link to="/login" onClick={() => setOpen(false)}>Sign in</Link>
                    </Button>
                    <Button asChild className="flex-1">
                      <Link to="/register" onClick={() => setOpen(false)}>Start learning</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </header>
      <main>{children}</main>
      <footer className="border-t border-line bg-surface">
        <div className="container-page grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Logo />
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
              PathForge turns ambitious goals into honest, well-paced learning roadmaps. Pick a path, set a pace, and let the plan meet you where you are.
            </p>
          </div>
          <div>
            <p className="eyebrow mb-3">Learn</p>
            <ul className="space-y-2 text-sm text-muted">
              <li><Link to="/explore" className="hover:text-ink">Explore roadmaps</Link></li>
              <li><Link to="/about" className="hover:text-ink">How PathForge works</Link></li>
              <li><Link to="/register" className="hover:text-ink">Create an account</Link></li>
            </ul>
          </div>
          <div>
            <p className="eyebrow mb-3">Account</p>
            <ul className="space-y-2 text-sm text-muted">
              <li><Link to="/login" className="hover:text-ink">Sign in</Link></li>
              <li><Link to="/forgot-password" className="hover:text-ink">Reset password</Link></li>
              <li><Link to="/profile" className="hover:text-ink">Profile settings</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-line/70">
          <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-muted sm:flex-row">
            <p>© {new Date().getFullYear()} PathForge. Built for steady progress.</p>
            <p>Progress is calculated from completed published tasks — never from clicks.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
