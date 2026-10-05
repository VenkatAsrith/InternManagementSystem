import { DocumentTemplate } from './documentTemplate.model.js';
import { Organization } from '../organizations/organization.model.js';
import { interpolateVariables, renderTemplatePDF, seedDefaultTemplates, buildInternContext } from './template.service.js';
import { loadScopedIntern } from '../interns/intern.access.js';
import { successResponse } from '../../utils/response.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { DOCUMENT_TYPE, DOCUMENT_CATEGORY } from '../../../../shared/constants.js';
import { ah } from '../../utils/asyncHandler.js';
import { notFound, unprocessable } from '../../utils/errors.js';
import { Validator } from '../../utils/validate.js';
import { formatDateLong } from '../../utils/time.js';

// Clearly-labelled SAMPLE values used only for template design previews. They are never used to issue a document.
const SAMPLE_CONTEXT = {
  candidate: { name: 'Sample Person', email: 'sample.person@example.com' },
  intern: { internId: 'INT-0000-000000', role: 'Sample Role', department: 'Sample Department', startDate: '1 January 2000', endDate: '31 March 2000', duration: '91 days', workMode: 'remote', mentor: 'Sample Mentor' },
  stipend: { amount: 'Sample stipend' },
  recommendation: { note: 'Sample recommendation paragraph.' },
  document: { sequence: 'SAMPLE', id: 'DOC-0000-000000', verifyUrl: 'https://example.invalid/verify' }
};

export const getTemplates = ah(async (req, res) => {
  const query = { organizationId: req.organizationId };
  if (Object.values(DOCUMENT_CATEGORY).includes(req.query.category)) query.category = req.query.category;
  if (Object.values(DOCUMENT_TYPE).includes(req.query.documentType)) query.documentType = req.query.documentType;
  const templates = await DocumentTemplate.find(query).populate('approvedBy', 'firstName lastName').sort({ templateCode: 1, version: -1 });
  return successResponse(res, templates);
});

export const getTemplateById = ah(async (req, res) => {
  const template = await DocumentTemplate.findOne({ _id: req.params.id, organizationId: req.organizationId }).populate('approvedBy', 'firstName lastName');
  if (!template) throw notFound('Template not found');
  return successResponse(res, template);
});

// Editing never mutates history: every save is a NEW version. Documents already issued keep the version they used.
export const createTemplateVersion = ah(async (req, res) => {
  const v = new Validator(req.body)
    .string('templateCode', { required: true, upper: true, max: 40, pattern: /^[A-Z][A-Z0-9_]{2,39}$/, patternMessage: 'Use capital letters, digits and underscores' })
    .string('title', { required: true, max: 150 })
    .oneOf('documentType', DOCUMENT_TYPE)
    .oneOf('category', DOCUMENT_CATEGORY)
    .string('bodyMarkdown', { required: true, min: 20, max: 20000 })
    .stringList('availableVariables', { max: 60, itemMax: 80 });
  const body = v.done();

  const latest = await DocumentTemplate.findOne({ organizationId: req.organizationId, templateCode: body.templateCode }).sort({ version: -1 });
  const documentType = body.documentType || latest?.documentType;
  if (!documentType) throw unprocessable('Document type is required for a new template.', [{ field: 'documentType', message: 'Required' }]);

  const template = await DocumentTemplate.create({
    organizationId: req.organizationId, templateCode: body.templateCode, title: body.title, version: latest ? latest.version + 1 : 1,
    documentType, category: body.category || latest?.category || DOCUMENT_CATEGORY.OTHER, bodyMarkdown: body.bodyMarkdown,
    availableVariables: body.availableVariables || latest?.availableVariables || [], isApproved: true, approvedBy: req.userId, isActive: true
  });
  await recordAuditLog({ action: 'TEMPLATE_VERSION_CREATED', entityType: 'DocumentTemplate', entityId: template._id, after: { templateCode: template.templateCode, version: template.version }, req });
  return successResponse(res, template, `Template ${template.templateCode} version ${template.version} created`, 201);
});

async function previewContext(req, internId) {
  if (!internId) return { context: SAMPLE_CONTEXT, sample: true };
  const intern = await loadScopedIntern(req, internId, [
    { path: 'userId', select: 'firstName lastName email phone' }, { path: 'departmentId', select: 'name' },
    { path: 'programId', select: 'title' }, { path: 'mentorId', select: 'firstName lastName' }
  ]);
  const context = await buildInternContext({ intern, tz: req.timezone, extra: { recommendation: { note: '[recommendation paragraph is written when the letter is issued]' } } });
  return { context, sample: false };
}

export const previewTemplate = ah(async (req, res) => {
  const template = await DocumentTemplate.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!template) throw notFound('Template not found');
  const { internId } = new Validator(req.body).objectId('internId').done();
  const { context, sample } = await previewContext(req, internId);
  const { text, missing } = interpolateVariables(template.bodyMarkdown, context);
  return successResponse(res, {
    templateId: template._id, templateCode: template.templateCode, version: template.version,
    rawMarkdown: template.bodyMarkdown, interpolatedMarkdown: text, missingVariables: missing, isSample: sample, contextUsed: context
  });
});

export const renderPDFPreviewEndpoint = ah(async (req, res) => {
  const template = await DocumentTemplate.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!template) throw notFound('Template not found');
  const org = await Organization.findById(req.organizationId).lean();
  const { internId } = new Validator(req.query).objectId('internId').done();
  const { context, sample } = await previewContext(req, internId);
  const { text } = interpolateVariables(template.bodyMarkdown, context, { keepMissing: true });
  const pdf = await renderTemplatePDF({
    organizationName: org?.name || '', title: template.title, body: text, recipientName: context.candidate.name,
    signatory: { name: org?.signatory?.name, title: org?.signatory?.title }, documentNumber: `PREVIEW-${template.templateCode}-V${template.version}`,
    issueDate: formatDateLong(new Date(), req.timezone), watermark: sample ? 'SAMPLE' : 'PREVIEW'
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${template.templateCode}_V${template.version}_preview.pdf"`);
  return res.send(pdf);
});

export const seedTemplates = ah(async (req, res) => {
  await seedDefaultTemplates(req.organizationId, req.userId);
  await recordAuditLog({ action: 'TEMPLATES_SEEDED', entityType: 'DocumentTemplate', entityId: req.organizationId, req });
  return successResponse(res, {}, 'Default letter templates initialised');
});
