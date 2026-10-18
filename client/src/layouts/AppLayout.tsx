import { useCallback, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { Drawer } from '@/components/ui/Overlay';
import { useAuth } from '@/context/AuthContext';
import { useMediaQuery } from '@/hooks';
import { InlineSpinner } from '@/components/ui/Feedback';

/**
 * Authenticated application shell:
 *  - persistent collapsible desktop sidebar
 *  - accessible mobile navigation drawer
 *  - subtle page transitions (disabled under prefers-reduced-motion)
 */
export function AppLayout() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const reduceMotion = useReducedMotion();

  const closeMobile = useCallback(() => setMobileNavOpen(false), []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <InlineSpinner label="Loading your workspace…" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      {isDesktop ? (
        <div className="sticky top-0 h-screen shrink-0">
          <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
        </div>
      ) : (
        <Drawer open={mobileNavOpen} onClose={closeMobile} side="left" width="w-72" title="Navigation">
          <Sidebar collapsed={false} onToggle={() => {}} mobile onNavigate={closeMobile} />
        </Drawer>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
        <motion.main
          key={location.pathname}
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8"
        >
          <Outlet />
        </motion.main>
        <footer className="border-t border-line px-6 py-4 text-center text-xs text-muted">
          QuizSphere — internal QCoins have no cash value.
        </footer>
      </div>
    </div>
  );
}

export default AppLayout;
