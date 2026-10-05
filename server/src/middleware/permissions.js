import { ROLES, ROLE_PERMISSIONS } from '../../../shared/constants.js';
import { Role } from '../modules/roles/role.model.js';

// Permission resolution is ALWAYS dynamic: role -> permissions is looked up per request (short TTL cache),
// so changing a role definition or a user's role takes effect on their very next request.
// (The previous build snapshotted permissions onto the user document, which went stale.)

const CACHE_TTL_MS = 15_000;
const cache = new Map();

export function invalidatePermissionCache() {
  cache.clear();
}

export { permissionMatches, hasGranted } from '../../../shared/permissions.js';

export async function resolvePermissions(user) {
  if (!user) return [];
  if (user.role === ROLES.SUPER_ADMIN) return ['*'];
  if (ROLE_PERMISSIONS[user.role]) return [...ROLE_PERMISSIONS[user.role]];

  const key = `${user.role}|${user.organizationId || ''}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.perms;

  // Custom role: organisation specific definition wins over a global one.
  const candidates = await Role.find({
    key: user.role,
    status: 'ACTIVE',
    $or: [{ organizationId: user.organizationId }, { organizationId: null }, { organizationId: { $exists: false } }]
  }).lean();
  candidates.sort((a, b) => (b.organizationId ? 1 : 0) - (a.organizationId ? 1 : 0));
  // '*' can never be granted through a custom role.
  const perms = candidates.length ? (candidates[0].permissions || []).filter(p => p !== '*') : [];
  cache.set(key, { perms, expires: Date.now() + CACHE_TTL_MS });
  return perms;
}
