import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Menu, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuth } from '@/lib/auth';
import { initials } from '@/lib/format';
import { ADMIN_NAV, CREATOR_NAV, USER_NAV, type NavGroup, type NavItem } from './navItems';

const COLLAPSE_KEY = 'quizsphere.sidebar.collapsed';
const GROUP_KEY = 'quizsphere.sidebar.groups';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

/** True when the current location belongs to the item (ignoring query string). */
function isActive(item: NavItem, pathname: string, search: string): boolean {
  const targets = item.match ?? [item.to];
  for (const target of targets) {
    const [path, query] = target.split('?');
    if (pathname !== path) continue;
    if (!query) {
      // Items without a query only match when no conflicting query is present.
      const hasConflictingQuery = ADMIN_NAV.concat(CREATOR_NAV, USER_NAV)
        .flatMap((g) => g.items)
        .some((other) => other.to.startsWith(`${path}?`) && other.to !== item.to && matchQuery(other.to, search));
      return !hasConflictingQuery;
    }
    if (matchQuery(target, search)) return true;
  }
  return false;
}

function matchQuery(target: string, search: string): boolean {
  const query = target.split('?')[1];
  if (!query) return false;
  const params = new URLSearchParams(query);
  const current = new URLSearchParams(search);
  for (const [key, value] of params.entries()) {
    if (current.get(key) !== value) return false;
  }
  return true;
}

function NavLink({ item, active, collapsed, onNavigate }: { item: NavItem; active: boolean; collapsed: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors',
        active ? 'bg-brand-50 font-medium text-brand-700' : 'text-ink-soft hover:bg-canvas hover:text-ink',
        collapsed && 'justify-center px-0',
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-brand-600' : 'text-ink-faint group-hover:text-ink-muted')} />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {collapsed && <span className="sr-only">{item.label}</span>}
    </Link>
  );
}

function SidebarBody({
  groups,
  collapsed,
  onNavigate,
}: {
  groups: NavGroup[];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { pathname, search } = useLocation();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    readJson<Record<string, boolean>>(GROUP_KEY, {}),
  );

  useEffect(() => {
    writeJson(GROUP_KEY, openGroups);
  }, [openGroups]);

  const activeIds = new Set<string>();
  groups.forEach((group) => {
    if (group.items.some((item) => isActive(item, pathname, search))) activeIds.add(group.id);
  });

  return (
    <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-2 py-3 scroll-area">
      {groups.map((group) => {
        const isOpen = collapsed ? true : (openGroups[group.id] ?? activeIds.has(group.id) ?? true);
        return (
          <div key={group.id} className="mb-1">
            {collapsed ? (
              <div className="my-2 mx-2 border-t border-line" />
            ) : (
              <button
                type="button"
                onClick={() => setOpenGroups((current) => ({ ...current, [group.id]: !isOpen }))}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-faint transition-colors hover:text-ink-muted"
              >
                {group.label}
                <ChevronDown className={cn('h-3 w-3 transition-transform', !isOpen && '-rotate-90')} />
              </button>
            )}
            {isOpen && (
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.label + item.to}
                    item={item}
                    active={isActive(item, pathname, search)}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function Sidebar({
  mode,
  onNavigate,
}: {
  mode: 'user' | 'admin';
  onNavigate?: () => void;
}) {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(() => readJson<boolean>(COLLAPSE_KEY, false));
  const navigate = useNavigate();

  useEffect(() => {
    writeJson(COLLAPSE_KEY, collapsed);
  }, [collapsed]);

  const groups = mode === 'admin' ? ADMIN_NAV : [...USER_NAV, ...(user?.isCreator ? CREATOR_NAV : [])];

  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-14 items-center gap-2 border-b border-line px-3', collapsed && 'justify-center px-0')}>
        <Link to={mode === 'admin' ? '/admin' : '/app'} className="flex items-center gap-2" onClick={onNavigate}>
          <span className="flex h-7 w-7 items-center justify-center rounded bg-brand-600 text-[13px] font-semibold text-white">
            Q
          </span>
          {!collapsed && (
            <span className="text-sm font-semibold tracking-[-0.01em] text-ink">
              QuizSphere
              {mode === 'admin' && <span className="ml-1.5 text-2xs font-medium uppercase text-ink-faint">Admin</span>}
            </span>
          )}
        </Link>
      </div>

      <SidebarBody groups={groups} collapsed={collapsed} onNavigate={onNavigate} />

      <div className="border-t border-line p-2">
        <button
          type="button"
          onClick={() => navigate(mode === 'admin' ? '/admin/profile' : '/app/profile')}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-canvas',
            collapsed && 'justify-center px-0',
          )}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-2xs font-semibold text-brand-700">
            {initials(user?.displayName ?? '?')}
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-ink">{user?.displayName}</span>
              <span className="block truncate text-2xs capitalize text-ink-muted">{user?.role}</span>
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            'mt-1 flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-2xs font-medium text-ink-faint transition-colors hover:bg-canvas hover:text-ink-muted',
            collapsed && 'justify-center px-0',
          )}
        >
          <Menu className="h-3.5 w-3.5" />
          {!collapsed && 'Collapse sidebar'}
        </button>
      </div>
    </div>
  );
}

export function MobileDrawer({ mode }: { mode: 'user' | 'admin' }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={open}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line-strong bg-white text-ink-soft lg:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/25" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 flex w-72 animate-fade-in flex-col bg-surface shadow-pop">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close navigation menu"
              className="absolute right-2 top-3 z-10 rounded p-1.5 text-ink-faint hover:bg-canvas hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
            <Sidebar mode={mode} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
