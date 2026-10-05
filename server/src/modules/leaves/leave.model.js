import mongoose from 'mongoose';
import { LEAVE_TYPE, LEAVE_STATUS } from '../../../../shared/constants.js';

const leaveSchema = new mongoose.Schema({
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
  leaveType: {
    type: String,
    enum: Object.values(LEAVE_TYPE),
    default: LEAVE_TYPE.CASUAL
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  // Computed by the server from the working days in the range (never trusted from the browser).
  totalDays: {
    type: Number,
    required: true,
    min: 0.5,
    default: 1
  },
  halfDay: { type: Boolean, default: false },
  cancelledAt: { type: Date },
  reason: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: Object.values(LEAVE_STATUS),
    default: LEAVE_STATUS.REQUESTED,
    index: true
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  reviewNotes: {
    type: String
  }
}, {
  timestamps: true
});

leaveSchema.index({ organizationId: 1, internId: 1, startDate: -1 });

export const Leave = mongoose.models.Leave || mongoose.model('Leave', leaveSchema);
