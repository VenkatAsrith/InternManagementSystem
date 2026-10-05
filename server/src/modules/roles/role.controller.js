import { Role } from './role.model.js';
import { RoleAssignment } from './roleAssignment.model.js';
import { RoleHistory } from './roleHistory.model.js';
import { User } from '../users/user.model.js';
import { Intern } from '../interns/intern.model.js';
import { Session } from '../auth/session.model.js';
import {
  ROLES, ROLE_DEFINITIONS, ROLE_PERMISSIONS, PERMISSION_GROUPS, ROLE_STATUS, ROLE_CATEGORY, ASSIGNABLE_PERMISSION_KEYS
} from '../../../../shared/constants.js';
import { INTERN_CLOSED_STATUSES } from '../../../../shared/lifecycle.js';
import { successResponse } from '../../utils/response.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { hasGranted, invalidatePermissionCache } from '../../middleware/permissions.js';
import { ah } from '../../utils/asyncHandler.js';
import { notFound, conflict, forbidden, unprocessable } from '../../utils/errors.js';
import { Validator } from '../../utils/validate.js';
import { assertCanGrantRole } from '../users/user.controller.js';

let systemRolesSynced = null;

/** Makes sure every built-in role exists as a (read-only) document. Runs once per process. */
function ensureSystemRoles() {
  if (!systemRolesSynced) {
    systemRolesSynced = (async () => {
      for (const def of Object.values(ROLE_DEFINITIONS)) {
        const existing = await Role.findOne({ key: def.key, organizationId: null });
        if (!existing) {
          await Role.create({
            key: def.key, label: def.label, description: def.description, category: def.category, scope: def.scope,
            organizationId: null, permissions: def.permissions, assignableBy: def.assignableBy,
            approvalRequired: def.approvalRequired, isSystemRole: true, defaultNavigation: def.defaultNavigation,
            status: ROLE_STATUS.ACTIVE
          });
        }
      }
    })().catch(err => { systemRolesSynced = null; throw err; });
  }
  return systemRolesSynced;
}

/** True when the actor may hand out permission `p`: they hold it (directly, via a wildcard, or via '*'). */
function actorHolds(actorPerms, p) {
  if (actorPerms.includes('*')) return true;
  // Granting a wildcard ('tasks.*') requires holding that exact wildcard; a single narrower permission is not enough.
  if (p.endsWith('.*')) return actorPerms.includes(p);
  return hasGranted(actorPerms, p);
}

/** Custom permission list must be known keys and must not exceed what the actor holds. */
function validatePermissionList(req, permissions) {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    throw unprocessable('Select at least one permission.', [{ field: 'permissions', message: 'At least one permission is required' }]);
  }
  const known = new Set(ASSIGNABLE_PERMISSION_KEYS);
  const cleaned = [...new Set(permissions.map(p => String(p).trim()))];
  for (const p of cleaned) {
    if (p === '*') throw forbidden('The all-access permission (*) cannot be granted to a custom role.', 'WILDCARD_FORBIDDEN');
    if (!known.has(p)) throw unprocessable(`Unknown permission: ${p}`, [{ field: 'permissions', message: `Unknown permission ${p}` }]);
  }
  // No privilege escalation: an actor can only put permissions into a role that they hold themselves.
  const actorPerms = req.permissions || [];
  const missing = cleaned.filter(p => !actorHolds(actorPerms, p));
  if (missing.length) {
    throw forbidden(`You cannot grant permissions you do not hold yourself: ${missing.join(', ')}`, 'PRIVILEGE_ESCALATION');
  }
  return cleaned;
}

const KEY_RE = /^[A-Z][A-Z0-9_]{2,39}$/;

export const getRoles = ah(async (req, res) => {
  await ensureSystemRoles();
  const query = { status: { $ne: ROLE_STATUS.ARCHIVED } };
  if (req.includeAllOrgs !== true) {
    query.$or = [{ organizationId: null }];
    if (req.organizationId) query.$or.push({ organizationId: req.organizationId });
  }
  const roles = await Role.find(query).sort({ isSystemRole: -1, label: 1 });
  return successResponse(res, roles);
});

