import crypto from 'crypto';
import { Interview } from './interview.model.js';
import { Application, Candidate } from '../recruitment/recruitment.model.js';
import { User } from '../users/user.model.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { resolvePermissions, hasGranted } from '../../middleware/permissions.js';
import { createNotification } from '../notifications/notification.service.js';
import { emailService } from '../email/email.service.js';
import { moveApplication } from '../recruitment/application.service.js';
import { APPLICATION_STATUS, INTERVIEW_STATUS, INTERVIEW_RECOMMENDATION, ROLES } from '../../../../shared/constants.js';
import { ah } from '../../utils/asyncHandler.js';
import { notFound, conflict, forbidden, unprocessable } from '../../utils/errors.js';
import { Validator, parsePagination, isObjectId, escapeRegex } from '../../utils/validate.js';
import { toDay, parseHHmm, formatDateLong } from '../../utils/time.js';

const ACTIVE = [INTERVIEW_STATUS.SCHEDULED, INTERVIEW_STATUS.RESCHEDULED];
const pad = (n) => String(n).padStart(2, '0');
const hhmm = (mins) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;

/** Turns date + "HH:mm" strings (organisation timezone) into absolute instants, validating everything. */
function buildSlot(req, { scheduledDate, startTime, endTime }) {
  const errors = [];
  const day = toDay(scheduledDate, req.timezone);
  if (!day) errors.push({ field: 'scheduledDate', message: 'Enter a valid date (YYYY-MM-DD)' });
  const start = parseHHmm(startTime);
  const end = parseHHmm(endTime);
  if (start === null) errors.push({ field: 'startTime', message: 'Use 24-hour time such as 14:30' });
  if (end === null) errors.push({ field: 'endTime', message: 'Use 24-hour time such as 15:30' });
  if (!errors.length) {
    if (end <= start) errors.push({ field: 'endTime', message: 'End time must be after the start time' });
    else if (end - start > 8 * 60) errors.push({ field: 'endTime', message: 'An interview cannot be longer than 8 hours' });
  }
  if (errors.length) throw unprocessable('Invalid interview schedule', errors);

  const startsAt = new Date(day.getTime() + start * 60000);
  const endsAt = new Date(day.getTime() + end * 60000);
  if (startsAt.getTime() <= Date.now()) {
    throw unprocessable('Interviews must be scheduled in the future', [{ field: 'scheduledDate', message: 'The selected date and time is in the past' }]);
  }
  return { scheduledDate: day, startTime: hhmm(start), endTime: hhmm(end), startsAt, endsAt };
}

async function assertNoConflicts(req, { interviewers, candidateId, startsAt, endsAt, excludeId }) {
  const query = {
    organizationId: req.organizationId,
    status: { $in: ACTIVE },
    startsAt: { $lt: endsAt },
    endsAt: { $gt: startsAt },
    $or: [{ interviewers: { $in: interviewers } }, { candidateId }]
  };
  if (excludeId) query._id = { $ne: excludeId };
  const clash = await Interview.findOne(query).populate('interviewers', 'firstName lastName');
  if (clash) {
    const sameCandidate = String(clash.candidateId) === String(candidateId);
    throw conflict(
      sameCandidate ? 'The candidate already has an interview at this time.' : 'One of the selected interviewers is already booked at this time.',
      'SCHEDULE_CONFLICT',
      { interviewId: clash._id, startsAt: clash.startsAt, endsAt: clash.endsAt }
    );
  }
}

async function validatePanel(req, interviewerIds) {
  const users = await User.find({ _id: { $in: interviewerIds }, organizationId: req.organizationId, isActive: true });
  if (users.length !== interviewerIds.length) {
    throw unprocessable('One or more interviewers do not exist or are inactive in your organization.', [{ field: 'interviewers', message: 'Unknown or inactive interviewer' }]);
  }
  for (const u of users) {
    const perms = await resolvePermissions(u);
    if (!hasGranted(perms, 'interviews.feedback')) {
      throw unprocessable(`${u.firstName} ${u.lastName} (${u.role}) is not permitted to conduct interviews.`, [{ field: 'interviewers', message: `${u.role} cannot interview` }]);
    }
  }
  return users;
}

async function findApplicationByAnyId(req, ref) {
  const clauses = [{ applicationId: String(ref) }];
  if (isObjectId(ref)) clauses.push({ _id: ref });
  return Application.findOne({ organizationId: req.organizationId, $or: clauses }).populate('candidateId').populate('openingId', 'title');
}

