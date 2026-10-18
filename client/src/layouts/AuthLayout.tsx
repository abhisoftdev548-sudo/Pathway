import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';

/** Centered auth card layout — redirects away when already signed in. */
export function AuthLayout() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  if (!isLoading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="px-6 py-5">
        <Link to="/" className="inline-flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            Q
          </span>
          <span className="text-sm font-semibold text-zinc-900">QuizSphere</span>
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <motion.div
          key={location.pathname}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          <Outlet />
        </motion.div>
      </main>
      <footer className="px-6 py-4 text-center text-xs text-zinc-400">
        © {new Date().getFullYear()} QuizSphere
      </footer>
    </div>
  );
}

export default AuthLayout;
