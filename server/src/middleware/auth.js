import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../modules/users/user.model.js';
import { Organization } from '../modules/organizations/organization.model.js';
import { ROLES } from '../../../shared/constants.js';
import { errorResponse } from '../utils/response.js';
import { isObjectId } from '../utils/validate.js';
import { resolvePermissions, hasGranted } from './permissions.js';

// Small TTL cache so every request does not need an extra organisation lookup.
const ORG_TTL_MS = 5_000;
const orgCache = new Map();

export function invalidateOrgCache(orgId) {
  if (orgId) orgCache.delete(String(orgId));
  else orgCache.clear();
}

export async function getOrgContext(orgId) {
  if (!orgId) return null;
  const key = String(orgId);
  const hit = orgCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const org = await Organization.findById(orgId).select('status timezone name').lean();
  const value = org ? { status: org.status, timezone: org.timezone || env.ORG_TIMEZONE, name: org.name } : null;
  orgCache.set(key, { value, expires: Date.now() + ORG_TTL_MS });
  return value;
}

function readBearer(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7).trim();
  return '';
}

async function attachUser(req, token) {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  const user = await User.findById(decoded.userId).populate('departmentId', 'name code');
  if (!user || !user.isActive) return { error: ['User account is inactive or no longer exists.', 401, 'USER_INACTIVE'] };

  // Access tokens issued before the last password change are dead (1s tolerance: JWT iat has 1s resolution).
  if (user.passwordChangedAt && decoded.iat && decoded.iat * 1000 + 1000 < user.passwordChangedAt.getTime()) {
    return { error: ['Your password was changed. Please sign in again.', 401, 'TOKEN_REVOKED'] };
  }

  let orgId = user.organizationId;
  const isSuper = user.role === ROLES.SUPER_ADMIN;

  // A tenant-bound account can only act while its organisation is ACTIVE.
  if (!isSuper) {
    const org = await getOrgContext(orgId);
    if (!org) return { error: ['Your organisation no longer exists.', 403, 'ORG_NOT_FOUND'] };
    if (org.status !== 'ACTIVE') {
      return { error: ['Your organisation is suspended. Please contact the platform administrator.', 403, 'ORG_SUSPENDED'] };
    }
    req.timezone = org.timezone;
  } else {
    // SUPER_ADMIN may act inside a tenant by naming it explicitly.
    const requested = req.headers['x-organization-id'];
    if (requested && isObjectId(requested)) {
      const org = await getOrgContext(requested);
      if (org) {
        orgId = new mongoose.Types.ObjectId(requested);
        req.timezone = org.timezone;
      }
    }
  }

  req.user = user;
  req.userId = user._id;
  req.userRole = user.role;
  req.organizationId = orgId;
  req.timezone = req.timezone || env.ORG_TIMEZONE;
  req.permissions = await resolvePermissions(user);
  req.can = (perm) => hasGranted(req.permissions, perm);
  return { user };
}

export async function authenticate(req, res, next) {
  try {
    // Tokens are accepted ONLY from the Authorization header (a ?token= query string leaks into logs/history).
    const token = readBearer(req);
    if (!token) {
      return errorResponse(res, 'Authentication required. No token provided.', 401, 'UNAUTHORIZED');
    }
    const result = await attachUser(req, token);
    if (result.error) return errorResponse(res, ...result.error);
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 'Authentication token expired. Please refresh your session.', 401, 'TOKEN_EXPIRED');
    }
    if (error.name === 'JsonWebTokenError' || error.name === 'NotBeforeError') {
      return errorResponse(res, 'Invalid authentication token.', 401, 'INVALID_TOKEN');
    }
    next(error);
  }
}

/** Public endpoints that behave differently for signed-in users. Never fails the request. */
export async function optionalAuthenticate(req, res, next) {
  const token = readBearer(req);
  if (!token) return next();
  try {
    await attachUser(req, token);
  } catch {
    // ignore: treated as anonymous
  }
  next();
}

/**
 * Org-scoped routers use this after authenticate. A SUPER_ADMIN without a chosen tenant
 * would otherwise run queries with organizationId=undefined (matching null documents).
 */
export function requireOrgContext(req, res, next) {
  if (!req.organizationId) {
    return errorResponse(
      res,
      req.userRole === ROLES.SUPER_ADMIN
        ? 'Select an organisation first (send the x-organization-id header) to use tenant-scoped features.'
        : 'User is not associated with any organisation.',
      req.userRole === ROLES.SUPER_ADMIN ? 400 : 403,
      req.userRole === ROLES.SUPER_ADMIN ? 'ORG_CONTEXT_REQUIRED' : 'TENANT_NOT_FOUND'
    );
  }
  next();
}
