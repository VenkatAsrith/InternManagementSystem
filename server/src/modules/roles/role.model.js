import mongoose from 'mongoose';
import { ROLE_CATEGORY, ROLE_SCOPE, ROLE_STATUS } from '../../../../shared/constants.js';

const roleSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  label: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    enum: Object.values(ROLE_CATEGORY),
    default: ROLE_CATEGORY.ADMINISTRATION
  },
  scope: {
    type: String,
    enum: Object.values(ROLE_SCOPE),
    default: ROLE_SCOPE.ORGANIZATION
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    index: true
  },
  permissions: [{
    type: String,
    trim: true
  }],
  assignableBy: [{
    type: String,
    uppercase: true
  }],
  approvalRequired: {
    type: Boolean,
    default: false
  },
  isSystemRole: {
    type: Boolean,
    default: false
  },
  defaultNavigation: {
    type: String,
    default: 'adminNav'
  },
  navigationAccess: [{
    type: String
  }],
  status: {
    type: String,
    enum: Object.values(ROLE_STATUS),
    default: ROLE_STATUS.ACTIVE,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

// Custom role keys are unique PER ORGANISATION (system roles have no organisationId).
roleSchema.index({ organizationId: 1, key: 1 }, { unique: true });

export const Role = mongoose.models.Role || mongoose.model('Role', roleSchema);
