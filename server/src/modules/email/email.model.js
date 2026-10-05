import mongoose from 'mongoose';
import { EMAIL_STATUS } from '../../../../shared/constants.js';

const emailLogSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    index: true
  },
  recipient: {
    type: String,
    required: true,
    index: true
  },
  subject: {
    type: String,
    required: true
  },
  template: {
    type: String,
    index: true
  },
  status: {
    type: String,
    enum: Object.values(EMAIL_STATUS),
    default: EMAIL_STATUS.QUEUED,
    index: true
  },
  provider: {
    type: String,
    default: 'smtp'
  },
  messageId: {
    type: String
  },
  idempotencyKey: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  sentAt: {
    type: Date
  },
  failedAt: {
    type: Date
  },
  retryCount: {
    type: Number,
    default: 0
  },
  failureReason: {
    type: String
  },
  payload: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

emailLogSchema.index({ createdAt: -1 });

export const EmailLog = mongoose.model('EmailLog', emailLogSchema);
