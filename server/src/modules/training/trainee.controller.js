import { TrainingProgram, TrainingEngagement, TrainingBatch } from './training.model.js';
import { TraineeTask } from './traineeTask.model.js';
import { TraineeAssessment } from './traineeAssessment.model.js';
import { TraineeProject } from './traineeProject.model.js';
import { TraineeAttendance } from './traineeAttendance.model.js';
import { TraineeActivity } from './traineeActivity.model.js';
import { User } from '../users/user.model.js';
import { Person } from '../people/people.model.js';
import { Organization } from '../organizations/organization.model.js';
import { Certificate } from '../certificates/certificate.model.js';
import { Intern } from '../interns/intern.model.js';
import { generateCertificatePDF, generateFeeReceiptPDF } from '../../utils/pdfGenerator.js';
import { storageService } from '../../utils/storage.js';
import { generateId, generateRandomId } from '../../utils/idGenerator.js';
import { formatDateLong } from '../../utils/time.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { createNotification } from '../notifications/notification.service.js';
import { ah } from '../../utils/asyncHandler.js';
import { notFound, conflict, unprocessable, forbidden, badRequest } from '../../utils/errors.js';
import { Validator, parsePagination, isObjectId, escapeRegex } from '../../utils/validate.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { sendOnboardingCredentialsEmail, sendFeeReceiptEmail } from '../email/email.service.js';

// Calculate rule-based At-Risk status
export function calculateAtRiskStatus(engagement, { attendanceRate, pendingTasksCount, failedAssessmentsCount }) {
  const reasons = [];
  if (attendanceRate !== null && attendanceRate < 75) {
    reasons.push(`Low attendance (${attendanceRate}%) below 75% threshold`);
  }
  if (pendingTasksCount >= 3) {
    reasons.push(`${pendingTasksCount} overdue or pending tasks`);
  }
  if (failedAssessmentsCount > 0) {
    reasons.push(`${failedAssessmentsCount} assessment(s) requiring revision or failed`);
  }
  const daysSinceActivity = (Date.now() - new Date(engagement.lastActivityAt || engagement.createdAt).getTime()) / 86400000;
  if (daysSinceActivity > 14) {
    reasons.push(`No logged activity in the last ${Math.round(daysSinceActivity)} days`);
  }
  return {
    isAtRisk: reasons.length > 0,
    atRiskReasons: reasons
  };
}

// Recalculate engagement measurable progress
export async function updateEngagementProgress(engagementId) {
  const engagement = await TrainingEngagement.findById(engagementId).populate('programId');
  if (!engagement || !engagement.programId) return null;

  const program = engagement.programId;
  const totalModules = program.modules?.length || 1;
  const completedModules = (engagement.completedModuleNumbers || []).length;
  const moduleProgress = Math.min(100, Math.round((completedModules / totalModules) * 100));

  const [totalTasks, approvedTasks] = await Promise.all([
    TraineeTask.countDocuments({ engagementId }),
    TraineeTask.countDocuments({ engagementId, status: 'APPROVED' })
  ]);
  const taskProgress = totalTasks > 0 ? Math.round((approvedTasks / totalTasks) * 100) : 100;

  const [attendanceRecords, presentRecords] = await Promise.all([
    TraineeAttendance.countDocuments({ engagementId }),
    TraineeAttendance.countDocuments({ engagementId, status: { $in: ['PRESENT', 'LATE'] } })
  ]);
  const attendanceRate = attendanceRecords > 0 ? Math.round((presentRecords / attendanceRecords) * 100) : 100;

  const failedAssessments = await TraineeAssessment.countDocuments({ engagementId, status: 'FAILED' });
  const pendingTasks = await TraineeTask.countDocuments({ engagementId, status: { $in: ['ASSIGNED', 'IN_PROGRESS', 'REVISION_REQUIRED'] } });

  // Weighted overall calculation: 40% Modules, 30% Tasks, 20% Attendance, 10% Assessments/Activity
  const overall = Math.round((moduleProgress * 0.4) + (taskProgress * 0.3) + (attendanceRate * 0.2) + (failedAssessments === 0 ? 10 : 0));
  engagement.overallProgress = Math.min(100, Math.max(0, overall));
  engagement.attendancePercent = attendanceRate;

  const atRisk = calculateAtRiskStatus(engagement, {
    attendanceRate,
    pendingTasksCount: pendingTasks,
    failedAssessmentsCount: failedAssessments
  });
  engagement.isAtRisk = atRisk.isAtRisk;
  engagement.atRiskReasons = atRisk.atRiskReasons;

  await engagement.save();
  return engagement;
}

// ==================== TRAINEE PUBLIC / PARTICIPANT APIS ====================

export const getAvailablePrograms = ah(async (req, res) => {
  const programs = await TrainingProgram.find({
    organizationId: req.organizationId,
    isActive: true,
    status: { $in: ['ACTIVE', 'UPCOMING'] }
  })
    .populate('trainerId', 'firstName lastName email')
    .sort({ createdAt: -1 });

  return successResponse(res, programs);
});

