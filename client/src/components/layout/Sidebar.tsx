import { NavLink, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { PanelLeftClose, PanelLeftOpen, ShieldCheck, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuth } from '@/context/AuthContext';
import { allNavSections, type NavSection } from './navConfig';
import { Badge } from '@/components/ui/Data';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  /** Rendered inside the mobile drawer (no collapse control, always expanded). */
  mobile?: boolean;
  onNavigate?: () => void;
}

/**
 * Persistent application sidebar. Shows only the sections the current user is
 * allowed to see (admin workspace replaces the user workspace for admins —
 * with a quick link back to the user view). Highlights the active route.
 */
export function Sidebar({ collapsed, onToggle, mobile = false, onNavigate }: SidebarProps) {
  const { user } = useAuth();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const sections: NavSection[] = allNavSections(user?.role);

  const isCollapsed = collapsed && !mobile;
  const width = isCollapsed ? 'w-[68px]' : 'w-64';

  return (
    <motion.aside
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className={cn(
        'flex h-full flex-col border-r border-zinc-200/80 bg-white',
        mobile ? 'w-full' : width,
        !mobile && 'transition-[width] duration-200 ease-out'
      )}
      aria-label="Main navigation"
    >
      {/* Brand */}
      <div className={cn('flex items-center gap-2.5 border-b border-zinc-100', isCollapsed ? 'justify-center px-3' : 'px-4', 'py-4')}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
          Q
        </div>
        {!isCollapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-900">QuizSphere</p>
            {user?.role === 'ADMIN' && (
              <Badge tone="brand" className="mt-0.5">
                <ShieldCheck className="h-3 w-3" /> Admin
              </Badge>
            )}
          </div>
        )}
        {mobile && (
          <button
            type="button"
            onClick={onNavigate}
            className="ml-auto rounded p-1.5 text-zinc-400 hover:bg-zinc-100"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto py-3">
        {sections.map((section) => (
          <div key={section.title} className="mb-3">
            {!isCollapsed && (
              <p className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5 px-2">
              {section.items.map((item) => {
                const to = item.to;
                const active =
                  location.pathname === to ||
                  (to !== '/dashboard' &&
                    to !== '/admin' &&
                    to !== '/creator' &&
                    location.pathname.startsWith(`${to}/`)) ||
                  (to === '/admin' && location.pathname === '/admin') ||
                  (to === '/creator' && location.pathname === '/creator');
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={to}
                      onClick={onNavigate}
                      title={isCollapsed ? item.label : undefined}
                      className={cn(
                        'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                        isCollapsed && 'justify-center px-0',
                        active
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                      )}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon
                        className={cn(
                          'h-[18px] w-[18px] shrink-0',
                          active ? 'text-brand-600' : 'text-zinc-400 group-hover:text-zinc-600'
                        )}
                      />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse control (desktop only) */}
      {!mobile && (
        <div className="border-t border-zinc-100 p-2">
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800',
              isCollapsed && 'justify-center px-0'
            )}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!isCollapsed && <span>Collapse</span>}
          </button>
        </div>
      )}

      {/* User card */}
      {user && !isCollapsed && (
        <div className="border-t border-zinc-100 px-4 py-3">
          <p className="truncate text-sm font-medium text-zinc-900">{user.name}</p>
          <p className="truncate text-xs text-zinc-500">{user.email}</p>
        </div>
      )}
    </motion.aside>
  );
}

export default Sidebar;
