import { Organization, Department } from './organization.model.js';
import { User } from '../users/user.model.js';
import { Intern } from '../interns/intern.model.js';
import { InternshipOpening, InternshipProgram } from '../recruitment/recruitment.model.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { invalidateOrgCache } from '../../middleware/auth.js';
import { INTERN_CLOSED_STATUSES } from '../../../../shared/lifecycle.js';
import { ah } from '../../utils/asyncHandler.js';
import { notFound, conflict, unprocessable } from '../../utils/errors.js';
import { Validator, parsePagination } from '../../utils/validate.js';

function isValidTimezone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const getOrganizations = ah(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 200 });
  const [orgs, total] = await Promise.all([
    Organization.find().sort({ name: 1 }).skip(skip).limit(limit),
    Organization.countDocuments()
  ]);
  return paginatedResponse(res, orgs, { page, limit, total });
});

export const getCurrentOrganization = ah(async (req, res) => {
  const org = await Organization.findById(req.organizationId);
  if (!org) throw notFound('Organization not found');
  return successResponse(res, org);
});

// Only these profile fields are editable. code, slug and status are platform-controlled
// (status changes go through the Global Command Center and take effect immediately).
export const updateOrganization = ah(async (req, res) => {
  const org = await Organization.findById(req.organizationId);
  if (!org) throw notFound('Organization not found');

  const v = new Validator(req.body);
  v.string('name', { max: 150 })
    .string('domain', { max: 200 })
    .email('email')
    .phone('phone')
    .url('website')
    .url('logoUrl')
    .string('timezone', { max: 60 });
  const body = v.done();
  if (body.timezone && !isValidTimezone(body.timezone)) {
    throw unprocessable('Unknown timezone', [{ field: 'timezone', message: 'Use an IANA timezone such as Asia/Kolkata' }]);
  }
  const extra = {};
  if (req.body?.signatory && typeof req.body.signatory === 'object') {
    const sv = new Validator(req.body.signatory).string('name', { max: 150 }).string('title', { max: 150 });
    extra.signatory = { ...org.signatory?.toObject?.() ?? org.signatory ?? {}, ...sv.done() };
  }
  if (req.body?.address && typeof req.body.address === 'object') {
    const av = new Validator(req.body.address)
      .string('street', { max: 200 }).string('city', { max: 100 }).string('state', { max: 100 })
      .string('country', { max: 100 }).string('zipCode', { max: 20 });
    extra.address = { ...org.address?.toObject?.() ?? org.address ?? {}, ...av.done() };
  }

  const before = org.toObject();
  Object.assign(org, body, extra);
  await org.save();
  invalidateOrgCache(org._id);

  await recordAuditLog({ action: 'ORGANIZATION_UPDATED', entityType: 'Organization', entityId: org._id, before, after: org.toObject(), req });
  return successResponse(res, org, 'Organization settings updated successfully');
});

// ---------------------------------------------------------------------------
// Departments: create / read / update / archive / restore (never hard delete: interns, openings and users point at them)
// ---------------------------------------------------------------------------
async function assertHeadOfDepartment(req, userId) {
  if (!userId) return;
  const head = await User.findOne({ _id: userId, organizationId: req.organizationId, isActive: true });
  if (!head) throw unprocessable('Head of department must be an active user in your organization', [{ field: 'headOfDepartment', message: 'Unknown user' }]);
}

export const getDepartments = ah(async (req, res) => {
  const query = { organizationId: req.organizationId };
  if (req.query.includeArchived !== 'true') query.isActive = true;
  const departments = await Department.find(query)
    .populate('headOfDepartment', 'firstName lastName email')
    .sort({ name: 1 });
  return successResponse(res, departments);
});

export const createDepartment = ah(async (req, res) => {
  const v = new Validator(req.body);
  v.string('name', { required: true, max: 120 })
    .string('code', { required: true, upper: true, max: 12, pattern: /^[A-Z0-9_-]{2,12}$/, patternMessage: 'Code must be 2-12 letters, digits, - or _' })
    .string('description', { max: 500 })
    .objectId('headOfDepartment');
  const body = v.done();
  await assertHeadOfDepartment(req, body.headOfDepartment);

  const dept = await Department.create({ organizationId: req.organizationId, ...body });
  await recordAuditLog({ action: 'DEPARTMENT_CREATED', entityType: 'Department', entityId: dept._id, after: dept.toObject(), req });
  return successResponse(res, dept, 'Department created successfully', 201);
});

export const updateDepartment = ah(async (req, res) => {
  const dept = await Department.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!dept) throw notFound('Department not found');

  const v = new Validator(req.body);
  v.string('name', { max: 120 })
    .string('code', { upper: true, max: 12, pattern: /^[A-Z0-9_-]{2,12}$/, patternMessage: 'Code must be 2-12 letters, digits, - or _' })
    .string('description', { max: 500, allowEmpty: true })
    .objectId('headOfDepartment');
  const body = v.done();
  await assertHeadOfDepartment(req, body.headOfDepartment);

  const before = dept.toObject();
  Object.assign(dept, body);
  await dept.save();
  await recordAuditLog({ action: 'DEPARTMENT_UPDATED', entityType: 'Department', entityId: dept._id, before, after: dept.toObject(), req });
  return successResponse(res, dept, 'Department updated successfully');
});

export const archiveDepartment = ah(async (req, res) => {
  const dept = await Department.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!dept) throw notFound('Department not found');
  if (!dept.isActive) throw conflict('Department is already archived.', 'ALREADY_ARCHIVED');

  const [openings, programs, interns, users] = await Promise.all([
    InternshipOpening.countDocuments({ organizationId: req.organizationId, departmentId: dept._id, status: { $ne: 'CLOSED' } }),
    InternshipProgram.countDocuments({ organizationId: req.organizationId, departmentId: dept._id, isActive: true }),
    Intern.countDocuments({ organizationId: req.organizationId, departmentId: dept._id, status: { $nin: INTERN_CLOSED_STATUSES } }),
    User.countDocuments({ organizationId: req.organizationId, departmentId: dept._id, isActive: true })
  ]);
  if (openings || programs || interns || users) {
    throw conflict(
      'This department is still in use. Close its openings, archive its programs and reassign its people first.',
      'DEPARTMENT_IN_USE', { openings, programs, interns, users }
    );
  }
  dept.isActive = false;
  dept.archivedAt = new Date();
  await dept.save();
  await recordAuditLog({ action: 'DEPARTMENT_ARCHIVED', entityType: 'Department', entityId: dept._id, req });
  return successResponse(res, dept, 'Department archived');
});

export const restoreDepartment = ah(async (req, res) => {
  const dept = await Department.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!dept) throw notFound('Department not found');
  if (dept.isActive) throw conflict('Department is already active.', 'ALREADY_ACTIVE');
  dept.isActive = true;
  dept.archivedAt = undefined;
  await dept.save();
  await recordAuditLog({ action: 'DEPARTMENT_RESTORED', entityType: 'Department', entityId: dept._id, req });
  return successResponse(res, dept, 'Department restored');
});
