import fs from 'fs';
import { Certificate } from './certificate.model.js';
import { evaluateCertificateEligibility } from './certificate.service.js';
import { Organization } from '../organizations/organization.model.js';
import { Exit } from '../exit/exit.model.js';
import { loadScopedIntern } from '../interns/intern.access.js';
import { generateRandomId } from '../../utils/idGenerator.js';
import { storageService } from '../../utils/storage.js';
import { generateCertificatePDF } from '../../utils/pdfGenerator.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { createNotification } from '../notifications/notification.service.js';
import { emailService } from '../email/email.service.js';
import { INTERN_STATUS, ROLES } from '../../../../shared/constants.js';
import { ah } from '../../utils/asyncHandler.js';
import { notFound, conflict, gone, unprocessable } from '../../utils/errors.js';
import { Validator, parsePagination, isObjectId } from '../../utils/validate.js';
import { formatDateLong } from '../../utils/time.js';
import { env } from '../../config/env.js';

const CERT_ID_RE = /^CERT-\d{4}-\d{6}$/;
const INTERN_POPULATE = [
  { path: 'userId', select: 'firstName lastName email' }, { path: 'departmentId', select: 'name' }, { path: 'programId' }
];

/** Live eligibility + why-not report. Also tells the UI which lifecycle step the intern is currently in. */
export const checkCompletionReadiness = ah(async (req, res) => {
  const intern = await loadScopedIntern(req, req.params.internId, INTERN_POPULATE);
  const exit = await Exit.findOne({ internId: intern._id }).sort({ createdAt: -1 }).select('exitId status reason certificateEligible lastWorkingDay');
  const eligibility = await evaluateCertificateEligibility(intern, { tz: req.timezone, endDate: exit?.lastWorkingDay });
  const existing = await Certificate.findOne({ internId: intern._id, status: 'ACTIVE' }).select('certificateId issueDate');
  return successResponse(res, {
    internId: intern.internId, name: `${intern.userId.firstName} ${intern.userId.lastName}`, status: intern.status,
    isReady: eligibility.eligible, eligible: eligibility.eligible, checks: eligibility.checks, reasons: eligibility.reasons,
    canIssueNow: eligibility.eligible && intern.status === INTERN_STATUS.CERTIFICATION && !existing && (exit ? exit.certificateEligible : false),
    exit, existingCertificate: existing
  });
});

