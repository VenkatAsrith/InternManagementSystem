import React from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldOff, WifiOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LoadingBlock } from './ui';
import { Button } from './ui/Button';
import { landingPath } from '../lib/access';

/** Blocks the whole workspace until a session exists. Unauthenticated visitors are sent to /login. */
export function RequireAuth() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center"><LoadingBlock label="Checking your session..." testId="session-loading" /></div>;
  }
  if (auth.status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center" role="alert" data-testid="boot-error">
        <WifiOff className="h-10 w-10 text-slate-600" aria-hidden="true" />
        <h1 className="text-lg font-semibold text-slate-900">We could not reach the server</h1>
        <p className="max-w-sm text-sm text-slate-600">{auth.bootError?.message}</p>
        <Button onClick={auth.reload} data-testid="retry-button">Try again</Button>
      </div>
    );
  }
  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

export function Forbidden() {
  const auth = useAuth();
  return (
    <div role="alert" data-testid="page-forbidden" className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <ShieldOff className="mb-4 h-12 w-12 text-rose-700" aria-hidden="true" />
      <h1 className="text-2xl font-bold text-slate-900">Access denied</h1>
      <p className="mt-2 text-sm text-slate-600">Your role does not include permission to open this page. If you believe this is a mistake, ask your administrator.</p>
      <Link
        to={landingPath(auth)}
        className="mt-6 inline-flex h-10 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
        data-testid="forbidden-home"
      >
        Go to my workspace
      </Link>
    </div>
  );
}

/**
 * Route-level permission gate. `any` is an any-of permission list, `roles` an explicit role whitelist.
 * The API enforces the same rule on every call, so this only prevents showing a screen that could not work.
 */
export function Guard({ any, roles, children }) {
  const auth = useAuth();
  const isSuper = auth.user?.role === 'SUPER_ADMIN';
  const allowedByRole = !roles || roles.includes(auth.user?.role) || isSuper;
  const allowedByPerm = !any || auth.canAny(any) || isSuper;
  if (!allowedByRole || !allowedByPerm) return <Forbidden />;
  return children;
}

/** Sends "/" style redirects to the correct workspace for the signed-in role. */
export function HomeRedirect() {
  const auth = useAuth();
  return <Navigate to={landingPath(auth)} replace />;
}
