import { Leave } from './leave.model.js';
import { AttendanceRecord } from '../attendance/attendance.model.js';
import { Intern } from '../interns/intern.model.js';
import { getOwnIntern, internScope } from '../interns/intern.access.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { createNotification } from '../notifications/notification.service.js';
import { ATTENDANCE_STATUS, ATTENDANCE_MODE, LEAVE_STATUS, LEAVE_TYPE } from '../../../../shared/constants.js';
import { INTERN_WORKING_STATUSES, LEAVE_TRANSITIONS, assertTransition } from '../../../../shared/lifecycle.js';
import { ah } from '../../utils/asyncHandler.js';
import { notFound, conflict, unprocessable } from '../../utils/errors.js';
import { Validator, parsePagination, isObjectId } from '../../utils/validate.js';
import { startOfDay, toDay, weekdaysBetween, addDays } from '../../utils/time.js';

const MAX_LEAVE_DAYS = 30;
const MAX_BACKDATE_DAYS = 7;

export const requestLeave = ah(async (req, res) => {
  const v = new Validator(req.body)
    .oneOf('leaveType', LEAVE_TYPE, { required: true })
    .string('startDate', { required: true, max: 30 })
    .string('endDate', { required: true, max: 30 })
    .boolean('halfDay', { defaultValue: false })
    .string('reason', { required: true, min: 3, max: 500 });
  const body = v.done();

  const intern = await getOwnIntern(req);
  if (!INTERN_WORKING_STATUSES.includes(intern.status)) throw conflict(`Leave cannot be requested while your status is ${intern.status}.`, 'INTERN_NOT_ACTIVE');

  const tz = req.timezone;
  const start = toDay(body.startDate, tz);
  const end = toDay(body.endDate, tz);
  const errors = [];
  if (!start) errors.push({ field: 'startDate', message: 'Enter a valid start date' });
  if (!end) errors.push({ field: 'endDate', message: 'Enter a valid end date' });
  if (errors.length) throw unprocessable('Invalid leave dates', errors);
  if (end < start) throw unprocessable('Invalid leave dates', [{ field: 'endDate', message: 'End date cannot be before the start date' }]);

  const today = startOfDay(new Date(), tz);
  if (start < addDays(today, -MAX_BACKDATE_DAYS, tz)) throw unprocessable('Leave cannot start more than 7 days in the past', [{ field: 'startDate', message: 'Too far in the past' }]);
  if (start < startOfDay(intern.startDate, tz)) throw unprocessable('Leave cannot start before your internship begins', [{ field: 'startDate', message: 'Before internship start' }]);
  if (end > startOfDay(intern.expectedEndDate, tz)) throw unprocessable('Leave cannot extend beyond your internship end date', [{ field: 'endDate', message: 'After internship end' }]);

  const workingDays = weekdaysBetween(start, end, tz).length;
  if (workingDays === 0) throw unprocessable('The selected range contains only weekends.', [{ field: 'startDate', message: 'No working days selected' }]);
  if (workingDays > MAX_LEAVE_DAYS) throw unprocessable(`A single request cannot exceed ${MAX_LEAVE_DAYS} working days`, [{ field: 'endDate', message: 'Range too long' }]);
  if (body.halfDay && start.getTime() !== end.getTime()) throw unprocessable('A half-day leave must be a single day', [{ field: 'halfDay', message: 'Half-day needs one date' }]);
  const totalDays = body.halfDay ? 0.5 : workingDays;

  const overlap = await Leave.findOne({
    internId: intern._id, status: { $in: [LEAVE_STATUS.REQUESTED, LEAVE_STATUS.APPROVED] },
    startDate: { $lte: end }, endDate: { $gte: start }
  });
  if (overlap) throw conflict('You already have a leave request that overlaps these dates.', 'LEAVE_OVERLAP');

  const leave = await Leave.create({
    organizationId: req.organizationId, internId: intern._id, leaveType: body.leaveType,
    startDate: start, endDate: end, totalDays, halfDay: !!body.halfDay, reason: body.reason, status: LEAVE_STATUS.REQUESTED
  });
  if (intern.mentorId) {
    await createNotification({
      organizationId: req.organizationId, recipientId: intern.mentorId, type: 'LEAVE_REQUESTED', title: 'Leave request',
      message: `${req.user.firstName} requested ${totalDays} day(s) of ${body.leaveType.toLowerCase()} leave.`, entityType: 'Leave', entityId: leave._id
    });
  }
  await recordAuditLog({ action: 'LEAVE_REQUESTED', entityType: 'Leave', entityId: leave._id, after: leave.toObject(), req });
  return successResponse(res, leave, 'Leave requested successfully', 201);
});

export const getLeaves = ah(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 200 });
  const internIds = await Intern.find(internScope(req)).distinct('_id');
  const query = { organizationId: req.organizationId, internId: { $in: internIds } };
  if (Object.values(LEAVE_STATUS).includes(req.query.status)) query.status = req.query.status;
  if (isObjectId(req.query.internId)) query.internId = req.query.internId;

  const [leaves, total] = await Promise.all([
    Leave.find(query)
      .populate({ path: 'internId', select: 'internId userId departmentId mentorId', populate: { path: 'userId', select: 'firstName lastName email' } })
      .populate('reviewedBy', 'firstName lastName email')
      .sort({ createdAt: -1 }).skip(skip).limit(limit),
    Leave.countDocuments(query)
  ]);
  return paginatedResponse(res, leaves, { page, limit, total });
});

