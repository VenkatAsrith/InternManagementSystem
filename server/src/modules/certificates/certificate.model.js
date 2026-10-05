import mongoose from 'mongoose';

const certificateSchema = new mongoose.Schema({
  certificateId: { type: String, required: true, unique: true, index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  internId: { type: mongoose.Schema.Types.ObjectId, ref: 'Intern', index: true },
  passId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pass', index: true },
  bootcampId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bootcamp', index: true },
  trainingId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingProgram', index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // At most ONE active certificate per intern/pass (unique sparse index). Re-issuing means revoking the old one first.
  activeKey: { type: String, unique: true, sparse: true },
  internName: { type: String, required: true },
  programTitle: { type: String, required: true },
  departmentName: { type: String, required: true },
  organizationName: { type: String, required: true },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  duration: { type: String },
  issueDate: { type: String, required: true },
  issuedAt: { type: Date, default: Date.now },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  signatory: { type: String, default: '' },
  filePath: { type: String, default: '' },
  checksum: { type: String },
  // Snapshot of the eligibility checks that justified issuing the certificate (audit evidence).
  eligibilitySnapshot: { type: mongoose.Schema.Types.Mixed },
  status: { type: String, enum: ['ACTIVE', 'REVOKED'], default: 'ACTIVE', index: true },
  revokedAt: { type: Date },
  revokedReason: { type: String }
}, { timestamps: true });

certificateSchema.pre('validate', function(next) {
  this.activeKey = this.status === 'ACTIVE'
    ? (this.internId ? String(this.internId) : this.passId ? `PASS_${this.passId}` : `CERT_${this.certificateId}`)
    : undefined;
  next();
});

export const Certificate = mongoose.models.Certificate || mongoose.model('Certificate', certificateSchema);
