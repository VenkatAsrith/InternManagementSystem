import { AttendanceRecord } from './attendance.model.js';
import { attendanceSummary } from './attendance.service.js';
import { Intern } from '../interns/intern.model.js';
import { Leave } from '../leaves/leave.model.js';
import { Exit } from '../exit/exit.model.js';
import { InternshipProgram } from '../recruitment/recruitment.model.js';
import { getOwnIntern, internScope, loadScopedIntern } from '../interns/intern.access.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { ATTENDANCE_STATUS, ATTENDANCE_MODE, INTERN_STATUS, LEAVE_STATUS } from '../../../../shared/constants.js';
import { INTERN_WORKING_STATUSES } from '../../../../shared/lifecycle.js';
import { ah } from '../../utils/asyncHandler.js';
import { notFound, conflict, unprocessable } from '../../utils/errors.js';
import { Validator, parsePagination, isObjectId } from '../../utils/validate.js';
import { startOfDay, toDay, minutesOfDay, parseHHmm, isWeekend, round2 } from '../../utils/time.js';
import { env } from '../../config/env.js';

const CHECK_IN_MODES = [ATTENDANCE_MODE.REMOTE, ATTENDANCE_MODE.ON_SITE, ATTENDANCE_MODE.HYBRID];
const lateAfterMinutes = () => (parseHHmm(env.ATTENDANCE_WORKDAY_START) ?? 570) + env.ATTENDANCE_GRACE_MINUTES;

export const checkIn = ah(async (req, res) => {
  const { mode } = new Validator(req.body).oneOf('mode', CHECK_IN_MODES, { defaultValue: ATTENDANCE_MODE.REMOTE }).done();
  const intern = await getOwnIntern(req);
  const tz = req.timezone;
  const now = new Date();
  const today = startOfDay(now, tz);

  if (!INTERN_WORKING_STATUSES.includes(intern.status)) {
    throw conflict(`Check-in is not available while your internship status is ${intern.status}.`, 'INTERN_NOT_ACTIVE');
  }
  if (intern.status === INTERN_STATUS.EXIT_INITIATED) {
    const exit = await Exit.findOne({ internId: intern._id }).sort({ createdAt: -1 });
    if (exit && today > startOfDay(exit.lastWorkingDay, tz)) throw conflict('Your last working day has passed.', 'AFTER_LAST_WORKING_DAY');
  }
  if (today < startOfDay(intern.startDate, tz)) throw conflict('Your internship has not started yet.', 'BEFORE_START_DATE');

  const onLeave = await Leave.findOne({ internId: intern._id, status: LEAVE_STATUS.APPROVED, startDate: { $lte: today }, endDate: { $gte: today } });
  if (onLeave && !isWeekend(today, tz)) {
    throw conflict('You have approved leave today. Cancel the leave first if you worked.', 'ON_APPROVED_LEAVE');
  }

  const late = minutesOfDay(now, tz) > lateAfterMinutes();
  try {
    const record = await AttendanceRecord.create({
      internId: intern._id, userId: req.userId, organizationId: req.organizationId,
      date: today, checkIn: now, status: late ? ATTENDANCE_STATUS.LATE : ATTENDANCE_STATUS.PRESENT, lateFlag: late,
      mode, ipAddress: req.ip
    });
    await recordAuditLog({ action: 'ATTENDANCE_CHECK_IN', entityType: 'AttendanceRecord', entityId: record._id, after: { mode, late }, req });
    return successResponse(res, record, `Checked in successfully${late ? ' (marked late)' : ''}`, 201);
  } catch (err) {
    if (err?.code === 11000) throw conflict('You have already checked in today.', 'ALREADY_CHECKED_IN');
    throw err;
  }
});

export const checkOut = ah(async (req, res) => {
  const intern = await getOwnIntern(req);
  const now = new Date();
  const today = startOfDay(now, req.timezone);
  const record = await AttendanceRecord.findOne({ internId: intern._id, date: today });
  if (!record || !record.checkIn) throw conflict('No check-in found for today. Please check in first.', 'NOT_CHECKED_IN');
  if (record.checkOut) throw conflict('You have already checked out today.', 'ALREADY_CHECKED_OUT');

  const hours = Math.max(0, (now - record.checkIn) / 3600000 - (record.breakDurationMinutes || 0) / 60);
  const totalHours = round2(hours);
  const status = totalHours < env.ATTENDANCE_HALF_DAY_HOURS ? ATTENDANCE_STATUS.HALF_DAY : record.status;

  // Atomic: only one concurrent check-out can win.
  const updated = await AttendanceRecord.findOneAndUpdate(
    { _id: record._id, checkOut: { $exists: false } },
    { $set: { checkOut: now, totalHours, status } },
    { new: true }
  );
  if (!updated) throw conflict('You have already checked out today.', 'ALREADY_CHECKED_OUT');
  await recordAuditLog({ action: 'ATTENDANCE_CHECK_OUT', entityType: 'AttendanceRecord', entityId: updated._id, after: { totalHours, status }, req });
  return successResponse(res, updated, `Checked out successfully. Total hours: ${totalHours}`);
});

