import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, passwordPolicyError } from '../users/user.model.js';
import { UserInvitation } from '../users/invitation.model.js';
import { Organization } from '../organizations/organization.model.js';
import { Session } from './session.model.js';
import { env } from '../../config/env.js';
import { successResponse } from '../../utils/response.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { getOrgContext } from '../../middleware/auth.js';
import { resolvePermissions } from '../../middleware/permissions.js';
import { ROLES } from '../../../../shared/constants.js';
import { ah } from '../../utils/asyncHandler.js';
import { AppError, unauthorized, forbidden, unprocessable, conflict } from '../../utils/errors.js';
import { hashToken } from '../../utils/idGenerator.js';
import { Validator } from '../../utils/validate.js';

// Constant-time answer for unknown accounts so response timing does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password-just-timing', 10);

function orgIdOf(user) {
  return user.organizationId?._id || user.organizationId;
}

function signAccessToken(user) {
  return jwt.sign(
    { userId: user._id, email: user.email, role: user.role, organizationId: orgIdOf(user) },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
  );
}

/** Creates the token pair AND the tracked server-side session for the refresh token. */
export async function issueSession(user, req) {
  const accessToken = signAccessToken(user);
  const refreshToken = jwt.sign({ userId: user._id, jti: crypto.randomUUID() }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN });
  const { exp } = jwt.decode(refreshToken);
  await Session.create({
    userId: user._id,
    organizationId: orgIdOf(user),
    refreshTokenHash: hashToken(refreshToken),
    ipAddress: req?.ip || req?.socket?.remoteAddress || '0.0.0.0',
    userAgent: req?.headers?.['user-agent'] || 'Unknown',
    expiresAt: new Date(exp * 1000)
  });
  return { accessToken, refreshToken };
}

async function sessionPayload(user, req) {
  const { accessToken, refreshToken } = await issueSession(user, req);
  const org = await getOrgContext(orgIdOf(user));
  return {
    token: accessToken,
    refreshToken,
    user: user.toJSON(),
    permissions: await resolvePermissions(user),
    organization: org ? { name: org.name, timezone: org.timezone } : null
  };
}

export const login = ah(async (req, res) => {
  const v = new Validator(req.body);
  v.string('email', { required: true, max: 254, lower: true });
  v.string('password', { required: true, max: 200 });
  const { email, password } = v.done();

  const user = await User.findOne({ email })
    .select('+password')
    .populate('departmentId', 'name code')
    .populate('organizationId', 'name code logoUrl status');

  // Verify the password FIRST. Account state is only revealed to someone who proved they own the credentials.
  const passwordOk = user ? await user.comparePassword(password) : (await bcrypt.compare(password, DUMMY_HASH), false);
  if (!user || !passwordOk) {
    await recordAuditLog({
      organizationId: user ? orgIdOf(user) : undefined,
      actorEmail: email, action: 'USER_LOGIN_FAILED', entityType: 'User', entityId: user ? user._id : 'unknown',
      metadata: { reason: 'INVALID_CREDENTIALS' }, req
    });
    throw unauthorized('Invalid credentials provided', 'INVALID_CREDENTIALS');
  }
  if (!user.isActive) {
    if (user.approvalStatus === 'PENDING') {
      throw forbidden('Your account registration is pending administrator approval. Please wait for an administrator to review and approve your account.', 'ACCOUNT_PENDING_APPROVAL');
    }
    if (user.approvalStatus === 'REJECTED') {
      throw forbidden('Your account registration request was rejected. Please contact your administrator.', 'ACCOUNT_REJECTED');
    }
    throw forbidden('Your account is deactivated. Please contact your organization administrator.', 'ACCOUNT_INACTIVE');
  }
  if (user.role !== ROLES.SUPER_ADMIN) {
    const org = await getOrgContext(orgIdOf(user));
    if (!org || org.status !== 'ACTIVE') throw forbidden('Your organization is suspended. Please contact the platform administrator.', 'ORG_SUSPENDED');
  }

  user.lastLoginAt = new Date();
  await user.save();

  await recordAuditLog({
    organizationId: orgIdOf(user), actorId: user._id, actorEmail: user.email, actorRole: user.role,
    action: 'USER_LOGIN', entityType: 'User', entityId: user._id, req
  });

  return successResponse(res, await sessionPayload(user, req), 'Login successful');
});

export const getCurrentUser = ah(async (req, res) => {
  const user = await User.findById(req.userId)
    .populate('departmentId', 'name code')
    .populate('organizationId', 'name code logoUrl domain timezone');
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  return successResponse(res, { user: user.toJSON(), permissions: req.permissions }, 'Current user retrieved');
});

