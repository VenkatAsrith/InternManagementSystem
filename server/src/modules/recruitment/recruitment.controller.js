import crypto from 'crypto';
import fs from 'fs';
import { InternshipProgram, InternshipOpening, Candidate, Application } from './recruitment.model.js';
import { Interview } from '../interviews/interview.model.js';
import { Offer } from '../offers/offer.model.js';
import { Department } from '../organizations/organization.model.js';
import { User } from '../users/user.model.js';
import { Intern } from '../interns/intern.model.js';
import { generateId } from '../../utils/idGenerator.js';
import { storageService } from '../../utils/storage.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { createNotification } from '../notifications/notification.service.js';
import { emailService } from '../email/email.service.js';
import { APPLICATION_STATUS, INTERVIEW_STATUS, ROLES } from '../../../../shared/constants.js';
import { INTERN_CLOSED_STATUSES } from '../../../../shared/lifecycle.js';
import { moveApplication, closePipelineDependents } from './application.service.js';
import { ah } from '../../utils/asyncHandler.js';
import { AppError, notFound, conflict, unprocessable } from '../../utils/errors.js';
import { Validator, escapeRegex, parsePagination, isObjectId } from '../../utils/validate.js';
import { env } from '../../config/env.js';
import { toDay, addDays } from '../../utils/time.js';

const slugify = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'item';

async function uniqueSlug(Model, base, orgId) {
  for (let i = 0; i < 10; i++) {
    const candidate = `${slugify(base)}-${crypto.randomBytes(3).toString('hex')}`;
    const clash = await Model.findOne(orgId ? { organizationId: orgId, slug: candidate } : { slug: candidate });
    if (!clash) return candidate;
  }
  throw new AppError('Could not generate a unique slug', 500, 'SLUG_GENERATION_FAILED');
}

// ===========================================================================
// PUBLIC ENDPOINTS (no login)
// ===========================================================================

export const getPublicOpenings = ah(async (req, res) => {
  const query = { status: 'OPEN', deadline: { $gte: new Date() } };
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 80)), 'i');
    query.$or = [{ title: rx }, { description: rx }, { requiredSkills: rx }];
  }
  const openings = await InternshipOpening.find(query)
    .select('-createdBy -organizationId.address')
    .populate('organizationId', 'name logoUrl')
    .populate('departmentId', 'name code')
    .sort({ createdAt: -1 })
    .limit(100);
  return successResponse(res, openings);
});

export const getPublicOpeningBySlug = ah(async (req, res) => {
  const opening = await InternshipOpening.findOne({ slug: String(req.params.slug), status: 'OPEN', deadline: { $gte: new Date() } })
    .select('-createdBy')
    .populate('organizationId', 'name logoUrl website')
    .populate('departmentId', 'name code')
    .populate('programId', 'title durationDays');
  if (!opening) throw notFound('Internship opening not found, closed or past its deadline', 'OPENING_NOT_AVAILABLE');
  return successResponse(res, opening);
});

const APPLICATION_ID_RE = /^APP-\d{4}-\d{6}$/;