export const enrollTrainee = ah(async (req, res) => {
  const v = new Validator(req.body)
    .objectId('programId', { required: true })
    .objectId('userId')
    .objectId('internId');
  const body = v.done();

  const targetUserId = body.userId || req.userId;

  const program = await TrainingProgram.findOne({
    _id: body.programId,
    organizationId: req.organizationId,
    isActive: true
  });
  if (!program) throw notFound('Training program not found');

  const existing = await TrainingEngagement.findOne({
    organizationId: req.organizationId,
    programId: program._id,
    userId: targetUserId,
    status: { $nin: ['DROPPED', 'TERMINATED'] }
  });
  if (existing) {
    throw conflict('Trainee is already enrolled in this training program.', 'ALREADY_ENROLLED', { engagementId: existing._id });
  }

  // Find or create person
  const user = await User.findById(targetUserId);
  if (!user) throw notFound('User not found');
  let person = await Person.findOne({ organizationId: req.organizationId, normalizedEmail: user.email.toLowerCase().trim() });
  if (!person) {
    const rawPhone = user.phone || '0000000000';
    person = await Person.create({
      organizationId: req.organizationId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      normalizedEmail: user.email.toLowerCase().trim(),
      phone: rawPhone,
      normalizedPhone: rawPhone.replace(/[^0-9+]/g, '') || '0000000000',
      userId: user._id
    });
  }

  const engagement = await TrainingEngagement.create({
    organizationId: req.organizationId,
    personId: person._id,
    userId: targetUserId,
    internId: body.internId || undefined,
    programId: program._id,
    trainerId: program.trainerId || undefined,
    mentorId: program.trainerId || undefined,
    status: 'ACTIVE',
    overallProgress: 0,
    completedModuleNumbers: [],
    attendancePercent: 100,
    enrolledAt: new Date(),
    lastActivityAt: new Date()
  });

  await TraineeActivity.create({
    organizationId: req.organizationId,
    engagementId: engagement._id,
    userId: targetUserId,
    action: 'ENROLLED',
    title: `Enrolled in ${program.title}`,
    details: { programCode: program.code, duration: program.duration }
  });

  await recordAuditLog({
    action: 'TRAINEE_ENROLLED',
    entityType: 'TrainingEngagement',
    entityId: engagement._id,
    after: { programTitle: program.title, userId: req.userId },
    req
  });

  return successResponse(res, engagement, 'Enrolled in training program successfully', 201);
});

