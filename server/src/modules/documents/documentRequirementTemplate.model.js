import mongoose from 'mongoose';
import { DOCUMENT_CATEGORY } from '../../../../shared/constants.js';

const requiredDocumentItemSchema = new mongoose.Schema({
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
  allowedMimeTypes: [{
    type: String
  }],
  maxSizeMB: {
    type: Number,
    default: 10
  }
});

const documentRequirementTemplateSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  appliesTo: {
    type: String,
    enum: ['INTERN', 'TRAINEE', 'BOOTCAMP', 'ALL'],
    default: 'INTERN'
  },
  programId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InternshipProgram',
    index: true
  },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    index: true
  },
  requiredDocuments: [requiredDocumentItemSchema],
  version: {
    type: Number,
    default: 1
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

documentRequirementTemplateSchema.index({ organizationId: 1, name: 1 });

export const DocumentRequirementTemplate = mongoose.models.DocumentRequirementTemplate ||
  mongoose.model('DocumentRequirementTemplate', documentRequirementTemplateSchema);