const slotFields = (v) => v.string('scheduledDate', { required: true, max: 30 }).string('startTime', { required: true, max: 8 }).string('endTime', { required: true, max: 8 });

export const scheduleInterview = ah(async (req, res) => {
  const v = new Validator(req.body);
  v.string('applicationId', { required: true, max: 40 })
    .string('title', { max: 150 })
    .oneOf('type', ['TECHNICAL', 'HR', 'MANAGERIAL', 'FINAL'], { defaultValue: 'TECHNICAL' })
    .objectIdList('interviewers', { required: true, max: 5 })
    .oneOf('mode', ['ONLINE', 'IN_PERSON'], { defaultValue: 'ONLINE' })
    .url('meetingLink')
    .string('location', { max: 300 })
    .string('notes', { max: 1000 });
  slotFields(v);
  const body = v.done();

  const app = await findApplicationByAnyId(req, body.applicationId);
  if (!app) throw notFound('Application not found');
  if (![APPLICATION_STATUS.SHORTLISTED, APPLICATION_STATUS.INTERVIEWED].includes(app.status)) {
    throw conflict(`Interviews can only be scheduled for SHORTLISTED or INTERVIEWED applications (current: ${app.status}).`, 'INVALID_APPLICATION_STATE');
  }
  if (await Interview.findOne({ applicationId: app._id, status: { $in: ACTIVE } })) {
    throw conflict('This application already has an interview scheduled. Reschedule or cancel it first.', 'INTERVIEW_ALREADY_SCHEDULED');
  }
  if (body.mode === 'IN_PERSON' && !body.location) {
    throw unprocessable('A location is required for in-person interviews', [{ field: 'location', message: 'Location is required' }]);
  }

  await validatePanel(req, body.interviewers);
  const slot = buildSlot(req, body);
  await assertNoConflicts(req, { interviewers: body.interviewers, candidateId: app.candidateId._id, startsAt: slot.startsAt, endsAt: slot.endsAt });

  const round = (await Interview.countDocuments({ applicationId: app._id, status: INTERVIEW_STATUS.COMPLETED })) + 1;
  const meetingLink = body.mode === 'ONLINE'
    ? (body.meetingLink || `https://meet.jit.si/TMT-Interview-${crypto.randomBytes(6).toString('hex')}`)
    : '';

  const interview = await Interview.create({
    organizationId: req.organizationId,
    applicationId: app._id,
    candidateId: app.candidateId._id,
    title: body.title || `${body.type} Evaluation Interview`,
    type: body.type,
    round,
    interviewers: body.interviewers,
    ...slot,
    mode: body.mode,
    meetingLink,
    location: body.location || '',
    notes: body.notes || '',
    createdBy: req.userId
  });

  try {
    moveApplication(app, APPLICATION_STATUS.INTERVIEW_SCHEDULED, {
      req, note: `Round ${round} ${body.type} interview scheduled for ${formatDateLong(slot.scheduledDate, req.timezone)} at ${slot.startTime}`
    });
    await app.save();
  } catch (err) {
    await Interview.deleteOne({ _id: interview._id }); // compensate: never leave an interview without its stage change
    throw err;
  }

  const when = `${formatDateLong(slot.scheduledDate, req.timezone)} ${slot.startTime}-${slot.endTime}`;
  await Promise.all(body.interviewers.map(id => createNotification({
    organizationId: req.organizationId, recipientId: id, type: 'INTERVIEW_SCHEDULED', title: 'New Interview Scheduled',
    message: `You are scheduled to interview ${app.candidateId.firstName} ${app.candidateId.lastName} on ${when}.`,
    entityType: 'Interview', entityId: interview._id
  })));
  emailService.queueEmail({
    to: app.candidateId.email, subject: `Interview scheduled: ${app.openingId?.title || 'Internship'}`, template: 'INTERVIEW_INVITATION',
    text: `Hi ${app.candidateId.firstName}, your ${body.type.toLowerCase()} interview is scheduled for ${when}. ${meetingLink ? `Join: ${meetingLink}` : `Location: ${body.location}`}`,
    organizationId: req.organizationId
  });
  await recordAuditLog({ action: 'INTERVIEW_SCHEDULED', entityType: 'Interview', entityId: interview._id, after: { applicationId: app.applicationId, round, startsAt: slot.startsAt, interviewers: body.interviewers }, req });

  return successResponse(res, interview, 'Interview scheduled successfully', 201);
});