export const createAndEnrollTrainee = ah(async (req, res) => {
  const {
    firstName, lastName, email, phone, programId, internId, mentorId, managerId, departmentId,
    institution, degree, graduationYear, location, workMode, startDate, expectedEndDate,
    source, referral, compensation, candidatePayment, internalNotes, assignedCourses, concession
  } = req.body;
  if (!firstName || !lastName || !email || !programId) {
    throw badRequest('First name, last name, email, and programId are required');
  }

  const normalizedEmail = email.toLowerCase().trim();
  const program = await TrainingProgram.findOne({
    _id: programId,
    organizationId: req.organizationId
  });
  if (!program) throw notFound('Training program not found');

  let internDoc = null;
  if (internId) {
    internDoc = await Intern.findOne({ _id: internId, organizationId: req.organizationId });
  }

  const rawDigits = Math.floor(100000 + Math.random() * 900000);
  const tempPassword = `Tmt@${rawDigits}`;

  let user = await User.findOne({ organizationId: req.organizationId, email: normalizedEmail });
  if (!user) {
    user = await User.create({
      organizationId: req.organizationId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      phone: phone?.trim() || '0000000000',
      password: tempPassword,
      role: 'INTERN_TRAINEE',
      status: 'ACTIVE',
      isActive: true,
      emailVerified: true
    });
  } else {
    user.password = tempPassword;
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ORGANIZATION_ADMIN') {
      user.role = 'INTERN_TRAINEE';
    }
    await user.save();
  }

  // Find or create Person
  let person = await Person.findOne({ organizationId: req.organizationId, normalizedEmail });
  if (!person) {
    const rawPhone = phone?.trim() || user.phone || '0000000000';
    person = await Person.create({
      organizationId: req.organizationId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      normalizedEmail,
      phone: rawPhone,
      normalizedPhone: rawPhone.replace(/[^0-9+]/g, '') || '0000000000',
      userId: user._id
    });
  }

  // Build concessions array if passed
  const concessionsList = [];
  if (concession && concession.concessionType) {
    concessionsList.push({
      concessionType: concession.concessionType,
      description: concession.description || '',
      amountOrPercentage: concession.amountOrPercentage || '',
      reason: concession.reason || '',
      originalFee: Number(concession.originalFee) || 0,
      adjustedFee: Number(concession.adjustedFee) || 0,
      effectiveDate: new Date(),
      approvalStatus: concession.approvalStatus || 'APPROVED',
      approvedBy: req.userId,
      approvedAt: new Date(),
      internalRemarks: concession.internalRemarks || ''
    });
  }

  // Candidate payment object
  const candidatePaymentObj = {
    feeType: candidatePayment?.feeType || program.feeType || 'PAID',
    feeAmount: candidatePayment?.feeAmount !== undefined ? Number(candidatePayment.feeAmount) : (program.grossFee || 0),
    amountPaid: candidatePayment?.amountPaid !== undefined ? Number(candidatePayment.amountPaid) : (program.amountPaid || 0),
    paymentStatus: candidatePayment?.paymentStatus || (program.feeType === 'FREE' ? 'PAID' : (program.paymentStatus || 'PENDING')),
    paymentMethod: candidatePayment?.paymentMethod || '',
    paymentReference: candidatePayment?.paymentReference || '',
    paidAt: candidatePayment?.paidAt ? new Date(candidatePayment.paidAt) : undefined,
    notes: candidatePayment?.notes || ''
  };

  // Compensation / stipend object
  const compensationObj = {
    type: compensation?.type || internDoc?.compensation?.type || 'UNPAID',
    amount: compensation?.amount !== undefined ? Number(compensation.amount) : (internDoc?.compensation?.amount || 0),
    currency: compensation?.currency || internDoc?.compensation?.currency || 'INR',
    frequency: compensation?.frequency || internDoc?.compensation?.frequency || 'MONTHLY',
    startDate: compensation?.startDate ? new Date(compensation.startDate) : (internDoc?.compensation?.startDate || new Date()),
    approvedBy: req.userId
  };

  // Referral details
  const referralObj = referral || internDoc?.referral || (req.body.referredById || req.body.referralName ? {
    referredById: req.body.referredById || undefined,
    referralName: req.body.referralName || '',
    referralEmail: req.body.referralEmail || '',
    relationship: req.body.relationship || '',
    notes: req.body.referralNotes || '',
    date: req.body.referralDate ? new Date(req.body.referralDate) : new Date()
  } : undefined);

  const traineeId = internDoc?.internId || await generateId('TRN');
  const start = startDate ? new Date(startDate) : (internDoc?.startDate || new Date());
  const end = expectedEndDate ? new Date(expectedEndDate) : (internDoc?.expectedEndDate || new Date(Date.now() + 86400000 * ((program.durationWeeks || 8) * 7)));

  // Check existing engagement in this program
  let engagement = await TrainingEngagement.findOne({
    organizationId: req.organizationId,
    programId: program._id,
    userId: user._id,
    status: { $nin: ['DROPPED', 'TERMINATED'] }
  });

  if (!engagement) {
    if (!internDoc) {
      try {
        const { Department } = await import('../organizations/organization.model.js');
        const { InternshipProgram } = await import('../recruitment/recruitment.model.js');
        let targetDeptId = departmentId;
        if (!targetDeptId) {
          const anyDept = await Department.findOne({ organizationId: req.organizationId });
          targetDeptId = anyDept?._id;
        }
        let targetProgId = program._id;
        const progExists = await InternshipProgram.exists({ _id: program._id });
        if (!progExists) {
          const anyProg = await InternshipProgram.findOne({ organizationId: req.organizationId });
          targetProgId = anyProg?._id;
        }
        if (targetDeptId && targetProgId) {
          internDoc = await Intern.create({
            internId: traineeId,
            userId: user._id,
            organizationId: req.organizationId,
            departmentId: targetDeptId,
            programId: targetProgId,
            mentorId: mentorId || program.trainerId || undefined,
            managerId: managerId || req.userId,
            workMode: workMode || 'REMOTE',
            startDate: start,
            expectedEndDate: end,
            status: 'ACTIVE',
            source: source || 'APPLICATION',
            institution: institution || '',
            degree: degree || '',
            location: location || '',
            compensation: compensationObj
          });
        }
      } catch {
        // Fall back gracefully if already exists
      }
    }

    engagement = await TrainingEngagement.create({
      organizationId: req.organizationId,
      personId: person._id,
      userId: user._id,
      internId: internId || internDoc?._id || undefined,
      traineeId,
      departmentId: departmentId || internDoc?.departmentId || undefined,
      programId: program._id,
      trainerId: mentorId || program.trainerId || undefined,
      mentorId: mentorId || program.trainerId || undefined,
      managerId: managerId || internDoc?.managerId || req.userId,
      workMode: workMode || internDoc?.workMode || 'REMOTE',
      startDate: start,
      expectedEndDate: end,
      activatedAt: new Date(),
      source: source || internDoc?.source || 'APPLICATION',
      institution: institution || internDoc?.institution || '',
      degree: degree || internDoc?.degree || '',
      graduationYear: graduationYear || internDoc?.graduationYear || '',
      location: location || internDoc?.location || '',
      internalNotes: internalNotes || internDoc?.internalNotes || '',
      referral: referralObj,
      compensation: compensationObj,
      candidatePayment: candidatePaymentObj,
      assignedCourses: Array.isArray(assignedCourses) ? assignedCourses : [],
      learningSpacesUrl: (req.body.learningSpacesUrl || program.learningSpacesUrl || '').trim(),
      learningSpacesName: (req.body.learningSpacesName || program.learningSpacesName || 'TechMecha Learning Spaces').trim(),
      concessions: concessionsList,
      status: 'ACTIVE',
      overallProgress: 0,
      completedModuleNumbers: [],
      attendancePercent: 100,
      enrolledAt: new Date(),
      lastActivityAt: new Date()
    });

    await TraineeActivity.create({
      organizationId: req.organizationId,
      engagementId: engagement._id,
      userId: user._id,
      action: 'ENROLLED',
      title: `Enrolled in ${program.title}`,
      details: { programCode: program.code, duration: program.duration }
    });
  } else {
    if (concessionsList.length > 0) {
      engagement.concessions.push(...concessionsList);
      await engagement.save();
    }
  }

  // Dispatch credentials email asynchronously
  const portalUrl = env.CLIENT_URL || env.FRONTEND_URL || 'http://localhost:3000';
  sendOnboardingCredentialsEmail({
    to: user.email,
    name: `${user.firstName} ${user.lastName}`,
    email: user.email,
    temporaryPassword: tempPassword,
    role: 'Intern Trainee',
    portalUrl
  }).catch((err) => {
    logger.warn(`Failed to send onboarding email to ${user.email}: ${err.message}`);
  });

  await recordAuditLog({
    action: 'TRAINEE_CREATED_AND_ENROLLED',
    entityType: 'TrainingEngagement',
    entityId: engagement._id,
    after: { programTitle: program.title, email: user.email },
    req
  });

  return successResponse(
    res,
    {
      engagement,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      },
      credentials: {
        email: user.email,
        temporaryPassword: tempPassword
      }
    },
    'Intern trainee created, enrolled, and credentials emailed successfully',
    201
  );
});