export const getPermissionCatalog = ah(async (req, res) => {
  return successResponse(res, { groups: PERMISSION_GROUPS, systemRoles: ROLE_DEFINITIONS });
});

export const createCustomRole = ah(async (req, res) => {
  await ensureSystemRoles();
  const v = new Validator(req.body);
  v.string('key', { required: true, upper: true, max: 40 })
    .string('label', { required: true, max: 80 })
    .string('description', { max: 400 })
    .oneOf('category', ROLE_CATEGORY, { defaultValue: ROLE_CATEGORY.ADMINISTRATION })
    .boolean('approvalRequired', { defaultValue: false })
    .stringList('navigationAccess', { max: 10 });
  const body = v.done();

  const key = body.key.replace(/[^A-Z0-9_]/g, '_');
  if (!KEY_RE.test(key)) throw unprocessable('Role key must be 3-40 characters: letters, digits and underscores, starting with a letter.', [{ field: 'key', message: 'Invalid role key' }]);
  if (ROLE_DEFINITIONS[key] || Object.values(ROLES).includes(key)) {
    throw conflict(`'${key}' is reserved for a built-in role.`, 'RESERVED_ROLE_KEY');
  }
  const permissions = validatePermissionList(req, req.body?.permissions);

  const isGlobal = req.userRole === ROLES.SUPER_ADMIN && req.body?.scope === 'GLOBAL';
  const organizationId = isGlobal ? null : req.organizationId;
  if (!isGlobal && !organizationId) throw unprocessable('Select an organization first', [{ field: 'organizationId', message: 'Organization required' }]);
  if (await Role.findOne({ key, organizationId })) throw conflict(`Role key '${key}' already exists.`, 'ROLE_KEY_EXISTS');

  const role = await Role.create({
    key, label: body.label, description: body.description || '', category: body.category,
    scope: isGlobal ? 'GLOBAL' : 'ORGANIZATION', organizationId, permissions,
    assignableBy: [ROLES.SUPER_ADMIN, ROLES.ORGANIZATION_ADMIN], approvalRequired: !!body.approvalRequired,
    isSystemRole: false, navigationAccess: body.navigationAccess || ['adminNav'], status: ROLE_STATUS.ACTIVE, createdBy: req.userId
  });
  invalidatePermissionCache();
  await recordAuditLog({ action: 'ROLE_CREATED', entityType: 'ROLE', entityId: role._id, after: { key: role.key, label: role.label, permissions: role.permissions }, req });
  return successResponse(res, role, 'Custom role created successfully', 201);
});

async function loadEditableRole(req) {
  const role = await Role.findById(req.params.id);
  if (!role) throw notFound('Role not found');
  if (role.isSystemRole) throw forbidden('System defined roles cannot be altered.', 'SYSTEM_ROLE_IMMUTABLE');
  const isMine = role.organizationId && String(role.organizationId) === String(req.organizationId);
  if (!isMine && req.userRole !== ROLES.SUPER_ADMIN) throw notFound('Role not found');
  return role;
}