function shape(interview, req) {
  const obj = interview.toObject ? interview.toObject() : interview;
  const expected = (obj.interviewers || []).length;
  obj.scorecardsSubmitted = (obj.feedback || []).length;
  obj.scorecardsExpected = expected;
  const isPanelOnly = req.userRole === ROLES.INTERVIEWER;
  if (isPanelOnly) {
    // Blind evaluation: an interviewer sees only their own scorecard.
    obj.feedback = (obj.feedback || []).filter(f => String(f.interviewerId?._id || f.interviewerId) === String(req.userId));
  }
  return obj;
}

export const getInterviews = ah(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 200 });
  const query = { organizationId: req.organizationId };
  if (req.userRole === ROLES.INTERVIEWER) query.interviewers = req.userId;
  if (isObjectId(req.query.applicationId)) query.applicationId = req.query.applicationId;
  if (isObjectId(req.query.candidateId)) query.candidateId = req.query.candidateId;
  if (Object.values(INTERVIEW_STATUS).includes(req.query.status)) query.status = req.query.status;
  if (req.query.upcoming === 'true') { query.startsAt = { $gte: new Date() }; query.status = { $in: ACTIVE }; }
  if (req.query.search) {
    // Find an interview by the candidate's name / email or by the application id.
    const rx = new RegExp(escapeRegex(String(req.query.search).slice(0, 80)), 'i');
    const [candidates, apps] = await Promise.all([
      Candidate.find({ organizationId: req.organizationId, $or: [{ firstName: rx }, { lastName: rx }, { email: rx }] }).select('_id').limit(500),
      Application.find({ organizationId: req.organizationId, applicationId: rx }).select('_id').limit(500)
    ]);
    query.$and = [...(query.$and || []), { $or: [{ candidateId: { $in: candidates.map(c => c._id) } }, { applicationId: { $in: apps.map(a => a._id) } }] }];
  }

  const [items, total] = await Promise.all([
    Interview.find(query)
      .populate('candidateId', 'firstName lastName email phone')
      .populate('interviewers', 'firstName lastName email')
      .populate('applicationId', 'applicationId status')
      .sort({ startsAt: req.query.order === 'desc' ? -1 : 1 }).skip(skip).limit(limit),
    Interview.countDocuments(query)
  ]);
  return paginatedResponse(res, items.map(i => shape(i, req)), { page, limit, total });
});

export const getInterviewById = ah(async (req, res) => {
  const query = { _id: req.params.id, organizationId: req.organizationId };
  if (req.userRole === ROLES.INTERVIEWER) query.interviewers = req.userId;
  const interview = await Interview.findOne(query)
    .populate('candidateId', 'firstName lastName email phone education')
    .populate('interviewers', 'firstName lastName email')
    .populate('feedback.interviewerId', 'firstName lastName email')
    .populate('applicationId', 'applicationId status');
  if (!interview) throw notFound('Interview not found');
  return successResponse(res, shape(interview, req));
});

export const submitInterviewFeedback = ah(async (req, res) => {
  const v = new Validator(req.body);
  for (const f of ['technicalKnowledge', 'communication', 'problemSolving', 'relevantExperience', 'learningAbility', 'cultureFit']) {
    v.number(f, { required: true, integer: true, min: 1, max: 10 });
  }
  v.oneOf('recommendation', INTERVIEW_RECOMMENDATION, { required: true }).string('comments', { required: true, min: 10, max: 2000 });
  const body = v.done();

  const interview = await Interview.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!interview) throw notFound('Interview not found');
  if (!interview.interviewers.some(id => String(id) === String(req.userId))) {
    throw forbidden('Only interviewers assigned to this interview can submit a scorecard.', 'NOT_ON_PANEL');
  }
  if (!ACTIVE.includes(interview.status)) {
    throw conflict(`Scorecards cannot be submitted for a ${interview.status} interview.`, 'INTERVIEW_NOT_ACTIVE');
  }

  // Atomic: the same interviewer can never push a second scorecard, even with a double click.
  const updated = await Interview.findOneAndUpdate(
    { _id: interview._id, status: { $in: ACTIVE }, 'feedback.interviewerId': { $ne: req.userId } },
    { $push: { feedback: { ...body, interviewerId: req.userId, submittedAt: new Date() } } },
    { new: true, runValidators: true }
  );
  if (!updated) throw conflict('You have already submitted a scorecard for this interview.', 'FEEDBACK_ALREADY_SUBMITTED');

  let completed = false;
  if (updated.feedback.length >= updated.interviewers.length) {
    const done = await Interview.findOneAndUpdate({ _id: updated._id, status: { $in: ACTIVE } }, { $set: { status: INTERVIEW_STATUS.COMPLETED } }, { new: true });
    if (done) {
      completed = true;
      const app = await Application.findById(updated.applicationId);
      if (app && app.status === APPLICATION_STATUS.INTERVIEW_SCHEDULED) {
        moveApplication(app, APPLICATION_STATUS.INTERVIEWED, { req, note: `All ${updated.feedback.length} scorecard(s) submitted for round ${updated.round}.` });
        await app.save();
      }
    }
  }

  await recordAuditLog({
    action: 'INTERVIEW_FEEDBACK_SUBMITTED', entityType: 'Interview', entityId: interview._id,
    after: { recommendation: body.recommendation, submitted: updated.feedback.length, expected: updated.interviewers.length, completed }, req
  });
  const fresh = await Interview.findById(updated._id).populate('interviewers', 'firstName lastName email').populate('feedback.interviewerId', 'firstName lastName');
  return successResponse(res, shape(fresh, req), completed ? 'Scorecard submitted. All interviewers have responded; the interview is complete.' : 'Scorecard submitted successfully');
});