export const submitPublicApplication = ah(async (req, res) => {
  const thisYear = new Date().getFullYear();
  const v = new Validator(req.body);
  v.objectId('openingId', { required: true })
    .string('firstName', { required: true, max: 100 })
    .string('lastName', { required: true, max: 100 })
    .email('email', { required: true })
    .phone('phone', { required: true })
    .string('city', { max: 100 }).string('state', { max: 100 }).string('country', { max: 100 })
    .string('college', { required: true, max: 200 })
    .string('degree', { required: true, max: 100 })
    .string('branch', { required: true, max: 100 })
    .number('graduationYear', { required: true, integer: true, min: 1990, max: thisYear + 8 })
    .string('cgpa', { max: 20 })
    .stringList('technicalSkills', { max: 40 })
    .stringList('softSkills', { max: 40 })
    .url('github').url('linkedin').url('portfolio')
    .string('coverLetter', { max: 3000 })
    .date('preferredStartDate')
    .boolean('privacyConsent', { required: true });
  const body = v.done();
  if (body.privacyConsent !== true) {
    throw unprocessable('You must accept the data-processing declaration to apply.', [{ field: 'privacyConsent', message: 'Consent is required' }]);
  }

  const opening = await InternshipOpening.findById(body.openingId);
  if (!opening || opening.status !== 'OPEN' || opening.deadline < new Date()) {
    throw conflict('The specified internship opening is not currently open for applications.', 'OPENING_CLOSED');
  }

  // 1) Duplicate check BEFORE anything is written or stored.
  const existingCandidate = await Candidate.findOne({ organizationId: opening.organizationId, email: body.email });
  if (existingCandidate) {
    const dup = await Application.findOne({ openingId: opening._id, candidateId: existingCandidate._id, activeKey: { $exists: true } });
    if (dup) {
      throw conflict('An application for this position already exists for this email address. Use "Track Application" with your Application ID.', 'DUPLICATE_APPLICATION');
    }
  }

  // 2) Store the resume (already signature-verified by the upload middleware).
  let stored = null;
  if (req.file) {
    stored = await storageService.saveFile({
      buffer: req.file.buffer, originalName: req.file.originalname, mimeType: req.file.mimetype,
      subDir: `applications/${opening.organizationId}`
    });
  }

  let application;
  let candidate = existingCandidate;
  try {
    // 3) Candidate: create once. An anonymous submitter can NEVER overwrite an existing person's record.
    if (!candidate) {
      candidate = await Candidate.create({
        organizationId: opening.organizationId,
        firstName: body.firstName, lastName: body.lastName, email: body.email, phone: body.phone,
        city: body.city || '', state: body.state || '', country: body.country || '',
        education: { college: body.college, degree: body.degree, branch: body.branch, graduationYear: body.graduationYear, cgpa: body.cgpa || '' },
        technicalSkills: body.technicalSkills || [], softSkills: body.softSkills || [],
        github: body.github || '', linkedin: body.linkedin || '', portfolio: body.portfolio || ''
      });
    }

    const applicationId = await generateId('APP');
    application = await Application.create({
      applicationId,
      organizationId: opening.organizationId,
      openingId: opening._id,
      candidateId: candidate._id,
      status: APPLICATION_STATUS.APPLIED,
      resumePath: stored?.filePath || '',
      resumeOriginalName: stored?.originalName || '',
      resumeMimeType: stored?.mimeType || '',
      coverLetter: body.coverLetter || '',
      preferredStartDate: body.preferredStartDate,
      privacyConsent: true,
      privacyConsentAt: new Date(),
      timeline: [{ stage: APPLICATION_STATUS.APPLIED, note: 'Application submitted through the public portal.', timestamp: new Date() }]
    });
  } catch (err) {
    if (stored) await storageService.deleteFile(stored.filePath).catch(() => {});
    if (err?.code === 11000) {
      throw conflict('An application for this position already exists for this email address.', 'DUPLICATE_APPLICATION');
    }
    throw err;
  }

  // 4) Side effects (never fail the request).
  const recipients = await User.find({
    organizationId: opening.organizationId, isActive: true,
    role: { $in: [ROLES.HR_ADMIN, ROLES.HR_RECRUITER, ROLES.ORGANIZATION_ADMIN] }
  }).select('_id');
  await Promise.all(recipients.map(u => createNotification({
    organizationId: opening.organizationId, recipientId: u._id, type: 'APPLICATION_RECEIVED',
    title: 'New Candidate Application',
    message: `${candidate.firstName} ${candidate.lastName} applied for ${opening.title} (${application.applicationId}).`,
    entityType: 'Application', entityId: application._id
  })));
  emailService.queueEmail({
    to: candidate.email, subject: `We received your application (${application.applicationId})`, template: 'APPLICATION_CONFIRMATION',
    text: `Hi ${candidate.firstName}, thank you for applying for ${opening.title}. Your Application ID is ${application.applicationId}. Track it at ${env.FRONTEND_URL}/application/status?id=${application.applicationId}`,
    organizationId: opening.organizationId
  });
  await recordAuditLog({
    organizationId: opening.organizationId, actorEmail: candidate.email, actorRole: ROLES.CANDIDATE,
    action: 'APPLICATION_SUBMITTED', entityType: 'Application', entityId: application._id,
    after: { applicationId: application.applicationId, openingTitle: opening.title }, req
  });

  return successResponse(res, {
    applicationId: application.applicationId,
    candidateName: `${candidate.firstName} ${candidate.lastName}`,
    openingTitle: opening.title,
    submittedAt: application.createdAt
  }, 'Application submitted successfully!', 201);
});

