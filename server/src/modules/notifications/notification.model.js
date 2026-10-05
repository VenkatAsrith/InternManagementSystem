import mongoose from 'mongoose';
import { NOTIFICATION_CHANNEL } from '../../../../shared/constants.js';

const notificationSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  entityType: { type: String },
  entityId: { type: String },
  channel: {
    type: String,
    enum: Object.values(NOTIFICATION_CHANNEL),
    default: NOTIFICATION_CHANNEL.IN_APP
  },
  readAt: { type: Date },
  isRead: { type: Boolean, default: false, index: true }
}, { timestamps: true });

notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
