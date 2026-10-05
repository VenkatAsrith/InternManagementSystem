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
import { Department } from '../organizations/organization.model.js';
import { InternshipProgram } from '../recruitment/recruitment.model.js';
import { generateId, generateSecretToken, hashToken } from '../../utils/idGenerator.js';
import { env } from '../../config/env.js';

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

  const [interns, total] = await Promise.all([
    Intern.find(query)
      .populate('userId', 'firstName lastName email phone avatarUrl')
      .populate('departmentId', 'name code').populate('programId', 'title durationDays')
      .populate('mentorId', 'firstName lastName email')
      .populate('referral.referredById', 'firstName lastName email')
      .sort({ createdAt: -1 }).skip(skip).limit(limit),
    Intern.countDocuments(query)
  ]);
  return paginatedResponse(res, interns, { page, limit, total });
});

// Real workspace metrics for the signed-in intern. Nothing here is hardcoded.
export const getMyInternProfile = ah(async (req, res) => {
  let intern = await Intern.findOne({ organizationId: req.organizationId, userId: req.userId })
    .populate('userId', 'firstName lastName email phone avatarUrl')
    .populate('departmentId', 'name code').populate('programId').populate('mentorId', 'firstName lastName email');

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
  const v = new Validator(req.body)
    .string('firstName', { required: true, max: 100 })
    .string('lastName', { required: true, max: 100 })
    .email('email', { required: true })
    .phone('phone')
    .objectId('departmentId', { required: true })
    .objectId('programId', { required: true })
    .objectId('mentorId')
    .objectId('managerId')
    .string('startDate', { required: true })
    .string('expectedEndDate', { required: true })
    .oneOf('workMode', ['REMOTE', 'HYBRID', 'ON_SITE'], { defaultValue: 'REMOTE' })
    .oneOf('source', ['APPLICATION', 'REFERRAL', 'CAMPUS', 'WALK_IN', 'PARTNER', 'INTERNAL_TRANSFER', 'OTHER'], { defaultValue: 'APPLICATION' })
    .objectId('applicationId')
    .objectId('referredById')
    .string('referralName', { max: 150 })
    .string('referralEmail', { max: 150 })
    .string('relationship', { max: 100 });
  const body = v.done();

  // Validate department & program in org
  const [dept, program] = await Promise.all([
    Department.findOne({ _id: body.departmentId, organizationId: req.organizationId, isActive: true }),
    InternshipProgram.findOne({ _id: body.programId, organizationId: req.organizationId, isActive: true })
  ]);
  if (!dept) throw unprocessable('Department not found in your organization', [{ field: 'departmentId', message: 'Unknown department' }]);
  if (!program) throw unprocessable('Internship Program not found in your organization', [{ field: 'programId', message: 'Unknown program' }]);

  const start = toDay(body.startDate, req.timezone);
  const end = toDay(body.expectedEndDate, req.timezone);
  if (!start) throw unprocessable('Invalid start date', [{ field: 'startDate', message: 'Valid date required' }]);
  if (!end || end <= start) throw unprocessable('End date must be after start date', [{ field: 'expectedEndDate', message: 'Must be after start date' }]);

  // Check user by email
  let user = await User.findOne({ email: body.email.toLowerCase().trim() });
  if (user) {
    if (String(user.organizationId) !== String(req.organizationId)) {
      throw conflict('This email belongs to an account in another organization.', 'EMAIL_IN_OTHER_ORG');
    }
    const existingIntern = await Intern.findOne({ userId: user._id });
    if (existingIntern) {
      throw conflict('An intern record already exists for this person.', 'ALREADY_INTERN', { internId: existingIntern.internId });
    }
  } else {
    const setupToken = generateSecretToken();
    user = await User.create({
      organizationId: req.organizationId,
      departmentId: dept._id,
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      email: body.email.toLowerCase().trim(),
      role: ROLES.INTERN,
      phone: body.phone || '',
      password: generateSecretToken(24),
      mustChangePassword: true,
      passwordSetupTokenHash: hashToken(setupToken),
      passwordSetupExpiresAt: new Date(Date.now() + (env.PASSWORD_SETUP_TTL_HOURS || 72) * 3600 * 1000),
      isActive: true
    });
  }

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
    referral: body.source === 'REFERRAL' ? {
      referredById: body.referredById || undefined,
      referralName: body.referralName || '',
      referralEmail: body.referralEmail ? body.referralEmail.toLowerCase().trim() : '',
      relationship: body.relationship || ''
    } : undefined
  });

  // Create Onboarding Plan
  await OnboardingPlan.create({
    organizationId: req.organizationId,
    internId: intern._id,
    status: ONBOARDING_STATUS.IN_PROGRESS,
    progress: 0
  });

  await recordAuditLog({
    action: 'INTERN_CREATED',
    entityType: 'Intern',
    entityId: intern._id,
    after: { internId, source: body.source, name: `${user.firstName} ${user.lastName}` },
    req
  });

  return successResponse(res, intern, 'Intern created successfully', 201);
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
  // Interns see the events but not internal metadata such as IP addresses or before/after snapshots.
  const timeline = logs.map(log => ({
    action: log.action, timestamp: log.timestamp, actorRole: log.actorRole, actorEmail: req.userRole === ROLES.INTERN ? undefined : log.actorEmail,
    details: req.userRole === ROLES.INTERN ? {} : (log.after || {})
  }));
  return successResponse(res, timeline);
});

export const getInternWorkRecord = ah(async (req, res) => {
  const intern = await loadScopedIntern(req, req.params.id, [
    { path: 'userId', select: 'firstName lastName email avatarUrl' }, { path: 'departmentId', select: 'name code' },
    { path: 'programId', select: 'title durationDays' }, { path: 'mentorId', select: 'firstName lastName email' }
  ]);
  const isSelf = req.userRole === ROLES.INTERN;
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

