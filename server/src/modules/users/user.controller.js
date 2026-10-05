import { User } from './user.model.js';
import { UserInvitation } from './invitation.model.js';
import { Role } from '../roles/role.model.js';
import { Intern } from '../interns/intern.model.js';
import { Session } from '../auth/session.model.js';
import { Department } from '../organizations/organization.model.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { ROLES, ROLE_DEFINITIONS, INTERN_STATUS, ONBOARDING_STATUS } from '../../../../shared/constants.js';
import { INTERN_CLOSED_STATUSES } from '../../../../shared/lifecycle.js';
import { ah } from '../../utils/asyncHandler.js';
import { notFound, conflict, forbidden, unprocessable } from '../../utils/errors.js';
import { Validator, escapeRegex, parsePagination, isObjectId } from '../../utils/validate.js';
import { generateId, generateSecretToken, hashToken } from '../../utils/idGenerator.js';
import { env } from '../../config/env.js';
import { emailService } from '../email/email.service.js';
import { InternshipProgram } from '../recruitment/recruitment.model.js';
import { OnboardingPlan, OnboardingTask, DEFAULT_ONBOARDING_TASKS } from '../onboarding/onboarding.model.js';

const SAFE_FIELDS = 'firstName lastName email role phone departmentId isActive lastLoginAt createdAt';

/**
 * Which role keys may `req.user` hand out? System roles follow ROLE_DEFINITIONS[role].assignableBy.
 * Custom roles are assignable by SUPER_ADMIN and ORGANIZATION_ADMIN only.
 * SUPER_ADMIN can only be granted by a SUPER_ADMIN. INTERN and CANDIDATE are never created by hand:
 * an intern exists only because an offer was accepted (which also creates the Intern engagement).
 */
export async function assertCanGrantRole(req, roleKey) {
  const requester = req.userRole;
  if (roleKey === ROLES.INTERN || roleKey === ROLES.CANDIDATE) {
    throw unprocessable(`The ${roleKey} role cannot be assigned manually. Interns are provisioned by offer acceptance.`, [{ field: 'role', message: 'Not assignable' }]);
  }
  const system = ROLE_DEFINITIONS[roleKey];
  if (system) {
    if (requester !== ROLES.SUPER_ADMIN && !system.assignableBy.includes(requester)) {
      throw forbidden(`Your role (${requester}) is not allowed to grant ${roleKey}.`, 'ROLE_NOT_ASSIGNABLE');
    }
    return { key: roleKey, isSystem: true };
  }
  const custom = await Role.findOne({
    key: roleKey,
    status: 'ACTIVE',
    $or: [{ organizationId: req.organizationId }, { organizationId: null }]
  });
  if (!custom) throw unprocessable(`Role '${roleKey}' does not exist or is not active.`, [{ field: 'role', message: 'Unknown role' }]);
  if (requester !== ROLES.SUPER_ADMIN && requester !== ROLES.ORGANIZATION_ADMIN) {
    throw forbidden('Only organization administrators may grant custom roles.', 'ROLE_NOT_ASSIGNABLE');
  }
  return { key: roleKey, isSystem: false, role: custom };
}

export const getUsers = ah(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 200 });
  const query = { organizationId: req.organizationId };

  // Inactive accounts are only visible to people allowed to manage users.
  if (req.query.includeInactive === 'true' && req.can('users.manage')) {
    // no isActive filter
  } else {
    query.isActive = true;
  }
  if (req.query.role) query.role = String(req.query.role).toUpperCase();
  if (isObjectId(req.query.departmentId)) query.departmentId = req.query.departmentId;
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(String(req.query.search).slice(0, 80)), 'i');
    query.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }];
  }

  const [users, total] = await Promise.all([
    User.find(query).select(SAFE_FIELDS).populate('departmentId', 'name code').sort({ firstName: 1, lastName: 1 }).skip(skip).limit(limit),
    User.countDocuments(query)
  ]);
  return paginatedResponse(res, users, { page, limit, total });
});