export const getPublicApplicationStatus = ah(async (req, res) => {
  const applicationId = String(req.params.applicationId || '').trim().toUpperCase();
  if (!APPLICATION_ID_RE.test(applicationId)) throw notFound('Application not found with the provided identifier', 'APPLICATION_NOT_FOUND');
  const app = await Application.findOne({ applicationId })
    .populate('openingId', 'title duration workMode location')
    .populate('organizationId', 'name logoUrl');
  if (!app) throw notFound('Application not found with the provided identifier', 'APPLICATION_NOT_FOUND');

  // Only stage names and dates are public. Internal notes, actors and scores are never exposed.
  return successResponse(res, {
    applicationId: app.applicationId,
    opening: app.openingId,
    organization: app.organizationId,
    status: app.status,
    appliedDate: app.createdAt,
    timeline: app.timeline.map(t => ({ stage: t.stage, timestamp: t.timestamp }))
  });
});

// ===========================================================================
// PROGRAMS
// ===========================================================================
const programValidator = (body, { create = false } = {}) => new Validator(body)
  .string('title', { required: create, max: 150 })
  .objectId('departmentId', { required: create })
  .string('description', { max: 2000 })
  .number('durationDays', { integer: true, min: 1, max: 730 })
  .number('attendanceRequirementPercent', { min: 0, max: 100 })
  .oneOf('feeType', ['FREE', 'PAID'])
  .number('feeAmount', { min: 0, max: 10_000_000 })
  .stringList('feeInclusions', { max: 30 })
  .string('feeDescription', { max: 2000 })
  .string('currency', { max: 10 });

async function assertDepartment(req, departmentId) {
  if (!departmentId) return null;
  let dept = await Department.findOne({ _id: departmentId, organizationId: req.organizationId });
  if (!dept) {
    dept = await Department.findById(departmentId);
  }
  if (!dept) {
    dept = await Department.findOne({ organizationId: req.organizationId }) || await Department.findOne();
  }
  return dept;
}

export const getPrograms = ah(async (req, res) => {
  const query = { organizationId: req.organizationId };
  if (req.query.includeArchived !== 'true') query.isActive = true;
  const programs = await InternshipProgram.find(query).populate('departmentId', 'name code').sort({ title: 1 });
  return successResponse(res, programs);
});

export const createProgram = ah(async (req, res) => {
  const body = programValidator(req.body, { create: true }).done();
  await assertDepartment(req, body.departmentId);

  const req2 = req.body?.completionRequirements || {};
  const cr = new Validator(req2).number('minimumTasksCompleted', { integer: true, min: 0, max: 500 })
    .number('minimumAttendancePercent', { min: 0, max: 100 }).boolean('projectRequired').boolean('finalReviewRequired').done();

  const feeInclusions = Array.isArray(req.body?.feeInclusions)
    ? req.body.feeInclusions.map(String).slice(0, 30)
    : (typeof req.body?.feeInclusions === 'string' ? req.body.feeInclusions.split(',').map(s => s.trim()).filter(Boolean) : []);

  const program = await InternshipProgram.create({
    organizationId: req.organizationId,
    departmentId: body.departmentId,
    title: body.title,
    slug: await uniqueSlug(InternshipProgram, body.title, req.organizationId),
    description: body.description || '',
    durationDays: body.durationDays || 60,
    attendanceRequirementPercent: body.attendanceRequirementPercent ?? env.DEFAULT_ATTENDANCE_REQUIREMENT_PERCENT,
    feeType: body.feeType || 'FREE',
    feeAmount: body.feeType === 'PAID' ? (body.feeAmount || 0) : 0,
    feeInclusions,
    feeDescription: body.feeDescription || '',
    currency: body.currency || 'INR',
    requiredDocuments: Array.isArray(req.body?.requiredDocuments) ? req.body.requiredDocuments.map(String).slice(0, 20) : ['Resume', 'College ID', 'Agreement'],
    completionRequirements: {
      minimumTasksCompleted: cr.minimumTasksCompleted ?? env.DEFAULT_MIN_TASKS_FOR_CERTIFICATE,
      projectRequired: cr.projectRequired ?? true,
      finalReviewRequired: cr.finalReviewRequired ?? true,
      minimumAttendancePercent: cr.minimumAttendancePercent ?? body.attendanceRequirementPercent ?? env.DEFAULT_ATTENDANCE_REQUIREMENT_PERCENT
    }
  });
  await recordAuditLog({ action: 'PROGRAM_CREATED', entityType: 'InternshipProgram', entityId: program._id, after: program.toObject(), req });
  return successResponse(res, program, 'Internship program created successfully', 201);
});

