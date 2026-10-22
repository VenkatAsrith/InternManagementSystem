import fs from 'fs';
import { Document, SENSITIVE_CATEGORIES } from './document.model.js';
import { User } from '../users/user.model.js';
import { generateDocumentForIntern } from './document.service.js';
import { OnboardingTask } from '../onboarding/onboarding.model.js';
import { OnboardingPlan } from '../onboarding/onboarding.model.js';
import { markOnboardingStarted, recomputeOnboarding } from '../onboarding/onboarding.service.js';
import { getOwnIntern, loadScopedIntern } from '../interns/intern.access.js';
import { storageService } from '../../utils/storage.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { emailService } from '../email/email.service.js';
import { DOCUMENT_CATEGORY, DOCUMENT_STATUS, ONBOARDING_STATUS, ROLES, INTERN_STATUS } from '../../../../shared/constants.js';
import { ah } from '../../utils/asyncHandler.js';
import { notFound, conflict, forbidden, unprocessable } from '../../utils/errors.js';
import { Validator, parsePagination, isObjectId } from '../../utils/validate.js';
import { formatDateLong } from '../../utils/time.js';

import { Project } from '../projects/project.model.js';

const GENERATABLE = {
  OFFER_LETTER: 'OFFER_LETTER', JOINING_LETTER: 'JOINING_LETTER', COMPLETION_LETTER: 'COMPLETION_LETTER',
  EXPERIENCE_LETTER: 'EXPERIENCE_LETTER', RECOMMENDATION_LETTER: 'RECOMMENDATION_LETTER', NDA_AGREEMENT: 'NDA_AGREEMENT'
};

function canSeeAll(req) {
  return req.can('documents.read');
}

async function assertAccess(req, doc) {
  const owner = String(doc.ownerId?._id || doc.ownerId) === String(req.userId);
  if (owner) return;

  // If document belongs to a project, project members and owners are authorized
  if (doc.projectId) {
    const project = await Project.findOne({ _id: doc.projectId, organizationId: req.organizationId });
    if (project) {
      const isMember = (project.members || []).some(m => String(m?._id || m) === String(req.userId));
      const isOwner = String(project.ownerId?._id || project.ownerId) === String(req.userId);
      if (isMember || isOwner || req.can('projects.read') || req.can('documents.read')) {
        return;
      }
    }
  }

  if (!canSeeAll(req)) throw notFound('Document not found');
}

