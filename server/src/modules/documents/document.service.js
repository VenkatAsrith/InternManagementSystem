import { Document } from './document.model.js';
import { Organization } from '../organizations/organization.model.js';
import { getActiveTemplate, buildInternContext, interpolateVariables, renderTemplatePDF } from '../templates/template.service.js';
import { storageService } from '../../utils/storage.js';
import { generateRandomId } from '../../utils/idGenerator.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { DOCUMENT_STATUS } from '../../../../shared/constants.js';
import { notFound, unprocessable } from '../../utils/errors.js';
import { formatDateLong } from '../../utils/time.js';
import { env } from '../../config/env.js';

/**
 * Issues an official letter from a versioned template using REAL records only.
 * - refuses to render when any placeholder cannot be resolved (no raw {{...}} in an official document)
 * - assigns a non-guessable public document id and a SHA-256 checksum
 * - keeps history: re-issuing creates version N+1 and marks the previous one ARCHIVED (superseded), never overwrites
 * `intern` must have userId / programId / departmentId / mentorId populated.
 */
export async function generateDocumentForIntern({ req, intern, templateCode, extra = {}, category }) {
  const tpl = await getActiveTemplate(intern.organizationId, templateCode, req?.userId);
  if (!tpl) throw notFound(`No active approved template '${templateCode}' exists for this organization.`, 'TEMPLATE_NOT_FOUND');

  const org = await Organization.findById(intern.organizationId).lean();
  const documentId = await generateRandomId('DOC', async (id) => !!(await Document.exists({ documentId: id })));
  const issuedAt = new Date();
  const tz = req?.timezone || env.ORG_TIMEZONE;
  const context = await buildInternContext({ intern, org, documentId, issuedAt, tz, extra });

  const { text, missing } = interpolateVariables(tpl.bodyMarkdown, context);
  if (missing.length) {
    throw unprocessable(
      `This document cannot be issued because required data is missing: ${missing.join(', ')}.`,
      missing.map(m => ({ field: m, message: 'No value available' })), 'MISSING_TEMPLATE_DATA'
    );
  }

  const pdf = await renderTemplatePDF({
    organizationName: org?.name || '', title: tpl.title, body: text, recipientName: context.candidate.name,
    signatory: { name: context.organization.signatoryName, title: context.organization.signatoryTitle },
    documentNumber: documentId, verifyUrl: context.document.verifyUrl, issueDate: formatDateLong(issuedAt, tz)
  });
  const stored = await storageService.saveFile({
    buffer: pdf, originalName: `${documentId}.pdf`, mimeType: 'application/pdf', subDir: `documents/${intern.organizationId}/generated`
  });

  const previous = await Document.find({ internId: intern._id, documentType: tpl.documentType, source: 'GENERATED', status: { $ne: DOCUMENT_STATUS.REVOKED } }).sort({ version: -1 });
  const version = previous.length ? previous[0].version + 1 : 1;

  let doc;
  try {
    doc = await Document.create({
      documentId, organizationId: intern.organizationId, ownerId: intern.userId._id || intern.userId, internId: intern._id,
      source: 'GENERATED', type: category || tpl.category, documentType: tpl.documentType, title: tpl.title,
      recipientName: context.candidate.name, fileName: stored.fileName, originalName: `${tpl.title}.pdf`, filePath: stored.filePath,
      mimeType: 'application/pdf', size: stored.size, checksum: stored.checksum, version,
      status: DOCUMENT_STATUS.GENERATED, uploadedBy: req?.userId || intern.userId._id || intern.userId,
      templateCode: tpl.templateCode, templateVersion: tpl.version, issuedAt
    });
  } catch (err) {
    await storageService.deleteFile(stored.filePath).catch(() => {});
    throw err;
  }
  for (const old of previous.filter(p => p.status !== DOCUMENT_STATUS.ARCHIVED)) {
    old.status = DOCUMENT_STATUS.ARCHIVED; old.supersededBy = doc._id; old.archivedAt = new Date();
    await old.save();
  }
  await recordAuditLog({
    organizationId: intern.organizationId, action: 'DOCUMENT_GENERATED', entityType: 'Document', entityId: doc._id,
    after: { documentId, documentType: tpl.documentType, version, templateCode: tpl.templateCode, templateVersion: tpl.version, checksum: stored.checksum }, req
  });
  return doc;
}

