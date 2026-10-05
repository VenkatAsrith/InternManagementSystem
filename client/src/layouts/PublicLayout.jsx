import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { landingPath } from '../lib/access';
import { ErrorBoundary } from '../components/ErrorBoundary';

const LINKS = [
  { to: '/internships', label: 'Internships', testId: 'public-nav-internships' },
  { to: '/application/status', label: 'Track application', testId: 'public-nav-status' },
  { to: '/verify/certificate', label: 'Verify certificate', testId: 'public-nav-verify' }
];

export function PublicLayout() {
  const auth = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg">Skip to main content</a>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-600" data-testid="public-brand">
            <img src="/tmt-logo.png" alt="TechMecha Torque" className="h-8 w-auto max-w-[140px] object-contain" />
            <span className="hidden text-sm font-semibold text-slate-900 sm:inline">Internship Portal</span>
          </Link>
          <nav aria-label="Public navigation" className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} data-testid={l.testId} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-600 ${isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-100'}`}>{l.label}</NavLink>
            ))}
            <Link to={auth.isAuthenticated ? landingPath(auth) : '/login'} data-testid="public-nav-login" className="ml-2 inline-flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2">
              {auth.isAuthenticated ? 'My workspace' : 'Sign in'}
            </Link>
          </nav>
          <button type="button" className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-600 md:hidden" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="public-mobile-menu" data-testid="public-menu-button">
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
        {open && (
          <nav id="public-mobile-menu" aria-label="Public navigation" className="border-t border-slate-200 bg-white px-4 py-3 md:hidden" data-testid="public-mobile-menu">
            <ul className="space-y-1">
              {LINKS.map((l) => <li key={l.to}><NavLink to={l.to} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-100">{l.label}</NavLink></li>)}
              <li><Link to={auth.isAuthenticated ? landingPath(auth) : '/login'} className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-brand-800 hover:bg-slate-100">{auth.isAuthenticated ? 'My workspace' : 'Sign in'}</Link></li>
            </ul>
          </nav>
        )}
      </header>

      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none" data-testid="public-main">
        <ErrorBoundary resetKey={location.pathname}><Outlet /></ErrorBoundary>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-xs text-slate-600 sm:flex-row sm:px-6 lg:px-8">
          <p>&copy; {new Date().getFullYear()} TechMecha Torque. All rights reserved.</p>
          <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
            <Link to="/internships" className="hover:text-slate-900 hover:underline">Internships</Link>
            <Link to="/application/status" className="hover:text-slate-900 hover:underline">Track application</Link>
            <Link to="/verify/certificate" className="hover:text-slate-900 hover:underline">Verify certificate</Link>
            <Link to="/login" className="hover:text-slate-900 hover:underline">Staff & intern sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