export const uploadDocument = ah(async (req, res) => {
  if (!req.file) throw unprocessable('A file is required.', [{ field: 'file', message: 'Choose a file to upload' }]);
  const v = new Validator(req.body)
    .string('title', { max: 150 })
    .string('description', { max: 2000 })
    .oneOf('type', DOCUMENT_CATEGORY, { defaultValue: DOCUMENT_CATEGORY.OTHER })
    .objectId('internId')
    .objectId('onboardingTaskId')
    .objectId('projectId');
  const body = v.done();

  // If uploading for a project
  if (body.projectId) {
    const project = await Project.findOne({ _id: body.projectId, organizationId: req.organizationId });
    if (!project) throw notFound('Project not found');
    const isMember = (project.members || []).some(m => String(m?._id || m) === String(req.userId));
    const isOwner = String(project.ownerId?._id || project.ownerId) === String(req.userId);
    if (!isMember && !isOwner && !req.can('projects.manage')) {
      throw forbidden('You are not authorized to upload documents to this project.', 'FORBIDDEN');
    }

    const stored = await storageService.saveFile({
      buffer: req.file.buffer, originalName: req.file.originalname, mimeType: req.file.mimetype,
      subDir: `projects/${req.organizationId}/${project._id}`
    });

    const doc = await Document.create({
      organizationId: req.organizationId, ownerId: req.userId, projectId: project._id, source: 'UPLOADED',
      type: body.type || DOCUMENT_CATEGORY.OTHER, title: body.title || req.file.originalname, description: body.description || '',
      fileName: stored.fileName, originalName: stored.originalName, filePath: stored.filePath, mimeType: stored.mimeType, size: stored.size,
      checksum: stored.checksum, status: DOCUMENT_STATUS.APPROVED, uploadedBy: req.userId, storageLocation: 'local'
    });

    await recordAuditLog({ action: 'PROJECT_DOCUMENT_UPLOADED', entityType: 'Document', entityId: doc._id, after: { projectId: project._id, fileName: doc.originalName }, req });
    return successResponse(res, doc, 'Project document uploaded successfully', 201);
  }

  // Whose file is this? Interns upload for themselves; staff upload for a named intern or as general organization documents.
  let intern = null;
  if ([ROLES.INTERN, ROLES.INTERN_TRAINEE].includes(req.userRole)) {
    intern = await getOwnIntern(req);
  } else if (body.internId) {
    intern = await loadScopedIntern(req, body.internId);
  }

  if (!intern) {
    const stored = await storageService.saveFile({
      buffer: req.file.buffer, originalName: req.file.originalname, mimeType: req.file.mimetype,
      subDir: `documents/${req.organizationId}/general`
    });

    const doc = await Document.create({
      organizationId: req.organizationId, ownerId: req.userId, source: 'UPLOADED',
      type: body.type || DOCUMENT_CATEGORY.OTHER, title: body.title || req.file.originalname, description: body.description || '',
      fileName: stored.fileName, originalName: stored.originalName, filePath: stored.filePath,
      mimeType: stored.mimeType, size: stored.size, checksum: stored.checksum, version: 1,
      status: DOCUMENT_STATUS.APPROVED, uploadedBy: req.userId, storageLocation: 'local'
    });

    await recordAuditLog({ action: 'DOCUMENT_UPLOADED', entityType: 'Document', entityId: doc._id, after: { title: doc.title, fileName: doc.originalName }, req });
    return successResponse(res, doc, 'Document uploaded successfully', 201);
  }

  let task = null;
  if (body.onboardingTaskId) {
    const plan = await OnboardingPlan.findOne({ internId: intern._id });
    task = plan && await OnboardingTask.findOne({ _id: body.onboardingTaskId, onboardingPlanId: plan._id });
    if (!task) throw unprocessable('That onboarding task does not belong to this intern.', [{ field: 'onboardingTaskId', message: 'Unknown task' }]);
    if (task.documentType && task.documentType !== body.type) {
      throw unprocessable(`This task expects a ${task.documentType} document.`, [{ field: 'type', message: `Expected ${task.documentType}` }]);
    }
    if (![INTERN_STATUS.PRE_ONBOARDING, INTERN_STATUS.ONBOARDING].includes(intern.status)) throw conflict('Onboarding is finished.', 'ONBOARDING_LOCKED');
  }

  const stored = await storageService.saveFile({
    buffer: req.file.buffer, originalName: req.file.originalname, mimeType: req.file.mimetype,
    subDir: `documents/${req.organizationId}/${intern.userId}`
  });

  const previous = await Document.find({
    ownerId: intern.userId, type: body.type, source: 'UPLOADED', onboardingTaskId: task?._id,
    status: { $in: [DOCUMENT_STATUS.UPLOADED, DOCUMENT_STATUS.UNDER_REVIEW, DOCUMENT_STATUS.REJECTED, DOCUMENT_STATUS.APPROVED] }
  }).sort({ version: -1 });

  let doc;
  try {
    doc = await Document.create({
      organizationId: req.organizationId, ownerId: intern.userId, internId: intern._id, source: 'UPLOADED', type: body.type,
      title: body.title || req.file.originalname, description: body.description || '', fileName: stored.fileName, originalName: stored.originalName, filePath: stored.filePath,
      mimeType: stored.mimeType, size: stored.size, checksum: stored.checksum, version: previous.length ? previous[0].version + 1 : 1,
      status: DOCUMENT_STATUS.UPLOADED, uploadedBy: req.userId, onboardingTaskId: task?._id, storageLocation: 'local'
    });
  } catch (err) {
    await storageService.deleteFile(stored.filePath).catch(() => {});
    throw err;
  }
  // Replacement never overwrites: earlier versions stay on record as ARCHIVED and point at their successor.
  for (const old of previous) { old.status = DOCUMENT_STATUS.ARCHIVED; old.supersededBy = doc._id; old.archivedAt = new Date(); await old.save(); }

  if (task) {
    task.documentId = doc._id;
    task.status = ONBOARDING_STATUS.IN_PROGRESS;
    task.notes = '';
    task.completedAt = undefined; task.completedBy = undefined;
    await task.save();
    await markOnboardingStarted(intern._id, req);
    await recomputeOnboarding(task.onboardingPlanId, req);
  }
  await recordAuditLog({ action: 'DOCUMENT_UPLOADED', entityType: 'Document', entityId: doc._id, after: { type: doc.type, version: doc.version, fileName: doc.originalName, internId: intern.internId }, req });
  return successResponse(res, doc, 'Document uploaded successfully', 201);
});

