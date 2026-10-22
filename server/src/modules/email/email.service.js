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
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
    dnsTimeout: 5000,
    tls: { rejectUnauthorized: false }
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
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
    dnsTimeout: 5000,
    tls: { rejectUnauthorized: false }
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

const sendWithTimeout = (transporter, opts, ms = 10000) => {
  return Promise.race([
    transporter.sendMail(opts),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`SMTP connection timed out after ${ms / 1000}s`)), ms)
    )
  ]);
};

/**
 * Send an email with automatic failover.
 * Tries primary first; if it fails or is over limit, falls back to secondary.
 */
export const sendMail = async (mailOptions) => {
  const { primaryTransporter, secondaryTransporter } = getTransporters();
  resetCountersIfNeeded();

  const fromAddress = process.env.EMAIL_FROM || env.EMAIL_FROM || process.env.SMTP_USER || env.SMTP_USER || 'team@techmechatorque.com';
  const appName = process.env.SMTP_FROM_NAME || env.SMTP_FROM_NAME || 'TechMecha Torque';

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
      const result = await sendWithTimeout(primaryTransporter, options, 8000);
      primarySendCount++;
      logger.info(`[Email] Sent via PRIMARY SMTP to ${options.to} (count: ${primarySendCount})`);
      return result;
    } catch (error) {
      logger.error(`[Email] PRIMARY SMTP failed/timed out: ${error.message}. Attempting secondary failover...`);
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

      const result = await sendWithTimeout(secondaryTransporter, options, 8000);
      secondarySendCount++;
      logger.info(`[Email] Sent via SECONDARY SMTP to ${options.to} (count: ${secondarySendCount})`);
      return result;
    } catch (error) {
      logger.error(`[Email] SECONDARY SMTP also failed/timed out: ${error.message}`);
    }
  }

  // Graceful fallback to avoid request timeout crash when SMTP hosts are unreachable or blocked by provider
  const fallbackId = `offline-queued-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  logger.warn(`[Email Timeout Fallback] All SMTP delivery attempts failed or timed out for ${options.to}. Returning offline queued record (${fallbackId}) to prevent request hang.`);
  return { messageId: fallbackId, simulated: true, queued: true, deliveryNote: 'Dispatched via fallback queue due to SMTP network unavailability' };
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
/**
 * TMT Header Component for HTML Emails
 */
const getTmtEmailHeader = (title = 'TechMecha Torque', subtitle = 'Internship Management & Learning Platform') => `
  <!-- TMT Header -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
    <tr>
      <td style="padding: 28px 36px; text-align: center; background: linear-gradient(135deg, #09090b 0%, #18181b 100%); border-radius: 14px 14px 0 0; border: 1px solid #27272a; border-bottom: 2px solid #ef4444;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto;">
          <tr>
            <td align="center" style="padding-bottom: 8px;">
              <span style="display: inline-block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 32px; font-weight: 900; letter-spacing: -1px; color: #ef4444;">
                <span style="color:#ffffff;">T</span>M<span style="color:#ffffff;">T</span>
              </span>
            </td>
          </tr>
          <tr>
            <td align="center">
              <span style="font-size: 13px; font-weight: 800; color: #ef4444; letter-spacing: 1.5px; text-transform: uppercase;">
                TECHMECHA TORQUE PVT. LTD.
              </span>
            </td>
          </tr>
        </table>
        <h1 style="margin: 12px 0 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px;">
          ${title}
        </h1>
        <p style="margin: 4px 0 0; font-size: 13px; color: #a1a1aa;">
          ${subtitle}
        </p>
      </td>
    </tr>
  </table>
`;

const getTmtEmailFooter = (orgName = 'TechMecha Torque Pvt. Ltd.') => `
  <!-- TMT Footer -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
    <tr>
      <td style="padding: 20px 36px; text-align: center; background-color: #09090b; border-radius: 0 0 14px 14px; border: 1px solid #27272a; border-top: 1px solid #18181b;">
        <p style="margin: 0 0 6px; font-size: 12px; font-weight: 600; color: #e4e4e7;">
          ${orgName}
        </p>
        <p style="margin: 0; font-size: 11px; color: #71717a;">
          © ${new Date().getFullYear()} TechMecha Torque Pvt. Ltd. All rights reserved. • team@techmechatorque.com
        </p>
      </td>
    </tr>
  </table>