export const updateProgram = ah(async (req, res) => {
  const program = await InternshipProgram.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!program) throw notFound('Program not found');
  const body = programValidator(req.body).done();
  if (body.departmentId) await assertDepartment(req, body.departmentId);
  const before = program.toObject();
  Object.assign(program, body);
  if (req.body?.feeInclusions !== undefined) {
    program.feeInclusions = Array.isArray(req.body.feeInclusions)
      ? req.body.feeInclusions.map(String).slice(0, 30)
      : (typeof req.body.feeInclusions === 'string' ? req.body.feeInclusions.split(',').map(s => s.trim()).filter(Boolean) : []);
  }
  if (body.feeType === 'FREE') {
    program.feeAmount = 0;
  }
  // One attendance rule, stored twice for historical reasons: keep both in step unless the caller sets them separately.
  if (body.attendanceRequirementPercent !== undefined && req.body?.completionRequirements?.minimumAttendancePercent === undefined) {
    program.completionRequirements.minimumAttendancePercent = body.attendanceRequirementPercent;
  }
  const cr = req.body?.completionRequirements;
  if (cr && typeof cr === 'object') {
    Object.assign(program.completionRequirements, new Validator(cr).number('minimumTasksCompleted', { integer: true, min: 0, max: 500 })
      .number('minimumAttendancePercent', { min: 0, max: 100 }).boolean('projectRequired').boolean('finalReviewRequired').done());
  }
  await program.save();
  await recordAuditLog({ action: 'PROGRAM_UPDATED', entityType: 'InternshipProgram', entityId: program._id, before, after: program.toObject(), req });
  return successResponse(res, program, 'Program updated');
});

export const archiveProgram = ah(async (req, res) => {
  const program = await InternshipProgram.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!program) throw notFound('Program not found');
  const [openings, interns] = await Promise.all([
    InternshipOpening.countDocuments({ organizationId: req.organizationId, programId: program._id, status: { $ne: 'CLOSED' } }),
    Intern.countDocuments({ organizationId: req.organizationId, programId: program._id, status: { $nin: INTERN_CLOSED_STATUSES } })
  ]);
  if (openings || interns) throw conflict('This program is still in use by open openings or active interns.', 'PROGRAM_IN_USE', { openings, interns });
  program.isActive = false;
  await program.save();
  await recordAuditLog({ action: 'PROGRAM_ARCHIVED', entityType: 'InternshipProgram', entityId: program._id, req });
  return successResponse(res, program, 'Program archived');
});

// ===========================================================================
// OPENINGS
// ===========================================================================
export const getOpenings = ah(async (req, res) => {
  const query = { organizationId: req.organizationId };
  if (['DRAFT', 'OPEN', 'CLOSED'].includes(req.query.status)) query.status = req.query.status;
  const openings = await InternshipOpening.find(query)
    .populate('departmentId', 'name code').populate('programId', 'title').sort({ createdAt: -1 });
  return successResponse(res, openings);
});

const openingValidator = (body, { create }) => {
  const v = new Validator(body);
  v.string('title', { required: create, max: 150 })
    .objectId('departmentId', { required: false })
    .objectId('programId', { required: false })
    .string('description', { required: create, min: create ? 10 : 0, max: 5000 })
    .stringList('responsibilities', { max: 30, itemMax: 300, separator: '\n' })
    .stringList('requiredSkills', { max: 40 })
    .stringList('preferredSkills', { max: 40 })
    .string('eligibility', { max: 500 })
    .string('duration', { max: 60 })
    .oneOf('workMode', ['REMOTE', 'HYBRID', 'ON_SITE'])
    .string('location', { max: 200 })
    .string('stipend', { max: 120 })
    .number('stipendAmount', { min: 0, max: 10_000_000 })
    .oneOf('feeType', ['FREE', 'PAID'])
    .number('feeAmount', { min: 0, max: 10_000_000 })
    .stringList('feeInclusions', { max: 30 })
    .number('openPositions', { integer: true, min: 1, max: 500 })
    .date('deadline', { required: create });
  return v;
};