export const getDocuments = ah(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 200 });
  const query = { organizationId: req.organizationId };

  if (isObjectId(req.query.projectId)) {
    query.projectId = req.query.projectId;
  } else if ([ROLES.INTERN, ROLES.INTERN_TRAINEE].includes(req.userRole) || !canSeeAll(req)) {
    query.ownerId = req.userId;
  } else if (isObjectId(req.query.internId)) query.internId = req.query.internId;

  if (Object.values(DOCUMENT_CATEGORY).includes(req.query.type)) query.type = req.query.type;
  if (Object.values(DOCUMENT_STATUS).includes(req.query.status)) query.status = req.query.status;
  else if (req.query.includeArchived !== 'true') query.status = { $nin: [DOCUMENT_STATUS.ARCHIVED] };
  if (['UPLOADED', 'GENERATED'].includes(req.query.source)) query.source = req.query.source;

  const [docs, total] = await Promise.all([
    Document.find(query).populate('uploadedBy', 'firstName lastName email').populate('approvedBy', 'firstName lastName email')
      .populate({ path: 'internId', select: 'internId userId', populate: { path: 'userId', select: 'firstName lastName email phone' } })
      .sort({ createdAt: -1 }).skip(skip).limit(limit),
    Document.countDocuments(query)
  ]);
  return paginatedResponse(res, docs, { page, limit, total });
});

export const getDocumentById = ah(async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, organizationId: req.organizationId })
    .populate('uploadedBy', 'firstName lastName email')
    .populate('approvedBy', 'firstName lastName email')
    .populate({ path: 'internId', select: 'internId userId', populate: { path: 'userId', select: 'firstName lastName email phone' } });
  if (!doc) throw notFound('Document not found');
  await assertAccess(req, doc);
  return successResponse(res, doc);
});

export const downloadDocument = ah(async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!doc) throw notFound('Document not found');
  await assertAccess(req, doc);
  if (doc.status === DOCUMENT_STATUS.REVOKED) throw conflict('This document was revoked.', 'DOCUMENT_REVOKED');
  if (!(await storageService.exists(doc.filePath))) throw notFound('File content not found on server', 'FILE_MISSING');

  if (SENSITIVE_CATEGORIES.includes(doc.type) || doc.source === 'GENERATED') {
    await recordAuditLog({ action: 'DOCUMENT_DOWNLOADED', entityType: 'Document', entityId: doc._id, after: { type: doc.type, documentId: doc.documentId }, req });
  }
  const inline = req.query.inline === '1' && (doc.mimeType === 'application/pdf' || doc.mimeType?.startsWith('image/'));
  res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(doc.originalName)}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  fs.createReadStream(storageService.getFilePath(doc.filePath)).pipe(res);
});

async function syncTaskAfterReview(doc, approved, note, req) {
  if (!doc.onboardingTaskId) return;
  const task = await OnboardingTask.findById(doc.onboardingTaskId);
  if (!task || String(task.documentId) !== String(doc._id)) return;
  if (approved) { task.status = ONBOARDING_STATUS.COMPLETED; task.completedAt = new Date(); task.completedBy = req.userId; task.notes = ''; }
  else { task.status = ONBOARDING_STATUS.PENDING; task.notes = `Rejected: ${note}`; task.completedAt = undefined; task.completedBy = undefined; }
  await task.save();
  await recomputeOnboarding(task.onboardingPlanId, req);
}

export const approveDocument = ah(async (req, res) => {
  const { approvalNotes } = new Validator(req.body).string('approvalNotes', { max: 500 }).done();
  const doc = await Document.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!doc) throw notFound('Document not found');
  if (String(doc.uploadedBy) === String(req.userId)) throw forbidden('You cannot approve a document you uploaded yourself.', 'SELF_APPROVAL');
  const updated = await Document.findOneAndUpdate(
    { _id: doc._id, status: { $in: [DOCUMENT_STATUS.UPLOADED, DOCUMENT_STATUS.UNDER_REVIEW] } },
    { $set: { status: DOCUMENT_STATUS.APPROVED, approvedBy: req.userId, approvalNotes: approvalNotes || '', approvedAt: new Date() } },
    { new: true }
  );
  if (!updated) throw conflict(`A ${doc.status} document cannot be approved.`, 'INVALID_TRANSITION');
  await syncTaskAfterReview(updated, true, '', req);
  await recordAuditLog({ action: 'DOCUMENT_APPROVED', entityType: 'Document', entityId: doc._id, after: { approvalNotes: approvalNotes || '' }, req });
  return successResponse(res, updated, 'Document approved');
});

