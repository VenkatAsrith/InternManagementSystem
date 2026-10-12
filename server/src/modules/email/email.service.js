import nodemailer from 'nodemailer';
import { EmailLog } from './email.model.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { EMAIL_STATUS } from '../../../../shared/constants.js';

/**
 * Dual-SMTP Nodemailer Service with automatic failover.
 * 
 * If primary SMTP fails or reaches limits, automatically switches to secondary.
 * Tracks send counts to proactively switch before hitting provider limits.
 */

// Send counters for rate tracking
let primarySendCount = 0;
let secondarySendCount = 0;
let primaryLastReset = Date.now();
let secondaryLastReset = Date.now();

// Default hourly limit before proactive switch
const SEND_LIMIT_PER_HOUR = parseInt(process.env.SMTP_LIMIT_PER_HOUR || String(env.SMTP_LIMIT_PER_HOUR || "450"), 10);
const HOUR_MS = 60 * 60 * 1000;

/**
 * Create primary nodemailer transporter from env config.
 */
const createPrimaryTransporter = () => {
  const host = process.env.SMTP_HOST || env.SMTP_HOST || 'smtp-relay.brevo.com';
  const port = parseInt(process.env.SMTP_PORT || String(env.SMTP_PORT || '587'), 10);
  const user = process.env.SMTP_USER || env.SMTP_USER;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || env.SMTP_PASSWORD;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });
};

/**
 * Create secondary nodemailer transporter from env config (backup/failover).
 */
const createSecondaryTransporter = () => {
  const host = process.env.SMTP2_HOST || env.SMTP2_HOST || 'smtp-relay.brevo.com';
  const port = parseInt(process.env.SMTP2_PORT || String(env.SMTP2_PORT || '587'), 10);
  const user = process.env.SMTP2_USER || env.SMTP2_USER;
  const pass = process.env.SMTP2_PASS || process.env.SMTP2_PASSWORD || env.SMTP2_PASSWORD;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });
};

let primaryTransporter = null;
let secondaryTransporter = null;

/**
 * Initialize transporters lazily on first use.
 */
const getTransporters = () => {
  if (!primaryTransporter) {
    primaryTransporter = createPrimaryTransporter();
  }
  if (!secondaryTransporter && (process.env.SMTP2_USER || env.SMTP2_USER)) {
    secondaryTransporter = createSecondaryTransporter();
  }
  return { primaryTransporter, secondaryTransporter };
};

/**
 * Reset hourly counters if an hour has passed.
 */
const resetCountersIfNeeded = () => {
  const now = Date.now();
  if (now - primaryLastReset > HOUR_MS) {
    primarySendCount = 0;
    primaryLastReset = now;
  }
  if (now - secondaryLastReset > HOUR_MS) {
    secondarySendCount = 0;
    secondaryLastReset = now;
  }
};

/**
 * Send an email with automatic failover.
 * Tries primary first; if it fails or is over limit, falls back to secondary.
 */