export const getMyTraineeProfile = ah(async (req, res) => {
  let engagement = await TrainingEngagement.findOne({
    organizationId: req.organizationId,
    userId: req.userId,
    status: { $nin: ['DROPPED', 'TERMINATED'] }
  })
    .populate('programId')
    .populate('mentorId', 'firstName lastName email avatarUrl')
    .sort({ createdAt: -1 });

  if (!engagement) {
    return successResponse(res, null);
  }

  const program = engagement.programId;
  const [tasks, assessments, project, activities, attendanceRecords] = await Promise.all([
    TraineeTask.find({ engagementId: engagement._id }).sort({ dueDate: 1 }),
    TraineeAssessment.find({ engagementId: engagement._id }).sort({ assessmentDate: -1 }),
    TraineeProject.findOne({ engagementId: engagement._id }),
    TraineeActivity.find({ engagementId: engagement._id }).sort({ timestamp: -1 }).limit(15),
    TraineeAttendance.find({ engagementId: engagement._id }).sort({ date: -1 }).limit(30)
  ]);

  const tasksCompleted = tasks.filter(t => t.status === 'APPROVED').length;
  const assessmentsPassed = assessments.filter(a => a.status === 'PASSED').length;
  const presentDays = attendanceRecords.filter(a => ['PRESENT', 'LATE'].includes(a.status)).length;
  const attendancePercent = attendanceRecords.length > 0 ? Math.round((presentDays / attendanceRecords.length) * 100) : 100;

  return successResponse(res, {
    engagement,
    program,
    dashboard: {
      overallProgress: engagement.overallProgress,
      attendancePercent,
      attendanceDays: presentDays,
      totalAttendanceDays: attendanceRecords.length,
      modulesCompletedCount: (engagement.completedModuleNumbers || []).length,
      totalModulesCount: program?.modules?.length || 0,
      tasksCompletedCount: tasksCompleted,
      totalTasksCount: tasks.length,
      assessmentsPassedCount: assessmentsPassed,
      totalAssessmentsCount: assessments.length,
      projectStatus: project?.status || 'NOT_STARTED',
      isAtRisk: engagement.isAtRisk,
      atRiskReasons: engagement.atRiskReasons || []
    },
    tasks,
    assessments,
    project,
    timeline: activities,
    attendance: attendanceRecords
  });
});

export const submitTraineeTask = ah(async (req, res) => {
  const task = await TraineeTask.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!task) throw notFound('Task not found');

  if (String(task.assignedTo) !== String(req.userId) && !['GLOBAL_ADMIN', 'ADMIN', 'HR_ADMIN', 'TRAINER'].includes(req.user?.role)) {
    throw forbidden('You can only submit tasks assigned to you.');
  }

  const v = new Validator(req.body)
    .string('workNotes', { max: 2000 })
    .url('githubUrl')
    .url('demoUrl')
    .url('fileUrl');
  const body = v.done();

  task.submission = {
    submittedAt: new Date(),
    workNotes: body.workNotes || req.body.notes || '',
    githubUrl: body.githubUrl || '',
    demoUrl: body.demoUrl || '',
    fileUrl: body.fileUrl || '',
    fileName: req.body.fileName || ''
  };
  task.status = 'UNDER_REVIEW';
  await task.save();

  if (task.engagementId) {
    await TraineeActivity.create({
      organizationId: req.organizationId,
      engagementId: task.engagementId,
      userId: req.userId,
      action: 'TASK_SUBMITTED',
      title: `Submitted task: ${task.title}`,
      details: { githubUrl: body.githubUrl, demoUrl: body.demoUrl }
    });
    await updateEngagementProgress(task.engagementId);
  }

  await recordAuditLog({
    action: 'TRAINEE_TASK_SUBMITTED',
    entityType: 'TraineeTask',
    entityId: task._id,
    after: { title: task.title, status: 'UNDER_REVIEW' },
    req
  });

  return successResponse(res, task, 'Task submitted for review');
});

export const completeModule = ah(async (req, res) => {
  const { moduleNumber } = req.body;
  if (moduleNumber == null || Number(moduleNumber) < 1) {
    throw unprocessable('Invalid module number', [{ field: 'moduleNumber', message: 'Valid number required' }]);
  }

  const engagement = await TrainingEngagement.findOne({
    organizationId: req.organizationId,
    userId: req.userId,
    status: { $nin: ['DROPPED', 'TERMINATED'] }
  });
  if (!engagement) throw notFound('Active trainee engagement not found');

  const num = Number(moduleNumber);
  if (!engagement.completedModuleNumbers.includes(num)) {
    engagement.completedModuleNumbers.push(num);
    engagement.lastActivityAt = new Date();
    await engagement.save();

    await TraineeActivity.create({
      organizationId: req.organizationId,
      engagementId: engagement._id,
      userId: req.userId,
      action: 'MODULE_COMPLETED',
      title: `Completed Module ${num}`,
      details: { moduleNumber: num }
    });

    await updateEngagementProgress(engagement._id);
  }

  return successResponse(res, engagement, `Module ${num} marked as completed`);
});

// ==================== ADMIN / TRAINER MANAGEMENT APIS ====================

export const getAdminTrainees = ah(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 200 });
  const query = { organizationId: req.organizationId };

  if (req.query.status) query.status = req.query.status.toUpperCase();
  if (isObjectId(req.query.programId)) query.programId = req.query.programId;
  if (req.query.atRisk === 'true') query.isAtRisk = true;

  if (req.query.search) {
    const rx = new RegExp(escapeRegex(String(req.query.search).slice(0, 80)), 'i');
    const users = await User.find({ organizationId: req.organizationId, $or: [{ firstName: rx }, { lastName: rx }, { email: rx }] }).select('_id');
    query.userId = { $in: users.map(u => u._id) };
  }

  const [engagements, total, activeCount, completedCount, atRiskCount] = await Promise.all([
    TrainingEngagement.find(query)
      .populate('userId', 'firstName lastName email phone avatarUrl')
      .populate('programId', 'title code duration durationWeeks')
      .populate('mentorId', 'firstName lastName email')
      .populate('managerId', 'firstName lastName email')
      .populate('departmentId', 'name code')
      .populate('internId', 'internId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    TrainingEngagement.countDocuments(query),
    TrainingEngagement.countDocuments({ organizationId: req.organizationId, status: { $in: ['ENROLLED', 'ACTIVE', 'ACTIVE_TRAINING'] } }),
    TrainingEngagement.countDocuments({ organizationId: req.organizationId, status: { $in: ['TRAINING_COMPLETED', 'COMPLETED'] } }),
    TrainingEngagement.countDocuments({ organizationId: req.organizationId, isAtRisk: true })
  ]);

  return paginatedResponse(res, engagements, { page, limit, total }, {
    stats: {
      active: activeCount,
      completed: completedCount,
      atRisk: atRiskCount,
      total
    }
  });
});

