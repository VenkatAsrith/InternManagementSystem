import mongoose from 'mongoose';

const roleAssignmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    index: true
  },
  roleKey: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  effectiveFrom: {
    type: Date,
    default: Date.now
  },
  effectiveUntil: {
    type: Date
  },
  reason: {
    type: String,
    default: 'Standard role assignment'
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvalStatus: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'APPROVED'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'REVOKED', 'EXPIRED'],
    default: 'ACTIVE',
    index: true
  }
}, { timestamps: true });

roleAssignmentSchema.index({ userId: 1, status: 1 });

export const RoleAssignment = mongoose.models.RoleAssignment || mongoose.model('RoleAssignment', roleAssignmentSchema);