export const sendMail = async (mailOptions) => {
  const { primaryTransporter, secondaryTransporter } = getTransporters();
  resetCountersIfNeeded();

  const fromAddress = process.env.EMAIL_FROM || env.EMAIL_FROM || process.env.SMTP_USER || env.SMTP_USER || 'telugufullstackdeveloper@gmail.com';
  const appName = process.env.SMTP_FROM_NAME || env.SMTP_FROM_NAME || 'LearningSpaces';

  const options = {
    from: `"${appName}" <${fromAddress}>`,
    ...mailOptions,
  };

  // Simulation mode for QA/test environments or when no transporters are configured
  if (['qa', 'test'].includes(env.NODE_ENV) || (!primaryTransporter && !secondaryTransporter)) {
    const simulatedId = `simulated-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    logger.info(`[Email (Simulated)] To: ${options.to} | Subject: "${options.subject}" | MsgID: ${simulatedId}`);
    return { messageId: simulatedId, simulated: true };
  }

  // Try primary first (if configured and under limit)
  if (primaryTransporter && primarySendCount < SEND_LIMIT_PER_HOUR) {
    try {
      const result = await primaryTransporter.sendMail(options);
      primarySendCount++;
      logger.info(`[Email] Sent via PRIMARY SMTP to ${options.to} (count: ${primarySendCount})`);
      return result;
    } catch (error) {
      logger.error(`[Email] PRIMARY SMTP failed: ${error.message}. Attempting secondary failover...`);
      // Fall through to secondary
    }
  } else if (primaryTransporter && primarySendCount >= SEND_LIMIT_PER_HOUR) {
    logger.warn(`[Email] PRIMARY SMTP limit reached (${primarySendCount}/${SEND_LIMIT_PER_HOUR}). Switching to secondary.`);
  }

  // Try secondary (if configured and under limit)
  if (secondaryTransporter && secondarySendCount < SEND_LIMIT_PER_HOUR) {
    try {
      const secondaryFrom = process.env.EMAIL2_FROM || env.EMAIL2_FROM || process.env.SMTP2_USER || env.SMTP2_USER || fromAddress;
      options.from = `"${appName}" <${secondaryFrom}>`;

      const result = await secondaryTransporter.sendMail(options);
      secondarySendCount++;
      logger.info(`[Email] Sent via SECONDARY SMTP to ${options.to} (count: ${secondarySendCount})`);
      return result;
    } catch (error) {
      logger.error(`[Email] SECONDARY SMTP also failed: ${error.message}`);
      throw new Error("All SMTP services failed. Could not send email.");
    }
  }

  // Simulation fallback if no SMTP configured (useful for offline local tests)
  if (!primaryTransporter && !secondaryTransporter) {
    const simulatedId = `simulated-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    logger.info(`[Email (Simulated)] To: ${options.to} | Subject: "${options.subject}" | MsgID: ${simulatedId}`);
    return { messageId: simulatedId, simulated: true };
  }

  throw new Error("All SMTP services exhausted or unavailable.");
};

/**
 * Generate a 6-digit OTP.
 */
export const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send an OTP verification email with branded HTML template.
 */
export const sendOtpEmail = async (email, otp, name = "Student") => {
  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 520px; margin: 0 auto; padding: 40px 20px;">
        <tr>
          <td style="padding: 0;">
            <!-- Header -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="padding: 30px 40px; text-align: center; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px 16px 0 0;">
                  <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
                    🎓 LearningSpaces
                  </h1>
                  <p style="margin: 8px 0 0; font-size: 14px; color: #8b8fa3;">
                    Your Learning Platform
                  </p>
                </td>
              </tr>
            </table>

            <!-- Body -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="padding: 40px; background-color: #12121a; border-left: 1px solid #1e1e2e; border-right: 1px solid #1e1e2e;">
                  <h2 style="margin: 0 0 8px; font-size: 22px; font-weight: 600; color: #ffffff;">
                    Hi ${name}! 👋
                  </h2>
                  <p style="margin: 0 0 30px; font-size: 15px; color: #9ca3af; line-height: 1.6;">
                    Welcome to LearningSpaces! Use the verification code below to complete your account registration.
                  </p>

                  <!-- OTP Box -->
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td align="center" style="padding: 24px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 1px solid #334155; border-radius: 12px;">
                        <p style="margin: 0 0 12px; font-size: 13px; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">
                          Verification Code
                        </p>
                        <p style="margin: 0; font-size: 40px; font-weight: 700; color: #60a5fa; letter-spacing: 12px; font-family: 'Courier New', monospace;">
                          ${otp}
                        </p>
                        <p style="margin: 12px 0 0; font-size: 13px; color: #64748b;">
                          Valid for 10 minutes
                        </p>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 30px 0 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                    ⚠️ If you didn't request this code, please ignore this email. Do not share this code with anyone.
                  </p>
                </td>
              </tr>
            </table>

            <!-- Footer -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="padding: 24px 40px; text-align: center; background-color: #0d0d14; border-radius: 0 0 16px 16px; border-left: 1px solid #1e1e2e; border-right: 1px solid #1e1e2e; border-bottom: 1px solid #1e1e2e;">
                  <p style="margin: 0; font-size: 12px; color: #4b5563;">
                    © ${new Date().getFullYear()} LearningSpaces. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return await sendMail({
    to: email,
    subject: `${otp} – Your LearningSpaces Verification Code`,
    html: htmlTemplate,
    text: `Your LearningSpaces verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`,
  });
};

/**
 * Send an OTP verification email for password reset.
 */
