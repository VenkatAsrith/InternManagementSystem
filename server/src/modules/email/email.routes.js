import { Router } from 'express';
import { EmailLog } from './email.model.js';
import { emailService } from './email.service.js';
import { User } from '../users/user.model.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { ah } from '../../utils/asyncHandler.js';
import { escapeRegex, parsePagination, Validator } from '../../utils/validate.js';
import { EMAIL_STATUS, ROLES } from '../../../../shared/constants.js';

const router = Router();

router.use(authenticate, requireOrgContext);

// Delivery logs (Admins & Auditors). Body content is never stored, only the delivery outcome.
router.get('/logs', requirePermission('audit.read'), ah(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 200 });
  const query = { organizationId: req.organizationId };
  if (Object.values(EMAIL_STATUS).includes(req.query.status)) query.status = req.query.status;
  if (req.query.recipient) query.recipient = new RegExp(escapeRegex(String(req.query.recipient).slice(0, 100)), 'i');

  const [logs, total] = await Promise.all([
    EmailLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    EmailLog.countDocuments(query)
  ]);
  return paginatedResponse(res, logs, { page, limit, total });
}));

// Get active user count grouped by role for the current organization
router.get('/roles-summary', requireAnyPermission('users.read', 'settings.manage'), ah(async (req, res) => {
  const users = await User.find({ organizationId: req.organizationId, isActive: true }).select('role');
  const roleCounts = {};
  Object.values(ROLES).forEach(r => { roleCounts[r] = 0; });
  let totalActive = 0;

  for (const u of users) {
    if (u.role) {
      roleCounts[u.role] = (roleCounts[u.role] || 0) + 1;
      totalActive++;
    }
  }

  return successResponse(res, {
    totalActive,
    roleCounts,
    roles: Object.keys(roleCounts).map(role => ({
      role,
      count: roleCounts[role]
    }))
  });
}));

// Broadcast email to one or more user roles
router.post('/broadcast', requireAnyPermission('settings.manage', 'users.create', 'users.read'), ah(async (req, res) => {
  const v = new Validator(req.body)
    .string('subject', { required: true, min: 3, max: 200 })
    .string('message', { required: true, min: 5, max: 10000 })
    .string('actionUrl', { max: 500 })
    .string('actionText', { max: 60 });
  const body = v.done();

  const rawRoles = req.body.roles;
  const targetRoles = Array.isArray(rawRoles) ? rawRoles : (rawRoles ? [rawRoles] : ['ALL']);

  // Query active users
  const filter = { organizationId: req.organizationId, isActive: true };
  if (!targetRoles.includes('ALL')) {
    filter.role = { $in: targetRoles };
  }

  const recipients = await User.find(filter).select('email firstName lastName role');
  if (!recipients.length) {
    return successResponse(res, { sentCount: 0, failedCount: 0, totalRecipients: 0 }, 'No active recipients found for selected roles');
  }

  let sentCount = 0;
  let failedCount = 0;
  const actionBtnHtml = body.actionUrl ? `
    <div style="margin: 28px 0; text-align: center;">
      <a href="${body.actionUrl}" style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);">
        ${body.actionText || 'View Details'}
      </a>
    </div>
  ` : '';

  // Process dispatch in chunks for rate stability
  for (const user of recipients) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>${body.subject}</title></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="padding: 24px; background: #0f172a; color: #ffffff; border-bottom: 3px solid #2563eb;">
              <h2 style="margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.02em;">TechMecha Torque System Announcement</h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #334155;">Hello <strong>${user.firstName || 'Team Member'}</strong>,</p>
              <div style="font-size: 15px; line-height: 1.7; color: #1e293b; white-space: pre-wrap; background: #f8fafc; border-radius: 8px; padding: 20px; border-left: 4px solid #2563eb;">${body.message}</div>
              ${actionBtnHtml}
              <p style="margin: 24px 0 0; font-size: 12px; color: #64748b; line-height: 1.5;">This email was sent to your registered role as <strong>${user.role}</strong>.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 24px; background: #f1f5f9; text-align: center; font-size: 11px; color: #64748b;">
              &copy; ${new Date().getFullYear()} TechMecha Torque IMS. Automated Broadcast.
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    try {
      await emailService.sendEmail({
        to: user.email,
        subject: body.subject,
        html,
        text: `${body.message}\n\n${body.actionUrl ? `Action Link: ${body.actionUrl}` : ''}`,
        template: 'ROLE_BROADCAST',
        organizationId: req.organizationId
      });
      sentCount++;
    } catch {
      failedCount++;
    }
  }

  await recordAuditLog({
    action: 'EMAIL_ROLE_BROADCAST_SENT',
    entityType: 'Email',
    entityId: req.userId,
    after: {
      targetRoles,
      subject: body.subject,
      totalRecipients: recipients.length,
      sentCount,
      failedCount
    },
    req
  });

  return successResponse(res, {
    sentCount,
    failedCount,
    totalRecipients: recipients.length,
    targetRoles
  }, `Dispatched announcement to ${sentCount} user(s) across selected roles.`);
}));

// Test SMTP transmission
router.post('/test', requirePermission('settings.manage'), ah(async (req, res) => {
  const v = new Validator(req.body).email('to');
  const { to } = v.done();
  const recipient = to || req.user.email;

  const result = await emailService.sendEmail({
    to: recipient,
    subject: 'TechMecha Torque IMS: SMTP Integration Test',
    template: 'SMTP_TEST',
    text: 'This is a test email confirming that your SMTP email delivery engine is operational.',
    organizationId: req.organizationId
  });
  return successResponse(res, result, `Test email dispatched to ${recipient}`);
}));

export default router;
