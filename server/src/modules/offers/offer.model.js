import mongoose from 'mongoose';
import { OFFER_STATUS, COMPENSATION_TYPE } from '../../../../shared/constants.js';
import { OFFER_OPEN_STATUSES } from '../../../../shared/lifecycle.js';

const offerSchema = new mongoose.Schema({
  offerId: { type: String, required: true, unique: true, index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'InternshipProgram', required: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  title: { type: String, required: true },
  mentorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  durationDays: { type: Number, min: 1 },
  workMode: { type: String, enum: ['REMOTE', 'HYBRID', 'ON_SITE'], default: 'REMOTE' },

  // Structured compensation (single source for the letter, the compensation plan and payroll).
  compensationType: { type: String, enum: Object.values(COMPENSATION_TYPE), default: COMPENSATION_TYPE.MONTHLY_STIPEND },
  stipendAmount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'INR', uppercase: true },
  // Display text DERIVED from the structured fields on the server (never typed in by the browser).
  stipend: { type: String, default: '' },

  responsibilities: [{ type: String }],
  terms: { type: String, default: 'Subject to completion of pre-onboarding documentation and orientation.' },
  status: {
    type: String,
    enum: Object.values(OFFER_STATUS),
    default: OFFER_STATUS.DRAFT,
    index: true
  },

  // While an offer is open (DRAFT/SENT/VIEWED) this holds the applicationId; the unique sparse index makes a
  // second open offer for the same application impossible at database level.
  openKey: { type: String, unique: true, sparse: true },
  // Only the SHA-256 hash of the candidate's secret acceptance link is stored.
  acceptTokenHash: { type: String, select: false, index: true },
  validUntil: { type: Date },

  sentAt: { type: Date },
  viewedAt: { type: Date },
  acceptedAt: { type: Date },
  acceptedVia: { type: String, enum: ['CANDIDATE_LINK', 'HR_ON_BEHALF'] },
  acceptanceNote: { type: String },
  acceptedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  declinedAt: { type: Date },
  declineReason: { type: String },
  revokedAt: { type: Date },
  revokedReason: { type: String },

  // Filled by atomic provisioning on acceptance (used by the integrity verifier).
  provisioning: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    internId: { type: mongoose.Schema.Types.ObjectId, ref: 'Intern' },
    onboardingPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'OnboardingPlan' },
    compensationPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'CompensationPlan' },
    completedAt: { type: Date }
  },
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

offerSchema.pre('validate', function(next) {
  this.openKey = OFFER_OPEN_STATUSES.includes(this.status) ? String(this.applicationId) : undefined;
  next();
});

offerSchema.index({ organizationId: 1, status: 1 });

export const Offer = mongoose.models.Offer || mongoose.model('Offer', offerSchema);

export function formatStipend(amount, currency = 'INR', compensationType = COMPENSATION_TYPE.MONTHLY_STIPEND) {
  if (compensationType === COMPENSATION_TYPE.UNPAID || !amount) return 'Unpaid internship';
  const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  const unit = { MONTHLY_STIPEND: 'per month', DAILY_RATE: 'per day', HOURLY_RATE: 'per hour', PERFORMANCE_BONUS: 'performance bonus' }[compensationType] || '';
  return `${money} ${unit}`.trim();
}