export const refreshAccessToken = ah(async (req, res) => {
  const refreshToken = req.body?.refreshToken;
  if (typeof refreshToken !== 'string' || !refreshToken) throw new AppError('Refresh token required', 400, 'TOKEN_REQUIRED');

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw unauthorized('Invalid or expired refresh token', 'INVALID_TOKEN');
  }

  const existing = await Session.findOne({ refreshTokenHash: hashToken(refreshToken), userId: decoded.userId, isRevoked: false });
  if (!existing) {
    // A rotated/revoked token was presented again: treat as replay and terminate every session of that user.
    await Session.updateMany({ userId: decoded.userId, isRevoked: false }, { isRevoked: true, revokedAt: new Date(), revokedReason: 'Suspected token reuse' });
    throw unauthorized('Session terminated: refresh token invalid or previously revoked', 'TOKEN_REVOKED');
  }

  // Atomic rotation: only one concurrent refresh can flip isRevoked from false to true.
  const rotated = await Session.findOneAndUpdate(
    { _id: existing._id, isRevoked: false },
    { isRevoked: true, revokedAt: new Date(), revokedReason: 'Token rotated' }
  );
  if (!rotated) throw unauthorized('Session terminated: refresh token invalid or previously revoked', 'TOKEN_REVOKED');

  const user = await User.findById(decoded.userId);
  if (!user || !user.isActive) throw unauthorized('User account invalid or deactivated', 'USER_INACTIVE');
  if (user.role !== ROLES.SUPER_ADMIN) {
    const org = await getOrgContext(orgIdOf(user));
    if (!org || org.status !== 'ACTIVE') throw forbidden('Your organization is suspended.', 'ORG_SUSPENDED');
  }

  const { accessToken, refreshToken: newRefreshToken } = await issueSession(user, req);
  return successResponse(res, { token: accessToken, refreshToken: newRefreshToken }, 'Token refreshed successfully');
});

export const logout = ah(async (req, res) => {
  const refreshToken = req.body?.refreshToken;
  if (typeof refreshToken === 'string' && refreshToken) {
    await Session.updateOne(
      { refreshTokenHash: hashToken(refreshToken) },
      { isRevoked: true, revokedAt: new Date(), revokedReason: 'User logout' }
    );
  }
  if (req.userId) {
    await recordAuditLog({
      organizationId: req.organizationId, actorId: req.userId, actorEmail: req.user?.email, actorRole: req.user?.role,
      action: 'USER_LOGOUT', entityType: 'User', entityId: req.userId, req
    });
  }
  return successResponse(res, {}, 'Logged out successfully');
});

export const logoutAll = ah(async (req, res) => {
  await Session.updateMany(
    { userId: req.userId, isRevoked: false },
    { isRevoked: true, revokedAt: new Date(), revokedReason: 'Logout all devices' }
  );
  await recordAuditLog({ action: 'USER_LOGOUT_ALL', entityType: 'User', entityId: req.userId, req });
  return successResponse(res, {}, 'All active sessions have been revoked');
});

export const changePassword = ah(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || !currentPassword) throw unprocessable('Current password is required', [{ field: 'currentPassword', message: 'Current password is required' }]);
  const policy = passwordPolicyError(newPassword);
  if (policy) throw unprocessable(policy, [{ field: 'newPassword', message: policy }]);
  if (newPassword === currentPassword) throw unprocessable('New password must differ from the current password', [{ field: 'newPassword', message: 'Must differ from the current password' }]);

  const user = await User.findById(req.userId).select('+password');
  if (!(await user.comparePassword(currentPassword))) {
    throw new AppError('Current password does not match', 400, 'INVALID_PASSWORD');
  }

  user.password = newPassword;
  user.mustChangePassword = false;
  await user.save();

  // Old refresh tokens die immediately; old access tokens die via the passwordChangedAt check in authenticate().
  await Session.updateMany({ userId: user._id, isRevoked: false }, { isRevoked: true, revokedAt: new Date(), revokedReason: 'Password changed' });

  await recordAuditLog({
    organizationId: user.organizationId, actorId: user._id, actorEmail: user.email, actorRole: user.role,
    action: 'PASSWORD_CHANGED', entityType: 'User', entityId: user._id, req
  });

  // Fresh tokens so THIS device stays signed in while every other device is signed out.
  const { accessToken, refreshToken } = await issueSession(user, req);
  return successResponse(res, { token: accessToken, refreshToken }, 'Password changed successfully. All other sessions have been signed out.');
});

/** Public: get invitation info for activation page verification */
export const getInvitationInfo = ah(async (req, res) => {
  const { token } = req.query || {};
  if (typeof token !== 'string' || token.length < 20) {
    throw unprocessable('A valid setup token is required', [{ field: 'token', message: 'Setup link is invalid' }]);
  }
  const tokenH = hashToken(token);
  const user = await User.findOne({
    passwordSetupTokenHash: tokenH,
    passwordSetupExpiresAt: { $gt: new Date() }
  }).populate('organizationId', 'name code logoUrl').populate('departmentId', 'name code');

  if (!user) {
    throw new AppError('This setup link is invalid or has expired. Ask your administrator for a new one.', 400, 'SETUP_TOKEN_INVALID');
  }
  if (!user.isActive) throw forbidden('Your account is deactivated.', 'ACCOUNT_INACTIVE');

  await UserInvitation.updateOne(
    { tokenHash: tokenH, status: 'SENT' },
    { $set: { status: 'OPENED' } }
  );

  return successResponse(res, {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    departmentName: user.departmentId?.name || '',
    organizationName: user.organizationId?.name || 'TechMecha Torque',
    organizationLogo: user.organizationId?.logoUrl || ''
  }, 'Invitation verified');
});

