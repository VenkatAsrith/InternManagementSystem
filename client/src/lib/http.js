import axios from 'axios';
import { session } from './session';

/**
 * Normalised API failure. Every failed request rejects with one of these, so pages never have to
 * guess whether `error.response` exists.
 *   status      HTTP status, 0 for network/timeout failures
 *   code        machine readable code from the API envelope (VALIDATION_ERROR, INVALID_TRANSITION, ...)
 *   fieldErrors { fieldName: message } built from a 422 `details` array
 */
export class ApiError extends Error {
  constructor({ status = 0, code = 'UNKNOWN', message, details = null, requestId = null, network = false, timeout = false }) {
    super(message || 'Something went wrong. Please try again.');
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
    this.network = network;
    this.timeout = timeout;
    this.fieldErrors = {};
    if (Array.isArray(details)) {
      for (const d of details) {
        if (d && d.field && !this.fieldErrors[d.field]) this.fieldErrors[d.field] = d.message;
      }
    }
  }
}

export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://internmanagementsystem-xm84.onrender.com').replace(/\/+$/, '');
const apiBase = `${API_BASE_URL}/api/v1`;

const raw = axios.create({ baseURL: apiBase, timeout: 30000 });
const api = axios.create({ baseURL: apiBase, timeout: 30000, headers: { 'Content-Type': 'application/json' } });

function actingOrgHeader(headers) {
  // A platform administrator acts inside one tenant at a time by naming it explicitly.
  const actingOrg = session.getActingOrg();
  if (actingOrg && session.getUser()?.role === 'SUPER_ADMIN') headers['x-organization-id'] = actingOrg;
}

function previewRoleHeader(headers) {
  const preview = session.getPreviewRole();
  if (preview) headers['x-preview-role'] = preview;
}

api.interceptors.request.use((config) => {
  const token = session.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  actingOrgHeader(config.headers);
  previewRoleHeader(config.headers);
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) delete config.headers['Content-Type'];
  return config;
});

let inflightRefresh = null;

async function refreshTokens() {
  const before = session.getRefresh();
  if (!before) throw new Error('no refresh token');
  const run = async () => {
    // Another tab may have rotated the token while we waited for the lock: reuse its result instead of
    // replaying an already-rotated token (the server treats a replay as theft and revokes every session).
    if (session.getRefresh() !== before) return session.getToken();
    const res = await raw.post('/auth/refresh', { refreshToken: before });
    const { token, refreshToken } = res.data.data;
    session.setTokens(token, refreshToken);
    return token;
  };
  if (typeof navigator !== 'undefined' && navigator.locks?.request) return navigator.locks.request('tmt-ims-refresh', run);
  return run();
}

export function toApiError(error) {
  if (error instanceof ApiError) return error;
  if (error.response) {
    const body = error.response.data;
    const e = body && typeof body === 'object' ? body.error : null;
    return new ApiError({
      status: error.response.status,
      code: e?.code || `HTTP_${error.response.status}`,
      message: e?.message || (error.response.status >= 500 ? 'The server had a problem. Please try again.' : 'The request could not be completed.'),
      details: e?.details || null,
      requestId: e?.requestId || error.response.headers?.['x-request-id'] || null
    });
  }
  if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '')) {
    return new ApiError({ code: 'TIMEOUT', timeout: true, message: 'The request timed out. Please check your connection and try again.' });
  }
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return new ApiError({
    code: 'NETWORK_ERROR',
    network: true,
    message: offline ? 'You appear to be offline. Check your connection and try again.' : 'Cannot reach the server. Please try again in a moment.'
  });
}

const SESSION_ENDING = new Set(['INVALID_TOKEN', 'TOKEN_REVOKED', 'USER_INACTIVE', 'UNAUTHORIZED']);

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const original = error.config || {};
    const apiError = toApiError(error);
    const isAuthCall = /\/auth\/(login|refresh|setup-password)$/.test(original.url || '');

    if (apiError.status === 401 && !isAuthCall) {
      if (apiError.code === 'TOKEN_EXPIRED' && !original._retried && session.getRefresh()) {
        try {
          inflightRefresh = inflightRefresh || refreshTokens().finally(() => { inflightRefresh = null; });
          const token = await inflightRefresh;
          original._retried = true;
          original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
          return api(original);
        } catch {
          session.clear('expired');
          return Promise.reject(new ApiError({ status: 401, code: 'SESSION_EXPIRED', message: 'Your session has expired. Please sign in again.' }));
        }
      }
      if (SESSION_ENDING.has(apiError.code) || apiError.code === 'TOKEN_EXPIRED') {
        session.clear(apiError.code === 'TOKEN_EXPIRED' ? 'expired' : apiError.code);
      }
    }
    if (apiError.status === 403 && (apiError.code === 'ORG_SUSPENDED' || apiError.code === 'ORG_NOT_FOUND')) session.clear(apiError.code);
    return Promise.reject(apiError);
  }
);

/** Downloads a protected file (PDF, resume) through the authenticated client and saves it. */
export async function downloadFile(url, fallbackName = 'download') {
  const headers = {};
  const token = session.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  actingOrgHeader(headers);
  let res;
  try {
    res = await raw.get(url, { responseType: 'blob', headers });
  } catch (error) {
    if (error.response?.data instanceof Blob) {
      let body = null;
      try { body = JSON.parse(await error.response.data.text()); } catch { /* not JSON */ }
      if (body?.error) throw new ApiError({ status: error.response.status, code: body.error.code, message: body.error.message });
    }
    throw toApiError(error);
  }
  const disposition = res.headers['content-disposition'] || '';
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const filename = match ? decodeURIComponent(match[1]) : fallbackName;
  const blobUrl = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  return { filename, size: res.data.size, type: res.data.type };
}

export default api;