export const getMyLeaves = ah(async (req, res) => {
  const intern = await getOwnIntern(req);
  const leaves = await Leave.find({ internId: intern._id }).populate('reviewedBy', 'firstName lastName').sort({ startDate: -1 });
  return successResponse(res, leaves);
});

async function createLeavePlaceholders(leave, tz) {
  const intern = await Intern.findById(leave.internId).select('userId organizationId');
  const days = weekdaysBetween(leave.startDate, leave.endDate, tz);
  const existing = new Set((await AttendanceRecord.find({ internId: leave.internId, date: { $in: days } }).select('date').lean()).map(r => r.date.getTime()));
  const docs = days.filter(d => !existing.has(d.getTime())).map(d => ({
    internId: leave.internId, userId: intern.userId, organizationId: leave.organizationId, date: d,
    status: ATTENDANCE_STATUS.LEAVE, mode: ATTENDANCE_MODE.MANUAL, leaveId: leave._id, notes: `${leave.leaveType} leave`
  }));
  if (docs.length) await AttendanceRecord.insertMany(docs, { ordered: false }).catch(() => {});
  return docs.length;
}

export const reviewLeave = ah(async (req, res) => {
  const v = new Validator(req.body).oneOf('status', [LEAVE_STATUS.APPROVED, LEAVE_STATUS.REJECTED], { required: true }).string('reviewNotes', { max: 500 });
  const { status, reviewNotes } = v.done();
  if (status === LEAVE_STATUS.REJECTED && !reviewNotes) throw unprocessable('A reason is required to reject a leave request.', [{ field: 'reviewNotes', message: 'Reason is required' }]);

  const visible = await Intern.find(internScope(req)).distinct('_id');
  const leave = await Leave.findOne({ _id: req.params.id, organizationId: req.organizationId, internId: { $in: visible } });
  if (!leave) throw notFound('Leave request not found');
  assertTransition('leave', LEAVE_TRANSITIONS, leave.status, status);

  // Atomic: two reviewers cannot both decide the same request.
  const updated = await Leave.findOneAndUpdate(
    { _id: leave._id, status: LEAVE_STATUS.REQUESTED },
    { $set: { status, reviewedBy: req.userId, reviewedAt: new Date(), reviewNotes: reviewNotes || '' } },
    { new: true }
  );
  if (!updated) throw conflict('This leave request has already been reviewed.', 'ALREADY_REVIEWED');

  let placeholders = 0;
  if (status === LEAVE_STATUS.APPROVED) placeholders = await createLeavePlaceholders(updated, req.timezone);

  const intern = await Intern.findById(updated.internId).select('userId');
  if (intern) {
    await createNotification({
      organizationId: req.organizationId, recipientId: intern.userId, type: `LEAVE_${status}`, title: `Leave ${status.toLowerCase()}`,
      message: `Your leave request was ${status.toLowerCase()}.${reviewNotes ? ' Note: ' + reviewNotes : ''}`, entityType: 'Leave', entityId: updated._id
    });
  }
  await recordAuditLog({ action: `LEAVE_${status}`, entityType: 'Leave', entityId: updated._id, after: { status, reviewNotes: reviewNotes || '', attendanceDaysMarked: placeholders }, req });
  return successResponse(res, updated, `Leave request ${status.toLowerCase()} successfully`);
});

export const cancelLeave = ah(async (req, res) => {
  const intern = await getOwnIntern(req);
  const leave = await Leave.findOne({ _id: req.params.id, internId: intern._id });
  if (!leave) throw notFound('Leave request not found');
  const today = startOfDay(new Date(), req.timezone);
  if (leave.status === LEAVE_STATUS.APPROVED && leave.startDate <= today) {
    throw conflict('Approved leave that has already started cannot be cancelled.', 'LEAVE_ALREADY_STARTED');
  }
  if (![LEAVE_STATUS.REQUESTED, LEAVE_STATUS.APPROVED].includes(leave.status)) throw conflict('This leave request can no longer be cancelled.', 'LEAVE_NOT_CANCELLABLE');
  const wasApproved = leave.status === LEAVE_STATUS.APPROVED;
  const updated = await Leave.findOneAndUpdate({ _id: leave._id, status: leave.status }, { $set: { status: LEAVE_STATUS.CANCELLED, cancelledAt: new Date() } }, { new: true });
  if (!updated) throw conflict('This leave request changed while you were cancelling it.', 'STATE_CHANGED');
  if (wasApproved) await AttendanceRecord.deleteMany({ leaveId: leave._id, status: ATTENDANCE_STATUS.LEAVE });
  await recordAuditLog({ action: 'LEAVE_CANCELLED', entityType: 'Leave', entityId: leave._id, req });
  return successResponse(res, updated, 'Leave request cancelled');
});