export const getAdminTraineeDetail = ah(async (req, res) => {
  const engagement = await TrainingEngagement.findOne({
    _id: req.params.id,
    organizationId: req.organizationId
  })
    .populate('userId', 'firstName lastName email phone avatarUrl')
    .populate('programId')
    .populate('mentorId', 'firstName lastName email')
    .populate('managerId', 'firstName lastName email')
    .populate('departmentId', 'name code')
    .populate('referral.referredById', 'firstName lastName email')
    .populate('internId');

  if (!engagement) throw notFound('Trainee record not found');

  const [tasks, assessments, project, activities, attendanceRecords] = await Promise.all([
    TraineeTask.find({ engagementId: engagement._id }).sort({ dueDate: 1 }),
    TraineeAssessment.find({ engagementId: engagement._id }).sort({ assessmentDate: -1 }),
    TraineeProject.findOne({ engagementId: engagement._id }),
    TraineeActivity.find({ engagementId: engagement._id }).sort({ timestamp: -1 }).limit(30),
    TraineeAttendance.find({ engagementId: engagement._id }).sort({ date: -1 })
  ]);

  return successResponse(res, {
    engagement,
    tasks,
    assessments,
    project,
    activities,
    attendance: attendanceRecords
  });
});

export const updateAdminTrainee = ah(async (req, res) => {
  const engagement = await TrainingEngagement.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!engagement) throw notFound('Trainee record not found');

  const before = engagement.toObject();
  const allowedFields = [
    'institution', 'degree', 'graduationYear', 'location', 'workMode',
    'internalNotes', 'source', 'status', 'learningSpacesUrl', 'learningSpacesName', 'assignedCourses'
  ];
  allowedFields.forEach((f) => {
    if (req.body[f] !== undefined) {
      engagement[f] = req.body[f];
    }
  });

  if (req.body.departmentId) engagement.departmentId = req.body.departmentId;
  if (req.body.mentorId) engagement.mentorId = req.body.mentorId;
  if (req.body.managerId) engagement.managerId = req.body.managerId;

  if (req.body.startDate) engagement.startDate = new Date(req.body.startDate);
  if (req.body.expectedEndDate) {
    const end = new Date(req.body.expectedEndDate);
    if (engagement.expectedEndDate && end.getTime() !== engagement.expectedEndDate.getTime()) {
      engagement.extensionHistory.push({
        previousEndDate: engagement.expectedEndDate,
        newEndDate: end,
        reason: req.body.reason || 'Curriculum duration update',
        changedBy: req.userId
      });
    }
    engagement.expectedEndDate = end;
  }

  if (req.body.compensation && typeof req.body.compensation === 'object') {
    engagement.compensation = {
      ...engagement.compensation?.toObject?.() || {},
      ...req.body.compensation
    };
  }

  if (req.body.candidatePayment && typeof req.body.candidatePayment === 'object') {
    const cp = req.body.candidatePayment;
    engagement.candidatePayment = {
      feeType: cp.feeType || engagement.candidatePayment?.feeType || 'PAID',
      feeAmount: cp.feeAmount !== undefined ? Number(cp.feeAmount) : (engagement.candidatePayment?.feeAmount || 0),
      amountPaid: cp.amountPaid !== undefined ? Number(cp.amountPaid) : (engagement.candidatePayment?.amountPaid || 0),
      paymentStatus: cp.paymentStatus || engagement.candidatePayment?.paymentStatus || 'PENDING',
      paymentMethod: cp.paymentMethod !== undefined ? cp.paymentMethod : (engagement.candidatePayment?.paymentMethod || ''),
      paymentReference: cp.paymentReference !== undefined ? cp.paymentReference : (engagement.candidatePayment?.paymentReference || ''),
      paidAt: cp.paidAt ? new Date(cp.paidAt) : (engagement.candidatePayment?.paidAt || undefined),
      notes: cp.notes !== undefined ? cp.notes : (engagement.candidatePayment?.notes || '')
    };
  }

  await engagement.save();
  await recordAuditLog({
    action: 'TRAINEE_UPDATED',
    entityType: 'TrainingEngagement',
    entityId: engagement._id,
    before,
    after: engagement.toObject(),
    req
  });

  return successResponse(res, engagement, 'Trainee profile updated successfully');
});

export const createTraineeTask = ah(async (req, res) => {
  const engagementIdParam = req.params.engagementId;
  let engagement = null;
  if (engagementIdParam) {
    engagement = await TrainingEngagement.findOne({ _id: engagementIdParam, organizationId: req.organizationId });
    if (!engagement) throw notFound('Trainee engagement not found');
  }

  const v = new Validator(req.body)
    .objectId('programId', { required: !engagement })
    .objectId('assignedTo', { required: !engagement })
    .objectId('engagementId')
    .string('title', { required: true, max: 200 })
    .string('description', { max: 2000 })
    .string('dueDate')
    .oneOf('priority', ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], { defaultValue: 'MEDIUM' })
    .number('moduleNumber', { defaultValue: 1 });
  const body = v.done();

  let engagementId = engagement ? engagement._id : body.engagementId;
  const programId = engagement ? engagement.programId : body.programId;
  const assignedTo = engagement ? engagement.userId : body.assignedTo;

  if (!engagementId && programId && assignedTo) {
    const eng = await TrainingEngagement.findOne({ programId, userId: assignedTo });
    if (eng) engagementId = eng._id;
  }

  const task = await TraineeTask.create({
    organizationId: req.organizationId,
    programId,
    engagementId,
    assignedTo,
    title: body.title,
    description: body.description || '',
    dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    priority: body.priority,
    moduleNumber: body.moduleNumber,
    status: 'ASSIGNED'
  });

  if (engagementId) {
    await TraineeActivity.create({
      organizationId: req.organizationId,
      engagementId,
      userId: assignedTo,
      action: 'TASK_ASSIGNED',
      title: `Task Assigned: ${task.title}`,
      details: { dueDate: task.dueDate, priority: task.priority }
    });
  }

  await createNotification({
    organizationId: req.organizationId,
    recipientId: assignedTo,
    type: 'TASK_ASSIGNED',
    title: 'New Training Task Assigned',
    message: `You were assigned: ${task.title}.`,
    entityType: 'TraineeTask',
    entityId: task._id
  });

  return successResponse(res, task, 'Task created successfully', 201);
});