export const updateCustomRole = ah(async (req, res) => {
  const role = await loadEditableRole(req);
  const v = new Validator(req.body);
  v.string('label', { max: 80 })
    .string('description', { max: 400, allowEmpty: true })
    .oneOf('category', ROLE_CATEGORY)
    .oneOf('status', [ROLE_STATUS.ACTIVE, ROLE_STATUS.DISABLED])
    .boolean('approvalRequired')
    .stringList('navigationAccess', { max: 10 });
  const body = v.done();

  const before = { label: role.label, permissions: role.permissions, status: role.status, scope: role.scope };
  Object.assign(role, body);
  if (req.body?.permissions !== undefined) role.permissions = validatePermissionList(req, req.body.permissions);

  // Scope change is a platform decision: GLOBAL <-> ORGANIZATION.
  if (req.body?.scope && req.body.scope !== role.scope) {
    if (req.userRole !== ROLES.SUPER_ADMIN) throw forbidden('Only a global administrator can change a role scope.', 'FORBIDDEN');
    if (req.body.scope === 'GLOBAL') {
      if (await Role.findOne({ key: role.key, organizationId: null, _id: { $ne: role._id } })) throw conflict('A global role with this key already exists.', 'ROLE_KEY_EXISTS');
      role.scope = 'GLOBAL';
      role.organizationId = null;
    } else if (req.body.scope === 'ORGANIZATION') {
      if (!req.organizationId) throw unprocessable('Select the target organization first', [{ field: 'organizationId', message: 'Organization required' }]);
      const foreignHolders = await User.countDocuments({ role: role.key, organizationId: { $ne: req.organizationId }, isActive: true });
      if (foreignHolders) throw conflict('Users in other organizations still hold this role.', 'ROLE_IN_USE', { foreignHolders });
      role.scope = 'ORGANIZATION';
      role.organizationId = req.organizationId;
    } else {
      throw unprocessable('scope must be GLOBAL or ORGANIZATION', [{ field: 'scope', message: 'Invalid scope' }]);
    }
  }

  // A role that is switched off must not be left on people: block if anyone still holds it.
  if (role.status === ROLE_STATUS.DISABLED && before.status !== ROLE_STATUS.DISABLED) {
    const holders = await User.countDocuments({ role: role.key, isActive: true, ...(role.organizationId ? { organizationId: role.organizationId } : {}) });
    if (holders) throw conflict(`${holders} active user(s) still hold this role. Reassign them before disabling it.`, 'ROLE_IN_USE', { holders });
  }

  await role.save();
  invalidatePermissionCache(); // holders see the new permission set on their very next request
  await recordAuditLog({ action: 'ROLE_UPDATED', entityType: 'ROLE', entityId: role._id, before, after: { label: role.label, permissions: role.permissions, status: role.status, scope: role.scope }, req });
  return successResponse(res, role, 'Role updated successfully');
});

async function holdersOf(role) {
  return User.countDocuments({ role: role.key, isActive: true, ...(role.organizationId ? { organizationId: role.organizationId } : {}) });
}

export const archiveRole = ah(async (req, res) => {
  const role = await loadEditableRole(req);
  const holders = await holdersOf(role);
  if (holders > 0) {
    throw conflict(`Cannot archive role '${role.label}'. ${holders} active user(s) are assigned to it. Reassign them first.`, 'ACTIVE_USERS_EXIST', { holders });
  }
  role.status = ROLE_STATUS.ARCHIVED;
  await role.save();
  invalidatePermissionCache();
  await recordAuditLog({ action: 'ROLE_ARCHIVED', entityType: 'ROLE', entityId: role._id, before: { status: 'ACTIVE' }, after: { status: 'ARCHIVED' }, req });
  return successResponse(res, null, `Role '${role.label}' has been safely archived.`);
});

// Permanent removal is only possible for roles that were never used (history must stay intact).
export const deleteRole = ah(async (req, res) => {
  const role = await loadEditableRole(req);
  const [holders, everAssigned] = await Promise.all([
    holdersOf(role),
    RoleHistory.countDocuments({ $or: [{ newRole: role.key }, { previousRole: role.key }], ...(role.organizationId ? { organizationId: role.organizationId } : {}) })
  ]);
  if (holders > 0) throw conflict(`${holders} active user(s) still hold this role.`, 'ROLE_IN_USE', { holders });
  if (everAssigned > 0) throw conflict('This role appears in the assignment history. Archive it instead of deleting it.', 'ROLE_HAS_HISTORY', { everAssigned });
  await role.deleteOne();
  invalidatePermissionCache();
  await recordAuditLog({ action: 'ROLE_DELETED', entityType: 'ROLE', entityId: role._id, before: { key: role.key, label: role.label }, req });
  return successResponse(res, null, `Role '${role.label}' deleted.`);
});

async function resolveRolePermissions(req, roleKey) {
  const system = ROLE_PERMISSIONS[roleKey];
  if (system) return system;
  const custom = await Role.findOne({ key: roleKey, status: 'ACTIVE', $or: [{ organizationId: req.organizationId }, { organizationId: null }] });
  return custom ? custom.permissions : null;
}