export const getTodayAttendance = ah(async (req, res) => {
  const intern = await getOwnIntern(req, { required: false });
  if (!intern) return successResponse(res, null);
  const record = await AttendanceRecord.findOne({ internId: intern._id, date: startOfDay(new Date(), req.timezone) });
  return successResponse(res, record);
});

export const getMyAttendanceHistory = ah(async (req, res) => {
  const intern = await getOwnIntern(req, { required: false });
  if (!intern) return successResponse(res, []);
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 60, maxLimit: 200 });
  const query = { internId: intern._id };
  const [records, total] = await Promise.all([
    AttendanceRecord.find(query).sort({ date: -1 }).skip(skip).limit(limit),
    AttendanceRecord.countDocuments(query)
  ]);
  return paginatedResponse(res, records, { page, limit, total });
});

/** Own summary (intern) or a specific intern's summary (staff, scoped). */
export const getAttendanceSummary = ah(async (req, res) => {
  let intern;
  if (isObjectId(req.query.internId) && req.can('attendance.read')) intern = await loadScopedIntern(req, req.query.internId);
  else intern = await getOwnIntern(req);
  const summary = await attendanceSummary(intern, { tz: req.timezone });
  // The threshold that decides certificate eligibility is the program's own rule, not a global default.
  const program = await InternshipProgram.findById(intern.programId).select('attendanceRequirementPercent completionRequirements').lean();
  const requiredPercent = program?.completionRequirements?.minimumAttendancePercent ?? program?.attendanceRequirementPercent ?? env.DEFAULT_ATTENDANCE_REQUIREMENT_PERCENT;
  return successResponse(res, { internId: intern.internId, requiredPercent, ...summary });
});

export const getOrganizationAttendance = ah(async (req, res) => {
  const day = req.query.date ? toDay(String(req.query.date), req.timezone) : startOfDay(new Date(), req.timezone);
  if (!day) throw unprocessable('Invalid date', [{ field: 'date', message: 'Use YYYY-MM-DD' }]);
  const scope = internScope(req);
  const internIds = await Intern.find(scope).distinct('_id');
  const query = { organizationId: req.organizationId, date: day, internId: { $in: internIds } };
  if (Object.values(ATTENDANCE_STATUS).includes(req.query.status)) query.status = req.query.status;

  const records = await AttendanceRecord.find(query)
    .populate('userId', 'firstName lastName email')
    .populate('internId', 'internId departmentId');
  return successResponse(res, records);
});

// HR correction with a mandatory reason and full audit trail.
export const correctAttendance = ah(async (req, res) => {
  const v = new Validator(req.body)
    .oneOf('status', Object.values(ATTENDANCE_STATUS), { required: true })
    .number('totalHours', { min: 0, max: 24 })
    .string('reason', { required: true, min: 5, max: 300 });
  const body = v.done();
  const record = await AttendanceRecord.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!record) throw notFound('Attendance record not found');
  const before = { status: record.status, totalHours: record.totalHours };
  record.status = body.status;
  if (body.totalHours !== undefined) record.totalHours = body.totalHours;
  if (!record.checkIn && [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE, ATTENDANCE_STATUS.HALF_DAY].includes(body.status)) {
    throw unprocessable('A worked day needs a check-in time. Correct an existing check-in instead.', [{ field: 'status', message: 'No check-in on this record' }]);
  }
  record.mode = ATTENDANCE_MODE.ADMIN_OVERRIDE;
  record.correctedBy = req.userId;
  record.correctionReason = body.reason;
  await record.save();
  await recordAuditLog({ action: 'ATTENDANCE_CORRECTED', entityType: 'AttendanceRecord', entityId: record._id, before, after: { status: record.status, totalHours: record.totalHours, reason: body.reason }, req });
  return successResponse(res, record, 'Attendance corrected');
});