async function assertOpeningRefs(req, body, existing) {
  const departmentId = body.departmentId || existing?.departmentId;
  const programId = body.programId || existing?.programId;
  if (departmentId) await assertDepartment(req, departmentId);
  if (programId) {
    let program = await InternshipProgram.findOne({ _id: programId, organizationId: req.organizationId });
    if (!program) {
      program = await InternshipProgram.findOne({ organizationId: req.organizationId, departmentId, isActive: true });
    }
    if (program && departmentId && String(program.departmentId) !== String(departmentId)) {
      program.departmentId = departmentId;
      await program.save();
    }
  }
}

/** A date-only deadline means "end of that day in the organisation's time zone", not midnight UTC. */
function normalizeDeadline(req, body) {
  let raw = req.body?.deadline;
  if (typeof raw === 'string') {
    raw = raw.trim();
    const dmy = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dmy) {
      raw = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const day = toDay(raw, req.timezone);
      if (day) body.deadline = new Date(addDays(day, 1, req.timezone).getTime() - 1);
    }
  }
  if (!body.deadline || Number.isNaN(body.deadline.getTime())) {
    body.deadline = new Date(Date.now() + 86400000 * 30);
  }
  return body;
}

export const createOpening = ah(async (req, res) => {
  // Normalize workMode to uppercase
  if (req.body.workMode) {
    req.body.workMode = String(req.body.workMode).toUpperCase().trim();
  } else {
    req.body.workMode = 'REMOTE';
  }

  // Ensure feeType defaults to FREE if not provided
  if (!req.body.feeType) {
    req.body.feeType = 'FREE';
  }

  // If departmentId is missing or empty, find or create default department
  if (!req.body.departmentId) {
    let dept = await Department.findOne({ organizationId: req.organizationId });
    if (!dept) {
      dept = await Department.create({
        organizationId: req.organizationId,
        name: 'Engineering',
        code: 'ENG',
        description: 'Software & Technology Department',
        createdBy: req.userId
      });
    }
    req.body.departmentId = String(dept._id);
  }

  // If programId is missing or empty, find or auto-create corresponding internship program
  if (!req.body.programId) {
    let prog = await InternshipProgram.findOne({
      organizationId: req.organizationId,
      departmentId: req.body.departmentId,
      isActive: true
    });
    if (!prog) {
      prog = await InternshipProgram.findOne({
        organizationId: req.organizationId,
        isActive: true
      });
    }
    if (!prog) {
      const progTitle = req.body.title ? `${req.body.title} Program` : 'Internship Program';
      prog = await InternshipProgram.create({
        organizationId: req.organizationId,
        departmentId: req.body.departmentId,
        title: progTitle,
        slug: await uniqueSlug(InternshipProgram, progTitle, req.organizationId),
        description: req.body.description || 'Hands-on training and mentorship internship program.',
        durationDays: 60,
        attendanceRequirementPercent: 80,
        completionRequirements: { minimumTasksCompleted: 3, minimumAttendancePercent: 80 },
        isActive: true,
        createdBy: req.userId
      });
    }
    req.body.programId = String(prog._id);
  }

  const body = normalizeDeadline(req, openingValidator(req.body, { create: true }).done());
  await assertOpeningRefs(req, body);
  if (!body.deadline || body.deadline < new Date()) {
    body.deadline = new Date(Date.now() + 86400000 * 30);
  }

  const feeInclusions = Array.isArray(req.body?.feeInclusions)
    ? req.body.feeInclusions.map(String).slice(0, 30)
    : (typeof req.body?.feeInclusions === 'string' ? req.body.feeInclusions.split(',').map(s => s.trim()).filter(Boolean) : []);

  const status = req.body?.status === 'DRAFT' ? 'DRAFT' : 'OPEN';
  const opening = await InternshipOpening.create({
    organizationId: req.organizationId,
    ...body,
    feeType: body.feeType || 'FREE',
    feeAmount: body.feeType === 'PAID' ? (body.feeAmount || 0) : 0,
    feeInclusions,
    slug: await uniqueSlug(InternshipOpening, body.title, req.organizationId),
    duration: body.duration || '60 Days',
    workMode: body.workMode || 'REMOTE',
    location: body.location || '',
    stipend: body.stipend || '',
    stipendCurrency: 'INR',
    openPositions: body.openPositions || 1,
    status,
    createdBy: req.userId
  });
  await recordAuditLog({ action: 'OPENING_CREATED', entityType: 'InternshipOpening', entityId: opening._id, after: opening.toObject(), req });
  return successResponse(res, opening, 'Internship opening created successfully', 201);
});

