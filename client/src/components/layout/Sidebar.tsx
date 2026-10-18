import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { LogOut, PanelLeftClose, PanelLeftOpen, Settings2, ShieldCheck, User as UserIcon, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { allNavSections, type NavSection } from './navConfig';
import { Avatar, Badge } from '@/components/ui/Data';

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
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const reduceMotion = useReducedMotion();
  const sections: NavSection[] = allNavSections(user?.role);

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out');
    navigate('/');
    onNavigate?.();
  };

  const isCollapsed = collapsed && !mobile;
  const width = isCollapsed ? 'w-[68px]' : 'w-64';

  return (
    <motion.aside
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className={cn(
        'flex h-full flex-col border-r border-line bg-white',
        mobile ? 'w-full' : width,
        !mobile && 'transition-[width] duration-200 ease-out'
      )}
      aria-label="Main navigation"
    >
      {/* Brand */}
      <div className={cn('flex items-center gap-2.5 border-b border-line', isCollapsed ? 'justify-center px-3' : 'px-4', 'py-4')}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
          Q
        </div>
        {!isCollapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-heading">QuizSphere</p>
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
            className="ml-auto rounded p-1.5 text-muted hover:bg-surface-muted"
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
              <p className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-wider text-muted">
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
                          : 'text-body hover:bg-surface-muted hover:text-heading'
                      )}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon
                        className={cn(
                          'h-[18px] w-[18px] shrink-0',
                          active ? 'text-brand-600' : 'text-muted group-hover:text-body'
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
        <div className="border-t border-line p-2">
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-body hover:bg-surface-muted hover:text-heading',
              isCollapsed && 'justify-center px-0'
            )}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!isCollapsed && <span>Collapse</span>}
          </button>
        </div>
      )}

      {/* User block: avatar, name, profile/settings access, logout */}
      {user && (
        <div className={cn('border-t border-line', isCollapsed ? 'flex flex-col items-center gap-1 px-2 py-3' : 'px-3 py-3')}>
          {isCollapsed ? (
            <>
              <Link to="/profile" title={user.name} className="mb-1" onClick={onNavigate}>
                <Avatar name={user.name} src={user.avatar?.url} size="sm" />
              </Link>
              <Link
                to="/profile"
                onClick={onNavigate}
                title="My profile"
                aria-label="My profile"
                className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-heading"
              >
                <UserIcon className="h-4 w-4" />
              </Link>
              <Link
                to="/settings"
                onClick={onNavigate}
                title="Settings"
                aria-label="Settings"
                className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-heading"
              >
                <Settings2 className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                title="Sign out"
                aria-label="Sign out"
                className="rounded-lg p-2 text-muted hover:bg-danger-soft hover:text-danger"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
                <Link to="/profile" onClick={onNavigate} className="shrink-0">
                  <Avatar name={user.name} src={user.avatar?.url} size="md" />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-heading">{user.name}</p>
                  <p className="truncate text-xs text-muted">{user.email}</p>
                </div>
              </div>
              <div className="mt-1 flex items-center gap-1">
                <Link
                  to="/profile"
                  onClick={onNavigate}
                  className="flex flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-body hover:bg-surface-muted hover:text-heading"
                >
                  <UserIcon className="h-3.5 w-3.5 text-muted" /> Profile
                </Link>
                <Link
                  to="/settings"
                  onClick={onNavigate}
                  className="flex flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-body hover:bg-surface-muted hover:text-heading"
                >
                  <Settings2 className="h-3.5 w-3.5 text-muted" /> Settings
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Sign out"
                  aria-label="Sign out"
                  className="rounded-lg p-1.5 text-muted hover:bg-danger-soft hover:text-danger"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </motion.aside>
  );
}

export default Sidebar;
