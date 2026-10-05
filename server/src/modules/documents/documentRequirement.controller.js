import { DocumentRequirementTemplate } from './documentRequirementTemplate.model.js';
import { InternDocumentRequirement } from './internDocumentRequirement.model.js';
import { Document } from './document.model.js';
import { Intern } from '../interns/intern.model.js';
import { User } from '../users/user.model.js';
import { storageService } from '../../utils/storage.js';
import { successResponse } from '../../utils/response.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { createNotification } from '../notifications/notification.service.js';
import { ah } from '../../utils/asyncHandler.js';
import { notFound, unprocessable, forbidden } from '../../utils/errors.js';
import { Validator, isObjectId } from '../../utils/validate.js';
import { ROLES, DOCUMENT_CATEGORY } from '../../../../shared/constants.js';

export const getRequirementTemplates = ah(async (req, res) => {
  const templates = await DocumentRequirementTemplate.find({ organizationId: req.organizationId })
    .populate('programId', 'title code')
    .populate('departmentId', 'name code')
    .sort({ createdAt: -1 });
  return successResponse(res, templates);
});

export const createRequirementTemplate = ah(async (req, res) => {
  const v = new Validator(req.body)
    .string('name', { required: true, min: 2, max: 150 })
    .string('description', { max: 500 })
    .oneOf('appliesTo', ['INTERN', 'TRAINEE', 'BOOTCAMP', 'ALL'], { defaultValue: 'INTERN' })
    .objectId('programId')
    .objectId('departmentId');
  const body = v.done();

  const requiredDocuments = Array.isArray(req.body.requiredDocuments) ? req.body.requiredDocuments : [];
  if (!requiredDocuments.length) {
    throw unprocessable('At least one required document must be defined.', [{ field: 'requiredDocuments', message: 'Required' }]);
  }

  const sanitizedDocs = requiredDocuments.map((d, index) => {
    if (!d.title?.trim()) throw unprocessable(`Item ${index + 1}: Title is required.`, [{ field: `requiredDocuments[${index}].title`, message: 'Title is required' }]);
    return {
      category: Object.values(DOCUMENT_CATEGORY).includes(d.category) ? d.category : DOCUMENT_CATEGORY.OTHER,
      title: d.title.trim(),
      description: d.description?.trim() || '',
      mandatory: d.mandatory !== false,
      instructions: d.instructions?.trim() || '',
      sampleTemplateUrl: d.sampleTemplateUrl?.trim() || '',
      sampleTemplateName: d.sampleTemplateName?.trim() || '',
      allowedMimeTypes: Array.isArray(d.allowedMimeTypes) ? d.allowedMimeTypes : ['application/pdf', 'image/png', 'image/jpeg'],
      maxSizeMB: Number(d.maxSizeMB) || 10
    };
  });

  const template = await DocumentRequirementTemplate.create({
    organizationId: req.organizationId,
    name: body.name,
    description: body.description || '',
    appliesTo: body.appliesTo,
    programId: body.programId || undefined,
    departmentId: body.departmentId || undefined,
    requiredDocuments: sanitizedDocs,
    version: 1
  });

  await recordAuditLog({
    action: 'DOCUMENT_TEMPLATE_CREATED',
    entityType: 'DocumentRequirementTemplate',
    entityId: template._id,
    after: { name: template.name, itemCount: sanitizedDocs.length },
    req
  });

  return successResponse(res, template, 'Document requirement template created', 201);
});

