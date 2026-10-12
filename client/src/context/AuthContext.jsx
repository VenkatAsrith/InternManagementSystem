import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../lib/http';
import { session } from '../lib/session';
import { setDisplayTimezone } from '../lib/format';
import { hasAnyGranted, hasGranted } from '@shared/permissions.js';

const AuthContext = createContext(null);

/**
 * Authentication state.
 *  - `status` is 'loading' until GET /auth/me has answered, then 'authenticated' or 'anonymous'.
 *  - permissions come from the server (dynamic RBAC). The UI uses them only to hide what the API would
 *    refuse anyway; the API remains the single authority.
 *  - a network failure while booting does NOT sign the user out: it shows a retry state instead.
 */
export function AuthProvider({ children }) {
  const [state, setState] = useState({
    status: session.getToken() ? 'loading' : 'anonymous',
    user: null,
    activeRole: null,
    originalRole: null,
    isPreviewMode: false,
    permissions: [],
    organization: null,
    bootError: null,
    endedReason: null
  });

  const applySession = useCallback((payload) => {
    setDisplayTimezone(payload.organization?.timezone || payload.user?.organizationId?.timezone);
    const origRole = payload.user?.originalRole || payload.user?.role;
    const currentRole = payload.user?.role;
    const isPreview = Boolean(payload.isPreviewMode || (session.getPreviewRole() && session.getPreviewRole() !== origRole));

    setState({
      status: 'authenticated',
      user: payload.user,
      activeRole: currentRole,
      originalRole: origRole,
      isPreviewMode: isPreview,
      permissions: payload.permissions || [],
      organization: payload.organization || null,
      bootError: null,
      endedReason: null
    });
  }, []);

  const boot = useCallback(async () => {
    if (!session.getToken()) {
      setState((s) => ({ ...s, status: 'anonymous' }));
      return;
    }
    setState((s) => ({ ...s, status: 'loading', bootError: null }));
    try {
      const res = await api.get('/auth/me');
      const { user, permissions, isPreviewMode, activeRole } = res.data;
      session.setUser(user);
      const org = user.organizationId && typeof user.organizationId === 'object' ? { name: user.organizationId.name, timezone: user.organizationId.timezone } : null;
      applySession({ user, permissions, organization: org, isPreviewMode, activeRole });
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        session.clear(error.code);
      } else {
        setState((s) => ({ ...s, status: 'error', bootError: error }));
      }
    }
  }, [applySession]);

  useEffect(() => { boot(); }, [boot]);

  // Session cleared anywhere (expired token, other tab logged out, tampered token) -> back to anonymous.
  useEffect(() => session.subscribe((event) => {
    if (event.type === 'cleared') {
      setState({ status: 'anonymous', user: null, activeRole: null, originalRole: null, isPreviewMode: false, permissions: [], organization: null, bootError: null, endedReason: event.reason || null });
    }
  }), []);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === session.KEYS.token && !e.newValue) {
        setState({ status: 'anonymous', user: null, activeRole: null, originalRole: null, isPreviewMode: false, permissions: [], organization: null, bootError: null, endedReason: 'other-tab' });
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = useCallback(async (email, password) => {
    session.setPreviewRole(null);
    const res = await api.post('/auth/login', { email, password });
    const { token, refreshToken, user, permissions, organization } = res.data;
    session.setTokens(token, refreshToken);
    session.setUser(user);
    applySession({ user, permissions, organization });
    return { user, permissions };
  }, [applySession]);

  const logout = useCallback(async () => {
    session.setPreviewRole(null);
    const refreshToken = session.getRefresh();
    try {
      await api.post('/auth/logout', { refreshToken });
    } catch { /* the local session is cleared regardless */ }
    session.clear('logout');
  }, []);

  const switchRole = useCallback(async (targetRole) => {
    const res = await api.post('/auth/switch-role', { role: targetRole });
    const { activeRole, originalRole, isPreviewMode, permissions, user } = res.data;
    session.setPreviewRole(isPreviewMode ? activeRole : null);
    session.setUser(user);
    setState((s) => ({
      ...s,
      user,
      activeRole,
      originalRole,
      isPreviewMode,
      permissions
    }));
    return { activeRole, permissions, isPreviewMode };
  }, []);

  const exitPreview = useCallback(async () => {
    const res = await api.post('/auth/exit-preview');
    const { activeRole, originalRole, isPreviewMode, permissions, user } = res.data;
    session.setPreviewRole(null);
    session.setUser(user);
    setState((s) => ({
      ...s,
      user,
      activeRole,
      originalRole,
      isPreviewMode,
      permissions
    }));
    return { activeRole, permissions };
  }, []);

  const value = useMemo(() => {
    const effectiveRole = state.activeRole || state.user?.role;
    const isSuper = effectiveRole === 'SUPER_ADMIN' && !state.isPreviewMode;

    return {
      ...state,
      effectiveRole,
      isAuthenticated: state.status === 'authenticated',
      isLoading: state.status === 'loading',
      login,
      logout,
      switchRole,
      exitPreview,
      reload: boot,
      setPermissions: (permissions) => setState((s) => ({ ...s, permissions })),
      can: (perm) => isSuper || hasGranted(state.permissions, perm),
      canAny: (perms) => isSuper || (!perms || perms.length === 0 || hasAnyGranted(state.permissions, perms)),
      hasRole: (...roles) => !!state.user && (isSuper || roles.includes(effectiveRole)),
      isSuperAdmin: isSuper
    };
  }, [state, login, logout, switchRole, exitPreview, boot]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