export const rejectDocument = ah(async (req, res) => {
  const { rejectionReason } = new Validator(req.body).string('rejectionReason', { required: true, min: 3, max: 500 }).done();
  const doc = await Document.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!doc) throw notFound('Document not found');
  const updated = await Document.findOneAndUpdate(
    { _id: doc._id, status: { $in: [DOCUMENT_STATUS.UPLOADED, DOCUMENT_STATUS.UNDER_REVIEW] } },
    { $set: { status: DOCUMENT_STATUS.REJECTED, approvedBy: req.userId, approvalNotes: rejectionReason } },
    { new: true }
  );
  if (!updated) throw conflict(`A ${doc.status} document cannot be rejected.`, 'INVALID_TRANSITION');
  await syncTaskAfterReview(updated, false, rejectionReason, req);
  await recordAuditLog({ action: 'DOCUMENT_REJECTED', entityType: 'Document', entityId: doc._id, after: { rejectionReason }, req });
  return successResponse(res, updated, 'Document rejected');
});

// Owners may remove their own not-yet-approved uploads (file deleted). Staff archive (file retained for records).
export const deleteDocument = ah(async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!doc) throw notFound('Document not found');
  if (doc.source === 'GENERATED') throw conflict('Official generated documents cannot be deleted. Revoke them instead.', 'GENERATED_DOCUMENT');
  const isOwner = String(doc.ownerId) === String(req.userId);
  const staff = req.can('documents.approve');
  if (!isOwner && !staff) throw notFound('Document not found');
  if (doc.status === DOCUMENT_STATUS.ARCHIVED) throw conflict('Document is already removed.', 'ALREADY_ARCHIVED');
  if (isOwner && !staff && ![DOCUMENT_STATUS.UPLOADED, DOCUMENT_STATUS.REJECTED].includes(doc.status)) {
    throw conflict('Approved documents can only be removed by HR.', 'DOCUMENT_LOCKED');
  }
  const removeFile = isOwner && !staff;
  doc.status = DOCUMENT_STATUS.ARCHIVED;
  doc.archivedAt = new Date();
  await doc.save();
  if (removeFile) await storageService.deleteFile(doc.filePath).catch(() => {});
  if (doc.onboardingTaskId) {
    const task = await OnboardingTask.findById(doc.onboardingTaskId);
    if (task && String(task.documentId) === String(doc._id)) {
      task.status = ONBOARDING_STATUS.PENDING; task.documentId = undefined; task.completedAt = undefined; task.completedBy = undefined;
      await task.save();
      await recomputeOnboarding(task.onboardingPlanId, req);
    }
  }
  await recordAuditLog({ action: 'DOCUMENT_REMOVED', entityType: 'Document', entityId: doc._id, after: { fileDeleted: removeFile }, req });
  return successResponse(res, doc, 'Document removed');
});

// ---------------------------------------------------------------------------
// Official letters
// ---------------------------------------------------------------------------
export const generateDocument = ah(async (req, res) => {
  const v = new Validator(req.body).objectId('internId', { required: true }).oneOf('templateCode', Object.keys(GENERATABLE), { required: true }).string('recommendationNote', { min: 20, max: 1500 });
  const body = v.done();
  const intern = await loadScopedIntern(req, body.internId, [
    { path: 'userId', select: 'firstName lastName email phone' }, { path: 'departmentId', select: 'name' },
    { path: 'programId', select: 'title' }, { path: 'mentorId', select: 'firstName lastName' }
  ]);
  const extra = {};
  if (body.templateCode === 'RECOMMENDATION_LETTER') {
    if (!body.recommendationNote) throw unprocessable('Write the recommendation paragraph (at least 20 characters).', [{ field: 'recommendationNote', message: 'Required for a recommendation letter' }]);
    extra.recommendation = { note: body.recommendationNote };
  }
  const doc = await generateDocumentForIntern({ req, intern, templateCode: body.templateCode, extra });
  return successResponse(res, doc, 'Document generated', 201);
});