export const assignRequirementTemplate = ah(async (req, res) => {
  const v = new Validator(req.body)
    .objectId('templateId')
    .objectId('internId')
    .objectId('programId')
    .string('role', { max: 50 });
  const body = v.done();

  let template = null;
  if (body.templateId) {
    template = await DocumentRequirementTemplate.findOne({
      _id: body.templateId,
      organizationId: req.organizationId
    });
    if (!template) throw notFound('Document template not found');
  }

  // Allow selective document assignment: only assign what documents are needed
  let docsToAssign = [];
  if (template) {
    const selectedTitles = Array.isArray(req.body.documentTitles) ? req.body.documentTitles : [];
    docsToAssign = selectedTitles.length > 0
      ? template.requiredDocuments.filter(d => selectedTitles.includes(d.title))
      : template.requiredDocuments;
  } else if (Array.isArray(req.body.documents) && req.body.documents.length > 0) {
    docsToAssign = req.body.documents.map(d => ({
      category: Object.values(DOCUMENT_CATEGORY).includes(d.category) ? d.category : DOCUMENT_CATEGORY.OTHER,
      title: (d.title || '').trim(),
      description: (d.description || '').trim(),
      mandatory: d.mandatory !== false,
      instructions: (d.instructions || '').trim(),
      sampleTemplateUrl: (d.sampleTemplateUrl || '').trim()
    })).filter(d => d.title);
  }

  if (!docsToAssign.length) {
    throw unprocessable('Please select at least one document to assign.', [{ field: 'documents', message: 'No documents selected' }]);
  }

  let targetInterns = [];
  if (body.internId) {
    const intern = await Intern.findOne({ _id: body.internId, organizationId: req.organizationId });
    if (!intern) throw notFound('Intern not found');
    targetInterns = [intern];
  } else if (body.role) {
    const roleUsers = await User.find({ organizationId: req.organizationId, role: body.role, isActive: true }).select('_id');
    const userIds = roleUsers.map(u => u._id);
    targetInterns = await Intern.find({ organizationId: req.organizationId, userId: { $in: userIds }, status: { $nin: ['ALUMNI', 'TERMINATED'] } });
  } else if (body.programId) {
    targetInterns = await Intern.find({ programId: body.programId, organizationId: req.organizationId, status: { $ne: 'ALUMNI' } });
  } else {
    targetInterns = await Intern.find({ organizationId: req.organizationId, status: { $nin: ['ALUMNI', 'TERMINATED'] } });
  }

  let assignedCount = 0;
  for (const intern of targetInterns) {
    for (const doc of docsToAssign) {
      const existing = await InternDocumentRequirement.findOne({
        organizationId: req.organizationId,
        internId: intern._id,
        title: doc.title
      });

      if (!existing) {
        await InternDocumentRequirement.create({
          organizationId: req.organizationId,
          internId: intern._id,
          userId: intern.userId,
          templateId: template ? template._id : undefined,
          category: doc.category,
          title: doc.title,
          description: doc.description || '',
          mandatory: doc.mandatory !== false,
          instructions: doc.instructions || '',
          sampleTemplateUrl: doc.sampleTemplateUrl || '',
          sampleTemplateName: doc.sampleTemplateName || '',
          status: 'REQUIRED'
        });
        assignedCount++;
      }
    }

    await createNotification({
      organizationId: req.organizationId,
      recipientId: intern.userId,
      type: 'DOCUMENT_REQUIRED',
      title: 'Required Documents Assigned',
      message: `You have been assigned ${docsToAssign.length} required document(s) for your role and profile compliance.`,
      entityType: template ? 'DocumentRequirementTemplate' : 'Intern',
      entityId: template ? template._id : intern._id
    });
  }

  await recordAuditLog({
    action: 'DOCUMENT_TEMPLATE_ASSIGNED',
    entityType: 'DocumentRequirementTemplate',
    entityId: template ? template._id : req.userId,
    after: { assignedInternCount: targetInterns.length, requirementsCreated: assignedCount, docsAssignedCount: docsToAssign.length },
    req
  });

  return successResponse(res, {
    templateId: template?._id,
    targetInternsCount: targetInterns.length,
    assignedCount,
    docsAssignedCount: docsToAssign.length
  }, `Assigned ${docsToAssign.length} required document(s) to ${targetInterns.length} intern(s).`);
});

export const getComplianceDashboard = ah(async (req, res) => {
  const reqs = await InternDocumentRequirement.find({ organizationId: req.organizationId })
    .populate({
      path: 'internId',
      select: 'internId status startDate expectedEndDate departmentId programId userId',
      populate: [
        { path: 'userId', select: 'firstName lastName email' },
        { path: 'programId', select: 'title' }
      ]
    });

  const totalRequired = reqs.filter(r => r.mandatory).length;
  const uploaded = reqs.filter(r => ['UPLOADED', 'UNDER_REVIEW', 'APPROVED'].includes(r.status)).length;
  const approved = reqs.filter(r => r.status === 'APPROVED').length;
  const pendingReview = reqs.filter(r => r.status === 'UNDER_REVIEW').length;
  const missing = reqs.filter(r => ['REQUIRED', 'PENDING', 'REJECTED'].includes(r.status)).length;

  // Group by intern
  const internMap = {};
  for (const r of reqs) {
    if (!r.internId) continue;
    const iId = String(r.internId._id);
    if (!internMap[iId]) {
      internMap[iId] = {
        internId: r.internId.internId,
        _id: r.internId._id,
        name: r.internId.userId ? `${r.internId.userId.firstName} ${r.internId.userId.lastName}` : 'Unknown',
        email: r.internId.userId?.email || '',
        program: r.internId.programId?.title || '-',
        total: 0,
        uploaded: 0,
        approved: 0,
        missing: 0,
        pendingReview: 0,
        items: []
      };
    }
    internMap[iId].total++;
    if (['UPLOADED', 'UNDER_REVIEW', 'APPROVED'].includes(r.status)) internMap[iId].uploaded++;
    if (r.status === 'APPROVED') internMap[iId].approved++;
    if (r.status === 'UNDER_REVIEW') internMap[iId].pendingReview++;
    if (['REQUIRED', 'PENDING', 'REJECTED'].includes(r.status)) internMap[iId].missing++;
    internMap[iId].items.push({
      _id: r._id,
      title: r.title,
      category: r.category,
      status: r.status,
      mandatory: r.mandatory,
      rejectionReason: r.rejectionReason
    });
  }

  const internCompliance = Object.values(internMap).map(i => ({
    ...i,
    compliancePercent: i.total > 0 ? Math.round((i.approved / i.total) * 100) : 100
  }));

  return successResponse(res, {
    summary: {
      totalRequired,
      uploaded,
      approved,
      pendingReview,
      missing,
      overallPercent: totalRequired > 0 ? Math.round((approved / totalRequired) * 100) : 100
    },
    interns: internCompliance
  });
});

