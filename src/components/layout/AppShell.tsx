import { useEffect, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar, MobileDrawer } from './Sidebar';
import { Topbar } from './Topbar';

/** Announces route changes and resets scroll, for keyboard and screen readers. */
function useRouteA11y(): void {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
}

export function AppShell({ mode, children }: { mode: 'user' | 'admin'; children?: ReactNode }) {
  useRouteA11y();

  return (
    <div className="flex min-h-screen bg-canvas">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-[13px] focus:shadow-pop"
      >
        Skip to content
      </a>

      <aside className="hidden w-60 shrink-0 border-r border-line bg-surface lg:block xl:w-64">
        <div className="sticky top-0 h-screen">
          <Sidebar mode={mode} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar mode={mode} />
        <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1180px]">
            {children ?? <Outlet />}
          </div>
        </main>
      </div>

      <div className="fixed bottom-4 left-4 z-40 lg:hidden">
        <MobileDrawer mode={mode} />
      </div>
    </div>
  );
}

/** Public marketing / auth pages: simple header, no sidebar. */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Topbar mode="user" />
      <main className="flex-1">
        <OutletWrapper>{children}</OutletWrapper>
      </main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-ink-muted sm:px-6">
          <p>QuizSphere — quizzes, polls and a transparent QCoin ledger.</p>
          <nav className="flex gap-4">
            <a className="hover:text-ink" href="https://github.com/abhisoftdev548-sudo/Pathway" rel="noreferrer" target="_blank">
              Repository
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function OutletWrapper({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