export const reviewTraineeTask = ah(async (req, res) => {
  const task = await TraineeTask.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!task) throw notFound('Task not found');

  const v = new Validator(req.body)
    .oneOf('status', ['APPROVED', 'REVISION_REQUIRED', 'IN_PROGRESS'], { required: true })
    .string('feedback', { max: 1000 })
    .number('score', { min: 0, max: 100 });
  const body = v.done();

  task.status = body.status;
  task.review = {
    reviewedBy: req.userId,
    reviewedAt: new Date(),
    feedback: body.feedback || '',
    score: body.score !== undefined ? body.score : task.review?.score
  };
  await task.save();

  if (task.engagementId) {
    await TraineeActivity.create({
      organizationId: req.organizationId,
      engagementId: task.engagementId,
      userId: task.assignedTo,
      action: 'TASK_REVIEWED',
      title: `Task ${body.status}: ${task.title}`,
      details: { feedback: body.feedback, score: body.score }
    });
    await updateEngagementProgress(task.engagementId);
  }

  await createNotification({
    organizationId: req.organizationId,
    recipientId: task.assignedTo,
    type: 'TASK_REVIEWED',
    title: `Task ${body.status === 'APPROVED' ? 'Approved' : 'Revision Required'}`,
    message: `Your submission for "${task.title}" was ${body.status.toLowerCase()}.${body.feedback ? ' Feedback: ' + body.feedback : ''}`,
    entityType: 'TraineeTask',
    entityId: task._id
  });

  return successResponse(res, task, `Task reviewed: ${body.status}`);
});

export const recordAttendance = ah(async (req, res) => {
  const engagementIdParam = req.params.engagementId;
  const v = new Validator(req.body)
    .objectId('engagementId', { required: !engagementIdParam })
    .string('date', { required: true })
    .oneOf('status', ['PRESENT', 'ABSENT', 'LATE'], { defaultValue: 'PRESENT' })
    .string('notes', { max: 300 });
  const body = v.done();

  const targetEngagementId = engagementIdParam || body.engagementId;
  const engagement = await TrainingEngagement.findOne({ _id: targetEngagementId, organizationId: req.organizationId });
  if (!engagement) throw notFound('Trainee engagement not found');

  const dateObj = new Date(body.date);
  dateObj.setHours(0, 0, 0, 0);

  const attendance = await TraineeAttendance.findOneAndUpdate(
    { organizationId: req.organizationId, engagementId: engagement._id, date: dateObj },
    {
      $set: {
        userId: engagement.userId,
        programId: engagement.programId,
        status: body.status,
        markedBy: req.userId,
        notes: body.notes || ''
      }
    },
    { upsert: true, new: true }
  );

  await updateEngagementProgress(engagement._id);

  return successResponse(res, attendance, 'Attendance recorded');
});

export const recordAssessment = ah(async (req, res) => {
  const engagementIdParam = req.params.engagementId;
  const v = new Validator(req.body)
    .objectId('engagementId', { required: !engagementIdParam })
    .string('title', { required: true, max: 150 })
    .number('score', { min: 0 })
    .number('maxScore', { defaultValue: 100, min: 1 })
    .number('passingScore', { defaultValue: 70, min: 0 })
    .string('assessmentUrl', { max: 1000 })
    .string('link', { max: 1000 })
    .string('platformName', { max: 150 })
    .string('instructions', { max: 2000 })
    .string('feedback', { max: 1000 });
  const body = v.done();

  const targetEngagementId = engagementIdParam || body.engagementId;
  const engagement = await TrainingEngagement.findOne({ _id: targetEngagementId, organizationId: req.organizationId });
  if (!engagement) throw notFound('Trainee engagement not found');

  const maxScore = Number(body.maxScore) || 100;
  const passingScore = Number(body.passingScore) || 70;
  const hasScore = body.score !== undefined && body.score !== null;
  const score = hasScore ? Number(body.score) : 0;
  const percentage = hasScore ? Math.round((score / maxScore) * 100) : 0;

  let status = req.body.status;
  if (!status) {
    if (hasScore) {
      status = percentage >= passingScore ? 'PASSED' : 'FAILED';
    } else {
      status = 'PENDING';
    }
  }

  const assessmentUrl = (body.assessmentUrl || body.link || req.body.url || '').trim();
  const platformName = (body.platformName || 'Learning Spaces').trim();

  const assessment = await TraineeAssessment.create({
    organizationId: req.organizationId,
    programId: engagement.programId,
    engagementId: engagement._id,
    userId: engagement.userId,
    title: body.title,
    assessmentDate: req.body.assessmentDate ? new Date(req.body.assessmentDate) : new Date(),
    dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
    assessmentUrl,
    platformName,
    instructions: body.instructions || req.body.instructions || '',
    score,
    maxScore,
    passingScore,
    percentage,
    status,
    feedback: body.feedback || '',
    evaluatedBy: req.userId
  });

  await TraineeActivity.create({
    organizationId: req.organizationId,
    engagementId: engagement._id,
    userId: engagement.userId,
    action: 'ASSESSMENT_RECORDED',
    title: `Assessment: ${assessment.title} (${hasScore ? `${percentage}%` : status})`,
    details: { score, maxScore, status, assessmentUrl }
  });

  await updateEngagementProgress(engagement._id);

  return successResponse(res, assessment, 'Assessment recorded', 201);
});