export const createUser = ah(async (req, res) => {
  const v = new Validator(req.body);
  v.string('firstName', { required: true, max: 100 })
    .string('lastName', { required: true, max: 100 })
    .email('email', { required: true })
    .string('role', { required: true, upper: true, max: 60 })
    .phone('phone')
    .objectId('departmentId');
  const body = v.done();

  await assertCanGrantRole(req, body.role);

  if (body.departmentId) {
    const dept = await Department.findOne({ _id: body.departmentId, organizationId: req.organizationId, isActive: true });
    if (!dept) throw unprocessable('Department not found in your organization', [{ field: 'departmentId', message: 'Unknown department' }]);
  }
  if (await User.findOne({ email: body.email })) {
    throw conflict('A user with this email already exists.', 'EMAIL_TAKEN');
  }

  // No password is ever chosen by the administrator. The invitee sets their own through a single-use link.
  const setupToken = generateSecretToken();
  const user = await User.create({
    organizationId: req.organizationId,
    departmentId: body.departmentId,
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    role: body.role,
    phone: body.phone || '',
    password: generateSecretToken(24), // unguessable placeholder; replaced when the invite is redeemed
    mustChangePassword: true,
    passwordSetupTokenHash: hashToken(setupToken),
    passwordSetupExpiresAt: new Date(Date.now() + env.PASSWORD_SETUP_TTL_HOURS * 3600 * 1000),
    isActive: true
  });

  const setupLink = `${env.FRONTEND_URL}/set-password?token=${setupToken}`;

  await UserInvitation.create({
    organizationId: req.organizationId,
    email: user.email,
    userId: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    departmentId: user.departmentId,
    role: user.role,
    tokenHash: hashToken(setupToken),
    expiresAt: user.passwordSetupExpiresAt,
    status: 'SENT',
    invitedBy: req.userId
  });

  emailService.queueEmail({
    to: user.email,
    subject: 'Your TechMecha Torque IMS account invitation',
    template: 'ACCOUNT_INVITATION',
    text: `Hello ${user.firstName}, an account was created for you. Set your password here: ${setupLink}`,
    organizationId: req.organizationId
  });

  await recordAuditLog({
    action: 'USER_CREATED', entityType: 'User', entityId: user._id,
    after: { email: user.email, role: user.role }, req
  });

  return successResponse(res, { user: user.toJSON(), setupLink, invitationLink: setupLink }, 'User invited successfully', 201);
});

export const updateUser = ah(async (req, res) => {
  const target = await User.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!target) throw notFound('User not found');

  const v = new Validator(req.body);
  v.string('firstName', { max: 100 }).string('lastName', { max: 100 }).phone('phone').objectId('departmentId');
  const body = v.done();
  if (body.departmentId) {
    const dept = await Department.findOne({ _id: body.departmentId, organizationId: req.organizationId, isActive: true });
    if (!dept) throw unprocessable('Department not found in your organization', [{ field: 'departmentId', message: 'Unknown department' }]);
  }

  const before = { firstName: target.firstName, lastName: target.lastName, phone: target.phone, departmentId: target.departmentId };
  Object.assign(target, body);
  await target.save();
  await recordAuditLog({ action: 'USER_UPDATED', entityType: 'User', entityId: target._id, before, after: body, req });
  return successResponse(res, target.toJSON(), 'User updated successfully');
});

async function assertSafeToDeactivate(req, target) {
  if (String(target._id) === String(req.userId)) throw forbidden('You cannot deactivate your own account.', 'SELF_DEACTIVATION');
  if (target.role === ROLES.SUPER_ADMIN) throw forbidden('Global administrators are managed from the Global Command Center.', 'FORBIDDEN');

  // Mentors with active mentees must hand them over first (no silent orphaning).
  const menteeCount = await Intern.countDocuments({
    organizationId: req.organizationId,
    $or: [{ mentorId: target._id }, { managerId: target._id }],
    status: { $nin: INTERN_CLOSED_STATUSES }
  });
  if (menteeCount > 0) {
    throw conflict(`This user supervises ${menteeCount} active intern(s). Reassign them before deactivating the account.`, 'HAS_ACTIVE_MENTEES', { menteeCount });
  }
  if (target.role === ROLES.INTERN) {
    const intern = await Intern.findOne({ userId: target._id, status: { $nin: INTERN_CLOSED_STATUSES } });
    if (intern) throw conflict('Active interns are deactivated through the exit workflow, not from the user list.', 'ACTIVE_INTERN_ACCOUNT');
  }
  if (target.role === ROLES.ORGANIZATION_ADMIN) {
    const others = await User.countDocuments({ organizationId: req.organizationId, role: ROLES.ORGANIZATION_ADMIN, isActive: true, _id: { $ne: target._id } });
    if (others === 0) throw conflict('This is the last active organization administrator.', 'LAST_ORG_ADMIN');
  }
}

export const deactivateUser = ah(async (req, res) => {
  const target = await User.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!target) throw notFound('User not found');
  if (!target.isActive) throw conflict('User is already deactivated.', 'ALREADY_INACTIVE');
  await assertSafeToDeactivate(req, target);

  target.isActive = false;
  target.deletedAt = new Date();
  await target.save();
  await Session.updateMany({ userId: target._id, isRevoked: false }, { isRevoked: true, revokedAt: new Date(), revokedReason: 'Account deactivated' });
  await recordAuditLog({ action: 'USER_DEACTIVATED', entityType: 'User', entityId: target._id, before: { isActive: true }, after: { isActive: false, reason: req.body?.reason || '' }, req });
  return successResponse(res, target.toJSON(), 'User deactivated');
});

export const reactivateUser = ah(async (req, res) => {
  const target = await User.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!target) throw notFound('User not found');
  if (target.isActive) throw conflict('User is already active.', 'ALREADY_ACTIVE');
  target.isActive = true;
  target.deletedAt = null;
  await target.save();
  await recordAuditLog({ action: 'USER_REACTIVATED', entityType: 'User', entityId: target._id, before: { isActive: false }, after: { isActive: true }, req });
  return successResponse(res, target.toJSON(), 'User reactivated');
});

