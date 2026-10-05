import mongoose from 'mongoose';
import { Organization } from './organization.model.js';
import { User } from '../users/user.model.js';
import { Intern } from '../interns/intern.model.js';
import { AuditLog } from '../audit/audit.model.js';
import { Role } from '../roles/role.model.js';
import { Session } from '../auth/session.model.js';
import { invalidateOrgCache } from '../../middleware/auth.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { emailService } from '../email/email.service.js';
import { ROLES, INTERN_STATUS } from '../../../../shared/constants.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { ah } from '../../utils/asyncHandler.js';
import { notFound, conflict, forbidden, unprocessable } from '../../utils/errors.js';
import { Validator, escapeRegex, parsePagination, isObjectId } from '../../utils/validate.js';
import { generateSecretToken, hashToken } from '../../utils/idGenerator.js';
import { env } from '../../config/env.js';
import { processUserApproval } from '../users/user.controller.js';

export const getGlobalAdminOverview = ah(async (req, res) => {
  const [totalOrgs, activeOrgs, suspendedOrgs, totalUsers, activeInterns, recentAuditEvents, totalRoles] = await Promise.all([
    Organization.countDocuments(), Organization.countDocuments({ status: 'ACTIVE' }), Organization.countDocuments({ status: 'SUSPENDED' }),
    User.countDocuments({ isActive: true }), Intern.countDocuments({ status: INTERN_STATUS.ACTIVE }),
    AuditLog.find().sort({ timestamp: -1 }).limit(10), Role.countDocuments({ status: 'ACTIVE' })
  ]);
  const memory = process.memoryUsage();
  return successResponse(res, {
    kpis: { totalOrgs, activeOrgs, suspendedOrgs, totalUsers, activeInterns, totalRoles },
    systemHealth: {
      database: mongoose.connection.readyState === 1 ? 'HEALTHY' : 'DEGRADED', databaseState: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
      uptimeSeconds: Math.floor(process.uptime()), heapUsedMB: Math.round(memory.heapUsed / 1048576), heapTotalMB: Math.round(memory.heapTotal / 1048576), environment: env.NODE_ENV
    },
    recentAuditEvents
  });
});

export const getGlobalOrganizations = ah(async (req, res) => {
  const orgs = await Organization.find().sort({ createdAt: -1 });
  const [users, interns] = await Promise.all([
    User.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$organizationId', n: { $sum: 1 } } }]),
    Intern.aggregate([{ $match: { status: INTERN_STATUS.ACTIVE } }, { $group: { _id: '$organizationId', n: { $sum: 1 } } }])
  ]);
  const uMap = new Map(users.map(u => [String(u._id), u.n]));
  const iMap = new Map(interns.map(u => [String(u._id), u.n]));
  return successResponse(res, orgs.map(o => ({ ...o.toObject(), userCount: uMap.get(String(o._id)) || 0, activeInternsCount: iMap.get(String(o._id)) || 0 })));
});