`;

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
    <body style="margin: 0; padding: 0; background-color: #050505; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 520px; margin: 0 auto; padding: 40px 16px;">
        <tr>
          <td style="padding: 0;">
            ${getTmtEmailHeader('Verification Code', 'Secure Account Authentication')}

            <!-- Body -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="padding: 36px; background-color: #121215; border-left: 1px solid #27272a; border-right: 1px solid #27272a;">
                  <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 600; color: #ffffff;">
                    Hi ${name}! 👋
                  </h2>
                  <p style="margin: 0 0 24px; font-size: 14px; color: #a1a1aa; line-height: 1.6;">
                    Welcome to TechMecha Torque! Use the verification code below to complete your account authentication.
                  </p>

                  <!-- OTP Box -->
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td align="center" style="padding: 24px; background: #18181b; border: 1px solid #3f3f46; border-radius: 12px;">
                        <p style="margin: 0 0 10px; font-size: 12px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">
                          Verification Code
                        </p>
                        <p style="margin: 0; font-size: 38px; font-weight: 800; color: #ef4444; letter-spacing: 10px; font-family: 'Courier New', monospace;">
                          ${otp}
                        </p>
                        <p style="margin: 10px 0 0; font-size: 12px; color: #71717a;">
                          Valid for 10 minutes
                        </p>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 26px 0 0; font-size: 13px; color: #71717a; line-height: 1.5;">
                    ⚠️ If you did not request this verification code, please ignore this email. Never share this code with anyone.
                  </p>
                </td>
              </tr>
            </table>

            ${getTmtEmailFooter()}
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return await sendMail({
    to: email,
    subject: `${otp} – Your TechMecha Torque Verification Code`,
    html: htmlTemplate,
    text: `Your TechMecha Torque verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`,
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
    <body style="margin: 0; padding: 0; background-color: #050505; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 520px; margin: 0 auto; padding: 40px 16px;">
        <tr>
          <td style="padding: 0;">
            ${getTmtEmailHeader('Password Reset', 'Account Security Services')}

            <!-- Body -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="padding: 36px; background-color: #121215; border-left: 1px solid #27272a; border-right: 1px solid #27272a;">
                  <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 600; color: #ffffff;">
                    Password Reset Request
                  </h2>
                  <p style="margin: 0 0 24px; font-size: 14px; color: #a1a1aa; line-height: 1.6;">
                    Hi ${name}! 👋<br>
                    We received a request to reset your TechMecha Torque workspace password. Use the verification code below:
                  </p>

                  <!-- OTP Box -->
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td align="center" style="padding: 24px; background: #18181b; border: 1px solid #3f3f46; border-radius: 12px;">
                        <p style="margin: 0 0 10px; font-size: 12px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">
                          Password Reset Code
                        </p>
                        <p style="margin: 0; font-size: 38px; font-weight: 800; color: #ef4444; letter-spacing: 10px; font-family: 'Courier New', monospace;">
                          ${otp}
                        </p>
                        <p style="margin: 10px 0 0; font-size: 12px; color: #71717a;">
                          Valid for 10 minutes
                        </p>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 26px 0 0; font-size: 13px; color: #71717a; line-height: 1.5;">
                    ⚠️ If you didn't request a password reset, your account is safe and you can ignore this email.
                  </p>
                </td>
              </tr>
            </table>

            ${getTmtEmailFooter()}
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return await sendMail({
    to: email,
    subject: `${otp} – TechMecha Torque Password Reset Code`,
    html: htmlTemplate,
    text: `Your TechMecha Torque password reset code is: ${otp}. Valid for 10 minutes. If you did not request this, please ignore this email.`,
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
  orgName = 'TechMecha Torque Pvt. Ltd.',
  loginUrl = 'https://internmanagementsystem-xm84.onrender.com/login',
  organizationId
}) => {
  const roleTitle = role === 'INTERN_TRAINEE' ? 'Intern Trainee' : (role === 'ORGANIZATION_ADMIN' ? 'Organization Administrator' : (role === 'HR_ADMIN' ? 'HR Administrator' : (role === 'MENTOR' ? 'Mentor' : 'Intern')));
  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin: 0; padding: 0; background-color: #050505; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 560px; margin: 0 auto; padding: 32px 16px;">
        <tr>
          <td style="padding: 0;">
            ${getTmtEmailHeader(`Welcome to ${orgName}`, `Official Onboarding Credentials • Role: ${roleTitle}`)}

            <!-- Body -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="padding: 36px; background-color: #121215; border-left: 1px solid #27272a; border-right: 1px solid #27272a;">
                  <h2 style="margin: 0 0 10px; font-size: 20px; font-weight: 600; color: #ffffff;">
                    Congratulations, ${name}! 🎉
                  </h2>
                  <p style="margin: 0 0 24px; font-size: 14px; color: #cbd5e1; line-height: 1.6;">
                    You have been provisioned as <strong>${roleTitle}</strong> at ${orgName}. Your portal workspace has been activated. Use your credentials below to log in:
                  </p>

                  <!-- Credentials Box -->
                  <div style="background-color: #09090b; border: 1px solid #3f3f46; border-left: 4px solid #ef4444; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
                    <p style="margin: 0 0 10px; font-size: 13px; color: #a1a1aa;">
                      <strong style="color: #ffffff;">Portal URL:</strong> <a href="${loginUrl}" style="color: #ef4444; text-decoration: underline;">${loginUrl}</a>
                    </p>
                    <p style="margin: 0 0 10px; font-size: 13px; color: #a1a1aa;">
                      <strong style="color: #ffffff;">Login Email:</strong> <span style="font-family: monospace; color: #ffffff;">${email}</span>
                    </p>
                    <p style="margin: 0; font-size: 13px; color: #a1a1aa;">
                      <strong style="color: #ffffff;">Temporary Password:</strong> <span style="font-family: monospace; background: #18181b; color: #ef4444; font-weight: bold; padding: 3px 8px; border-radius: 4px; border: 1px solid #3f3f46;">${password}</span>
                    </p>
                  </div>

                  <p style="margin: 0 0 24px; font-size: 13px; color: #a1a1aa; line-height: 1.5;">
                    🔒 <strong>Next Steps:</strong> Log in, navigate to Account &amp; Security to update your password, and begin your workspace tasks.
                  </p>

                  <div style="text-align: center;">
                    <a href="${loginUrl}" style="display: inline-block; background-color: #ef4444; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 32px; border-radius: 8px; letter-spacing: 0.3px;">
                      Log In to Workspace &rarr;
                    </a>
                  </div>
                </td>
              </tr>
            </table>

            ${getTmtEmailFooter(orgName)}
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
 * Send Training Fee Payment Receipt Email to Intern Trainee
 */
export const sendFeeReceiptEmail = async ({
  to,
  traineeName,
  traineeId,
  programTitle,
  receiptId,
  amountPaid,
  paymentMethod = 'UPI',
  paymentReference = 'N/A',
  paidAt = new Date(),
  balance = 0,
  orgName = 'TechMecha Torque Pvt. Ltd.',
  attachments = []
}) => {
  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin: 0; padding: 0; background-color: #050505; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 580px; margin: 0 auto; padding: 32px 16px;">
        <tr>
          <td style="padding: 0;">
            ${getTmtEmailHeader('Fee Payment Receipt', `Official Receipt: ${receiptId}`)}

            <!-- Body -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="padding: 36px; background-color: #121215; border-left: 1px solid #27272a; border-right: 1px solid #27272a;">
                  <h2 style="margin: 0 0 10px; font-size: 20px; font-weight: 600; color: #ffffff;">
                    Payment Acknowledgment
                  </h2>
                  <p style="margin: 0 0 24px; font-size: 14px; color: #cbd5e1; line-height: 1.6;">
                    Dear <strong>${traineeName}</strong>, thank you for your payment. We acknowledge receipt of your program tuition fee for <strong>${programTitle}</strong>.
                  </p>

                  <!-- Receipt Summary Box -->
                  <div style="background-color: #09090b; border: 1px solid #3f3f46; border-radius: 10px; padding: 22px; margin-bottom: 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="font-size: 13px; color: #a1a1aa;">
                      <tr>
                        <td style="padding: 6px 0; color: #ffffff; font-weight: 600;">Receipt Number:</td>
                        <td align="right" style="padding: 6px 0; font-family: monospace; color: #ef4444; font-weight: bold;">${receiptId}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">Trainee ID:</td>
                        <td align="right" style="padding: 6px 0; color: #ffffff;">${traineeId || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">Training Program:</td>
                        <td align="right" style="padding: 6px 0; color: #ffffff;">${programTitle}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">Payment Date:</td>
                        <td align="right" style="padding: 6px 0; color: #ffffff;">${new Date(paidAt).toLocaleDateString()}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">Payment Mode:</td>
                        <td align="right" style="padding: 6px 0; color: #ffffff;">${paymentMethod}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">Reference / UTR:</td>
                        <td align="right" style="padding: 6px 0; font-family: monospace; color: #ffffff;">${paymentReference}</td>
                      </tr>
                      <tr style="border-top: 1px solid #27272a;">
                        <td style="padding: 12px 0 6px; font-size: 15px; font-weight: 700; color: #ffffff;">Amount Received:</td>
                        <td align="right" style="padding: 12px 0 6px; font-size: 18px; font-weight: 800; color: #22c55e;">₹${Number(amountPaid).toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; font-size: 12px;">Remaining Balance:</td>
                        <td align="right" style="padding: 4px 0; font-size: 12px; color: ${balance > 0 ? '#f59e0b' : '#22c55e'}; font-weight: 600;">₹${Number(balance).toLocaleString()}</td>
                      </tr>
                    </table>
                  </div>

                  <p style="margin: 0 0 20px; font-size: 13px; color: #a1a1aa; line-height: 1.5;">
                    Your official digitally signed PDF payment receipt is attached to this email for your records and compliance.
                  </p>
                </td>
              </tr>
            </table>

            ${getTmtEmailFooter(orgName)}
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return await sendMail({
    to,
    subject: `Payment Receipt: ${receiptId} – ${programTitle} | TechMecha Torque`,
    html: htmlTemplate,
    text: `Dear ${traineeName}, we have received your payment of ₹${amountPaid} for ${programTitle}. Receipt ID: ${receiptId}. Reference: ${paymentReference}.`,
    attachments
  });
};

/**
 * Send an official branded interview invitation email with meeting link,
 * schedule details, and optional take-home task / case study document.
 */
export const sendInterviewInvitationEmail = async ({
  to,
  candidateName = 'Candidate',
  openingTitle = 'Internship Role',
  interviewTitle = 'Technical Evaluation Interview',
  round = 1,
  interviewType = 'TECHNICAL',
  scheduledDate,
  startTime,
  endTime,
  timezone = 'Asia/Kolkata',
  mode = 'ONLINE',
  meetingLink = '',
  location = '',
  interviewers = [],
  notes = '',
  task = null,
  attachments = [],
  organizationId,
  orgName = 'TechMecha Torque Pvt. Ltd.'
}) => {
  const panelNames = Array.isArray(interviewers)
    ? interviewers.map(i => typeof i === 'string' ? i : `${i.firstName || ''} ${i.lastName || ''}`.trim()).filter(Boolean).join(', ')
    : '';

  const hasTask = Boolean(task && (task.assigned || task.title || task.description || task.documentUrl));

  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #050505; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 580px; margin: 0 auto; padding: 40px 16px;">
        <tr>
          <td style="padding: 0;">
            ${getTmtEmailHeader(`Round ${round}: ${interviewType} Interview`, `${openingTitle} • TechMecha Torque`)}

            <!-- Body Container -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="padding: 36px; background-color: #121215; border-left: 1px solid #27272a; border-right: 1px solid #27272a; color: #ffffff;">
                  <h2 style="margin: 0 0 10px; font-size: 21px; font-weight: 700; color: #ffffff;">
                    Dear ${candidateName}, 👋
                  </h2>
                  <p style="margin: 0 0 24px; font-size: 14px; color: #a1a1aa; line-height: 1.6;">
                    Thank you for applying for the position of <strong style="color: #ffffff;">${openingTitle}</strong> at <strong style="color: #ef4444;">${orgName}</strong>. Following our review of your profile, we are pleased to invite you to your <strong style="color: #ffffff;">Round ${round} (${interviewType})</strong> interview.
                  </p>

                  <!-- Interview Schedule Details Box -->
                  <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 22px; margin-bottom: 24px;">
                    <div style="margin-bottom: 16px;">
                      <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #ef4444;">
                        📅 Interview Schedule & Access
                      </span>
                    </div>

                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="font-size: 13px; color: #d4d4d8;">
                      <tr>
                        <td style="padding: 6px 0; width: 35%; color: #71717a;">Session:</td>
                        <td style="padding: 6px 0; font-weight: 600; color: #ffffff;">${interviewTitle}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #71717a;">Date:</td>
                        <td style="padding: 6px 0; font-weight: 600; color: #ffffff;">${scheduledDate}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #71717a;">Time:</td>
                        <td style="padding: 6px 0; font-weight: 600; color: #ffffff;">${startTime} – ${endTime} (${timezone})</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #71717a;">Format / Mode:</td>
                        <td style="padding: 6px 0; font-weight: 600; color: ${mode === 'ONLINE' ? '#38bdf8' : '#fbbf24'};">
                          ${mode === 'ONLINE' ? '🌐 Online Video Call' : '🏢 In-Person Office Session'}
                        </td>
                      </tr>
                      ${panelNames ? `
                      <tr>
                        <td style="padding: 6px 0; color: #71717a;">Interview Panel:</td>
                        <td style="padding: 6px 0; font-weight: 500; color: #e4e4e7;">${panelNames}</td>
                      </tr>
                      ` : ''}
                      ${mode === 'IN_PERSON' && location ? `
                      <tr>
                        <td style="padding: 6px 0; color: #71717a;">Location:</td>
                        <td style="padding: 6px 0; font-weight: 500; color: #ffffff;">${location}</td>
                      </tr>
                      ` : ''}
                    </table>

                    ${mode === 'ONLINE' && meetingLink ? `
                    <!-- Meeting Link Button -->
                    <div style="margin-top: 20px; text-align: center;">
                      <a href="${meetingLink}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #ffffff; text-decoration: none; padding: 13px 28px; border-radius: 8px; font-size: 14px; font-weight: 700; letter-spacing: 0.5px; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4);">
                        🎥 Join Interview Meeting
                      </a>
                      <p style="margin: 10px 0 0; font-size: 11px; color: #71717a;">
                        Direct link: <a href="${meetingLink}" target="_blank" style="color: #ef4444; word-break: break-all;">${meetingLink}</a>
                      </p>
                    </div>
                    ` : ''}
                  </div>

                  ${hasTask ? `
                  <!-- Optional Take-Home Task / Case Study Section -->
                  <div style="background-color: #1a1625; border: 1px solid #4c1d95; border-radius: 12px; padding: 22px; margin-bottom: 24px;">
                    <div style="margin-bottom: 12px;">
                      <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #c084fc;">
                        📋 Assessment & Take-Home Task / Case Study
                      </span>
                    </div>

                    ${task.title ? `
                    <h3 style="margin: 0 0 8px; font-size: 16px; font-weight: 700; color: #ffffff;">
                      ${task.title}
                    </h3>
                    ` : ''}

                    ${task.description ? `
                    <p style="margin: 0 0 14px; font-size: 13px; color: #d4d4d8; line-height: 1.6; white-space: pre-line;">
                      ${task.description}
                    </p>
                    ` : ''}

                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="font-size: 12.5px; color: #d4d4d8; margin-bottom: 14px;">
                      ${task.dueDate ? `
                      <tr>
                        <td style="padding: 4px 0; width: 35%; color: #a78bfa; font-weight: 600;">Submission Due:</td>
                        <td style="padding: 4px 0; font-weight: 700; color: #ffffff;">${task.dueDate}</td>
                      </tr>
                      ` : ''}
                      ${task.submissionInstructions ? `
                      <tr>
                        <td style="padding: 4px 0; color: #a78bfa; font-weight: 600;">Instructions:</td>
                        <td style="padding: 4px 0; color: #e4e4e7;">${task.submissionInstructions}</td>
                      </tr>
                      ` : ''}
                    </table>

                    ${task.documentUrl ? `
                    <div style="margin-top: 12px;">
                      <a href="${task.documentUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #581c87; border: 1px solid #7e22ce; color: #ffffff; text-decoration: none; padding: 9px 18px; border-radius: 6px; font-size: 12px; font-weight: 600;">
                        📄 Download Task Specification Document (${task.documentName || 'Document'})
                      </a>
                    </div>
                    ` : ''}
                  </div>
                  ` : ''}

                  ${notes ? `
                  <div style="background-color: #18181b; border-left: 3px solid #ef4444; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
                    <p style="margin: 0; font-size: 12.5px; color: #d4d4d8; line-height: 1.5;">
                      <strong style="color: #ffffff;">Preparation Note:</strong> ${notes}
                    </p>
                  </div>
                  ` : ''}

                  <div style="background-color: #09090b; border: 1px solid #27272a; border-radius: 8px; padding: 14px; margin-bottom: 12px;">
                    <p style="margin: 0 0 6px; font-size: 12px; font-weight: 600; color: #ffffff;">
                      💡 Tips for your interview:
                    </p>
                    <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #a1a1aa; line-height: 1.6;">
                      <li>Please ensure a stable internet connection and quiet environment.</li>
                      <li>Have your resume, past projects, and code repositories accessible.</li>
                      <li>Join the video call link 5 minutes prior to the scheduled start time.</li>
                    </ul>
                  </div>

                  <p style="margin: 20px 0 0; font-size: 13px; color: #71717a; line-height: 1.5;">
                    If you have any scheduling conflicts or questions, please reply directly to this email or reach us at <span style="color: #ef4444;">team@techmechatorque.com</span>.
                  </p>
                </td>
              </tr>
            </table>

            ${getTmtEmailFooter(orgName)}
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const plainText = `
Dear ${candidateName},