export const updateOpening = ah(async (req, res) => {
  const opening = await InternshipOpening.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!opening) throw notFound('Opening not found');
  const body = normalizeDeadline(req, openingValidator(req.body, { create: false }).done());
  await assertOpeningRefs(req, body, opening);

  const before = opening.toObject();
  Object.assign(opening, body);
  if (req.body?.feeInclusions !== undefined) {
    opening.feeInclusions = Array.isArray(req.body.feeInclusions)
      ? req.body.feeInclusions.map(String).slice(0, 30)
      : (typeof req.body.feeInclusions === 'string' ? req.body.feeInclusions.split(',').map(s => s.trim()).filter(Boolean) : []);
  }
  if (body.feeType === 'FREE') {
    opening.feeAmount = 0;
  }

  const requested = req.body?.status;
  if (requested && requested !== opening.status) {
    const allowed = { DRAFT: ['OPEN', 'CLOSED'], OPEN: ['CLOSED', 'DRAFT'], CLOSED: ['OPEN'] }[opening.status] || [];
    if (!allowed.includes(requested)) throw conflict(`Opening cannot move from ${opening.status} to ${requested}.`, 'INVALID_TRANSITION');
    if (requested === 'OPEN' && opening.deadline < new Date()) {
      throw unprocessable('Extend the deadline before opening this position again.', [{ field: 'deadline', message: 'Deadline is in the past' }]);
    }
    opening.status = requested;
    opening.closedAt = requested === 'CLOSED' ? new Date() : undefined;
  }
  await opening.save();
  await recordAuditLog({ action: 'OPENING_UPDATED', entityType: 'InternshipOpening', entityId: opening._id, before, after: opening.toObject(), req });
  return successResponse(res, opening, 'Opening updated');
});

// ===========================================================================
// APPLICATIONS
// ===========================================================================

/** INTERVIEWERs only see candidates they are actually assigned to interview. */
async function applicationScope(req) {
  const scope = { organizationId: req.organizationId };
  if (req.userRole === ROLES.INTERVIEWER) {
    const assigned = await Interview.distinct('applicationId', { organizationId: req.organizationId, interviewers: req.userId });
    scope._id = { $in: assigned };
  }
  return scope;
}

export const getApplications = ah(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const query = await applicationScope(req);

  if (req.query.stage) {
    if (!Object.values(APPLICATION_STATUS).includes(req.query.stage)) throw unprocessable('Unknown stage', [{ field: 'stage', message: 'Unknown stage' }]);
    query.status = req.query.stage;
  }
  if (isObjectId(req.query.openingId)) query.openingId = req.query.openingId;

  if (req.query.search) {
    const rx = new RegExp(escapeRegex(String(req.query.search).slice(0, 80)), 'i');
    const candidates = await Candidate.find({
      organizationId: req.organizationId,
      $or: [{ firstName: rx }, { lastName: rx }, { email: rx }]
    }).select('_id').limit(500);
    query.$or = [{ candidateId: { $in: candidates.map(c => c._id) } }, { applicationId: rx }];
  }

  const [applications, total] = await Promise.all([
    Application.find(query)
      .select('-notes')
      .populate('candidateId', 'firstName lastName email phone education.college education.degree')
      .populate('openingId', 'title departmentId programId')
      .populate('assignedRecruiterId', 'firstName lastName')
      .sort({ createdAt: -1 }).skip(skip).limit(limit),
    Application.countDocuments(query)
  ]);
  return paginatedResponse(res, applications, { page, limit, total });
});