export const createOrganization = ah(async (req, res) => {
  const v = new Validator(req.body)
    .string('name', { required: true, max: 150 })
    .string('code', { required: true, upper: true, max: 12, pattern: /^[A-Z0-9]{2,12}$/, patternMessage: 'Code must be 2-12 capital letters or digits' })
    .string('domain', { max: 200 }).email('email', { required: true }).phone('phone').url('website')
    .string('timezone', { max: 60 })
    .string('adminFirstName', { max: 100 }).string('adminLastName', { max: 100 }).email('adminEmail');
  const body = v.done();

  const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (await Organization.findOne({ $or: [{ slug }, { code: body.code }] })) throw conflict('An organization with this name or code already exists.', 'ORG_EXISTS');
  if (body.adminEmail && await User.findOne({ email: body.adminEmail })) throw conflict('The administrator email already has an account.', 'EMAIL_TAKEN');
  if (body.adminEmail && (!body.adminFirstName || !body.adminLastName)) throw unprocessable('Administrator first and last name are required.', [{ field: 'adminFirstName', message: 'Required with adminEmail' }]);

  const org = await Organization.create({ name: body.name, slug, code: body.code, domain: body.domain || '', email: body.email, phone: body.phone || '', website: body.website || '', timezone: body.timezone || env.ORG_TIMEZONE, status: 'ACTIVE' });

  let setupLink = null;
  if (body.adminEmail) {
    const token = generateSecretToken();
    await User.create({
      organizationId: org._id, firstName: body.adminFirstName, lastName: body.adminLastName, email: body.adminEmail, role: ROLES.ORGANIZATION_ADMIN,
      password: generateSecretToken(24), mustChangePassword: true, passwordSetupTokenHash: hashToken(token),
      passwordSetupExpiresAt: new Date(Date.now() + env.PASSWORD_SETUP_TTL_HOURS * 3600 * 1000)
    });
    setupLink = `${env.FRONTEND_URL}/set-password?token=${token}`;
    emailService.queueEmail({ to: body.adminEmail, subject: `Your ${org.name} administrator account`, template: 'ACCOUNT_INVITATION', text: `Set your password: ${setupLink}`, organizationId: org._id });
  }
  await recordAuditLog({ organizationId: org._id, action: 'ORGANIZATION_CREATED', entityType: 'ORGANIZATION', entityId: org._id, after: { name: org.name, code: org.code, adminInvited: !!body.adminEmail }, req });
  return successResponse(res, { organization: org, setupLink }, 'Organization created successfully', 201);
});

// Suspension takes effect immediately: every session of that organisation is revoked and every request is refused (see authenticate()).
export const updateOrganizationStatus = ah(async (req, res) => {
  const v = new Validator(req.body).oneOf('status', ['ACTIVE', 'SUSPENDED', 'INACTIVE'], { required: true }).string('reason', { max: 300 });
  const { status, reason } = v.done();
  const org = await Organization.findById(req.params.id);
  if (!org) throw notFound('Organization not found');
  if (org.status === status) throw conflict(`Organization is already ${status}.`, 'NO_CHANGE');

  const before = org.status;
  org.status = status;
  await org.save();
  invalidateOrgCache(org._id);
  let revoked = 0;
  if (status !== 'ACTIVE') {
    const res2 = await Session.updateMany({ organizationId: org._id, isRevoked: false }, { isRevoked: true, revokedAt: new Date(), revokedReason: `Organization ${status}` });
    revoked = res2.modifiedCount;
  }
  await recordAuditLog({ organizationId: org._id, action: 'ORGANIZATION_STATUS_CHANGED', entityType: 'ORGANIZATION', entityId: org._id, before: { status: before }, after: { status, reason: reason || 'Administrative action', sessionsRevoked: revoked }, req });
  return successResponse(res, org, `Organization status updated to ${status}`);
});

export const getGlobalUsers = ah(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 200 });
  const query = {};
  if (isObjectId(req.query.organizationId)) query.organizationId = req.query.organizationId;
  if (req.query.role) query.role = String(req.query.role).toUpperCase();
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(String(req.query.search).slice(0, 80)), 'i');
    query.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }];
  }
  const [users, total] = await Promise.all([
    User.find(query).populate('organizationId', 'name code').populate('departmentId', 'name code').sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(query)
  ]);
  return paginatedResponse(res, users, { page, limit, total });
});

