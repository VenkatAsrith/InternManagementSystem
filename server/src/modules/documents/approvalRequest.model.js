import mongoose from 'mongoose';

const approvalRequestSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['DOCUMENT', 'OFFER', 'STIPEND', 'EXIT', 'ROLE_CHANGE'],
    required: true,
    index: true
  },
  entityId: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedApproverRole: {
    type: String,
    required: true
  },
  assignedApproverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  stepNumber: {
    type: Number,
    default: 1
  },
  totalSteps: {
    type: Number,
    default: 1
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED'],
    default: 'PENDING',
    index: true
  },
  reason: {
    type: String,
    default: ''
  },
  comments: {
    type: String,
    default: ''
  },
  approvedAt: {
    type: Date
  },
  rejectedAt: {
    type: Date
  },
  auditTrail: [{
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: String,
    comments: String,
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

approvalRequestSchema.index({ organizationId: 1, status: 1 });
approvalRequestSchema.index({ type: 1, entityId: 1 });

export const ApprovalRequest = mongoose.models.ApprovalRequest || mongoose.model('ApprovalRequest', approvalRequestSchema);