async function loadTargetUser(req, userId) {
  // Tenant isolation: a user outside the caller's organisation simply does not exist for them.
  const filter = { _id: userId };
  if (req.userRole !== ROLES.SUPER_ADMIN) filter.organizationId = req.organizationId;
  else if (req.organizationId) filter.$or = [{ organizationId: req.organizationId }, { organizationId: null }, { organizationId: { $exists: false } }];
  const user = await User.findOne(filter);
  if (!user) throw notFound('User not found');
  return user;
}

export const previewRoleChange = ah(async (req, res) => {
  const v = new Validator(req.body).objectId('userId', { required: true }).string('newRoleKey', { required: true, upper: true, max: 60 });
  const { userId, newRoleKey } = v.done();
  const user = await loadTargetUser(req, userId);
  const newPerms = await resolveRolePermissions(req, newRoleKey);
  if (!newPerms) throw unprocessable(`Role '${newRoleKey}' does not exist.`, [{ field: 'newRoleKey', message: 'Unknown role' }]);

  const currentPerms = (await resolveRolePermissions(req, user.role)) || [];
  const permissionsAdded = newPerms.filter(p => !currentPerms.includes(p));
  const permissionsRemoved = currentPerms.filter(p => !newPerms.includes(p));

  const warnings = [];
  if (user.role === ROLES.SUPER_ADMIN && newRoleKey !== ROLES.SUPER_ADMIN) {
    const superAdminCount = await User.countDocuments({ role: ROLES.SUPER_ADMIN, isActive: true });
    if (superAdminCount <= 1) warnings.push('CRITICAL: This is the ONLY active Global Administrator. Demoting will lock out platform governance.');
  }
  if (String(user._id) === String(req.userId)) warnings.push('You cannot change your own role.');

  return successResponse(res, {
    userId: user._id, userName: `${user.firstName} ${user.lastName}`, currentRole: user.role, newRole: newRoleKey,
    currentPermissions: currentPerms, newPermissions: newPerms, permissionsAdded, permissionsRemoved, warnings
  });
});

/**
 * Role assignment guards (server side, authoritative):
 *  1. target user must belong to the caller's organisation (SUPER_ADMIN excepted)
 *  2. nobody changes their OWN role (self-escalation)
 *  3. the new role must exist and be grantable by the caller (assignableBy / custom-role rules)
 *  4. the last SUPER_ADMIN / last ORGANIZATION_ADMIN cannot be demoted
 *  5. interns and supervising mentors keep their role until the dependent records are handled
 * Permissions are resolved from the role at request time, so the change is effective immediately.
 */