export const updateUserAccountStatus = ah(async (req, res) => {
  const { isActive, reason } = new Validator(req.body).boolean('isActive', { required: true }).string('reason', { max: 300 }).done();
  const target = await User.findById(req.params.id);
  if (!target) throw notFound('User not found');
  if (String(target._id) === String(req.userId) && !isActive) throw forbidden('You cannot deactivate your own account.', 'SELF_DEACTIVATION');
  if (target.role === ROLES.SUPER_ADMIN && !isActive && (await User.countDocuments({ role: ROLES.SUPER_ADMIN, isActive: true })) <= 1) {
    throw forbidden('Cannot deactivate the last active Global Administrator.', 'LAST_SUPER_ADMIN_GUARD');
  }
  if (target.isActive === isActive) throw conflict(`User is already ${isActive ? 'active' : 'inactive'}.`, 'NO_CHANGE');

  target.isActive = isActive;
  target.deletedAt = isActive ? null : new Date();
  await target.save();
  if (!isActive) await Session.updateMany({ userId: target._id, isRevoked: false }, { isRevoked: true, revokedAt: new Date(), revokedReason: 'Account deactivated by global administrator' });
  await recordAuditLog({ organizationId: target.organizationId, action: isActive ? 'USER_REACTIVATED' : 'USER_DEACTIVATED', entityType: 'USER', entityId: target._id, before: { isActive: !isActive }, after: { isActive, reason: reason || 'Administrative action' }, req });
  return successResponse(res, { _id: target._id, isActive: target.isActive }, `User account has been ${isActive ? 'activated' : 'deactivated'}.`);
});

export const createGlobalUser = ah(async (req, res) => {
  const v = new Validator(req.body);
  v.string('firstName', { required: true, max: 100 })
    .string('lastName', { required: true, max: 100 })
    .email('email', { required: true })
    .string('role', { required: true, upper: true, max: 60 })
    .phone('phone')
    .objectId('organizationId')
    .objectId('departmentId');
  const body = v.done();

  let orgId = body.organizationId || null;
  if (!orgId && body.role !== ROLES.SUPER_ADMIN) {
    throw unprocessable('An organization must be selected for non-platform users.', [{ field: 'organizationId', message: 'Organization is required' }]);
  }

  const existing = await User.findOne({ email: body.email.toLowerCase() });
  if (existing) {
    throw conflict('A user account with this email address already exists.', 'EMAIL_TAKEN');
  }

  const setupToken = generateSecretToken(32);
  const user = await User.create({
    organizationId: orgId,
    departmentId: body.departmentId || null,
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email.toLowerCase(),
    phone: body.phone || '',
    role: body.role,
    password: req.body.password || generateSecretToken(24),
    mustChangePassword: !req.body.password,
    isActive: true,
    passwordSetupTokenHash: hashToken(setupToken),
    passwordSetupExpiresAt: new Date(Date.now() + env.PASSWORD_SETUP_TTL_HOURS * 3600 * 1000)
  });

  const setupLink = `${env.FRONTEND_URL}/set-password?token=${setupToken}&email=${encodeURIComponent(user.email)}`;
  emailService.queueEmail({
    to: user.email,
    subject: 'Welcome to TechMecha Torque - Set up your password',
    template: 'USER_INVITATION',
    text: `Hello ${user.firstName}, your account with role ${user.role} has been created. Set up your password here: ${setupLink}`,
    organizationId: orgId
  });

  await recordAuditLog({
    organizationId: orgId,
    action: 'USER_CREATED',
    entityType: 'User',
    entityId: user._id,
    after: { email: user.email, role: user.role, organizationId: orgId },
    req
  });

  return successResponse(res, {
    user: { _id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, organizationId: orgId, isActive: true },
    setupLink
  }, 'User created successfully', 201);
});

export const getGlobalPendingRegistrations = ah(async (req, res) => {
  const users = await User.find({ approvalStatus: 'PENDING' })
    .populate('departmentId', 'name code')
    .populate('organizationId', 'name code')
    .sort({ createdAt: -1 });
  return successResponse(res, users, 'Global pending registrations retrieved');
});

export const approveGlobalRegistration = ah(async (req, res) => {
  const user = await User.findById(req.params.id);
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

export const rejectGlobalRegistration = ah(async (req, res) => {
  const user = await User.findById(req.params.id);
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

