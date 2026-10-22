import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Bell, ChevronDown, ExternalLink, KeyRound, LogOut, Menu, X, CheckCheck, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { visibleNav } from '../lib/access';
import { session } from '../lib/session';
import api from '../lib/http';
import { fmtDateTime, fullName } from '../lib/format';
import { Avatar } from '../components/ui';
import { ErrorBoundary } from '../components/ErrorBoundary';

function NavList({ groups, onNavigate }) {
  return (
    <nav aria-label="Main navigation" className="flex-1 space-y-5 overflow-y-auto px-3 py-4" data-testid="sidebar-nav">
      {groups.map((g) => (
        <div key={g.group} data-testid={`nav-section-${g.key || g.group.toLowerCase().replace(/\s+/g, '-')}`}>
          <div className="mb-1.5 flex items-center gap-2 px-3">
            {g.icon && <g.icon className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />}
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600" data-testid={`nav-section-title-${g.key || g.group.toLowerCase().replace(/\s+/g, '-')}`}>
              {g.group}
            </p>
          </div>
          <ul className="space-y-0.5">
            {g.items.map((it) => (
              <li key={it.key}>
                <NavLink
                  to={it.to}
                  onClick={onNavigate}
                  data-testid={`nav-${it.key}`}
                  className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-600 ${isActive ? 'bg-brand-50 font-semibold text-brand-800' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'}`}
                >
                  <it.icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  <span className="truncate">{it.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-600 rounded" data-testid="brand-link">
      <img src="/tmt-logo.png" alt="TechMecha Torque" className="h-8 w-auto max-w-[130px] object-contain" />
      <span className="rounded border border-brand-200 bg-brand-50 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-brand-800">IMS</span>
    </Link>
  );
}

function useOutsideClose(ref, open, close) {
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [ref, open, close]);
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ notifications: [], unreadCount: 0 });
  const [failed, setFailed] = useState(false);
  const box = useRef(null);
  useOutsideClose(box, open, () => setOpen(false));

  const load = async () => {
    try {
      const res = await api.get('/notifications');
      setData({ notifications: res.data.notifications || [], unreadCount: res.data.unreadCount || 0 });
      setFailed(false);
    } catch { setFailed(true); }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  const markAll = async () => {
    try {
      await api.post('/notifications/read-all');
      setData((d) => ({ notifications: d.notifications.map((n) => ({ ...n, isRead: true })), unreadCount: 0 }));
    } catch { /* stay unread */ }
  };
  const markOne = async (n) => {
    if (n.isRead) return;
    try {
      await api.patch(`/notifications/${n._id}/read`);
      setData((d) => ({ notifications: d.notifications.map((x) => (x._id === n._id ? { ...x, isRead: true } : x)), unreadCount: Math.max(0, d.unreadCount - 1) }));
    } catch { /* ignore */ }
  };

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); if (!open) load(); }}
        aria-label={data.unreadCount ? `Notifications, ${data.unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
        data-testid="notifications-button"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-600"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {data.unreadCount > 0 && (
          <span data-testid="notifications-unread" className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">{data.unreadCount > 9 ? '9+' : data.unreadCount}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl" data-testid="notifications-panel">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
            {data.unreadCount > 0 && (
              <button type="button" onClick={markAll} data-testid="notifications-mark-all" className="flex items-center gap-1 rounded text-xs font-medium text-brand-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-600">
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" /> Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {failed && <li className="p-4 text-center text-sm text-rose-700" role="alert">Could not load notifications.</li>}
            {!failed && data.notifications.length === 0 && <li className="p-6 text-center text-sm text-slate-600">You are all caught up.</li>}
            {data.notifications.map((n) => (
              <li key={n._id}>
                <button type="button" onClick={() => markOne(n)} className={`block w-full px-4 py-3 text-left hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-100 ${n.isRead ? '' : 'bg-brand-50/60'}`}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">{n.title}</span>
                    {!n.isRead && <span className="sr-only">Unread</span>}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-700 break-words">{n.message}</span>
                  <span className="mt-1 block text-[11px] text-slate-600">{fmtDateTime(n.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RoleBadge() {
  const { user } = useAuth();
  const roleName = user?.role ? user.role.replace(/_/g, ' ') : '';
  if (!roleName) return null;
  return (
    <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs">
      <span className="h-2 w-2 rounded-full bg-emerald-500" />
      <span className="font-mono text-[11px] font-semibold">{roleName}</span>
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useOutsideClose(box, open, () => setOpen(false));
  const displayRole = user?.role ? user.role.replace(/_/g, ' ') : '';

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        data-testid="user-menu-button"
        className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-600"
      >
        <Avatar name={fullName(user)} />
        <span className="hidden text-left sm:block">
          <span data-testid="user-name" className="block max-w-[10rem] truncate text-sm font-semibold leading-tight text-slate-900">{fullName(user)}</span>
          <span data-testid="user-role" className="block font-mono text-[11px] leading-tight text-slate-600">
            {displayRole}
          </span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-slate-600 sm:block" aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl" data-testid="user-menu">
          <div className="border-b border-slate-100 px-4 py-2.5 sm:hidden">
            <p className="text-sm font-semibold text-slate-900">{fullName(user)}</p>
            <p className="font-mono text-xs text-slate-600">{displayRole}</p>
          </div>
          <Link to="/account" onClick={() => setOpen(false)} data-testid="menu-account" className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-800 hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-100">
            <KeyRound className="h-4 w-4" aria-hidden="true" /> Account & security
          </Link>
          <button type="button" onClick={logout} data-testid="logout-button" className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-rose-800 hover:bg-rose-50 focus:outline-none focus-visible:bg-rose-100">
            <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  const auth = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);
  const main = useRef(null);
  const groups = useMemo(() => visibleNav(auth), [auth.permissions, auth.user]);
  const actingOrg = session.getActingOrg();

  // Close the mobile drawer and move focus to the page on navigation (keyboard / screen-reader users).
  useEffect(() => {
    setDrawer(false);
    main.current?.focus({ preventScroll: true });
    window.scrollTo?.(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setDrawer(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawer]);

  const leaveOrg = () => {
    session.setActingOrg(null);
    toast.info('You left the organization and are back in the platform view.');
    window.location.assign('/admin/global-command');
  };

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg" data-testid="skip-link">Skip to main content</a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 flex-shrink-0 flex-col border-r border-slate-200 bg-white lg:flex" data-testid="sidebar">
        <div className="flex h-16 items-center border-b border-slate-100 px-5"><Brand /></div>
        <NavList groups={groups} />
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" data-testid="mobile-drawer">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setDrawer(false)} aria-hidden="true" />
          <aside role="dialog" aria-modal="true" aria-label="Navigation menu" className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4">
              <Brand />
              <button type="button" onClick={() => setDrawer(false)} aria-label="Close navigation menu" data-testid="drawer-close" className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-600"><X className="h-5 w-5" aria-hidden="true" /></button>
            </div>
            <NavList groups={groups} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setDrawer(true)} aria-label="Open navigation menu" aria-expanded={drawer} data-testid="menu-button" className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-600 lg:hidden"><Menu className="h-5 w-5" aria-hidden="true" /></button>
            <span className="hidden truncate text-sm text-slate-700 sm:block" data-testid="org-name"><Building2 className="mr-1.5 inline h-4 w-4 -mt-0.5" aria-hidden="true" />{auth.organization?.name || 'Platform'}</span>
          </div>
          <div className="flex items-center gap-2">
            <RoleBadge />
            <Link to="/internships" target="_blank" rel="noopener noreferrer" className="hidden items-center gap-1 rounded text-xs font-medium text-slate-700 hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-600 md:inline-flex">Public portal <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only">(opens in a new tab)</span></Link>
            <Notifications />
            <UserMenu />
          </div>
        </header>

        {auth.isSuperAdmin && actingOrg && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-2.5 text-sm text-amber-950 sm:px-6 shadow-xs" data-testid="acting-org-banner" role="status">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-amber-700" />
              <span>
                Managing Organization: <strong className="font-bold text-amber-900">{auth.organization?.name || 'Selected Tenant'}</strong>. Showing all operations and staff tools.
              </span>
            </div>
            <button
              type="button"
              onClick={leaveOrg}
              data-testid="leave-org"
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-200/80 hover:bg-amber-300 px-3 py-1 text-xs font-bold text-amber-950 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-900"
            >
              ← Exit to Global Command
            </button>
          </div>
        )}

        <main id="main" ref={main} tabIndex={-1} className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-8" data-testid="main-content">
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
