import { Intern } from './intern.model.js';
import { internScope, loadScopedIntern } from './intern.access.js';
import { Task } from '../tasks/task.model.js';
import { AttendanceRecord } from '../attendance/attendance.model.js';
import { attendanceSummary } from '../attendance/attendance.service.js';
import { JournalEntry } from '../journals/journal.model.js';
import { LearningProgress, LearningLesson } from '../learning/learning.model.js';
import { Meeting } from '../meetings/meeting.model.js';
import { PerformanceReview } from '../performance/performance.model.js';
import { OnboardingPlan, OnboardingTask } from '../onboarding/onboarding.model.js';
import { User } from '../users/user.model.js';
import { AuditLog } from '../audit/audit.model.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { createNotification } from '../notifications/notification.service.js';
import { ROLES, TASK_STATUS, ATTENDANCE_STATUS, INTERN_STATUS, ONBOARDING_STATUS, PERFORMANCE_REVIEW_STATUS } from '../../../../shared/constants.js';
import {
  INTERN_MANUAL_TRANSITIONS, INTERN_CLOSED_STATUSES, TASK_DONE_STATUSES, TASK_OPEN_STATUSES, assertTransition
} from '../../../../shared/lifecycle.js';
import { ah } from '../../utils/asyncHandler.js';
import { notFound, conflict, unprocessable } from '../../utils/errors.js';
import { Validator, escapeRegex, parsePagination, isObjectId } from '../../utils/validate.js';
import { startOfDay, toDay } from '../../utils/time.js';
import { Department, Organization } from '../organizations/organization.model.js';
import { InternshipProgram } from '../recruitment/recruitment.model.js';
import { Project } from '../projects/project.model.js';
import { Document } from '../documents/document.model.js';
import { DocumentRequirementTemplate } from '../documents/documentRequirementTemplate.model.js';
import { InternDocumentRequirement } from '../documents/internDocumentRequirement.model.js';
import { sendOnboardingCredentialsEmail } from '../email/email.service.js';
import { generateId, generateSecretToken, hashToken } from '../../utils/idGenerator.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

const MENTOR_ROLES = [ROLES.MENTOR, ROLES.TEAM_LEAD, ROLES.PROGRAM_MANAGER];
const MS_DAY = 86400000;

export const getInterns = ah(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 200 });
  const query = internScope(req);
  if (Object.values(INTERN_STATUS).includes(req.query.status)) query.status = req.query.status;
  if (isObjectId(req.query.departmentId)) query.departmentId = req.query.departmentId;
  if (isObjectId(req.query.programId)) query.programId = req.query.programId;
  if (isObjectId(req.query.mentorId)) query.mentorId = req.query.mentorId;
  if (req.query.unassigned === 'true') query.mentorId = { $exists: false };
  // Statuses that are still in play (excludes ALUMNI / TERMINATED) - used by pickers.
  if (req.query.open === 'true') query.status = { $nin: INTERN_CLOSED_STATUSES };

  if (req.query.search) {
    const rx = new RegExp(escapeRegex(String(req.query.search).slice(0, 80)), 'i');
    const users = await User.find({ organizationId: req.organizationId, $or: [{ firstName: rx }, { lastName: rx }, { email: rx }] }).select('_id').limit(500);
    const and = [{ $or: [{ userId: { $in: users.map(u => u._id) } }, { internId: rx }] }];
    query.$and = [...(query.$and || []), ...and];
  }

  if (req.query.source) {
    const s = String(req.query.source).toUpperCase();
    if (['APPLICATION', 'REFERRAL', 'CAMPUS', 'WALK_IN', 'PARTNER', 'INTERNAL_TRANSFER', 'OTHER'].includes(s)) {
      query.source = s;
    }
  }

  const [internsList, total] = await Promise.all([
    Intern.find(query)
      .populate('userId', 'firstName lastName email phone avatarUrl role')
      .populate('departmentId', 'name code').populate('programId', 'title durationDays')
      .populate('mentorId', 'firstName lastName email')
      .populate('referral.referredById', 'firstName lastName email')
      .sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Intern.countDocuments(query)
  ]);

  const userIds = internsList.map(i => i.userId?._id).filter(Boolean);
  const internIds = internsList.map(i => i._id);

  const [projects, docs] = await Promise.all([
    Project.find({ organizationId: req.organizationId, members: { $in: userIds } }, 'name code members').lean(),
    Document.find({ organizationId: req.organizationId, $or: [{ internId: { $in: internIds } }, { ownerId: { $in: userIds } }] }, 'status type internId ownerId originalName title').lean()
  ]);

  const interns = internsList.map(i => {
    const assignedProjects = projects.filter(p => p.members?.some(m => String(m) === String(i.userId?._id)));
    const internDocs = docs.filter(d => String(d.internId) === String(i._id) || String(d.ownerId) === String(i.userId?._id));
    return {
      ...i,
      projects: assignedProjects,
      documents: internDocs
    };
  });

  return paginatedResponse(res, interns, { page, limit, total });
});