export const rescheduleInterview = ah(async (req, res) => {
  const v = new Validator(req.body);
  slotFields(v).string('reason', { required: true, min: 3, max: 300 });
  const body = v.done();

  const interview = await Interview.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!interview) throw notFound('Interview not found');
  if (!ACTIVE.includes(interview.status)) throw conflict(`A ${interview.status} interview cannot be rescheduled.`, 'INTERVIEW_NOT_ACTIVE');

  const slot = buildSlot(req, body);
  await assertNoConflicts(req, { interviewers: interview.interviewers, candidateId: interview.candidateId, startsAt: slot.startsAt, endsAt: slot.endsAt, excludeId: interview._id });

  interview.rescheduleHistory.push({ previousStartsAt: interview.startsAt, newStartsAt: slot.startsAt, reason: body.reason, changedBy: req.userId });
  Object.assign(interview, slot, { status: INTERVIEW_STATUS.RESCHEDULED });
  await interview.save();

  await Promise.all(interview.interviewers.map(id => createNotification({
    organizationId: req.organizationId, recipientId: id, type: 'INTERVIEW_RESCHEDULED', title: 'Interview Rescheduled',
    message: `An interview was moved to ${formatDateLong(slot.scheduledDate, req.timezone)} ${slot.startTime}. Reason: ${body.reason}`,
    entityType: 'Interview', entityId: interview._id
  })));
  await recordAuditLog({ action: 'INTERVIEW_RESCHEDULED', entityType: 'Interview', entityId: interview._id, after: { startsAt: slot.startsAt, reason: body.reason }, req });
  return successResponse(res, interview, 'Interview rescheduled');
});

// Only cancellation / no-show may be set by hand. COMPLETED is produced by scorecards.
export const updateInterviewStatus = ah(async (req, res) => {
  const v = new Validator(req.body).oneOf('status', [INTERVIEW_STATUS.CANCELLED, INTERVIEW_STATUS.NO_SHOW], { required: true }).string('reason', { required: true, min: 3, max: 300 });
  const { status, reason } = v.done();

  const interview = await Interview.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!interview) throw notFound('Interview not found');
  if (!ACTIVE.includes(interview.status)) throw conflict(`A ${interview.status} interview cannot be changed.`, 'INTERVIEW_NOT_ACTIVE');

  interview.status = status;
  interview.cancelledAt = new Date();
  interview.cancelReason = reason;
  await interview.save();

  // The application returns to the stage that allows a new interview to be scheduled.
  const app = await Application.findById(interview.applicationId);
  if (app && app.status === APPLICATION_STATUS.INTERVIEW_SCHEDULED && !(await Interview.findOne({ applicationId: app._id, status: { $in: ACTIVE }, _id: { $ne: interview._id } }))) {
    const hadCompleted = await Interview.countDocuments({ applicationId: app._id, status: INTERVIEW_STATUS.COMPLETED });
    moveApplication(app, hadCompleted ? APPLICATION_STATUS.INTERVIEWED : APPLICATION_STATUS.SHORTLISTED, { req, note: `Interview ${status.toLowerCase().replace('_', ' ')}: ${reason}` });
    await app.save();
  }
  await recordAuditLog({ action: `INTERVIEW_${status}`, entityType: 'Interview', entityId: interview._id, after: { reason }, req });
  return successResponse(res, interview, `Interview marked ${status}`);
});
