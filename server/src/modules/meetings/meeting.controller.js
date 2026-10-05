import crypto from 'crypto';
import { Meeting } from './meeting.model.js';
import { Task } from '../tasks/task.model.js';
import { Intern } from '../interns/intern.model.js';
import { User } from '../users/user.model.js';
import { internScope } from '../interns/intern.access.js';
import { successResponse } from '../../utils/response.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { createNotification } from '../notifications/notification.service.js';
import { MEETING_TYPE, ROLES, TASK_STATUS, TASK_PRIORITY } from '../../../../shared/constants.js';
import { ah } from '../../utils/asyncHandler.js';
import { notFound, conflict, forbidden, unprocessable } from '../../utils/errors.js';
import { Validator } from '../../utils/validate.js';
import { toDay, parseHHmm, formatDateLong } from '../../utils/time.js';
import { GoogleIntegrationService } from '../integrations/google.service.js';

const OPEN = ['SCHEDULED', 'RESCHEDULED'];
const MEETING_TRANSITIONS = {
  SCHEDULED: ['STARTED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
  RESCHEDULED: ['STARTED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
  STARTED: ['COMPLETED'],
  COMPLETED: [], CANCELLED: [], NO_SHOW: [], DRAFT: ['SCHEDULED', 'CANCELLED']
};
const pad = (n) => String(n).padStart(2, '0');
const hhmm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

function slot(req, { scheduledDate, startTime, endTime }) {
  const day = toDay(scheduledDate, req.timezone);
  const s = parseHHmm(startTime);
  const e = parseHHmm(endTime);
  const errors = [];
  if (!day) errors.push({ field: 'scheduledDate', message: 'Enter a valid date' });
  if (s === null) errors.push({ field: 'startTime', message: 'Use 24-hour time such as 14:30' });
  if (e === null) errors.push({ field: 'endTime', message: 'Use 24-hour time such as 15:30' });
  if (!errors.length && e <= s) errors.push({ field: 'endTime', message: 'End time must be after the start time' });
  if (errors.length) throw unprocessable('Invalid meeting schedule', errors);
  if (day.getTime() + s * 60000 <= Date.now()) throw unprocessable('Meetings must be scheduled in the future', [{ field: 'scheduledDate', message: 'The selected time is in the past' }]);
  return { scheduledDate: day, startTime: hhmm(s), endTime: hhmm(e) };
}

async function meetingScope(req) {
  const scope = { organizationId: req.organizationId };
  if (req.userRole === ROLES.INTERN) {
    const intern = await Intern.findOne({ userId: req.userId, organizationId: req.organizationId });
    scope.$or = [{ participants: req.userId }, ...(intern ? [{ internIds: intern._id }] : [])];
  } else if ([ROLES.MENTOR, ROLES.TEAM_LEAD].includes(req.userRole)) {
    scope.$or = [{ mentorId: req.userId }, { participants: req.userId }];
  }
  return scope;
}

export const getMeetings = ah(async (req, res) => {
  const meetings = await Meeting.find(await meetingScope(req))
    .populate('participants', 'firstName lastName email avatarUrl')
    .populate('mentorId', 'firstName lastName email')
    .populate('organizerId', 'firstName lastName email')
    .populate('projectId', 'title code')
    .populate('actionItems.assigneeId', 'firstName lastName')
    .sort({ scheduledDate: 1, startTime: 1 });
  return successResponse(res, meetings);
});

export const createMeeting = ah(async (req, res) => {
  const v = new Validator(req.body)
    .string('title', { required: true, max: 150 }).oneOf('type', MEETING_TYPE, { defaultValue: MEETING_TYPE.MENTOR_1ON1 })
    .objectIdList('participants', { max: 30 }).objectIdList('internIds', { max: 30 })
    .string('scheduledDate', { required: true, max: 30 }).string('startTime', { required: true, max: 8 }).string('endTime', { required: true, max: 8 })
    .url('meetingLink').string('agenda', { max: 2000 }).string('description', { max: 2000 })
    .string('meetingProvider', { max: 50 }).objectId('projectId').objectId('programId')
    .string('idempotencyKey', { max: 100 });
  const body = v.done();
  const when = slot(req, body);

  // Idempotency: prevent double-click duplicate creation within 15 seconds
  if (body.idempotencyKey) {
    const existing = await Meeting.findOne({ organizationId: req.organizationId, idempotencyKey: body.idempotencyKey });
    if (existing) return successResponse(res, existing, 'Meeting scheduled successfully', 200);
  } else {
    const recentDuplicate = await Meeting.findOne({
      organizationId: req.organizationId,
      organizerId: req.userId,
      title: body.title,
      scheduledDate: when.scheduledDate,
      startTime: when.startTime,
      createdAt: { $gte: new Date(Date.now() - 15000) }
    });
    if (recentDuplicate) return successResponse(res, recentDuplicate, 'Meeting scheduled successfully', 200);
  }

  // Participants must be people in this organisation; mentors can only invite their own mentees.
  const participants = [...new Set([String(req.userId), ...(body.participants || [])])];
  const found = await User.countDocuments({ _id: { $in: participants }, organizationId: req.organizationId, isActive: true });
  if (found !== participants.length) throw unprocessable('All participants must be active users in your organization.', [{ field: 'participants', message: 'Unknown participant' }]);
  let internIds = body.internIds || [];
  if (internIds.length) {
    const scoped = await Intern.find({ _id: { $in: internIds }, ...internScope(req) }).select('_id userId');
    if (scoped.length !== internIds.length) throw forbidden('You can only include interns you supervise.', 'NOT_YOUR_MENTEE');
    scoped.forEach(i => { if (!participants.includes(String(i.userId))) participants.push(String(i.userId)); });
  }

  const meetingProvider = body.meetingProvider || 'GOOGLE_MEET';
  let googleCalendarEventId = '';
  let googleConferenceId = '';
  let googleMeetLink = '';
  let finalMeetingLink = body.meetingLink || '';

  if (meetingProvider === 'GOOGLE_MEET') {
    const attendeeUsers = await User.find({ _id: { $in: participants } }).select('email');
    const attendeeEmails = attendeeUsers.map(u => u.email).filter(Boolean);

    const gcal = await GoogleIntegrationService.createCalendarAndMeetEvent({
      organizationId: req.organizationId,
      title: body.title,
      description: body.description || body.agenda || '',
      scheduledDate: when.scheduledDate,
      startTime: when.startTime,
      endTime: when.endTime,
      timezone: req.timezone || 'Asia/Kolkata',
      attendees: attendeeEmails
    });

    googleCalendarEventId = gcal.eventId;
    googleConferenceId = gcal.conferenceId;
    googleMeetLink = gcal.meetLink;
    finalMeetingLink = gcal.meetLink;
  } else if (!finalMeetingLink && meetingProvider !== 'IN_PERSON') {
    finalMeetingLink = `https://meet.jit.si/TMT-Meeting-${crypto.randomBytes(6).toString('hex')}`;
  }

  // Calculate 2 reminders: 24 hours before (1440 min) and 15 minutes before (15 min)
  const [startHour, startMin] = when.startTime.split(':').map(Number);
  const meetingStartTime = new Date(when.scheduledDate);
  meetingStartTime.setHours(startHour, startMin, 0, 0);

  const reminders = [
    {
      type: '24_HOURS',
      offsetMinutes: 1440,
      status: 'SCHEDULED',
      scheduledFor: new Date(meetingStartTime.getTime() - 1440 * 60 * 1000)
    },
    {
      type: '15_MINUTES',
      offsetMinutes: 15,
      status: 'SCHEDULED',
      scheduledFor: new Date(meetingStartTime.getTime() - 15 * 60 * 1000)
    }
  ];

  const meeting = await Meeting.create({
    organizationId: req.organizationId,
    title: body.title,
    type: body.type,
    participants,
    internIds,
    mentorId: req.userId,
    organizerId: req.userId,
    ...when,
    meetingProvider,
    meetingLink: finalMeetingLink,
    googleCalendarEventId,
    googleConferenceId,
    googleMeetLink,
    reminders,
    idempotencyKey: body.idempotencyKey || undefined,
    agenda: body.agenda || body.description || '',
    description: body.description || body.agenda || '',
    projectId: body.projectId || undefined,
    programId: body.programId || undefined
  });

  await Promise.all(participants.filter(id => id !== String(req.userId)).map(id => createNotification({
    organizationId: req.organizationId, recipientId: id, type: 'MEETING_SCHEDULED', title: 'New Meeting Scheduled',
    message: `Meeting "${meeting.title}" on ${formatDateLong(when.scheduledDate, req.timezone)} at ${when.startTime}.`, entityType: 'Meeting', entityId: meeting._id
  })));
  await recordAuditLog({ action: 'MEETING_SCHEDULED', entityType: 'Meeting', entityId: meeting._id, after: { title: meeting.title, ...when, googleMeetLink }, req });
  return successResponse(res, meeting, 'Meeting scheduled successfully', 201);
});

async function ownMeeting(req) {
  const meeting = await Meeting.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!meeting) throw notFound('Meeting not found');
  const manager = req.can('meetings.manage') && (meeting.mentorId && String(meeting.mentorId) === String(req.userId) || ![ROLES.MENTOR, ROLES.TEAM_LEAD].includes(req.userRole));
  if (!manager) throw forbidden('You can only manage meetings you organised.', 'FORBIDDEN');
  return meeting;
}

export const rescheduleMeeting = ah(async (req, res) => {
  const v = new Validator(req.body).string('scheduledDate', { required: true, max: 30 }).string('startTime', { required: true, max: 8 }).string('endTime', { required: true, max: 8 }).string('reason', { required: true, min: 3, max: 300 });
  const body = v.done();
  const meeting = await ownMeeting(req);
  if (!OPEN.includes(meeting.status)) throw conflict(`A ${meeting.status} meeting cannot be rescheduled.`, 'INVALID_TRANSITION');
  const when = slot(req, body);
  meeting.rescheduleHistory.push({ previousDate: meeting.scheduledDate, newDate: when.scheduledDate, reason: body.reason, changedBy: req.userId });

  // Update Google Calendar event if connected
  if (meeting.googleCalendarEventId) {
    await GoogleIntegrationService.updateCalendarEvent({
      organizationId: req.organizationId,
      eventId: meeting.googleCalendarEventId,
      scheduledDate: when.scheduledDate,
      startTime: when.startTime,
      endTime: when.endTime,
      timezone: req.timezone || 'Asia/Kolkata'
    }).catch(err => console.error('Failed to update Google Calendar event on reschedule:', err));
  }

  // Recalculate reminders
  const [startHour, startMin] = when.startTime.split(':').map(Number);
  const meetingStartTime = new Date(when.scheduledDate);
  meetingStartTime.setHours(startHour, startMin, 0, 0);

  meeting.reminders = [
    { type: '24_HOURS', offsetMinutes: 1440, status: 'SCHEDULED', scheduledFor: new Date(meetingStartTime.getTime() - 1440 * 60 * 1000) },
    { type: '15_MINUTES', offsetMinutes: 15, status: 'SCHEDULED', scheduledFor: new Date(meetingStartTime.getTime() - 15 * 60 * 1000) }
  ];

  Object.assign(meeting, when, { status: 'RESCHEDULED' });
  await meeting.save();
  await Promise.all(meeting.participants.filter(id => String(id) !== String(req.userId)).map(id => createNotification({
    organizationId: req.organizationId, recipientId: id, type: 'MEETING_RESCHEDULED', title: 'Meeting Rescheduled',
    message: `Meeting "${meeting.title}" moved to ${formatDateLong(when.scheduledDate, req.timezone)} at ${when.startTime}.`, entityType: 'Meeting', entityId: meeting._id
  })));
  await recordAuditLog({ action: 'MEETING_RESCHEDULED', entityType: 'Meeting', entityId: meeting._id, after: { ...when, reason: body.reason }, req });
  return successResponse(res, meeting, 'Meeting rescheduled successfully');
});

export const updateMeetingStatus = ah(async (req, res) => {
  const v = new Validator(req.body).oneOf('status', ['STARTED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).string('notes', { max: 5000 }).url('recordingUrl');
  const body = v.done();
  const meeting = await ownMeeting(req);
  if (body.status) {
    if (!MEETING_TRANSITIONS[meeting.status]?.includes(body.status)) throw conflict(`Meeting cannot move from ${meeting.status} to ${body.status}.`, 'INVALID_TRANSITION');
    meeting.status = body.status;

    // If cancelled, notify participants and update Google Calendar
    if (body.status === 'CANCELLED') {
      if (meeting.googleCalendarEventId) {
        await GoogleIntegrationService.cancelCalendarEvent({
          organizationId: req.organizationId,
          eventId: meeting.googleCalendarEventId
        }).catch(err => console.error('Failed to cancel Google Calendar event:', err));
      }
      await Promise.all(meeting.participants.filter(id => String(id) !== String(req.userId)).map(id => createNotification({
        organizationId: req.organizationId, recipientId: id, type: 'MEETING_CANCELLED', title: 'Meeting Cancelled',
        message: `Meeting "${meeting.title}" has been cancelled.`, entityType: 'Meeting', entityId: meeting._id
      })));
    }
  }
  if (body.notes !== undefined) meeting.notes = body.notes;
  if (body.recordingUrl !== undefined) meeting.recordingUrl = body.recordingUrl;
  await meeting.save();
  await recordAuditLog({ action: 'MEETING_UPDATED', entityType: 'Meeting', entityId: meeting._id, after: { status: meeting.status }, req });
  return successResponse(res, meeting, 'Meeting updated');
});

export const addMeetingActionItem = ah(async (req, res) => {
  const v = new Validator(req.body).string('title', { required: true, max: 300 }).objectId('assigneeId').string('dueDate', { max: 30 }).boolean('convertToTask', { defaultValue: false });
  const body = v.done();
  const meeting = await ownMeeting(req);
  if (body.assigneeId && !(await User.exists({ _id: body.assigneeId, organizationId: req.organizationId, isActive: true }))) {
    throw unprocessable('Assignee not found in your organization', [{ field: 'assigneeId', message: 'Unknown user' }]);
  }
  if (body.convertToTask && !body.assigneeId) throw unprocessable('Choose an assignee to convert the action item to a task.', [{ field: 'assigneeId', message: 'Required to create a task' }]);
  const due = body.dueDate ? new Date(body.dueDate) : undefined;
  if (due && Number.isNaN(due.getTime())) throw unprocessable('Invalid due date', [{ field: 'dueDate', message: 'Invalid date' }]);

  meeting.actionItems.push({ title: body.title, assigneeId: body.assigneeId, dueDate: due, isCompleted: false });
  await meeting.save();
  let task = null;
  if (body.convertToTask) {
    task = await Task.create({
      organizationId: req.organizationId, title: `[Action Item] ${body.title}`, description: `Action item from meeting "${meeting.title}".`,
      assignedTo: [body.assigneeId], createdBy: req.userId, priority: TASK_PRIORITY.MEDIUM, status: TASK_STATUS.TODO, dueDate: due
    });
    const item = meeting.actionItems[meeting.actionItems.length - 1];
    item.convertedTaskId = task._id;
    await meeting.save();
  }
  await recordAuditLog({ action: 'MEETING_ACTION_ITEM_ADDED', entityType: 'Meeting', entityId: meeting._id, after: { title: body.title, taskId: task?._id }, req });
  return successResponse(res, { meeting, task }, 'Action item added');
});