export const sendDocument = ah(async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, organizationId: req.organizationId, source: 'GENERATED' })
    .populate({ path: 'internId', populate: { path: 'userId', select: 'firstName email phone' } });
  if (!doc) throw notFound('Generated document not found');
  if ([DOCUMENT_STATUS.REVOKED, DOCUMENT_STATUS.ARCHIVED].includes(doc.status)) throw conflict(`A ${doc.status} document cannot be sent.`, 'INVALID_TRANSITION');

  const channels = Array.isArray(req.body?.channels) && req.body.channels.length > 0
    ? req.body.channels
    : ['EMAIL'];

  const results = [];
  let to = doc.internId?.userId?.email;
  if (!to && doc.ownerId) {
    const owner = await User.findById(doc.ownerId);
    if (owner?.email) to = owner.email;
  }
  const recipientFirst = doc.internId?.userId?.firstName || 'Intern';

  if (channels.includes('EMAIL')) {
    if (!to) throw conflict('The recipient has no email address.', 'NO_RECIPIENT');
    await emailService.sendEmail({
      to, subject: `${doc.title} (${doc.documentId})`, template: doc.documentType || 'DOCUMENT_DELIVERY',
      text: `Hello ${recipientFirst}, please find your ${doc.title} attached. Verify it at any time with document id ${doc.documentId}.`,
      attachments: [{ filename: `${doc.documentId}.pdf`, path: storageService.getFilePath(doc.filePath) }], organizationId: req.organizationId
    });
    doc.deliveryHistory.push({ channel: 'EMAIL', to, by: req.userId, status: 'DELIVERED', sentAt: new Date() });
    results.push('Email');
  }

  if (channels.includes('PORTAL')) {
    doc.deliveryHistory.push({ channel: 'PORTAL', to: String(doc.internId?.userId?._id || 'portal'), by: req.userId, status: 'DELIVERED', sentAt: new Date() });
    results.push('Portal');
  }

  if (channels.includes('WHATSAPP')) {
    const phone = doc.internId?.userId?.phone;
    doc.deliveryHistory.push({ channel: 'WHATSAPP', to: phone || 'N/A', by: req.userId, status: phone ? 'SENT' : 'DISABLED', sentAt: new Date() });
    results.push('WhatsApp');
  }

  if (doc.status === DOCUMENT_STATUS.GENERATED) doc.status = DOCUMENT_STATUS.SENT;
  await doc.save();
  await recordAuditLog({ action: 'DOCUMENT_SENT', entityType: 'Document', entityId: doc._id, after: { channels, to, documentId: doc.documentId }, req });
  return successResponse(res, doc, `Document dispatched via ${results.join(', ')}`);
});

export const revokeDocument = ah(async (req, res) => {
  const { reason } = new Validator(req.body).string('reason', { required: true, min: 3, max: 300 }).done();
  const doc = await Document.findOneAndUpdate(
    { _id: req.params.id, organizationId: req.organizationId, source: 'GENERATED', status: { $nin: [DOCUMENT_STATUS.REVOKED] } },
    { $set: { status: DOCUMENT_STATUS.REVOKED, revokedAt: new Date(), revokedReason: reason } }, { new: true }
  );
  if (!doc) throw conflict('Only active generated documents can be revoked.', 'INVALID_TRANSITION');
  await recordAuditLog({ action: 'DOCUMENT_REVOKED', entityType: 'Document', entityId: doc._id, after: { reason }, req });
  return successResponse(res, doc, 'Document revoked');
});

// Public: proves a letter is authentic WITHOUT exposing anything private.
export const verifyPublicDocument = ah(async (req, res) => {
  const id = String(req.params.documentId || '').trim().toUpperCase();
  if (!/^DOC-\d{4}-\d{6}$/.test(id)) throw notFound('Document not found', 'DOCUMENT_NOT_FOUND');
  const doc = await Document.findOne({ documentId: id, source: 'GENERATED' }).populate('organizationId', 'name');
  if (!doc) throw notFound('Document not found', 'DOCUMENT_NOT_FOUND');
  const revoked = doc.status === DOCUMENT_STATUS.REVOKED;
  return successResponse(res, {
    isValid: !revoked, documentId: doc.documentId, documentType: doc.documentType, title: doc.title, recipientName: doc.recipientName,
    organizationName: doc.organizationId?.name, issuedOn: doc.issuedAt ? formatDateLong(doc.issuedAt) : null, version: doc.version,
    isCurrentVersion: !doc.supersededBy && !revoked, status: revoked ? 'REVOKED' : (doc.supersededBy ? 'SUPERSEDED' : 'VALID'),
    checksum: doc.checksum
  }, revoked ? 'This document has been revoked' : 'Document is authentic');
});