export const generateCertificate = ah(async (req, res) => {
  const { internId } = new Validator(req.body).objectId('internId', { required: true }).done();
  const intern = await loadScopedIntern(req, internId, INTERN_POPULATE);

  // Certificates are issued during the exit process (CERTIFICATION stage), never as a shortcut to ALUMNI.
  if (intern.status !== INTERN_STATUS.CERTIFICATION) {
    throw conflict(`A certificate can only be issued in the CERTIFICATION stage of the exit process (current: ${intern.status}).`, 'WRONG_LIFECYCLE_STAGE');
  }
  const exit = await Exit.findOne({ internId: intern._id, completedAt: { $exists: false }, cancelledAt: { $exists: false } });
  if (!exit || !exit.certificateEligible) throw conflict('This exit is not marked as certificate-eligible.', 'EXIT_NOT_CERTIFICATE_ELIGIBLE');

  const eligibility = await evaluateCertificateEligibility(intern, { tz: req.timezone, endDate: exit.lastWorkingDay });
  if (!eligibility.eligible) {
    throw unprocessable('Certificate unavailable. Requirements not met.', eligibility.checks.filter(c => !c.satisfied).map(c => ({ field: c.key, message: `${c.label}: ${c.actual}${c.unit} / required ${c.required}${c.unit}` })), 'NOT_ELIGIBLE');
  }
  if (await Certificate.exists({ internId: intern._id, status: 'ACTIVE' })) {
    throw conflict('An active certificate already exists for this intern. Revoke it before issuing a new one.', 'CERTIFICATE_EXISTS');
  }

  const org = await Organization.findById(req.organizationId);
  const tz = req.timezone;
  const certificateId = await generateRandomId('CERT', async (id) => !!(await Certificate.exists({ certificateId: id })));
  const endDate = intern.actualEndDate || exit.lastWorkingDay || intern.expectedEndDate;
  const days = Math.round((new Date(endDate) - new Date(intern.startDate)) / 86400000) + 1;
  const data = {
    internName: `${intern.userId.firstName} ${intern.userId.lastName}`, internId: intern.internId, programTitle: intern.programId?.title,
    departmentName: intern.departmentId?.name, organizationName: org.name, startDate: formatDateLong(intern.startDate, tz), endDate: formatDateLong(endDate, tz),
    duration: `${days} days`, certificateId, issueDate: formatDateLong(new Date(), tz), signatory: org.signatory?.name,
    verifyUrl: `${env.FRONTEND_URL}/verify/certificate/${certificateId}`
  };
  const missing = Object.entries({ programTitle: data.programTitle, departmentName: data.departmentName, signatory: data.signatory }).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw unprocessable(`Cannot issue: missing ${missing.join(', ')}.`, missing.map(m => ({ field: m, message: 'Required' })), 'MISSING_DATA');

  const pdf = await generateCertificatePDF(data);
  const stored = await storageService.saveFile({ buffer: pdf, originalName: `${certificateId}.pdf`, mimeType: 'application/pdf', subDir: `certificates/${req.organizationId}` });

  let cert;
  try {
    cert = await Certificate.create({
      certificateId, organizationId: req.organizationId, internId: intern._id, userId: intern.userId._id, internName: data.internName,
      programTitle: data.programTitle, departmentName: data.departmentName, organizationName: org.name, startDate: data.startDate, endDate: data.endDate,
      duration: data.duration, issueDate: data.issueDate, issuedBy: req.userId, signatory: data.signatory, filePath: stored.filePath, checksum: stored.checksum,
      eligibilitySnapshot: { checks: eligibility.checks, attendance: eligibility.attendance }, status: 'ACTIVE'
    });
  } catch (err) {
    await storageService.deleteFile(stored.filePath).catch(() => {});
    if (err?.code === 11000) throw conflict('A certificate was just issued for this intern.', 'CERTIFICATE_EXISTS');
    throw err;
  }

  intern.completionDetails.certificateId = certificateId;
  intern.completionDetails.attendancePercent = eligibility.attendance.percent || 0;
  intern.completionDetails.tasksCompletedCount = eligibility.checks.find(c => c.key === 'tasks').actual;
  intern.completionDetails.approvedBy = req.userId;
  intern.completionDetails.approvedAt = new Date();
  await intern.save();

  await recordAuditLog({ action: 'CERTIFICATE_ISSUED', entityType: 'Certificate', entityId: cert._id, after: { certificateId, checksum: stored.checksum }, req });
  await createNotification({
    organizationId: req.organizationId, recipientId: intern.userId._id, type: 'CERTIFICATE_ISSUED', title: 'Certificate Issued!',
    message: `Your Certificate of Completion (${certificateId}) has been issued.`, entityType: 'Certificate', entityId: cert._id
  });
  return successResponse(res, cert, 'Certificate generated successfully', 201);
});

export const getCertificates = ah(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 200 });
  const query = { organizationId: req.organizationId };
  if ([ROLES.INTERN, ROLES.INTERN_TRAINEE].includes(req.userRole) || !req.can('certificates.read')) query.userId = req.userId;
  else if (isObjectId(req.query.internId)) query.internId = req.query.internId;
  const [certs, total] = await Promise.all([
    Certificate.find(query).select('-filePath -eligibilitySnapshot').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Certificate.countDocuments(query)
  ]);
  return paginatedResponse(res, certs, { page, limit, total });
});

async function loadOwnedCertificate(req) {
  const query = {};
  if (isObjectId(req.params.id)) {
    query._id = req.params.id;
  } else {
    query.certificateId = req.params.id;
  }

  if (req.organizationId && req.userRole !== ROLES.SUPER_ADMIN) {
    query.organizationId = req.organizationId;
  }

  let cert = await Certificate.findOne(query);
  if (!cert && query.organizationId) {
    cert = await Certificate.findOne({
      $or: [
        ...(isObjectId(req.params.id) ? [{ _id: req.params.id }] : []),
        { certificateId: req.params.id }
      ]
    });
  }

  if (!cert) throw notFound('Certificate not found');
  if (([ROLES.INTERN, ROLES.INTERN_TRAINEE].includes(req.userRole) || !req.can('certificates.read')) && String(cert.userId) !== String(req.userId)) {
    throw notFound('Certificate not found');
  }
  return cert;
}

