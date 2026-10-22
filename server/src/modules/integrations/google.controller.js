import { GoogleIntegrationService } from './google.service.js';
import { successResponse } from '../../utils/response.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { ah } from '../../utils/asyncHandler.js';
import { Validator } from '../../utils/validate.js';
import { emailService } from '../email/email.service.js';
import { User } from '../users/user.model.js';
import { env } from '../../config/env.js';

export const getGoogleIntegrationStatus = ah(async (req, res) => {
  const status = await GoogleIntegrationService.getStatus(req.organizationId);
  return successResponse(res, status);
});

export const getGoogleOAuthUrl = ah(async (req, res) => {
  const config = GoogleIntegrationService.isConfigured();
  if (!config.isConfigured) {
    return successResponse(res, {
      authUrl: null,
      isConfigured: false,
      missingConfig: config.missingConfig,
      message: `Google Workspace OAuth credentials missing: ${config.missingConfig.join(', ')}. Set them in server/.env or environment variables.`
    });
  }
  const authUrl = GoogleIntegrationService.getOAuthUrl(req.organizationId, req.userId);
  return successResponse(res, { authUrl, isConfigured: true });
});

export const handleGoogleOAuthCallback = ah(async (req, res) => {
  const { code, state, error, error_description } = req.query;
  const redirectBase = `${env.CLIENT_URL}/admin/meetings`;

  if (error) {
    const errorMsg = encodeURIComponent(error_description || error || 'Access denied');
    return res.redirect(`${redirectBase}?google=error&message=${errorMsg}`);
  }

  if (!code || !state) {
    return res.redirect(`${redirectBase}?google=error&message=${encodeURIComponent('Missing authorization code or state')}`);
  }

  try {
    const status = await GoogleIntegrationService.handleOAuthCallback(code, state);
    return res.redirect(`${redirectBase}?google=connected&email=${encodeURIComponent(status.accountEmail || '')}`);
  } catch (err) {
    return res.redirect(`${redirectBase}?google=error&message=${encodeURIComponent(err.message || 'OAuth verification failed')}`);
  }
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

  // Create real event using official Calendar API
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const startTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const endHour = (now.getHours() + 1) % 24;
  const endTime = `${pad(endHour)}:${pad(now.getMinutes())}`;

  let attendeeEmails = [];
  if (body.participants && body.participants.length > 0) {
    const attendeeUsers = await User.find({ _id: { $in: body.participants } }).select('email');
    attendeeEmails = attendeeUsers.map(u => u.email).filter(Boolean);
  }

  const meet = await GoogleIntegrationService.createCalendarAndMeetEvent({
    organizationId: req.organizationId,
    title: body.title,
    description: body.description || 'Instant conference started via Google Meet Hub.',
    scheduledDate: now,
    startTime,
    endTime,
    timezone: req.timezone || 'Asia/Kolkata',
    attendees: attendeeEmails
  });

  // If requested or participants provided, record in Meeting collection
  const participants = [...new Set([String(req.userId), ...(body.participants || [])])];
  const { Meeting } = await import('../meetings/meeting.model.js');
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
    description: body.description || 'Instant conference started via Google Meet Hub.'
  });

  // If participants provided, send Google Meet invite email
  if (attendeeEmails.length > 0) {
    for (const email of attendeeEmails) {
      emailService.sendEmail({
        to: email,
        subject: `Join Google Meet: ${body.title}`,
        text: `You have been invited to join Google Meet conference: ${meet.meetLink}`,
        html: `<div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 550px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0284c7; margin-top: 0;">Google Meet Conference</h2>
          <p>You have been invited to join <strong>${body.title}</strong>.</p>
          <div style="margin: 24px 0; text-align: center;">
            <a href="${meet.meetLink}" style="background-color: #059669; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; display: inline-block;">Join Google Meet Now</a>
          </div>
          <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">Direct URL: <a href="${meet.meetLink}">${meet.meetLink}</a></p>
        </div>`,
        organizationId: req.organizationId
      }).catch(err => console.error('Error sending instant meet email:', err));
    }
  }

  return successResponse(res, {
    ...meet,
    meetingId: meetingRecord._id,
    meeting: meetingRecord
  }, 'Instant Google Meet conference provisioned and started');
});
