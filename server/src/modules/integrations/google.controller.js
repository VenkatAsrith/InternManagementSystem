import { GoogleIntegrationService } from './google.service.js';
import { successResponse } from '../../utils/response.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { ah } from '../../utils/asyncHandler.js';
import { Validator } from '../../utils/validate.js';

export const getGoogleIntegrationStatus = ah(async (req, res) => {
  const status = await GoogleIntegrationService.getStatus(req.organizationId);
  return successResponse(res, status);
});

export const connectGoogleIntegration = ah(async (req, res) => {
  const v = new Validator(req.body)
    .email('accountEmail', { defaultValue: 'workspace.admin@techmecha.com' })
    .string('authCode', { max: 500 });
  const body = v.done();

  const status = await GoogleIntegrationService.connect(req.organizationId, req.userId, {
    accountEmail: body.accountEmail,
    authCode: body.authCode
  });

  await recordAuditLog({
    action: 'INTEGRATION_GOOGLE_CONNECTED',
    entityType: 'Organization',
    entityId: req.organizationId,
    after: { accountEmail: status.accountEmail, meetAvailable: status.meetAvailable },
    req
  });

  return successResponse(res, status, 'Google Workspace connected successfully');
});

export const disconnectGoogleIntegration = ah(async (req, res) => {
  const result = await GoogleIntegrationService.disconnect(req.organizationId);

  await recordAuditLog({
    action: 'INTEGRATION_GOOGLE_DISCONNECTED',
    entityType: 'Organization',
    entityId: req.organizationId,
    after: { isConnected: false },
    req
  });

  return successResponse(res, result, 'Google Workspace disconnected');
});

export const createInstantGoogleMeet = ah(async (req, res) => {
  const v = new Validator(req.body)
    .string('title', { defaultValue: 'Instant Google Meet Conference', max: 150 })
    .string('description', { max: 1000 })
    .objectIdList('participants', { max: 50 });
  const body = v.done();

  const meet = await GoogleIntegrationService.createInstantMeet({
    organizationId: req.organizationId,
    title: body.title,
    userId: req.userId
  });

  // If requested or participants provided, record in Meeting collection
  if (req.body.saveAsMeeting || (body.participants && body.participants.length > 0)) {
    const { Meeting } = await import('../meetings/meeting.model.js');
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const startTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const endHour = (now.getHours() + 1) % 24;
    const endTime = `${pad(endHour)}:${pad(now.getMinutes())}`;

    const participants = [...new Set([String(req.userId), ...(body.participants || [])])];
    const meetingRecord = await Meeting.create({
      organizationId: req.organizationId,
      title: body.title,
      type: req.body.type || 'MENTOR_1ON1',
      participants,
      mentorId: req.userId,
      organizerId: req.userId,
      scheduledDate: now,
      startTime,
      endTime,
      meetingProvider: 'GOOGLE_MEET',
      meetingLink: meet.meetLink,
      googleMeetLink: meet.meetLink,
      googleConferenceId: meet.conferenceId,
      googleCalendarEventId: meet.eventId,
      status: 'STARTED',
      description: body.description || 'Instant conference started via Google Meet Integration Hub.'
    });

    return successResponse(res, {
      ...meet,
      meetingId: meetingRecord._id,
      meeting: meetingRecord
    }, 'Instant Google Meet created and launched');
  }

  return successResponse(res, meet, 'Instant Google Meet room generated');
});