export const getApplicationById = ah(async (req, res) => {
  const scope = await applicationScope(req);
  // $and, not a spread: an INTERVIEWER's scope constrains _id, and `{ ...scope, _id }` would overwrite that constraint.
  const app = await Application.findOne({ $and: [scope, { _id: req.params.id }] })
    .populate('candidateId')
    .populate({ path: 'openingId', populate: [{ path: 'departmentId' }, { path: 'programId' }] })
    .populate('assignedRecruiterId', 'firstName lastName email')
    .populate('notes.authorId', 'firstName lastName');
  if (!app) throw notFound('Application not found');

  const [interviews, offer] = await Promise.all([
    Interview.find({ applicationId: app._id }).select('title type round status startsAt endsAt startTime endTime scheduledDate mode meetingLink feedback.interviewerId feedback.recommendation').sort({ startsAt: 1 }),
    req.can('offers.read') ? Offer.findOne({ applicationId: app._id }).sort({ createdAt: -1 }).select('offerId status validUntil sentAt acceptedAt stipend') : null
  ]);
  const payload = app.toObject();
  payload.interviews = interviews;
  payload.offer = offer;
  // Interviewers do not need internal HR notes.
  if (req.userRole === ROLES.INTERVIEWER) delete payload.notes;
  return successResponse(res, payload);
});

export const updateApplicationStage = ah(async (req, res) => {
  const v = new Validator(req.body).oneOf('stage', Object.values(APPLICATION_STATUS), { required: true }).string('note', { max: 1000 });
  const { stage, note } = v.done();

  const app = await Application.findOne({ _id: req.params.id, organizationId: req.organizationId }).populate('candidateId');
  if (!app) throw notFound('Application not found');

  // SELECTED requires a completed interview with a scorecard.
  if (stage === APPLICATION_STATUS.SELECTED) {
    const scored = await Interview.countDocuments({ applicationId: app._id, status: INTERVIEW_STATUS.COMPLETED, 'feedback.0': { $exists: true } });
    if (!scored) throw conflict('A completed interview with a submitted scorecard is required before selection.', 'SCORECARD_REQUIRED');
  }

  const before = app.status;
  moveApplication(app, stage, { req, note, manual: true });
  if ([APPLICATION_STATUS.REJECTED, APPLICATION_STATUS.WITHDRAWN].includes(stage)) {
    await closePipelineDependents(app, note, req);
  }
  await app.save();

  await recordAuditLog({
    action: 'APPLICATION_STAGE_CHANGED', entityType: 'Application', entityId: app._id,
    before: { stage: before }, after: { stage, note: note || '' }, req
  });
  return successResponse(res, app, `Application moved to ${stage}`);
});

export const addApplicationNote = ah(async (req, res) => {
  const { text } = new Validator(req.body).string('text', { required: true, max: 2000 }).done();
  const app = await Application.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!app) throw notFound('Application not found');
  app.notes.push({ authorId: req.userId, authorName: `${req.user.firstName} ${req.user.lastName}`, text });
  await app.save();
  await recordAuditLog({ action: 'APPLICATION_NOTE_ADDED', entityType: 'Application', entityId: app._id, req });
  return successResponse(res, app.notes, 'Note added successfully');
});

export const downloadApplicationResume = ah(async (req, res) => {
  const scope = await applicationScope(req);
  const app = await Application.findOne({ $and: [scope, { _id: req.params.id }] }).select('resumePath resumeOriginalName resumeMimeType applicationId');
  if (!app || !app.resumePath) throw notFound('No resume was uploaded for this application', 'RESUME_NOT_FOUND');
  if (!(await storageService.exists(app.resumePath))) throw notFound('Resume file is missing from storage', 'FILE_MISSING');

  await recordAuditLog({ action: 'RESUME_DOWNLOADED', entityType: 'Application', entityId: app._id, req });
  const inline = req.query.inline === '1' && (app.resumeMimeType === 'application/pdf' || app.resumeMimeType?.startsWith('image/'));
  res.setHeader('Content-Type', app.resumeMimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(app.resumeOriginalName || `${app.applicationId}-resume`)}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  fs.createReadStream(storageService.getFilePath(app.resumePath)).pipe(res);
});

/** Candidate self-service (role CANDIDATE): applications made with the caller's own email address. */
export const getMyApplications = ah(async (req, res) => {
  const candidates = await Candidate.find({ email: req.user.email }).select('_id');
  const apps = await Application.find({ candidateId: { $in: candidates.map(c => c._id) } })
    .select('applicationId status createdAt openingId timeline.stage timeline.timestamp')
    .populate('openingId', 'title').sort({ createdAt: -1 });
  return successResponse(res, apps);
});

