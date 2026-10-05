import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  actorEmail: { type: String },
  actorRole: { type: String },
  action: { type: String, required: true, index: true },
  entityType: { type: String, required: true, index: true },
  entityId: { type: String, required: true, index: true },
  before: { type: mongoose.Schema.Types.Mixed },
  after: { type: mongoose.Schema.Types.Mixed },
  ipAddress: { type: String },
  userAgent: { type: String },
  correlationId: { type: String, index: true },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, {
  timestamps: { createdAt: 'timestamp', updatedAt: false }
});

auditLogSchema.index({ organizationId: 1, timestamp: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });

// The audit trail is APPEND-ONLY. Every mutation path except insert is refused at the model layer.
const refuse = function(next) {
  next(new Error('Audit log entries are immutable and cannot be modified or deleted.'));
};
['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndReplace', 'replaceOne', 'findOneAndDelete', 'deleteMany']
  .forEach(op => auditLogSchema.pre(op, refuse));
auditLogSchema.pre('deleteOne', { document: true, query: true }, refuse);
auditLogSchema.pre('updateOne', { document: true, query: true }, refuse);
auditLogSchema.pre('save', function(next) {
  if (!this.isNew) return next(new Error('Audit log entries are immutable and cannot be modified or deleted.'));
  next();
});

export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
