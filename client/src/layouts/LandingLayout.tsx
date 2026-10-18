import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';

/** Public marketing shell: minimal nav + footer. */
export function LandingLayout() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-zinc-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              Q
            </span>
            <span className="text-sm font-semibold text-zinc-900">QuizSphere</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Public navigation">
            <Link to="/explore/quizzes" className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900">
              Quizzes
            </Link>
            <Link to="/explore/polls" className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900">
              Polls
            </Link>
            <Link to="/leaderboards" className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900">
              Leaderboards
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/dashboard">
                <Button size="sm">Open dashboard</Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">Get started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-zinc-100 bg-zinc-50">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
                  Q
                </span>
                <span className="text-sm font-semibold text-zinc-900">QuizSphere</span>
              </div>
              <p className="mt-2 max-w-xs text-sm text-zinc-500">
                A community platform for quizzes and polls with a transparent internal QCoin economy.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Explore</p>
                <ul className="mt-2 space-y-1.5 text-zinc-600">
                  <li><Link to="/explore/quizzes" className="hover:text-zinc-900">Quizzes</Link></li>
                  <li><Link to="/explore/polls" className="hover:text-zinc-900">Polls</Link></li>
                  <li><Link to="/leaderboards" className="hover:text-zinc-900">Leaderboards</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Account</p>
                <ul className="mt-2 space-y-1.5 text-zinc-600">
                  <li><Link to="/login" className="hover:text-zinc-900">Sign in</Link></li>
                  <li><Link to="/register" className="hover:text-zinc-900">Register</Link></li>
                  <li><Link to="/help" className="hover:text-zinc-900">Help</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Economy</p>
                <p className="mt-2 max-w-[180px] text-zinc-500">
                  QCoins are internal credits with no cash value — no withdrawals, no transfers.
                </p>
              </div>
            </div>
          </div>
          <p className="mt-8 border-t border-zinc-200 pt-6 text-xs text-zinc-400">
            © {new Date().getFullYear()} QuizSphere. All participation data comes from real platform activity.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default LandingLayout;