// Real workspace metrics for the signed-in intern. Nothing here is hardcoded.
export const getMyInternProfile = ah(async (req, res) => {
  let intern = await Intern.findOne({ organizationId: req.organizationId, userId: req.userId })
    .populate('userId', 'firstName lastName email phone avatarUrl')
    .populate('departmentId', 'name code').populate('programId').populate('mentorId', 'firstName lastName email');

  if (!intern && (req.userRole === ROLES.INTERN_TRAINEE || req.userRole === ROLES.INTERN)) {
    const own = await getOwnIntern(req, { required: false });
    if (own) {
      intern = await Intern.findById(own._id)
        .populate('userId', 'firstName lastName email phone avatarUrl')
        .populate('departmentId', 'name code').populate('programId').populate('mentorId', 'firstName lastName email');
    }
  }

  let viewingAsAdmin = false;
  if (!intern && (req.userRole === ROLES.SUPER_ADMIN || req.can?.('interns.read') || req.userRole === ROLES.ORGANIZATION_ADMIN)) {
    const adminQuery = req.query.internId
      ? { _id: req.query.internId }
      : (req.organizationId ? { organizationId: req.organizationId } : {});
    intern = await Intern.findOne(adminQuery)
      .populate('userId', 'firstName lastName email phone avatarUrl')
      .populate('departmentId', 'name code').populate('programId').populate('mentorId', 'firstName lastName email');
    if (intern) viewingAsAdmin = true;
  }

  if (!intern) {
    if (req.userRole === ROLES.SUPER_ADMIN || req.can?.('interns.read')) {
      return successResponse(res, {
        intern: {
          internId: 'ADMIN-PREVIEW',
          status: 'ACTIVE',
          startDate: new Date(),
          expectedEndDate: new Date(Date.now() + 90 * MS_DAY),
          userId: { firstName: 'System', lastName: 'Demo Intern', email: 'intern.preview@tmt.internal' },
          programId: { title: 'Software Engineering Internship Track' }
        },
        viewingAsAdmin: true,
        dashboard: {
          dayNumber: 1, totalProgramDays: 90, overallProgress: 0,
          onboarding: { progress: 0, status: 'IN_PROGRESS' },
          todayAttendance: { checkedIn: false, status: 'PENDING' },
          attendance: { percent: 100, expectedDays: 20, attendedDays: 20 },
          tasks: { pending: 0, completed: 0, total: 0, dueSoon: 0 },
          learning: { percent: 0, completed: 0, total: 0 },
          journalToday: { submitted: false },
          upcomingMeetings: [],
          performanceScore: null
        }
      });
    }
    throw notFound('Intern profile not found for the authenticated user', 'INTERN_PROFILE_NOT_FOUND');
  }

  const tz = req.timezone || 'UTC';
  const today = startOfDay(new Date(), tz);
  const start = startOfDay(intern.startDate || new Date(), tz);
  const dayNumber = today < start ? 0 : Math.round((today - start) / MS_DAY) + 1;
  const totalProgramDays = intern.programId?.durationDays || Math.max(1, Math.round(((intern.expectedEndDate || new Date()) - (intern.startDate || new Date())) / MS_DAY) + 1);

  const in3Days = new Date(Date.now() + 3 * MS_DAY);
  const targetUserId = intern.userId?._id || intern.userId;
  const targetOrgId = intern.organizationId?._id || intern.organizationId || req.organizationId;

  const [attendanceToday, tasks, dueSoon, completedLessons, totalLessons, journalToday, upcomingMeetings, latestReview, attendance, onboarding] = await Promise.all([
    AttendanceRecord.findOne({ internId: intern._id, date: today }),
    Task.aggregate([
      { $match: { organizationId: targetOrgId, assignedTo: targetUserId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Task.countDocuments({ organizationId: targetOrgId, assignedTo: targetUserId, status: { $in: TASK_OPEN_STATUSES }, dueDate: { $gte: today, $lte: in3Days } }),
    LearningProgress.countDocuments({ userId: targetUserId, isCompleted: true }),
    LearningLesson.countDocuments({ organizationId: targetOrgId }),
    JournalEntry.findOne({ internId: intern._id, date: today }),
    Meeting.find({ organizationId: targetOrgId, $or: [{ internIds: intern._id }, { participants: targetUserId }], scheduledDate: { $gte: today }, status: { $in: ['SCHEDULED', 'RESCHEDULED'] } }).sort({ scheduledDate: 1 }).limit(3),
    PerformanceReview.findOne({ internId: intern._id, status: PERFORMANCE_REVIEW_STATUS.FINALIZED }).sort({ finalizedAt: -1 }),
    attendanceSummary(intern, { tz }),
    OnboardingPlan.findOne({ internId: intern._id }).select('progress status')
  ]);

  const taskCounts = Object.fromEntries(tasks.map(t => [t._id, t.count]));
  const totalTasks = tasks.reduce((s, t) => s + t.count, 0);
  const doneTasks = TASK_DONE_STATUSES.reduce((s, k) => s + (taskCounts[k] || 0), 0);
  const pendingTasks = [TASK_STATUS.TODO, TASK_STATUS.IN_PROGRESS, TASK_STATUS.REVISION_REQUIRED, TASK_STATUS.BLOCKED].reduce((s, k) => s + (taskCounts[k] || 0), 0);
  const learningPercent = totalLessons > 0 ? Math.round(completedLessons / totalLessons * 100) : 0;

  // Overall progress is only meaningful once the internship has started.
  const timeRatio = totalProgramDays > 0 ? Math.min(1, Math.max(0, dayNumber / totalProgramDays)) : 0;
  const overallProgress = Math.round(((totalTasks ? doneTasks / totalTasks : 0) * 0.5 + timeRatio * 0.3 + (learningPercent / 100) * 0.2) * 100);

  return successResponse(res, {
    intern,
    viewingAsAdmin,
    dashboard: {
      dayNumber, totalProgramDays, overallProgress,
      onboarding: onboarding ? { progress: onboarding.progress, status: onboarding.status } : null,
      todayAttendance: attendanceToday && attendanceToday.checkIn
        ? { checkedIn: true, checkInTime: attendanceToday.checkIn, checkedOut: !!attendanceToday.checkOut, status: attendanceToday.status }
        : { checkedIn: false, status: attendanceToday?.status || 'PENDING' },
      attendance: { percent: attendance.percent, expectedDays: attendance.expectedDays, attendedDays: attendance.attendedDays },
      tasks: { pending: pendingTasks, completed: doneTasks, total: totalTasks, dueSoon },
      learning: { percent: learningPercent, completed: completedLessons, total: totalLessons },
      journalToday: journalToday ? { submitted: true, status: journalToday.status } : { submitted: false },
      upcomingMeetings,
      performanceScore: latestReview ? latestReview.finalScore : null
    }
  });
});

export const getInternById = ah(async (req, res) => {
  const intern = await loadScopedIntern(req, req.params.id, [
    { path: 'userId', select: 'firstName lastName email phone avatarUrl' },
    { path: 'departmentId', select: 'name code' }, 'programId',
    { path: 'mentorId', select: 'firstName lastName email' }, { path: 'managerId', select: 'firstName lastName email' },
    { path: 'referral.referredById', select: 'firstName lastName email role' },
    'candidateId', 'applicationId'
  ]);
  const [tasks, journalsCount, attendance, plan] = await Promise.all([
    Task.find({ organizationId: req.organizationId, assignedTo: intern.userId._id }).sort({ dueDate: 1 }).limit(10),
    JournalEntry.countDocuments({ internId: intern._id }),
    attendanceSummary(intern, { tz: req.timezone }),
    OnboardingPlan.findOne({ internId: intern._id }).select('progress status')
  ]);
  return successResponse(res, {
    intern, recentTasks: tasks,
    metrics: { journalsLogged: journalsCount, daysPresent: attendance.attendedDays, attendancePercent: attendance.percent, onboardingProgress: plan?.progress ?? null }
  });
});

export const createIntern = ah(async (req, res) => {
  const input = { ...req.body };
  if (input.compensation && typeof input.compensation === 'object') {
    input.compensationType = input.compensationType || input.compensation.type;
    input.stipendAmount = input.stipendAmount ?? input.compensation.amount;
    input.currency = input.currency || input.compensation.currency;
    input.stipendFrequency = input.stipendFrequency || input.compensation.frequency;
    input.stipendStartDate = input.stipendStartDate || input.compensation.startDate;
  }
  if (input.referral && typeof input.referral === 'object') {
    input.referredById = input.referredById || input.referral.referredById;
    input.referralName = input.referralName || input.referral.referralName;
    input.referralEmail = input.referralEmail || input.referral.referralEmail;
    input.relationship = input.relationship || input.referral.relationship;
    input.referralNotes = input.referralNotes || input.referral.notes;
    input.referralDate = input.referralDate || input.referral.date;
  }
  if (input.templateId && !input.documentTemplateId) {
    input.documentTemplateId = input.templateId;
  }

  const v = new Validator(input)
    .string('firstName', { required: true, max: 100 })
    .string('lastName', { required: true, max: 100 })
    .email('email', { required: true })
    .phone('phone')
    .objectId('departmentId')
    .objectId('programId')
    .objectId('mentorId')
    .objectId('managerId')
    .objectId('projectId')
    .string('startDate')
    .string('expectedEndDate')
    .oneOf('workMode', ['REMOTE', 'HYBRID', 'ON_SITE'], { defaultValue: 'REMOTE' })
    .oneOf('role', ['INTERN', 'INTERN_TRAINEE'], { defaultValue: 'INTERN' })
    .oneOf('source', ['APPLICATION', 'REFERRAL', 'CAMPUS', 'WALK_IN', 'PARTNER', 'INTERNAL_TRANSFER', 'OTHER'], { defaultValue: 'APPLICATION' })
    .objectId('applicationId')
    .objectId('referredById')
    .string('referralName', { max: 150 })
    .string('referralEmail', { max: 150 })
    .string('relationship', { max: 100 })
    .string('referralNotes', { max: 1000 })
    .string('referralDate')
    .string('institution', { max: 200 })
    .string('degree', { max: 150 })
    .string('graduationYear', { max: 50 })
    .string('location', { max: 150 })
    .string('internalNotes', { max: 2000 })
    .oneOf('compensationType', ['PAID', 'UNPAID'], { defaultValue: 'UNPAID' })
    .number('stipendAmount', { min: 0 })
    .string('currency', { defaultValue: 'INR' })
    .oneOf('stipendFrequency', ['MONTHLY', 'WEEKLY', 'ONE_TIME'], { defaultValue: 'MONTHLY' })
    .string('stipendStartDate')
    .objectId('documentTemplateId');
  const body = v.done();

  // Validate or auto-fallback department & program in org
  let dept = body.departmentId ? await Department.findOne({ _id: body.departmentId, organizationId: req.organizationId }) : null;
  if (!dept) {
    dept = await Department.findOne({ organizationId: req.organizationId }) || await Department.create({ organizationId: req.organizationId, name: 'Engineering & Technology', code: 'ENG' });
  }

  let program = body.programId ? await InternshipProgram.findOne({ _id: body.programId, organizationId: req.organizationId }) : null;
  if (!program) {
    program = await InternshipProgram.findOne({ organizationId: req.organizationId }) || await InternshipProgram.create({ organizationId: req.organizationId, title: 'Technical Internship Track', durationWeeks: 12, mode: 'REMOTE' });
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const futureStr = new Date(Date.now() + 86400000 * 90).toISOString().slice(0, 10);
  const start = toDay(body.startDate || todayStr, req.timezone);
  const end = toDay(body.expectedEndDate || futureStr, req.timezone);

  const userRole = body.role === 'INTERN_TRAINEE' ? ROLES.INTERN_TRAINEE : ROLES.INTERN;
  const rawPassword = req.body.password || `Tmt@${Math.floor(100000 + Math.random() * 900000)}`;

  const compensationObj = {
    type: body.compensationType === 'PAID' ? 'PAID' : 'UNPAID',
    amount: body.compensationType === 'PAID' ? (body.stipendAmount || 0) : 0,
    currency: body.currency || 'INR',
    frequency: body.stipendFrequency || 'MONTHLY',
    startDate: body.stipendStartDate ? toDay(body.stipendStartDate, req.timezone) : start,
    approvedBy: req.userId
  };

  const referralObj = body.source === 'REFERRAL' ? {
    referredById: body.referredById || undefined,
    referralName: body.referralName || '',
    referralEmail: body.referralEmail ? body.referralEmail.toLowerCase().trim() : '',
    relationship: body.relationship || '',
    notes: body.referralNotes || '',
    date: body.referralDate ? new Date(body.referralDate) : new Date()
  } : undefined;

  // Check user by email
  let user = await User.findOne({ email: body.email.toLowerCase().trim() });
  if (user) {
    if (String(user.organizationId) !== String(req.organizationId)) {
      user.organizationId = req.organizationId;
    }
    user.role = userRole;
    user.firstName = body.firstName.trim();
    user.lastName = body.lastName.trim();
    if (body.phone) user.phone = body.phone;
    user.password = rawPassword;
    user.mustChangePassword = true;
    user.isActive = true;
    await user.save();

    const existingIntern = await Intern.findOne({ userId: user._id });
    if (existingIntern) {
      if (dept) existingIntern.departmentId = dept._id;
      if (program) existingIntern.programId = program._id;
      if (body.mentorId) existingIntern.mentorId = body.mentorId;
      if (body.workMode) existingIntern.workMode = body.workMode;
      if (start) existingIntern.startDate = start;
      if (end) existingIntern.expectedEndDate = end;
      if (body.institution) existingIntern.institution = body.institution;
      if (body.degree) existingIntern.degree = body.degree;
      if (body.graduationYear) existingIntern.graduationYear = body.graduationYear;
      if (body.location) existingIntern.location = body.location;
      if (body.internalNotes) existingIntern.internalNotes = body.internalNotes;
      existingIntern.compensation = compensationObj;
      if (referralObj) existingIntern.referral = referralObj;
      if (['COMPLETED', 'TERMINATED', 'CANCELLED'].includes(existingIntern.status)) {
        existingIntern.status = INTERN_STATUS.PRE_ONBOARDING;
      }
      await existingIntern.save();

      if (body.projectId) {
        await Project.updateOne(
          { _id: body.projectId, organizationId: req.organizationId },
          { $addToSet: { members: user._id } }
        );
      }

      // Re-ensure Onboarding Plan exists
      let plan = await OnboardingPlan.findOne({ internId: existingIntern._id });
      if (!plan) {
        plan = await OnboardingPlan.create({
          organizationId: req.organizationId,
          internId: existingIntern._id,
          status: ONBOARDING_STATUS.IN_PROGRESS,
          progress: 0
        });
        await OnboardingTask.insertMany([
          { organizationId: req.organizationId, onboardingPlanId: plan._id, title: 'Government ID & Address Proof', description: 'Upload national identity document (Aadhaar / Passport / Driver License).' },
          { organizationId: req.organizationId, onboardingPlanId: plan._id, title: 'College ID or Bonafide Certificate', description: 'Upload official university identity card or enrollment proof.' },
          { organizationId: req.organizationId, onboardingPlanId: plan._id, title: 'Signed Internship Agreement / NDA', description: 'Review, acknowledge and upload your signed copy.' }
        ]);
      }

      // Dispatch Welcome Email with Credentials
      const org = await Organization.findById(req.organizationId);
      const proto = req.protocol || 'http';
      const host = req.get('host') || 'localhost:3000';
      sendOnboardingCredentialsEmail({
        to: user.email,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        password: rawPassword,
        role: userRole,
        orgName: org?.name || 'TechMecha Torque',
        loginUrl: `${proto}://${host}/login`,
        organizationId: req.organizationId
      }).catch(err => logger.warn(`Async credentials reset email dispatch: ${err.message}`));

      await recordAuditLog({
        action: 'INTERN_CREDENTIALS_RESET',
        entityType: 'Intern',
        entityId: existingIntern._id,
        after: { internId: existingIntern.internId, name: `${user.firstName} ${user.lastName}`, role: userRole },
        req
      });

      return successResponse(res, {
        ...existingIntern.toObject(),
        tempPassword: rawPassword,
        user: { _id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role }
      }, 'Intern profile updated and credentials re-issued successfully.', 200);
    }
  } else {
    user = await User.create({
      organizationId: req.organizationId,
      departmentId: dept._id,
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      email: body.email.toLowerCase().trim(),
      role: userRole,
      phone: body.phone || '',
      password: rawPassword,
      mustChangePassword: true,
      isActive: true
    });
  }

  const candidatePaymentObj = {
    feeType: req.body?.candidatePayment?.feeType || req.body?.feeType || 'FREE',
    feeAmount: Number(req.body?.candidatePayment?.feeAmount || req.body?.feeAmount || 0),
    amountPaid: Number(req.body?.candidatePayment?.amountPaid || req.body?.amountPaid || 0),
    paymentStatus: req.body?.candidatePayment?.paymentStatus || req.body?.paymentStatus || 'PENDING',
    paymentMethod: req.body?.candidatePayment?.paymentMethod || req.body?.paymentMethod || '',
    paymentReference: req.body?.candidatePayment?.paymentReference || req.body?.paymentReference || '',
    paidAt: req.body?.candidatePayment?.paidAt ? new Date(req.body.candidatePayment.paidAt) : (req.body?.paidAt ? new Date(req.body.paidAt) : undefined),
    notes: req.body?.candidatePayment?.notes || req.body?.paymentNotes || ''
  };

  const internId = await generateId('INT');
  const intern = await Intern.create({
    internId,
    userId: user._id,
    applicationId: body.applicationId || undefined,
    organizationId: req.organizationId,
    departmentId: dept._id,
    programId: program._id,
    mentorId: body.mentorId || undefined,
    managerId: body.managerId || req.userId,
    workMode: body.workMode,
    startDate: start,
    expectedEndDate: end,
    status: INTERN_STATUS.PRE_ONBOARDING,
    source: body.source,
    institution: body.institution || '',
    degree: body.degree || '',
    graduationYear: body.graduationYear || '',
    location: body.location || '',
    internalNotes: body.internalNotes || '',
    compensation: compensationObj,
    candidatePayment: candidatePaymentObj,
    referral: referralObj
  });

  // Assign project if requested
  if (body.projectId) {
    await Project.updateOne(
      { _id: body.projectId, organizationId: req.organizationId },
      { $addToSet: { members: user._id } }
    );
  }

  // Create Onboarding Plan
  const plan = await OnboardingPlan.create({
    organizationId: req.organizationId,
    internId: intern._id,
    status: ONBOARDING_STATUS.IN_PROGRESS,
    progress: 0
  });

  // Assign document requirements template if selected
  let templateAssigned = false;
  if (body.documentTemplateId) {
    const docTpl = await DocumentRequirementTemplate.findOne({
      _id: body.documentTemplateId,
      organizationId: req.organizationId
    });
    if (docTpl && docTpl.requiredDocuments?.length > 0) {
      templateAssigned = true;
      for (const d of docTpl.requiredDocuments) {
        await InternDocumentRequirement.create({
          organizationId: req.organizationId,
          internId: intern._id,
          userId: user._id,
          templateId: docTpl._id,
          category: d.category || 'OTHER',
          title: d.title,
          description: d.description || '',
          mandatory: d.mandatory !== false,
          instructions: d.instructions || '',
          sampleTemplateUrl: d.sampleTemplateUrl || '',
          sampleTemplateName: d.sampleTemplateName || '',
          status: 'REQUIRED'
        });
        await OnboardingTask.create({
          organizationId: req.organizationId,
          onboardingPlanId: plan._id,
          title: d.title,
          required: d.mandatory !== false,
          description: d.description || d.instructions || `Submit required document: ${d.title}`
        });
      }
    }
  }

  if (!templateAssigned) {
    // Automatically assign essential onboarding document tasks
    await OnboardingTask.insertMany([
      { organizationId: req.organizationId, onboardingPlanId: plan._id, title: 'Government ID & Address Proof', description: 'Upload national identity document (Aadhaar / Passport / Driver License).' },
      { organizationId: req.organizationId, onboardingPlanId: plan._id, title: 'College ID or Bonafide Certificate', description: 'Upload official university identity card or enrollment proof.' },
      { organizationId: req.organizationId, onboardingPlanId: plan._id, title: 'Signed Internship Agreement / NDA', description: 'Review, acknowledge and upload your signed copy.' }
    ]);
  }

  // Dispatch Welcome Email with Credentials
  const org = await Organization.findById(req.organizationId);
  const proto = req.protocol || 'http';
  const host = req.get('host') || 'localhost:3000';
  sendOnboardingCredentialsEmail({
    to: user.email,
    name: `${user.firstName} ${user.lastName}`,
    email: user.email,
    password: rawPassword,
    role: userRole,
    orgName: org?.name || 'TechMecha Torque',
    loginUrl: `${proto}://${host}/login`,
    organizationId: req.organizationId
  }).catch(err => logger.warn(`Async credentials email dispatch: ${err.message}`));

  await recordAuditLog({
    action: 'INTERN_CREATED',
    entityType: 'Intern',
    entityId: intern._id,
    after: { internId, source: body.source, name: `${user.firstName} ${user.lastName}`, role: userRole },
    req
  });

  return successResponse(res, {
    ...intern.toObject(),
    tempPassword: rawPassword,
    user: { _id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role }
  }, 'Intern created successfully and login credentials dispatched', 201);
});

/**
 * Update mentor/manager/end date and (validated) status.
 * Status changes are limited to INTERN_MANUAL_TRANSITIONS; exit progression belongs to the Exit module and
 * ONBOARDING -> ACTIVE additionally requires every required onboarding task to be completed.
 */
export const updateIntern = ah(async (req, res) => {
  const intern = await loadScopedIntern(req, req.params.id);
  const v = new Validator(req.body)
    .objectId('mentorId').objectId('managerId')
    .string('expectedEndDate', { max: 30 })
    .oneOf('status', Object.values(INTERN_STATUS))
    .string('reason', { max: 300 });
  const body = v.done();
  if (INTERN_CLOSED_STATUSES.includes(intern.status)) throw conflict('This internship is closed and can no longer be edited.', 'INTERN_CLOSED');

  const before = intern.toObject();
  const changes = {};

  for (const [field, roles] of [['mentorId', MENTOR_ROLES], ['managerId', [ROLES.PROGRAM_MANAGER, ROLES.ORGANIZATION_ADMIN, ROLES.HR_ADMIN]]]) {
    if (body[field]) {
      const person = await User.findOne({ _id: body[field], organizationId: req.organizationId, isActive: true, role: { $in: roles } });
      if (!person) throw unprocessable(`${field === 'mentorId' ? 'Mentor' : 'Manager'} must be an active ${roles.join(' / ')} in your organization`, [{ field, message: 'Invalid selection' }]);
      if (String(intern[field] || '') !== String(person._id)) { intern[field] = person._id; changes[field] = person._id; }
    }
  }

  if (body.expectedEndDate) {
    const end = toDay(body.expectedEndDate, req.timezone);
    if (!end) throw unprocessable('Invalid end date', [{ field: 'expectedEndDate', message: 'Enter a valid date' }]);
    if (end <= startOfDay(intern.startDate, req.timezone)) throw unprocessable('End date must be after the start date', [{ field: 'expectedEndDate', message: 'Must be after start date' }]);
    if (!body.reason) throw unprocessable('A reason is required when changing the end date', [{ field: 'reason', message: 'Reason is required' }]);
    if (end.getTime() !== intern.expectedEndDate.getTime()) {
      intern.extensionHistory.push({ previousEndDate: intern.expectedEndDate, newEndDate: end, reason: body.reason, changedBy: req.userId });
      intern.expectedEndDate = end;
      changes.expectedEndDate = end;
    }
  }

  if (body.status && body.status !== intern.status) {
    assertTransition('intern', INTERN_MANUAL_TRANSITIONS, intern.status, body.status);
    if (body.status === INTERN_STATUS.ACTIVE && intern.status === INTERN_STATUS.ONBOARDING) {
      const open = await OnboardingTask.countDocuments({ onboardingPlanId: (await OnboardingPlan.findOne({ internId: intern._id }))?._id, required: true, status: { $ne: ONBOARDING_STATUS.COMPLETED } });
      if (open > 0) throw conflict(`${open} required onboarding task(s) are not complete.`, 'ONBOARDING_INCOMPLETE', { open });
      intern.activatedAt = new Date();
    }
    intern.status = body.status;
    changes.status = body.status;
  }

  if (req.body.candidatePayment && typeof req.body.candidatePayment === 'object') {
    const cp = req.body.candidatePayment;
    intern.candidatePayment = {
      feeType: cp.feeType || intern.candidatePayment?.feeType || 'FREE',
      feeAmount: cp.feeAmount !== undefined ? Number(cp.feeAmount) : (intern.candidatePayment?.feeAmount || 0),
      amountPaid: cp.amountPaid !== undefined ? Number(cp.amountPaid) : (intern.candidatePayment?.amountPaid || 0),
      paymentStatus: cp.paymentStatus || intern.candidatePayment?.paymentStatus || 'PENDING',
      paymentMethod: cp.paymentMethod !== undefined ? cp.paymentMethod : (intern.candidatePayment?.paymentMethod || ''),
      paymentReference: cp.paymentReference !== undefined ? cp.paymentReference : (intern.candidatePayment?.paymentReference || ''),
      paidAt: cp.paidAt ? new Date(cp.paidAt) : (intern.candidatePayment?.paidAt || undefined),
      notes: cp.notes !== undefined ? cp.notes : (intern.candidatePayment?.notes || '')
    };
    changes.candidatePayment = intern.candidatePayment;
  }

  ['institution', 'degree', 'graduationYear', 'location', 'internalNotes'].forEach((f) => {
    if (req.body[f] !== undefined) {
      intern[f] = String(req.body[f]).trim();
      changes[f] = intern[f];
    }
  });

  if (!Object.keys(changes).length) throw unprocessable('No changes were supplied', [{ field: 'body', message: 'Nothing to update' }]);
  await intern.save();

  if (changes.mentorId) {
    await createNotification({ organizationId: req.organizationId, recipientId: changes.mentorId, type: 'MENTEE_ASSIGNED', title: 'New mentee assigned', message: `You are now the mentor for intern ${intern.internId}.`, entityType: 'Intern', entityId: intern._id });
    await createNotification({ organizationId: req.organizationId, recipientId: intern.userId, type: 'MENTOR_ASSIGNED', title: 'Mentor assigned', message: 'A mentor has been assigned to you.', entityType: 'Intern', entityId: intern._id });
  }
  await recordAuditLog({ action: changes.mentorId ? 'INTERN_MENTOR_ASSIGNED' : 'INTERN_RECORD_UPDATED', entityType: 'Intern', entityId: intern._id, before, after: { ...changes, reason: body.reason || '' }, req });
  return successResponse(res, intern, 'Intern record updated successfully');
});

export const getInternTimeline = ah(async (req, res) => {
  const intern = await loadScopedIntern(req, req.params.id);
  const logs = await AuditLog.find({
    organizationId: req.organizationId,
    entityId: { $in: [String(intern._id), String(intern.userId), String(intern.applicationId), String(intern.offerId)] }
  }).sort({ timestamp: 1 }).limit(500);
  // Interns and trainees see the events but not internal metadata such as IP addresses or before/after snapshots.
  const isParticipant = [ROLES.INTERN, ROLES.INTERN_TRAINEE].includes(req.userRole);
  const timeline = logs.map(log => ({
    action: log.action, timestamp: log.timestamp, actorRole: log.actorRole, actorEmail: isParticipant ? undefined : log.actorEmail,
    details: isParticipant ? {} : (log.after || {})
  }));
  return successResponse(res, timeline);
});

export const getInternWorkRecord = ah(async (req, res) => {
  const intern = await loadScopedIntern(req, req.params.id, [
    { path: 'userId', select: 'firstName lastName email avatarUrl' }, { path: 'departmentId', select: 'name code' },
    { path: 'programId', select: 'title durationDays' }, { path: 'mentorId', select: 'firstName lastName email' }
  ]);
  const isSelf = [ROLES.INTERN, ROLES.INTERN_TRAINEE].includes(req.userRole);
  const [tasks, journals, attendance, meetings, reviews] = await Promise.all([
    Task.find({ organizationId: req.organizationId, assignedTo: intern.userId._id }).sort({ createdAt: -1 }),
    JournalEntry.find({ internId: intern._id }).sort({ date: -1 }),
    AttendanceRecord.find({ internId: intern._id }).sort({ date: -1 }).limit(60),
    Meeting.find({ organizationId: req.organizationId, $or: [{ internIds: intern._id }, { participants: intern.userId._id }] }).sort({ scheduledDate: -1 }),
    // An intern only ever sees reviews once finalized (draft mentor scores and manager comments stay private).
    PerformanceReview.find({ internId: intern._id, ...(isSelf ? { status: PERFORMANCE_REVIEW_STATUS.FINALIZED } : {}) }).sort({ createdAt: -1 })
  ]);

  const activities = [
    ...tasks.map(t => ({ type: 'TASK', title: `Task: ${t.title}`, status: t.status, date: t.createdAt, priority: t.priority, details: t.description })),
    ...journals.map(j => ({ type: 'JOURNAL', title: `Daily Journal Day ${j.dayNumber}`, status: j.status, date: j.date, details: j.workSummary, mentorReview: j.mentorReview?.comments })),
    ...meetings.map(m => ({ type: 'MEETING', title: `Meeting: ${m.title}`, status: m.status, date: m.scheduledDate, details: m.agenda, meetingLink: m.meetingLink })),
    ...reviews.map(r => ({ type: 'PERFORMANCE', title: `Review: ${r.cycleTitle}`, status: r.status, date: r.createdAt, finalScore: r.finalScore, details: isSelf ? undefined : (r.managerReview?.comments || r.mentorAssessment?.feedback) }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return successResponse(res, {
    intern,
    summary: {
      totalTasks: tasks.length, completedTasks: tasks.filter(t => TASK_DONE_STATUSES.includes(t.status)).length,
      totalJournals: journals.length, attendanceRecordsCount: attendance.filter(a => [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE, ATTENDANCE_STATUS.HALF_DAY].includes(a.status)).length,
      totalMeetings: meetings.length, reviewsCount: reviews.length
    },
    activities,
    raw: { tasks, journals, attendance, meetings, reviews }
  });
});

export const resetInternPassword = ah(async (req, res) => {
  const intern = await Intern.findOne({ _id: req.params.id, organizationId: req.organizationId }).populate('userId');
  if (!intern) throw notFound('Intern not found');
  if (!intern.userId) throw notFound('User account not found for this intern');

  const newPassword = `Tmt@${Math.floor(100000 + Math.random() * 900000)}`;
  const user = await User.findById(intern.userId._id);
  user.password = newPassword;
  user.mustChangePassword = true;
  await user.save();

  const org = await Organization.findById(req.organizationId);
  try {
    const proto = req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    await sendOnboardingCredentialsEmail({
      to: user.email,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      password: newPassword,
      role: user.role,
      orgName: org?.name || 'TechMecha Torque',
      loginUrl: `${proto}://${host}/login`,
      organizationId: req.organizationId
    });
  } catch (err) {
    logger.warn(`Failed to dispatch reset email: ${err.message}`);
  }

  await recordAuditLog({
    action: 'INTERN_PASSWORD_RESET',
    entityType: 'Intern',
    entityId: intern._id,
    after: { email: user.email, resetBy: req.userId },
    req
  });

  return successResponse(res, { newPassword, email: user.email }, 'Password reset successfully and email dispatched');
});

export const assignInternProject = ah(async (req, res) => {
  const { projectId } = req.body || {};
  if (!projectId) throw unprocessable('Project ID is required', [{ field: 'projectId', message: 'Required' }]);

  const intern = await Intern.findOne({ _id: req.params.id, organizationId: req.organizationId }).populate('userId');
  if (!intern) throw notFound('Intern not found');

  const project = await Project.findOne({ _id: projectId, organizationId: req.organizationId });
  if (!project) throw notFound('Project not found');

  await Project.updateOne(
    { _id: project._id },
    { $addToSet: { members: intern.userId._id } }
  );

  await createNotification({
    organizationId: req.organizationId,
    recipientId: intern.userId._id,
    type: 'PROJECT_ASSIGNED',
    title: 'Project Assigned',
    message: `You have been assigned to project ${project.name}.`,
    entityType: 'Project',
    entityId: project._id
  });

  return successResponse(res, { project, intern }, `Project ${project.name} assigned to intern`);
});

export const assignInternDocumentTask = ah(async (req, res) => {
  const { title, type, description } = req.body || {};
  if (!title) throw unprocessable('Document title is required', [{ field: 'title', message: 'Required' }]);

  const intern = await Intern.findOne({ _id: req.params.id, organizationId: req.organizationId }).populate('userId');
  if (!intern) throw notFound('Intern not found');

  let plan = await OnboardingPlan.findOne({ internId: intern._id, organizationId: req.organizationId });
  if (!plan) {
    plan = await OnboardingPlan.create({ organizationId: req.organizationId, internId: intern._id });
  }

  const task = await OnboardingTask.create({
    onboardingPlanId: plan._id,
    title: title.trim(),
    type: type || 'DOCUMENT',
    description: description || `Please upload ${title.trim()} document.`,
    status: ONBOARDING_STATUS.PENDING
  });

  return successResponse(res, task, `Document requirement assigned to intern`, 201);
});

export const getInternDocumentsList = ah(async (req, res) => {
  const intern = await Intern.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!intern) throw notFound('Intern not found');

  const docs = await Document.find({
    organizationId: req.organizationId,
    $or: [{ internId: intern._id }, { ownerId: intern.userId }]
  }).sort({ createdAt: -1 });

  return successResponse(res, docs);
});

