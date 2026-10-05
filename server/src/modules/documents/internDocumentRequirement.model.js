import mongoose from 'mongoose';
import { DOCUMENT_CATEGORY } from '../../../../shared/constants.js';

const internDocumentRequirementSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  internId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Intern',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DocumentRequirementTemplate',
    index: true
  },
  category: {
    type: String,
    enum: Object.values(DOCUMENT_CATEGORY),
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  mandatory: {
    type: Boolean,
    default: true
  },
  instructions: {
    type: String,
    default: ''
  },
  sampleTemplateUrl: {
    type: String,
    default: ''
  },
  sampleTemplateName: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['REQUIRED', 'PENDING', 'UPLOADED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED'],
    default: 'REQUIRED',
    index: true
  },
  submittedDocumentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  },
  rejectionReason: {
    type: String,
    default: ''
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  }
}, { timestamps: true });

internDocumentRequirementSchema.index({ organizationId: 1, internId: 1, title: 1 });

export const InternDocumentRequirement = mongoose.models.InternDocumentRequirement ||
  mongoose.model('InternDocumentRequirement', internDocumentRequirementSchema);
