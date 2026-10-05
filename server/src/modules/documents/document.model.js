import mongoose from 'mongoose';
import { DOCUMENT_CATEGORY, DOCUMENT_STATUS, DOCUMENT_TYPE } from '../../../../shared/constants.js';

// One collection for both kinds of documents:
//   source UPLOADED  - a file a person uploaded (ID proof, signed NDA ...). Goes through UPLOADED -> APPROVED/REJECTED.
//   source GENERATED - an official letter rendered by the platform (offer, experience, LOR ...). Gets a public
//                      verification id, is versioned and NEVER overwritten: a re-issue supersedes the old version.
const documentSchema = new mongoose.Schema({
  documentId: { type: String, unique: true, sparse: true, index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  internId: { type: mongoose.Schema.Types.ObjectId, ref: 'Intern', index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },
  source: { type: String, enum: ['UPLOADED', 'GENERATED'], default: 'UPLOADED', index: true },
  type: {
    type: String,
    enum: Object.values(DOCUMENT_CATEGORY),
    default: DOCUMENT_CATEGORY.OTHER,
    index: true
  },
  documentType: { type: String, enum: Object.values(DOCUMENT_TYPE) },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  recipientName: { type: String, default: '' },
  fileName: { type: String, required: true },
  originalName: { type: String, required: true },
  filePath: { type: String, required: true },
  storageLocation: { type: String, default: 'local' },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  checksum: { type: String },
  version: { type: Number, default: 1, min: 1 },
  supersededBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
  status: {
    type: String,
    enum: Object.values(DOCUMENT_STATUS),
    default: DOCUMENT_STATUS.UPLOADED,
    index: true
  },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvalNotes: { type: String, default: '' },
  approvedAt: { type: Date },
  onboardingTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'OnboardingTask' },
  templateCode: { type: String },
  templateVersion: { type: Number },
  issuedAt: { type: Date },
  revokedAt: { type: Date },
  revokedReason: { type: String },
  archivedAt: { type: Date },
  deliveryHistory: [{
    channel: { type: String, enum: ['EMAIL', 'DOWNLOAD', 'PORTAL', 'WHATSAPP'] },
    to: String,
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, default: 'DELIVERED' },
    sentAt: { type: Date, default: Date.now },
    at: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

documentSchema.index({ organizationId: 1, ownerId: 1 });
documentSchema.index({ internId: 1, type: 1, status: 1 });

export const Document = mongoose.models.Document || mongoose.model('Document', documentSchema);

// Document categories that contain personal identity data. Every download of these is audited.
export const SENSITIVE_CATEGORIES = [DOCUMENT_CATEGORY.ID_PROOF, DOCUMENT_CATEGORY.COLLEGE_ID, DOCUMENT_CATEGORY.FINANCE];
