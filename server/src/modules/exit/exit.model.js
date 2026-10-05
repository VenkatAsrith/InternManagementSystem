import mongoose from 'mongoose';
import { EXIT_REASON, EXIT_STATUS } from '../../../../shared/constants.js';

const stageHistorySchema = new mongoose.Schema({
  stage: { type: String, enum: Object.values(EXIT_STATUS), required: true },
  outcome: { type: String, enum: ['COMPLETED', 'WAIVED', 'SKIPPED'], required: true },
  notes: { type: String, default: '' },
  waiveReason: { type: String },
  blockersAtCompletion: [{ code: String, message: String }],
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  actorRole: { type: String },
  at: { type: Date, default: Date.now }
}, { _id: false });

const exitSchema = new mongoose.Schema({
  exitId: { type: String, required: true, unique: true, index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  internId: { type: mongoose.Schema.Types.ObjectId, ref: 'Intern', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, enum: Object.values(EXIT_REASON), required: true },
  // The stage currently IN PROGRESS. EXIT_INITIATED -> ... -> ALUMNI (see shared/lifecycle.js EXIT_STAGE_DEFS).
  status: { type: String, enum: Object.values(EXIT_STATUS), default: EXIT_STATUS.EXIT_INITIATED, index: true },
  stageHistory: [stageHistorySchema],
  // While an exit is open this holds the internId; the unique sparse index allows ONE open exit per intern.
  openKey: { type: String, unique: true, sparse: true },
  initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  initiatedDate: { type: Date, default: Date.now },
  lastWorkingDay: { type: Date, required: true },
  noticePeriodDays: { type: Number, default: 0, min: 0, max: 90 },
  managerNotes: { type: String },
  hrNotes: { type: String },
  certificateEligible: { type: Boolean, default: false },
  lorEligible: { type: Boolean, default: false },
  // Computed by the server when the settlement stage is completed. Never accepted from the browser.
  finalSettlement: {
    amount: { type: Number, default: 0 },
    currency: { type: String },
    paymentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }],
    computedAt: { type: Date }
  },
  accessRevoked: { type: Boolean, default: false },
  accessRevokedAt: { type: Date },
  archivedAt: { type: Date },
  completedAt: { type: Date },
  cancelledAt: { type: Date },
  cancelReason: { type: String }
}, { timestamps: true });

exitSchema.pre('validate', function(next) {
  const open = !this.completedAt && !this.cancelledAt;
  this.openKey = open ? String(this.internId) : undefined;
  next();
});

exitSchema.index({ organizationId: 1, internId: 1 });

export const Exit = mongoose.models.Exit || mongoose.model('Exit', exitSchema);