/** Shared helper to approve and provision a user account */
export async function processUserApproval({ user, role, departmentId, actor, req }) {
  const targetRole = role || user.requestedRole || user.role || ROLES.INTERN;
  user.role = targetRole;
  user.approvalStatus = 'APPROVED';
  user.isActive = true;
  if (departmentId) user.departmentId = departmentId;
  await user.save();

  // If role is INTERN and no Intern profile exists yet, automatically provision one
  if (targetRole === ROLES.INTERN) {
    let intern = await Intern.findOne({ userId: user._id });
    if (!intern) {
      const internId = await generateId('INT');
      let defaultProgram = await InternshipProgram.findOne({ organizationId: user.organizationId, status: 'ACTIVE' });
      if (!defaultProgram) {
        defaultProgram = await InternshipProgram.findOne({ status: 'ACTIVE' }) || await InternshipProgram.findOne({});
      }
      let targetDeptId = user.departmentId || defaultProgram?.departmentId;
      if (!targetDeptId) {
        const dept = await Department.findOne({ organizationId: user.organizationId }) || await Department.findOne({});
        targetDeptId = dept?._id;
      }
      const startDate = new Date();
      const expectedEndDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      intern = await Intern.create({
        internId,
        userId: user._id,
        organizationId: user.organizationId,
        departmentId: targetDeptId,
        programId: defaultProgram?._id,
        workMode: 'REMOTE',
        startDate,
        expectedEndDate,
        status: INTERN_STATUS.ONBOARDING
      });

      const plan = await OnboardingPlan.create({
        organizationId: user.organizationId,
        internId: intern._id,
        status: ONBOARDING_STATUS.IN_PROGRESS,
        progress: 0
      });

      await OnboardingTask.insertMany(DEFAULT_ONBOARDING_TASKS.map(t => ({
        ...t,
        onboardingPlanId: plan._id,
        organizationId: user.organizationId,
        status: ONBOARDING_STATUS.PENDING,
        dueDate: startDate
      })));
    }
  }

  await recordAuditLog({
    organizationId: user.organizationId,
    actorId: actor?._id,
    actorEmail: actor?.email,
    actorRole: actor?.role,
    action: 'USER_REGISTRATION_APPROVED',
    entityType: 'User',
    entityId: user._id,
    metadata: { approvedRole: targetRole },
    req
  });

  return user;
}

export const getPendingRegistrations = ah(async (req, res) => {
  const query = { approvalStatus: 'PENDING' };
  if (req.organizationId && req.userRole !== ROLES.SUPER_ADMIN) {
    query.organizationId = req.organizationId;
  }
  const users = await User.find(query)
    .populate('departmentId', 'name code')
    .populate('organizationId', 'name code')
    .sort({ createdAt: -1 });
  return successResponse(res, users, 'Pending registrations retrieved');
});

export const approveRegistration = ah(async (req, res) => {
  const query = { _id: req.params.id };
  if (req.organizationId && req.userRole !== ROLES.SUPER_ADMIN) {
    query.organizationId = req.organizationId;
  }
  const user = await User.findOne(query);
  if (!user) throw notFound('User not found');
  if (user.approvalStatus !== 'PENDING') {
    throw conflict(`This user registration is already ${user.approvalStatus.toLowerCase()}.`, 'REGISTRATION_ALREADY_PROCESSED');
  }

  const role = req.body?.role || user.requestedRole || ROLES.INTERN;
  const departmentId = req.body?.departmentId || user.departmentId;

  const approved = await processUserApproval({
    user,
    role,
    departmentId,
    actor: req.user,
    req
  });

  return successResponse(res, approved.toJSON(), 'User registration approved and activated');
});

export const rejectRegistration = ah(async (req, res) => {
  const query = { _id: req.params.id };
  if (req.organizationId && req.userRole !== ROLES.SUPER_ADMIN) {
    query.organizationId = req.organizationId;
  }
  const user = await User.findOne(query);
  if (!user) throw notFound('User not found');
  if (user.approvalStatus !== 'PENDING') {
    throw conflict(`This user registration is already ${user.approvalStatus.toLowerCase()}.`, 'REGISTRATION_ALREADY_PROCESSED');
  }

  user.approvalStatus = 'REJECTED';
  user.isActive = false;
  await user.save();

  await recordAuditLog({
    organizationId: user.organizationId,
    actorId: req.user?._id,
    actorEmail: req.user?.email,
    actorRole: req.user?.role,
    action: 'USER_REGISTRATION_REJECTED',
    entityType: 'User',
    entityId: user._id,
    metadata: { reason: req.body?.reason || '' },
    req
  });

  return successResponse(res, user.toJSON(), 'User registration rejected');
});