export const downloadCertificatePDF = ah(async (req, res) => {
  const cert = await loadOwnedCertificate(req);
  if (cert.status === 'REVOKED') throw conflict('This certificate was revoked.', 'CERTIFICATE_REVOKED');

  await recordAuditLog({ action: 'CERTIFICATE_DOWNLOADED', entityType: 'Certificate', entityId: cert._id, req });
  const inline = req.query.inline === '1';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${cert.certificateId}.pdf"`);
  res.setHeader('Cache-Control', 'private, no-store');

  // If cached file exists on disk/storage, stream directly
  if (cert.filePath) {
    try {
      const exists = await storageService.exists(cert.filePath);
      if (exists) {
        return fs.createReadStream(storageService.getFilePath(cert.filePath)).pipe(res);
      }
    } catch (e) {
      console.warn('[Certificate Download] Cached file read failed, regenerating dynamically:', e.message);
    }
  }

  // Self-Healing: Dynamically regenerate PDF on the fly using exact replica layout
  const org = await Organization.findById(cert.organizationId).lean();
  const pdfBuffer = await generateCertificatePDF({
    internName: cert.internName,
    internId: cert.internId,
    programTitle: cert.programTitle,
    departmentName: cert.departmentName,
    organizationName: cert.organizationName || org?.name || 'TechMecha Torque',
    startDate: cert.startDate,
    endDate: cert.endDate,
    duration: cert.duration,
    certificateId: cert.certificateId,
    issueDate: cert.issueDate,
    signatory: cert.signatory || org?.signatory?.name || 'Jay Chandra Reddy Chilakamarry',
    verifyUrl: `${env.FRONTEND_URL}/verify/certificate/${cert.certificateId}`,
    type: cert.bootcampId ? 'BOOTCAMP' : 'INTERNSHIP',
    isBootcamp: Boolean(cert.bootcampId),
    bootcampTitle: cert.bootcampId ? cert.programTitle : ''
  });

  // Try saving back to storage in background for future caching
  storageService.saveFile({
    buffer: pdfBuffer,
    originalName: `${cert.certificateId}.pdf`,
    mimeType: 'application/pdf',
    subDir: `certificates/${cert.organizationId}`
  }).then(async (stored) => {
    cert.filePath = stored.filePath;
    cert.checksum = stored.checksum;
    await cert.save();
  }).catch(() => {});

  return res.send(pdfBuffer);
});