/** Public: completes an invitation (new staff account or intern provisioned by offer acceptance). */
export const setupPassword = ah(async (req, res) => {
  const { token, password } = req.body || {};
  if (typeof token !== 'string' || token.length < 20) throw unprocessable('A valid setup token is required', [{ field: 'token', message: 'Setup link is invalid' }]);
  const policy = passwordPolicyError(password);
  if (policy) throw unprocessable(policy, [{ field: 'password', message: policy }]);

  const tokenH = hashToken(token);
  const user = await User.findOne({
    passwordSetupTokenHash: tokenH,
    passwordSetupExpiresAt: { $gt: new Date() }
  }).select('+password +passwordSetupTokenHash +passwordSetupExpiresAt');
  if (!user) throw new AppError('This setup link is invalid or has expired. Ask your administrator for a new one.', 400, 'SETUP_TOKEN_INVALID');
  if (!user.isActive) throw forbidden('Your account is deactivated.', 'ACCOUNT_INACTIVE');

  user.password = password;
  user.mustChangePassword = false;
  user.passwordSetupTokenHash = undefined;
  user.passwordSetupExpiresAt = undefined;
  user.lastLoginAt = new Date();
  await user.save();

  await UserInvitation.updateOne(
    { tokenHash: tokenH },
    { $set: { status: 'ACCEPTED', acceptedAt: new Date() } }
  );

  await recordAuditLog({
    organizationId: user.organizationId, actorId: user._id, actorEmail: user.email, actorRole: user.role,
    action: 'PASSWORD_SETUP_COMPLETED', entityType: 'User', entityId: user._id, req
  });

  const populated = await User.findById(user._id).populate('departmentId', 'name code').populate('organizationId', 'name code logoUrl');
  return successResponse(res, await sessionPayload(populated, req), 'Password set. You are now signed in.');
});

export const getPublicOrganizations = ah(async (req, res) => {
  const orgs = await Organization.find({ status: 'ACTIVE' }).select('name code logoUrl').sort({ name: 1 });
  return successResponse(res, orgs, 'Active organizations retrieved');
});

export const register = ah(async (req, res) => {
  const v = new Validator(req.body);
  v.string('firstName', { required: true, max: 100 });
  v.string('lastName', { required: true, max: 100 });
  v.string('email', { required: true, max: 254, lower: true });
  v.string('password', { required: true, max: 200 });
  v.string('requestedRole', { max: 50 });
  v.string('phone', { max: 30 });
  v.string('notes', { max: 500 });
  const { firstName, lastName, email, password, requestedRole, phone, notes } = v.done();

  const policy = passwordPolicyError(password);
  if (policy) throw unprocessable(policy, [{ field: 'password', message: policy }]);

  const existing = await User.findOne({ email });
  if (existing) {
    throw conflict('An account with this email address already exists. Please sign in or use a different email.', 'EMAIL_ALREADY_EXISTS');
  }

  let org = null;
  if (req.body.organizationId) {
    org = await Organization.findById(req.body.organizationId);
  }
  if (!org) {
    org = await Organization.findOne({ status: 'ACTIVE' });
  }

  const roleToRequest = (requestedRole || ROLES.INTERN).toUpperCase();
  const validRoles = [ROLES.INTERN, ROLES.MENTOR, ROLES.HR_ADMIN, ROLES.INTERVIEWER, ROLES.ORGANIZATION_ADMIN];
  const finalRequestedRole = validRoles.includes(roleToRequest) ? roleToRequest : ROLES.INTERN;

  const newUser = await User.create({
    firstName,
    lastName,
    email,
    password,
    role: finalRequestedRole,
    requestedRole: finalRequestedRole,
    organizationId: org ? org._id : undefined,
    phone: phone || '',
    registrationNotes: notes || '',
    isActive: false,
    approvalStatus: 'PENDING'
  });

  await recordAuditLog({
    organizationId: org ? org._id : undefined,
    actorEmail: email,
    action: 'USER_REGISTERED_PENDING_APPROVAL',
    entityType: 'User',
    entityId: newUser._id,
    metadata: { requestedRole: finalRequestedRole, email },
    req
  });

  return successResponse(res, {
    user: {
      _id: newUser._id,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      email: newUser.email,
      requestedRole: newUser.requestedRole,
      approvalStatus: newUser.approvalStatus
    }
  }, 'Registration submitted successfully. Please wait for an administrator to review and approve your account.', 201);
});

