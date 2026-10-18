import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';

/** Public marketing shell: minimal nav + footer. */
export function LandingLayout() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              Q
            </span>
            <span className="text-sm font-semibold text-heading">QuizSphere</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Public navigation">
            <Link to="/explore/quizzes" className="rounded-lg px-3 py-2 text-sm font-medium text-body hover:bg-surface-muted hover:text-heading">
              Quizzes
            </Link>
            <Link to="/explore/polls" className="rounded-lg px-3 py-2 text-sm font-medium text-body hover:bg-surface-muted hover:text-heading">
              Polls
            </Link>
            <Link to="/leaderboards" className="rounded-lg px-3 py-2 text-sm font-medium text-body hover:bg-surface-muted hover:text-heading">
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

      <footer className="border-t border-line bg-background">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
                  Q
                </span>
                <span className="text-sm font-semibold text-heading">QuizSphere</span>
              </div>
              <p className="mt-2 max-w-xs text-sm text-body">
                A community platform for quizzes and polls with a transparent internal QCoin economy.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Explore</p>
                <ul className="mt-2 space-y-1.5 text-body">
                  <li><Link to="/explore/quizzes" className="hover:text-heading">Quizzes</Link></li>
                  <li><Link to="/explore/polls" className="hover:text-heading">Polls</Link></li>
                  <li><Link to="/leaderboards" className="hover:text-heading">Leaderboards</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Account</p>
                <ul className="mt-2 space-y-1.5 text-body">
                  <li><Link to="/login" className="hover:text-heading">Sign in</Link></li>
                  <li><Link to="/register" className="hover:text-heading">Register</Link></li>
                  <li><Link to="/help" className="hover:text-heading">Help</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Economy</p>
                <p className="mt-2 max-w-[180px] text-body">
                  QCoins are internal credits with no cash value — no withdrawals, no transfers.
                </p>
              </div>
            </div>
          </div>
          <p className="mt-8 border-t border-line pt-6 text-xs text-muted">
            © {new Date().getFullYear()} QuizSphere. All participation data comes from real platform activity.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default LandingLayout;