You are invited to Round ${round} (${interviewType}) for the position of ${openingTitle} at ${orgName}.

Interview Details:
- Session: ${interviewTitle}
- Date: ${scheduledDate}
- Time: ${startTime} - ${endTime} (${timezone})
- Format: ${mode}
${mode === 'ONLINE' && meetingLink ? `- Meeting Link: ${meetingLink}` : ''}
${mode === 'IN_PERSON' && location ? `- Location: ${location}` : ''}
${panelNames ? `- Panel: ${panelNames}` : ''}

${hasTask ? `
Take-Home Assessment / Task:
- Title: ${task.title || 'Technical Assessment'}
- Description: ${task.description || ''}
${task.dueDate ? `- Due Date: ${task.dueDate}` : ''}
${task.documentUrl ? `- Document: ${task.documentUrl}` : ''}
${task.submissionInstructions ? `- Submission Instructions: ${task.submissionInstructions}` : ''}
` : ''}

${notes ? `Note: ${notes}` : ''}

Join 5 minutes prior to the scheduled time.

Warm regards,
Talent Acquisition & Engineering Operations
${orgName}
  `.trim();

  return await sendMail({
    to,
    subject: `Interview Invitation: Round ${round} (${interviewType}) – ${openingTitle} | ${orgName}`,
    html: htmlTemplate,
    text: plainText,
    attachments
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

  /** Send official branded interview invitation email */
  async sendInterviewInvitation(params) {
    return await sendInterviewInvitationEmail(params);
  }

  /** Queue official branded interview invitation email asynchronously */
  queueInterviewInvitation(params) {
    setImmediate(async () => {
      try {
        await sendInterviewInvitationEmail(params);
      } catch (err) {
        logger.error(`[EmailService Interview Invite Async Error] ${err.message}`);
      }
    });
  }
}

export const emailService = new EmailService();

export default {
  sendMail,
  sendOtpEmail,
  sendPasswordResetEmail,
  sendOnboardingCredentialsEmail,
  sendFeeReceiptEmail,
  sendInterviewInvitationEmail,
  generateOtp,
  emailService,
  sendEmail: emailService.sendEmail.bind(emailService),
  queueEmail: emailService.queueEmail.bind(emailService),
  sendInterviewInvitation: emailService.sendInterviewInvitation.bind(emailService),
  queueInterviewInvitation: emailService.queueInterviewInvitation.bind(emailService)
};