export const sendPasswordResetEmail = async (email, otp, name = "Student") => {
  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 520px; margin: 0 auto; padding: 40px 20px;">
        <tr>
          <td style="padding: 0;">
            <!-- Header -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="padding: 30px 40px; text-align: center; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px 16px 0 0;">
                  <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
                    🎓 LearningSpaces
                  </h1>
                  <p style="margin: 8px 0 0; font-size: 14px; color: #8b8fa3;">
                    Your Learning Platform
                  </p>
                </td>
              </tr>
            </table>

            <!-- Body -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="padding: 40px; background-color: #12121a; border-left: 1px solid #1e1e2e; border-right: 1px solid #1e1e2e;">
                  <h2 style="margin: 0 0 8px; font-size: 22px; font-weight: 600; color: #ffffff;">
                    Password Reset Request
                  </h2>
                  <p style="margin: 0 0 30px; font-size: 15px; color: #9ca3af; line-height: 1.6;">
                    Hi ${name}! 👋<br><br>
                    We received a request to reset your password. Use the verification code below to set up a new password.
                  </p>

                  <!-- OTP Box -->
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td align="center" style="padding: 24px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 1px solid #334155; border-radius: 12px;">
                        <p style="margin: 0 0 12px; font-size: 13px; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">
                          Verification Code
                        </p>
                        <p style="margin: 0; font-size: 40px; font-weight: 700; color: #60a5fa; letter-spacing: 12px; font-family: 'Courier New', monospace;">
                          ${otp}
                        </p>
                        <p style="margin: 12px 0 0; font-size: 13px; color: #64748b;">
                          Valid for 10 minutes
                        </p>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 30px 0 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                    ⚠️ If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
                  </p>
                </td>
              </tr>
            </table>

            <!-- Footer -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="padding: 24px 40px; text-align: center; background-color: #0d0d14; border-radius: 0 0 16px 16px; border-left: 1px solid #1e1e2e; border-right: 1px solid #1e1e2e; border-bottom: 1px solid #1e1e2e;">
                  <p style="margin: 0; font-size: 12px; color: #4b5563;">
                    © ${new Date().getFullYear()} LearningSpaces. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return await sendMail({
    to: email,
    subject: `${otp} – Password Reset Code`,
    html: htmlTemplate,
    text: `Your password reset code is: ${otp}. Valid for 10 minutes. If you did not request this, please ignore this email.`,
  });
};

/**
 * Send welcome onboarding credentials email with generated password.
 */
export const sendOnboardingCredentialsEmail = async ({
  to,
  name = 'Participant',
  email,
  password,
  role = 'INTERN',
  orgName = 'TechMecha Torque',
  loginUrl = 'http://localhost:3000/login',
  organizationId
}) => {
  const roleTitle = role === 'INTERN_TRAINEE' ? 'Intern Trainee' : 'Intern';
  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 560px; margin: 0 auto; padding: 32px 16px;">
        <tr>
          <td style="padding: 0;">
            <!-- Header -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="padding: 28px 36px; text-align: center; background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); border-radius: 14px 14px 0 0; border: 1px solid #4338ca;">
                  <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
                    🚀 Welcome to ${orgName}
                  </h1>
                  <p style="margin: 6px 0 0; font-size: 14px; color: #c7d2fe;">
                    Intern Management &amp; Learning Platform
                  </p>
                </td>
              </tr>
            </table>

            <!-- Body -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="padding: 36px; background-color: #1e293b; border-left: 1px solid #334155; border-right: 1px solid #334155;">
                  <h2 style="margin: 0 0 10px; font-size: 20px; font-weight: 600; color: #ffffff;">
                    Congratulations, ${name}! 🎉
                  </h2>
                  <p style="margin: 0 0 24px; font-size: 14px; color: #cbd5e1; line-height: 1.6;">
                    You have been onboarded as <strong>${roleTitle}</strong> at ${orgName}. Your portal account has been created. Use the credentials below to log in:
                  </p>

                  <!-- Credentials Box -->
                  <div style="background-color: #0f172a; border: 1px solid #3b82f6; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
                    <p style="margin: 0 0 10px; font-size: 13px; color: #94a3b8;">
                      <strong style="color: #ffffff;">Portal URL:</strong> <a href="${loginUrl}" style="color: #60a5fa; text-decoration: underline;">${loginUrl}</a>
                    </p>
                    <p style="margin: 0 0 10px; font-size: 13px; color: #94a3b8;">
                      <strong style="color: #ffffff;">Login Email:</strong> <span style="font-family: monospace; color: #93c5fd;">${email}</span>
                    </p>
                    <p style="margin: 0; font-size: 13px; color: #94a3b8;">
                      <strong style="color: #ffffff;">Temporary Password:</strong> <span style="font-family: monospace; background: #1e293b; color: #34d399; font-weight: bold; padding: 3px 8px; border-radius: 4px; border: 1px solid #059669;">${password}</span>
                    </p>
                  </div>

                  <p style="margin: 0 0 24px; font-size: 13px; color: #94a3b8; line-height: 1.5;">
                    🔒 <strong>Next Steps:</strong> Log in, reset your temporary password in Account &amp; Security, and upload your required onboarding documents.
                  </p>

                  <div style="text-align: center;">
                    <a href="${loginUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 30px; border-radius: 8px;">
                      Log In to Workspace &rarr;
                    </a>
                  </div>
                </td>
              </tr>
            </table>

            <!-- Footer -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="padding: 20px 36px; text-align: center; background-color: #0f172a; border-radius: 0 0 14px 14px; border: 1px solid #334155;">
                  <p style="margin: 0; font-size: 11px; color: #64748b;">
                    © ${new Date().getFullYear()} ${orgName}. All rights reserved. Do not share your login credentials with anyone.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return await sendMail({
    to,
    subject: `Welcome to ${orgName} – Your Login Credentials`,
    html: htmlTemplate,
    text: `Welcome to ${orgName}! Your login email: ${email}, Temporary Password: ${password}. Portal: ${loginUrl}`
  });
};

