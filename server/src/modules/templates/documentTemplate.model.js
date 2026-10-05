import mongoose from 'mongoose';
import { DOCUMENT_TYPE, DOCUMENT_CATEGORY } from '../../../../shared/constants.js';

const documentTemplateSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  templateCode: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  version: {
    type: Number,
    required: true,
    default: 1
  },
  documentType: {
    type: String,
    enum: Object.values(DOCUMENT_TYPE),
    required: true,
    index: true
  },
  category: {
    type: String,
    enum: Object.values(DOCUMENT_CATEGORY),
    default: DOCUMENT_CATEGORY.OTHER
  },
  headerText: {
    type: String,
    default: 'TECHMECHA TORQUE - CENTER FOR EXCELLENCE & TALENT'
  },
  bodyMarkdown: {
    type: String,
    required: true
  },
  footerText: {
    type: String,
    default: 'Confidential & Proprietary - TechMecha Torque'
  },
  defaultSignatory: {
    name: String,
    title: String
  },
  availableVariables: [{
    type: String
  }],
  isApproved: {
    type: Boolean,
    default: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Enforce unique versioning per template code per organization
documentTemplateSchema.index({ organizationId: 1, templateCode: 1, version: 1 }, { unique: true });

export const DocumentTemplate = mongoose.model('DocumentTemplate', documentTemplateSchema);