export const getMyRequirements = ah(async (req, res) => {
  const intern = await Intern.findOne({ userId: req.userId, organizationId: req.organizationId });
  if (!intern) {
    return successResponse(res, []);
  }

  const requirements = await InternDocumentRequirement.find({
    organizationId: req.organizationId,
    internId: intern._id
  })
    .populate('submittedDocumentId', 'fileName originalName size mimeType status')
    .sort({ mandatory: -1, createdAt: 1 });

  return successResponse(res, requirements);
});

export const getInternRequirements = ah(async (req, res) => {
  const requirements = await InternDocumentRequirement.find({
    organizationId: req.organizationId,
    internId: req.params.internId
  })
    .populate('submittedDocumentId')
    .populate('reviewedBy', 'firstName lastName email')
    .sort({ mandatory: -1, createdAt: 1 });

  return successResponse(res, requirements);
});

export const uploadRequirementDocument = ah(async (req, res) => {
  const requirement = await InternDocumentRequirement.findOne({
    _id: req.params.id,
    organizationId: req.organizationId
  });
  if (!requirement) throw notFound('Requirement item not found');

  if (req.userRole === ROLES.INTERN && String(requirement.userId) !== String(req.userId)) {
    throw forbidden('You cannot upload documents for another intern.');
  }

  if (!req.file) {
    throw unprocessable('No file uploaded', [{ field: 'file', message: 'A document file is required' }]);
  }

  const stored = await storageService.saveFile({
    buffer: req.file.buffer,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    subDir: `documents/${req.organizationId}`
  });

  const doc = await Document.create({
    organizationId: req.organizationId,
    ownerId: requirement.userId,
    internId: requirement.internId,
    source: 'UPLOADED',
    type: requirement.category,
    title: requirement.title,
    fileName: stored.filePath.split(/[/\\]/).pop(),
    originalName: req.file.originalname,
    filePath: stored.filePath,
    mimeType: req.file.mimetype,
    size: req.file.size,
    checksum: stored.checksum,
    status: 'UPLOADED',
    uploadedBy: req.userId
  });

  requirement.submittedDocumentId = doc._id;
  requirement.status = 'UNDER_REVIEW';
  requirement.rejectionReason = '';
  await requirement.save();

  await recordAuditLog({
    action: 'DOCUMENT_REQUIREMENT_UPLOADED',
    entityType: 'InternDocumentRequirement',
    entityId: requirement._id,
    after: { title: requirement.title, documentId: doc._id, fileName: req.file.originalname },
    req
  });

  return successResponse(res, { requirement, document: doc }, 'Document uploaded for review', 201);
});

export const reviewDocumentRequirement = ah(async (req, res) => {
  const requirement = await InternDocumentRequirement.findOne({
    _id: req.params.id,
    organizationId: req.organizationId
  });
  if (!requirement) throw notFound('Requirement item not found');

  const v = new Validator(req.body)
    .oneOf('status', ['APPROVED', 'REJECTED'], { required: true })
    .string('notes', { max: 1000 });
  const body = v.done();

  if (body.status === 'REJECTED' && !body.notes?.trim()) {
    throw unprocessable('A reason is required when rejecting a document.', [{ field: 'notes', message: 'Rejection reason is required' }]);
  }

  requirement.status = body.status;
  requirement.rejectionReason = body.notes ? body.notes.trim() : '';
  requirement.reviewedBy = req.userId;
  requirement.reviewedAt = new Date();
  await requirement.save();

  if (requirement.submittedDocumentId) {
    await Document.updateOne(
      { _id: requirement.submittedDocumentId },
      {
        $set: {
          status: body.status,
          approvedBy: body.status === 'APPROVED' ? req.userId : undefined,
          approvalNotes: body.notes || '',
          approvedAt: body.status === 'APPROVED' ? new Date() : undefined
        }
      }
    );
  }

  await createNotification({
    organizationId: req.organizationId,
    recipientId: requirement.userId,
    type: body.status === 'APPROVED' ? 'DOCUMENT_APPROVED' : 'DOCUMENT_REJECTED',
    title: `Document ${body.status === 'APPROVED' ? 'Approved' : 'Rejected'}`,
    message: body.status === 'APPROVED'
      ? `Your document "${requirement.title}" has been approved.`
      : `Your document "${requirement.title}" was rejected: ${requirement.rejectionReason}`,
    entityType: 'InternDocumentRequirement',
    entityId: requirement._id
  });

  await recordAuditLog({
    action: body.status === 'APPROVED' ? 'DOCUMENT_APPROVED' : 'DOCUMENT_REJECTED',
    entityType: 'InternDocumentRequirement',
    entityId: requirement._id,
    after: { status: body.status, notes: body.notes },
    req
  });

  return successResponse(res, requirement, `Document requirement marked as ${body.status}`);
});