// Delivery by email (supports intern users and bootcamp participants).
export const sendCertificate = ah(async (req, res) => {
  const cert = await Certificate.findOne({ _id: req.params.id, organizationId: req.organizationId })
    .populate('userId', 'email firstName lastName')
    .populate('passId', 'candidateEmail candidateName');
  if (!cert) throw notFound('Certificate not found');
  if (cert.status !== 'ACTIVE') throw conflict('Only active certificates can be sent.', 'CERTIFICATE_REVOKED');

  const recipientEmail = cert.userId?.email || cert.passId?.candidateEmail;
  const recipientName = cert.userId?.firstName || cert.passId?.candidateName || cert.internName || 'Participant';

  if (!recipientEmail) {
    throw unprocessable('No recipient email available for this certificate.');
  }

  const verifyUrl = `${env.FRONTEND_URL}/verify/certificate/${cert.certificateId}`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <div style="background: #0f172a; padding: 24px; text-align: center;">
        <h1 style="color: #ffffff; font-size: 20px; margin: 0; letter-spacing: 1px;">TECHMECHA TORQUE</h1>
        <p style="color: #94a3b8; font-size: 13px; margin: 6px 0 0 0;">Official Certificate of Recognition</p>
      </div>
      <div style="padding: 28px;">
        <p style="font-size: 16px; margin: 0 0 16px 0;">Hello <strong>${recipientName}</strong>,</p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
          Congratulations! TechMecha Torque is proud to present your official <strong>Certificate of Recognition</strong> (${cert.certificateId}) for successfully completing <strong>${cert.programTitle}</strong>.
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
          Your certificate is attached as a PDF to this email. You can also view and verify your credential online anytime:
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${verifyUrl}" style="background-color: #e11d48; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">Verify Certificate Online</a>
        </div>
        <p style="font-size: 12px; color: #64748b; margin-top: 24px;">Certificate ID: <code>${cert.certificateId}</code></p>
      </div>
      <div style="background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
        TechMecha Torque Pvt. Ltd. • team@techmechatorque.com
      </div>
    </div>
  `;

  let pdfAttachment = null;
  if (cert.filePath && (await storageService.exists(cert.filePath))) {
    pdfAttachment = { filename: `${cert.certificateId}.pdf`, path: storageService.getFilePath(cert.filePath) };
  } else {
    const org = await Organization.findById(cert.organizationId).lean();
    const pdfBuffer = await generateCertificatePDF({
      internName: cert.internName,
      internId: cert.internId,
      programTitle: cert.programTitle,
      departmentName: cert.departmentName,
      organizationName: cert.organizationName || org?.name || 'TechMecha Torque',
      startDate: cert.startDate,
      endDate: cert.endDate,
      duration: cert.duration,
      certificateId: cert.certificateId,
      issueDate: cert.issueDate,
      signatory: cert.signatory || org?.signatory?.name || 'Jay Chandra Reddy Chilakamarry',
      verifyUrl,
      type: cert.bootcampId ? 'BOOTCAMP' : 'INTERNSHIP',
      isBootcamp: Boolean(cert.bootcampId),
      bootcampTitle: cert.bootcampId ? cert.programTitle : ''
    });
    pdfAttachment = { filename: `${cert.certificateId}.pdf`, content: pdfBuffer, contentType: 'application/pdf' };
  }

  await emailService.sendEmail({
    to: recipientEmail,
    subject: `Your Certificate of Recognition (${cert.certificateId}) - TechMecha Torque`,
    template: 'CERTIFICATE_DELIVERY',
    text: `Hello ${recipientName},\n\nCongratulations on completing ${cert.programTitle}! Your official certificate (${cert.certificateId}) is attached.\n\nAnyone can verify your certificate at: ${verifyUrl}\n\nTechMecha Torque Pvt. Ltd.`,
    html,
    attachments: [pdfAttachment],
    organizationId: req.organizationId
  });

  await recordAuditLog({ action: 'CERTIFICATE_SENT', entityType: 'Certificate', entityId: cert._id, after: { to: recipientEmail }, req });
  return successResponse(res, {}, `Certificate emailed to ${recipientEmail}`);
});

export const revokeCertificate = ah(async (req, res) => {
  const { reason } = new Validator(req.body).string('reason', { required: true, min: 3, max: 300 }).done();
  const cert = await Certificate.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!cert) throw notFound('Certificate not found');
  if (cert.status === 'REVOKED') throw conflict('This certificate is already revoked.', 'ALREADY_REVOKED');
  cert.status = 'REVOKED'; cert.revokedAt = new Date(); cert.revokedReason = reason;
  await cert.save();
  await recordAuditLog({ action: 'CERTIFICATE_REVOKED', entityType: 'Certificate', entityId: cert._id, after: { reason }, req });
  return successResponse(res, cert, 'Certificate revoked');
});

// Public verification: authentic metadata only. No email, phone, attendance, scores, notes or internal ids.
export const verifyPublicCertificate = ah(async (req, res) => {
  const id = String(req.params.certificateId || '').trim().toUpperCase();
  if (!CERT_ID_RE.test(id)) throw notFound('Certificate not found. Check the identifier and try again.', 'CERTIFICATE_NOT_FOUND');
  const cert = await Certificate.findOne({ certificateId: id });
  if (!cert) throw notFound('Certificate not found. Check the identifier and try again.', 'CERTIFICATE_NOT_FOUND');
  if (cert.status === 'REVOKED') throw gone('This certificate has been revoked by the issuing organization.', 'CERTIFICATE_REVOKED');
  return successResponse(res, {
    isValid: true, certificateId: cert.certificateId, internName: cert.internName, programTitle: cert.programTitle, departmentName: cert.departmentName,
    organizationName: cert.organizationName, duration: cert.duration, issueDate: cert.issueDate, verifiedAt: new Date().toISOString()
  }, 'Certificate is valid and authentic');
});