/**
 * Enterprise EmailService class supporting idempotency, audit logging,
 * and seamless dual-SMTP delivery.
 */
class EmailService {
  /**
   * Dispatches an email with idempotency protection.
   * Only recipient, subject, template and delivery outcome are logged.
   */
  async sendEmail({ to, subject, template = 'GENERIC', html, text, attachments = [], idempotencyKey, organizationId }) {
    if (idempotencyKey) {
      const existing = await EmailLog.findOne({ idempotencyKey });
      if (existing && existing.status === EMAIL_STATUS.SENT) {
        logger.info(`[EmailService] Idempotent duplicate suppressed for key: ${idempotencyKey}`);
        return existing;
      }
    }

    let logRecord;
    if (idempotencyKey) {
      logRecord = await EmailLog.findOneAndUpdate(
        { idempotencyKey },
        { recipient: to, subject, template, status: EMAIL_STATUS.PROCESSING, organizationId },
        { upsert: true, new: true }
      );
    } else {
      logRecord = await EmailLog.create({ recipient: to, subject, template, status: EMAIL_STATUS.PROCESSING, organizationId });
    }

    try {
      const info = await sendMail({
        to,
        subject,
        text: text || html?.replace(/<[^>]*>?/gm, ''),
        html,
        attachments
      });

      const messageId = info.messageId || `msg-${Date.now()}`;
      logRecord.status = EMAIL_STATUS.SENT;
      logRecord.messageId = messageId;
      logRecord.sentAt = new Date();
      await logRecord.save();
      return logRecord;
    } catch (err) {
      logger.error(`[EmailService] Dispatch failed to ${to}: ${err.message}`);
      logRecord.status = EMAIL_STATUS.FAILED;
      logRecord.failedAt = new Date();
      logRecord.failureReason = err.message;
      logRecord.retryCount += 1;
      await logRecord.save();
      throw err;
    }
  }

  /** Fire-and-forget delivery that never blocks or fails the HTTP request that triggered it. */
  queueEmail(params) {
    setImmediate(async () => {
      try {
        await this.sendEmail(params);
      } catch (err) {
        logger.error(`[EmailService Async Queue Error] ${err.message}`);
      }
    });
  }
}

export const emailService = new EmailService();

export default {
  sendMail,
  sendOtpEmail,
  sendPasswordResetEmail,
  generateOtp,
  emailService,
  sendEmail: emailService.sendEmail.bind(emailService),
  queueEmail: emailService.queueEmail.bind(emailService)
};
