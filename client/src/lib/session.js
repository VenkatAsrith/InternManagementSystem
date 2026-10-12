// Browser session storage. Every access is wrapped: storage can be blocked, full or unavailable
// (private windows, embedded previews) and the app must still render.
// NOTE: the server never trusts anything stored here. Tampering with these values only gets the user
// a 401 and a forced sign-out; permissions are re-read from GET /auth/me on every page load.
const KEYS = { token: 'ims_token', refresh: 'ims_refresh', user: 'ims_user', org: 'ims_acting_org', previewRole: 'ims_preview_role' };
const listeners = new Set();

const read = (k) => {
  try { return window.localStorage.getItem(k); } catch { return null; }
};
const write = (k, v) => {
  try {
    if (v == null) window.localStorage.removeItem(k);
    else window.localStorage.setItem(k, v);
  } catch { /* storage unavailable */ }
};
const emit = (event) => listeners.forEach((l) => l(event));

export const session = {
  KEYS,
  getToken: () => read(KEYS.token),
  getRefresh: () => read(KEYS.refresh),
  getActingOrg: () => read(KEYS.org),
  getPreviewRole: () => read(KEYS.previewRole),
  getUser() {
    try {
      const raw = read(KEYS.user);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  setTokens(token, refreshToken) {
    write(KEYS.token, token);
    if (refreshToken !== undefined) write(KEYS.refresh, refreshToken);
  },
  setUser(user) { write(KEYS.user, user ? JSON.stringify(user) : null); },
  setActingOrg(orgId) {
    write(KEYS.org, orgId || null);
    emit({ type: 'org' });
  },
  setPreviewRole(role) {
    write(KEYS.previewRole, role || null);
    emit({ type: 'previewRole', role });
  },
  clear(reason) {
    Object.values(KEYS).forEach((k) => write(k, null));
    emit({ type: 'cleared', reason });
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
};