export const assignUserRole = ah(async (req, res) => {
  await ensureSystemRoles();
  const v = new Validator(req.body)
    .objectId('userId', { required: true })
    .string('newRoleKey', { required: true, upper: true, max: 60 })
    .string('reason', { required: true, min: 3, max: 300 })
    .date('effectiveFrom')
    .string('effectiveUntil', { max: 40 });
  const { userId, newRoleKey, reason, effectiveFrom, effectiveUntil } = v.done();

  if (effectiveUntil) throw unprocessable('Expiring role assignments are not supported. Remove the end date.', [{ field: 'effectiveUntil', message: 'Not supported' }]);
  if (effectiveFrom && effectiveFrom.getTime() > Date.now() + 24 * 3600 * 1000) {
    throw unprocessable('Future-dated role assignments are not supported. Assignments apply immediately.', [{ field: 'effectiveFrom', message: 'Must be today or earlier' }]);
  }

  const target = await loadTargetUser(req, userId);
  if (String(target._id) === String(req.userId)) throw forbidden('You cannot change your own role.', 'SELF_ROLE_CHANGE');
  if (target.role === newRoleKey) throw conflict('User already holds this role.', 'ROLE_UNCHANGED');

  // Removing SUPER_ADMIN needs a SUPER_ADMIN; granting is handled by assertCanGrantRole below.
  if (target.role === ROLES.SUPER_ADMIN && req.userRole !== ROLES.SUPER_ADMIN) throw forbidden('Only a global administrator can change a global administrator.', 'FORBIDDEN');
  if (newRoleKey === ROLES.SUPER_ADMIN) {
    if (req.userRole !== ROLES.SUPER_ADMIN) throw forbidden('Only Global Administrators can grant SUPER_ADMIN privileges.', 'PRIVILEGE_ESCALATION');
  } else {
    await assertCanGrantRole(req, newRoleKey);
  }

  if (target.role === ROLES.SUPER_ADMIN) {
    const count = await User.countDocuments({ role: ROLES.SUPER_ADMIN, isActive: true });
    if (count <= 1) throw forbidden('Operation Forbidden: Cannot remove or demote the last remaining Global Administrator.', 'LAST_SUPER_ADMIN_GUARD');
  }
  if (target.role === ROLES.ORGANIZATION_ADMIN && newRoleKey !== ROLES.ORGANIZATION_ADMIN) {
    const others = await User.countDocuments({ organizationId: target.organizationId, role: ROLES.ORGANIZATION_ADMIN, isActive: true, _id: { $ne: target._id } });
    if (others === 0) throw forbidden('Cannot demote the last active organization administrator.', 'LAST_ORG_ADMIN_GUARD');
  }
  if (target.role === ROLES.INTERN) {
    const intern = await Intern.findOne({ userId: target._id, status: { $nin: INTERN_CLOSED_STATUSES } });
    if (intern) throw conflict('This user has an active internship. Use the exit workflow instead of changing the role.', 'ACTIVE_INTERN_ACCOUNT');
  }
  const mentees = await Intern.countDocuments({ organizationId: target.organizationId, $or: [{ mentorId: target._id }, { managerId: target._id }], status: { $nin: INTERN_CLOSED_STATUSES } });
  if (mentees > 0 && !['MENTOR', 'TEAM_LEAD', 'PROGRAM_MANAGER'].includes(newRoleKey)) {
    throw conflict(`This user supervises ${mentees} active intern(s). Reassign them before changing the role.`, 'HAS_ACTIVE_MENTEES', { mentees });
  }

  const currentRole = target.role;
  const currentPerms = (await resolveRolePermissions(req, currentRole)) || [];
  const newPerms = (await resolveRolePermissions(req, newRoleKey)) || [];
  const permissionsAdded = newPerms.filter(p => !currentPerms.includes(p));
  const permissionsRemoved = currentPerms.filter(p => !newPerms.includes(p));

  target.role = newRoleKey;
  await target.save();

  await RoleAssignment.updateMany({ userId: target._id, status: 'ACTIVE' }, { $set: { status: 'REVOKED' } });
  await RoleAssignment.create({
    userId: target._id, organizationId: target.organizationId, roleKey: newRoleKey,
    effectiveFrom: effectiveFrom || new Date(), reason, assignedBy: req.userId,
    approvalStatus: 'APPROVED', approvedBy: req.userId, status: 'ACTIVE'
  });
  await RoleHistory.create({
    userId: target._id, organizationId: target.organizationId, previousRole: currentRole, newRole: newRoleKey,
    changedBy: req.userId, reason, permissionsAdded, permissionsRemoved, effectiveDate: new Date()
  });

  // Their refresh tokens are re-issued under the new role on next refresh; access checks are already dynamic.
  await Session.updateMany({ userId: target._id, isRevoked: false }, { isRevoked: true, revokedAt: new Date(), revokedReason: 'Role changed' });
  invalidatePermissionCache();

  await recordAuditLog({
    action: 'USER_ROLE_ASSIGNED', entityType: 'USER', entityId: target._id, organizationId: target.organizationId,
    before: { role: currentRole }, after: { role: newRoleKey, reason }, metadata: { permissionsAdded, permissionsRemoved }, req
  });

  return successResponse(res, { userId: target._id, role: target.role, permissions: newPerms }, `Role successfully updated to ${newRoleKey}`);
});

export const getUserRoleHistory = ah(async (req, res) => {
  const target = await loadTargetUser(req, req.params.userId);
  const history = await RoleHistory.find({ userId: target._id }).populate('changedBy', 'firstName lastName email').sort({ createdAt: -1 });
  return successResponse(res, history);
});

// exported for tests
export { hasGranted };