export const recordMentorFeedback = ah(async (req, res) => {
  const targetEngagementId = req.params.engagementId || req.body.engagementId;
  const engagement = await TrainingEngagement.findOne({ _id: targetEngagementId, organizationId: req.organizationId });
  if (!engagement) throw notFound('Trainee engagement not found');

  const v = new Validator(req.body)
    .number('technicalSkills', { min: 1, max: 5, defaultValue: 4 })
    .number('communication', { min: 1, max: 5, defaultValue: 4 })
    .number('problemSolving', { min: 1, max: 5, defaultValue: 4 })
    .number('taskCompletion', { min: 1, max: 5, defaultValue: 4 })
    .number('professionalism', { min: 1, max: 5, defaultValue: 4 })
    .string('overallFeedback', { max: 2000 });
  const body = v.done();

  engagement.mentorFeedback = engagement.mentorFeedback || [];
  engagement.mentorFeedback.push({
    mentorId: req.userId,
    date: new Date(),
    technicalSkills: body.technicalSkills,
    communication: body.communication,
    problemSolving: body.problemSolving,
    taskCompletion: body.taskCompletion,
    professionalism: body.professionalism,
    overallFeedback: body.overallFeedback || ''
  });
  engagement.lastActivityAt = new Date();
  await engagement.save();

  await TraineeActivity.create({
    organizationId: req.organizationId,
    engagementId: engagement._id,
    userId: engagement.userId,
    action: 'MENTOR_REVIEW_COMPLETED',
    title: 'Mentor Review Recorded',
    details: {
      technicalSkills: body.technicalSkills,
      problemSolving: body.problemSolving,
      feedback: body.overallFeedback
    }
  });

  return successResponse(res, engagement, 'Mentor review recorded successfully');
});

export const updateProject = ah(async (req, res) => {
  const v = new Validator(req.body)
    .objectId('engagementId', { required: true })
    .string('title', { required: true, max: 150 })
    .string('description', { max: 2000 })
    .url('githubUrl')
    .url('demoUrl')
    .oneOf('status', ['NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REVISION_REQUIRED'], { defaultValue: 'IN_PROGRESS' });
  const body = v.done();

  const engagement = await TrainingEngagement.findOne({ _id: body.engagementId, organizationId: req.organizationId });
  if (!engagement) throw notFound('Trainee engagement not found');

  const project = await TraineeProject.findOneAndUpdate(
    { engagementId: engagement._id },
    {
      $set: {
        organizationId: req.organizationId,
        programId: engagement.programId,
        userId: engagement.userId,
        title: body.title,
        description: body.description || '',
        githubUrl: body.githubUrl || '',
        demoUrl: body.demoUrl || '',
        status: body.status,
        mentorId: engagement.mentorId || req.userId
      }
    },
    { upsert: true, new: true }
  );

  return successResponse(res, project, 'Project updated');
});

// Connects to Certificate Generator System when completed
export const completeTraineeProgram = ah(async (req, res) => {
  const targetId = req.params.id || req.params.engagementId;
  const engagement = await TrainingEngagement.findOne({ _id: targetId, organizationId: req.organizationId })
    .populate('userId')
    .populate('programId');

  if (!engagement) throw notFound('Trainee engagement not found');
  if (engagement.status === 'COMPLETED' && engagement.certificateId) {
    throw conflict('This trainee has already completed the program and received a certificate.', 'ALREADY_COMPLETED');
  }

  const [org, approvedTasksCount, passedAssessmentsCount, project] = await Promise.all([
    Organization.findById(req.organizationId),
    TraineeTask.countDocuments({ engagementId: engagement._id, status: 'APPROVED' }),
    TraineeAssessment.countDocuments({ engagementId: engagement._id, status: 'PASSED' }),
    TraineeProject.findOne({ engagementId: engagement._id })
  ]);

  const certificateId = await generateRandomId('CERT', async (id) => !!(await Certificate.exists({ certificateId: id })));
  const tz = req.timezone || 'Asia/Kolkata';
  const user = engagement.userId;
  const program = engagement.programId;

  const certData = {
    internName: `${user.firstName} ${user.lastName}`,
    internId: `TRN-${user._id.toString().slice(-6).toUpperCase()}`,
    programTitle: program.title,
    departmentName: 'Professional Training & Learning Division',
    organizationName: org.name,
    startDate: formatDateLong(engagement.enrolledAt, tz),
    endDate: formatDateLong(new Date(), tz),
    duration: program.duration || `${program.durationWeeks || 8} Weeks`,
    certificateId,
    issueDate: formatDateLong(new Date(), tz),
    signatory: org.signatory?.name || 'Director of Training',
    verifyUrl: `${env.FRONTEND_URL}/verify/certificate/${certificateId}`
  };

  const pdf = await generateCertificatePDF(certData);
  const stored = await storageService.saveFile({
    buffer: pdf,
    originalName: `${certificateId}.pdf`,
    mimeType: 'application/pdf',
    subDir: `certificates/${req.organizationId}`
  });

  const cert = await Certificate.create({
    certificateId,
    organizationId: req.organizationId,
    userId: user._id,
    internName: certData.internName,
    programTitle: certData.programTitle,
    departmentName: certData.departmentName,
    organizationName: org.name,
    startDate: certData.startDate,
    endDate: certData.endDate,
    duration: certData.duration,
    issueDate: certData.issueDate,
    issuedBy: req.userId,
    signatory: certData.signatory,
    filePath: stored.filePath,
    checksum: stored.checksum,
    status: 'ACTIVE'
  });

  engagement.status = 'COMPLETED';
  engagement.completedAt = new Date();
  engagement.certificateId = certificateId;
  engagement.completionSnapshot = {
    isEligible: true,
    completedAt: new Date(),
    attendanceRate: engagement.attendancePercent || 100,
    tasksApprovedCount: approvedTasksCount,
    assessmentsPassedCount: passedAssessmentsCount,
    projectApproved: project?.status === 'APPROVED',
    approvedBy: req.userId
  };
  await engagement.save();

  await TraineeActivity.create({
    organizationId: req.organizationId,
    engagementId: engagement._id,
    userId: user._id,
    action: 'PROGRAM_COMPLETED',
    title: `Graduated & Certificate Issued (${certificateId})`,
    details: { certificateId }
  });

  await createNotification({
    organizationId: req.organizationId,
    recipientId: user._id,
    type: 'CERTIFICATE_ISSUED',
    title: 'Training Program Completed!',
    message: `Congratulations! Your certificate (${certificateId}) for ${program.title} has been generated.`,
    entityType: 'Certificate',
    entityId: cert._id
  });

  await recordAuditLog({
    action: 'TRAINEE_PROGRAM_COMPLETED',
    entityType: 'TrainingEngagement',
    entityId: engagement._id,
    after: { certificateId, programTitle: program.title },
    req
  });

  return successResponse(res, {
    engagement,
    certificate: cert,
    certificateId: cert.certificateId
  }, 'Program completed and certificate issued', 201);
});

