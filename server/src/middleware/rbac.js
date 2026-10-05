import { ROLES } from '../../../shared/constants.js';
import { errorResponse } from '../utils/response.js';
import { hasGranted } from './permissions.js';
import { forbidden } from '../utils/errors.js';

/** Hard role gate. Reserved for platform-level features (e.g. SUPER_ADMIN only). Prefer requirePermission. */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return errorResponse(res, 'Authentication required', 401, 'UNAUTHORIZED');
    if (req.user.role === ROLES.SUPER_ADMIN) return next();
    if (!roles.includes(req.user.role)) {
      return errorResponse(res, 'Forbidden: You do not have the required role to perform this action.', 403, 'FORBIDDEN');
    }
    next();
  };
}

/** ALL listed permissions are required. Wildcards ('domain.*', '*') are honoured. */
export function requirePermission(...required) {
  return (req, res, next) => {
    if (!req.user) return errorResponse(res, 'Authentication required', 401, 'UNAUTHORIZED');
    const granted = req.permissions || [];
    if (!required.every(r => hasGranted(granted, r))) {
      return errorResponse(res, `Forbidden: Missing required permission (${required.join(', ')})`, 403, 'FORBIDDEN');
    }
    next();
  };
}

/** AT LEAST ONE of the listed permissions is required. */
export function requireAnyPermission(...options) {
  return (req, res, next) => {
    if (!req.user) return errorResponse(res, 'Authentication required', 401, 'UNAUTHORIZED');
    const granted = req.permissions || [];
    if (!options.some(o => hasGranted(granted, o))) {
      return errorResponse(res, `Forbidden: Requires one of (${options.join(', ')})`, 403, 'FORBIDDEN');
    }
    next();
  };
}

// Kept for older routers that still mount it. Tenant enforcement lives in requireOrgContext (auth.js).
export function scopeToTenant(req, res, next) {
  if (req.user && req.user.role !== ROLES.SUPER_ADMIN && !req.organizationId) {
    return errorResponse(res, 'User is not associated with any organization.', 403, 'TENANT_NOT_FOUND');
  }
  next();
}

/** Throws when the caller lacks the permission (for checks inside controllers). */
export function assertCan(req, permission, message) {
  if (!req.can || !req.can(permission)) throw forbidden(message || `Forbidden: Missing required permission (${permission})`);
}

/** Roles whose visibility is limited to the interns they supervise. */
export const MENTEE_SCOPED_ROLES = [ROLES.MENTOR, ROLES.TEAM_LEAD];
export const isMenteeScoped = (req) => MENTEE_SCOPED_ROLES.includes(req.userRole);
