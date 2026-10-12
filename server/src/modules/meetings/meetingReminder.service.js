import { Meeting } from './meeting.model.js';
import { User } from '../users/user.model.js';
import { emailService } from '../email/email.service.js';
import { createNotification } from '../notifications/notification.service.js';
import { logger } from '../../config/logger.js';
import { formatDateLong } from '../../utils/time.js';

let reminderInterval = null;

export class MeetingReminderService {
  /**
   * Process and dispatch all pending reminders whose scheduled time has arrived
   */
  static async processPendingReminders() {
    const now = new Date();
    try {
      const meetings = await Meeting.find({
        status: { $in: ['SCHEDULED', 'RESCHEDULED'] },
        'reminders.status': 'SCHEDULED',
        'reminders.scheduledFor': { $lte: now }
      }).populate('participants', 'email firstName lastName');

      for (const meeting of meetings) {
        let modified = false;

        for (const rem of meeting.reminders) {
          if (rem.status === 'SCHEDULED' && rem.scheduledFor && new Date(rem.scheduledFor) <= now) {
            try {
              const label = rem.type === '24_HOURS' ? '24 Hours' : rem.type === '15_MINUTES' ? '15 Minutes' : 'Upcoming';
              const meetUrl = meeting.googleMeetLink || meeting.meetingLink;
              const dateText = formatDateLong(meeting.scheduledDate, meeting.timezone);

              // Collect all recipient emails: participants + externalAttendees
              const registeredEmails = (meeting.participants || []).map(p => p.email).filter(Boolean);
              const allEmails = [...new Set([...registeredEmails, ...(meeting.externalAttendees || [])])];

              for (const toEmail of allEmails) {
                emailService.sendEmail({
                  to: toEmail,
                  subject: `Reminder (${label}): ${meeting.title}`,
                  text: `Meeting "${meeting.title}" is scheduled for ${dateText} at ${meeting.startTime} (${meeting.timezone || 'Asia/Kolkata'}). Join link: ${meetUrl}`,
                  html: `
                    <div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 580px; border: 1px solid #e2e8f0; border-radius: 8px;">
                      <div style="border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 16px;">
                        <h2 style="color: #0284c7; margin: 0; font-size: 20px;">Meeting Reminder (${label})</h2>
                        <p style="color: #64748b; margin: 4px 0 0 0; font-size: 13px;">${meeting.title}</p>
                      </div>
                      <p>This is an automated reminder that your scheduled meeting is starting soon:</p>
                      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
                        <tr><td style="padding: 6px 0; color: #64748b; width: 120px;"><strong>Date:</strong></td><td>${dateText}</td></tr>
                        <tr><td style="padding: 6px 0; color: #64748b;"><strong>Time:</strong></td><td>${meeting.startTime} - ${meeting.endTime} (${meeting.timezone || 'Asia/Kolkata'})</td></tr>
                        ${meeting.agenda ? `<tr><td style="padding: 6px 0; color: #64748b; vertical-align: top;"><strong>Agenda:</strong></td><td>${meeting.agenda}</td></tr>` : ''}
                      </table>
                      ${meetUrl ? `
                        <div style="margin: 24px 0; text-align: center;">
                          <a href="${meetUrl}" style="background-color: #0284c7; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; display: inline-block;">Join Google Meet</a>
                        </div>
                        <p style="font-size: 12px; color: #64748b; word-break: break-all;">Meeting URL: <a href="${meetUrl}">${meetUrl}</a></p>
                      ` : ''}
                    </div>
                  `,
                  organizationId: meeting.organizationId
                }).catch(err => logger.error(`Error sending reminder email to ${toEmail}:`, err));
              }

              // Also create in-app notifications for registered users
              for (const p of meeting.participants || []) {
                createNotification({
                  organizationId: meeting.organizationId,
                  recipientId: p._id,
                  type: 'MEETING_REMINDER',
                  title: `Meeting Reminder: ${meeting.title}`,
                  message: `Your meeting starts in ${label} on ${dateText} at ${meeting.startTime}.`,
                  entityType: 'Meeting',
                  entityId: meeting._id
                }).catch(err => logger.error('Error creating reminder in-app notification:', err));
              }

              rem.status = 'SENT';
              rem.sentAt = new Date();
              modified = true;
              logger.info(`Dispatched ${label} reminder for meeting "${meeting.title}" (${meeting._id})`);
            } catch (remErr) {
              rem.status = 'FAILED';
              modified = true;
              logger.error(`Failed to dispatch reminder for meeting ${meeting._id}:`, remErr);
            }
          }
        }

        if (modified) {
          await meeting.save();
        }
      }
    } catch (err) {
      logger.error('Error running MeetingReminderService.processPendingReminders:', err);
    }
  }

  /**
   * Start recurring background worker polling every 60 seconds
   */
  static startWorker() {
    if (reminderInterval) return;
    logger.info('Starting MeetingReminderService worker (60s poll interval)...');
    reminderInterval = setInterval(() => {
      this.processPendingReminders().catch(err => logger.error('Reminder worker error:', err));
    }, 60 * 1000);
    reminderInterval.unref();

    // Run immediate check
    this.processPendingReminders().catch(err => logger.error('Initial reminder check error:', err));
  }

  static stopWorker() {
    if (reminderInterval) {
      clearInterval(reminderInterval);
      reminderInterval = null;
    }
  }
}
