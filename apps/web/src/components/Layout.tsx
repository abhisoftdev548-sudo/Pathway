import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Bell, BookOpenCheck, Compass, History, LayoutDashboard, LogOut, Menu, PenSquare, ShieldCheck, Sparkles, UserRound, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

const linkCls = ({ isActive }: { isActive: boolean }) => `inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? 'bg-brand-50 text-brand-700' : 'text-navy-900 hover:bg-slate-100'}`;

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!user) return;
    api.get('/api/me/notifications').then(r => setUnread(r.data.unread || 0)).catch(() => {});
  }, [user]);
  const close = () => setOpen(false);
  return <div className="flex min-h-screen flex-col">
    <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-bold">Skip to content</a>
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2" onClick={close}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl brand-gradient text-white"><Sparkles className="h-5 w-5" /></span>
          <span className="text-lg font-extrabold tracking-tight text-navy-950">Quiz<span className="brand-text">Sphere</span></span>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Primary">
          <NavLink to="/explore" className={linkCls}><Compass className="h-4 w-4" />Explore</NavLink>
          {user && <NavLink to="/dashboard" className={linkCls}><LayoutDashboard className="h-4 w-4" />Dashboard</NavLink>}
          {user && <NavLink to="/my-quizzes" className={linkCls}><PenSquare className="h-4 w-4" />My quizzes</NavLink>}
          {user && <NavLink to="/history" className={linkCls}><History className="h-4 w-4" />History</NavLink>}
          {user?.role === 'admin' && <NavLink to="/admin" className={linkCls}><ShieldCheck className="h-4 w-4" />Admin</NavLink>}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user && <Link to="/notifications" aria-label="Notifications" className="relative rounded-xl p-2 text-navy-900 hover:bg-slate-100">
            <Bell className="h-5 w-5" />{unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread}</span>}
          </Link>}
          {user ? <>
            <Link to="/quizzes/new" className="hidden rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-95 sm:inline-flex">Create quiz</Link>
            <Link to="/profile" className="hidden items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-100 md:inline-flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-950 text-xs font-bold text-white">{user.displayName.slice(0, 1)}</span>
              <span className="text-sm font-semibold text-navy-950">{user.displayName.split(' ')[0]}</span>
            </Link>
            <button onClick={async () => { await logout(); navigate('/'); }} className="hidden items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 md:inline-flex"><LogOut className="h-4 w-4" />Log out</button>
          </> : <>
            <Link to="/login" className="rounded-xl px-3 py-2 text-sm font-semibold text-navy-900 hover:bg-slate-100">Log in</Link>
            <Link to="/register" className="rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-95">Sign up free</Link>
          </>}
          <button className="rounded-xl p-2 hover:bg-slate-100 lg:hidden" aria-label="Toggle menu" onClick={() => setOpen(o => !o)}>{open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}</button>
        </div>
      </div>
      {open && <nav className="border-t border-slate-100 px-4 py-3 lg:hidden" aria-label="Mobile">
        <div className="flex flex-col gap-1">
          <NavLink to="/explore" className={linkCls} onClick={close}><Compass className="h-4 w-4" />Explore quizzes</NavLink>
          {user && <NavLink to="/dashboard" className={linkCls} onClick={close}><LayoutDashboard className="h-4 w-4" />Dashboard</NavLink>}
          {user && <NavLink to="/my-quizzes" className={linkCls} onClick={close}><PenSquare className="h-4 w-4" />My quizzes</NavLink>}
          {user && <NavLink to="/quizzes/new" className={linkCls} onClick={close}><BookOpenCheck className="h-4 w-4" />Create quiz</NavLink>}
          {user && <NavLink to="/history" className={linkCls} onClick={close}><History className="h-4 w-4" />Attempt history</NavLink>}
          {user && <NavLink to="/notifications" className={linkCls} onClick={close}><Bell className="h-4 w-4" />Notifications{unread > 0 ? ` (${unread})` : ''}</NavLink>}
          {user && <NavLink to="/profile" className={linkCls} onClick={close}><UserRound className="h-4 w-4" />Profile</NavLink>}
          {user?.role === 'admin' && <NavLink to="/admin" className={linkCls} onClick={close}><ShieldCheck className="h-4 w-4" />Admin</NavLink>}
          {user && <button onClick={async () => { await logout(); close(); navigate('/'); }} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50"><LogOut className="h-4 w-4" />Log out</button>}
        </div>
      </nav>}
    </header>
    <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8"><Outlet /></main>
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:px-6">
        <span className="font-semibold text-navy-950">Quiz<span className="brand-text">Sphere</span> <span className="font-normal text-slate-500">— community quizzes, reviewed before they publish.</span></span>
        <span className="flex gap-4"><Link className="hover:text-brand-700" to="/explore">Explore</Link><a className="hover:text-brand-700" href="/api/docs" target="_blank" rel="noreferrer">API docs</a>{user && <Link className="hover:text-brand-700" to="/quizzes/new">Create a quiz</Link>}</span>
      </div>
    </footer>
  </div>;
}

export function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="py-20 text-center text-sm text-slate-500">Loading…</div>;
  if (!user) return <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
    <h1 className="text-lg font-bold">Please log in</h1><p className="mt-2 text-sm text-slate-500">You need an account for this page.</p>
    <Link to="/login" className="mt-4 inline-block rounded-xl brand-gradient px-5 py-2.5 text-sm font-bold text-white">Log in</Link>
  </div>;
  return <>{children}</>;
}
export function AdminOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="py-20 text-center text-sm text-slate-500">Loading…</div>;
  if (!user || user.role !== 'admin') return <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
    <h1 className="text-lg font-bold">Administrators only</h1><p className="mt-2 text-sm text-slate-500">This area is restricted to QuizSphere moderators.</p></div>;
  return <>{children}</>;
}