export const downloadTraineeReceipt = ah(async (req, res) => {
  const engagement = await TrainingEngagement.findOne({
    _id: req.params.id,
    organizationId: req.organizationId
  }).populate('userId', 'firstName lastName email phone')
    .populate('programId')
    .populate('batchId', 'name');

  if (!engagement) throw notFound('Trainee engagement record not found');

  const org = await Organization.findById(req.organizationId);
  const cp = engagement.candidatePayment || {};
  const feeAmount = cp.feeAmount !== undefined ? Number(cp.feeAmount) : (engagement.programId?.grossFee || 0);
  const amountPaid = cp.amountPaid !== undefined ? Number(cp.amountPaid) : 0;
  const concession = engagement.concession?.amount || 0;
  const balance = Math.max(0, feeAmount - concession - amountPaid);
  const receiptId = cp.receiptId || `RCP-${new Date().getFullYear()}-${engagement._id.toString().slice(-6).toUpperCase()}`;

  const pdfBuffer = await generateFeeReceiptPDF({
    traineeName: `${engagement.userId?.firstName || 'Trainee'} ${engagement.userId?.lastName || ''}`.trim(),
    traineeId: `TRN-${engagement.userId?._id?.toString().slice(-6).toUpperCase()}`,
    email: engagement.userId?.email || '',
    phone: engagement.userId?.phone || '',
    college: engagement.profileSnapshot?.college || '',
    programTitle: engagement.programId?.title || 'Training Program',
    batchName: engagement.batchId?.name || 'Default Batch',
    receiptId,
    paymentStatus: cp.paymentStatus || (amountPaid >= (feeAmount - concession) ? 'PAID' : 'PARTIAL'),
    feeAmount,
    concession,
    amountPaid,
    balance,
    paymentMethod: cp.paymentMethod || 'UPI / Online Transfer',
    paymentReference: cp.paymentReference || 'VERIFIED-TRANSACTION',
    paidAt: cp.paidAt || engagement.enrolledAt || new Date(),
    organizationName: org?.name || 'TechMecha Torque Pvt. Ltd.'
  });

  const inline = req.query.inline === '1';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${receiptId}.pdf"`);
  return res.send(pdfBuffer);
});

export const sendTraineeReceipt = ah(async (req, res) => {
  const engagement = await TrainingEngagement.findOne({
    _id: req.params.id,
    organizationId: req.organizationId
  }).populate('userId', 'firstName lastName email phone')
    .populate('programId')
    .populate('batchId', 'name');

  if (!engagement) throw notFound('Trainee engagement record not found');
  if (!engagement.userId?.email) throw conflict('Trainee has no registered email address');

  const org = await Organization.findById(req.organizationId);
  const cp = engagement.candidatePayment || {};
  const feeAmount = cp.feeAmount !== undefined ? Number(cp.feeAmount) : (engagement.programId?.grossFee || 0);
  const amountPaid = cp.amountPaid !== undefined ? Number(cp.amountPaid) : 0;
  const concession = engagement.concession?.amount || 0;
  const balance = Math.max(0, feeAmount - concession - amountPaid);
  const receiptId = cp.receiptId || `RCP-${new Date().getFullYear()}-${engagement._id.toString().slice(-6).toUpperCase()}`;

  const pdfBuffer = await generateFeeReceiptPDF({
    traineeName: `${engagement.userId?.firstName || 'Trainee'} ${engagement.userId?.lastName || ''}`.trim(),
    traineeId: `TRN-${engagement.userId?._id?.toString().slice(-6).toUpperCase()}`,
    email: engagement.userId?.email || '',
    phone: engagement.userId?.phone || '',
    college: engagement.profileSnapshot?.college || '',
    programTitle: engagement.programId?.title || 'Training Program',
    batchName: engagement.batchId?.name || 'Default Batch',
    receiptId,
    paymentStatus: cp.paymentStatus || (amountPaid >= (feeAmount - concession) ? 'PAID' : 'PARTIAL'),
    feeAmount,
    concession,
    amountPaid,
    balance,
    paymentMethod: cp.paymentMethod || 'UPI / Online Transfer',
    paymentReference: cp.paymentReference || 'VERIFIED-TRANSACTION',
    paidAt: cp.paidAt || engagement.enrolledAt || new Date(),
    organizationName: org?.name || 'TechMecha Torque Pvt. Ltd.'
  });

  await sendFeeReceiptEmail({
    to: engagement.userId.email,
    traineeName: engagement.userId.firstName,
    traineeId: `TRN-${engagement.userId._id.toString().slice(-6).toUpperCase()}`,
    programTitle: engagement.programId?.title || 'Training Program',
    receiptId,
    amountPaid,
    paymentMethod: cp.paymentMethod || 'UPI / Online Transfer',
    paymentReference: cp.paymentReference || 'VERIFIED-TRANSACTION',
    paidAt: cp.paidAt || engagement.enrolledAt || new Date(),
    balance,
    orgName: org?.name || 'TechMecha Torque Pvt. Ltd.',
    attachments: [{
      filename: `${receiptId}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }]
  });

  return successResponse(res, { receiptId }, `Payment receipt dispatched to ${engagement.userId.email}`);
});
