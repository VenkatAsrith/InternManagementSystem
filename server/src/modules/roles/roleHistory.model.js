import mongoose from 'mongoose';

const roleHistorySchema = new mongoose.Schema({
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
  previousRole: {
    type: String,
    required: true,
    uppercase: true
  },
  newRole: {
    type: String,
    required: true,
    uppercase: true
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  permissionsAdded: [{
    type: String
  }],
  permissionsRemoved: [{
    type: String
  }],
  effectiveDate: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

roleHistorySchema.index({ userId: 1, createdAt: -1 });

export const RoleHistory = mongoose.models.RoleHistory || mongoose.model('RoleHistory', roleHistorySchema);
