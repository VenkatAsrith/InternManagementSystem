import mongoose from 'mongoose';
import { INTERN_STATUS } from '../../../../shared/constants.js';

// One Intern document == one internship ENGAGEMENT of one person. It always points back to the same
// User (login identity), Candidate (application profile) and Application (how they were hired).
const internSchema = new mongoose.Schema({
  internId: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', index: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' },
  offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer', index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'InternshipProgram', required: true, index: true },
  mentorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  workMode: { type: String, enum: ['REMOTE', 'HYBRID', 'ON_SITE'], default: 'REMOTE' },
  startDate: { type: Date, required: true },
  expectedEndDate: { type: Date, required: true },
  actualEndDate: { type: Date },
  activatedAt: { type: Date },
  extensionHistory: [{
    previousEndDate: Date,
    newEndDate: Date,
    reason: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now }
  }],
  status: {
    type: String,
    enum: Object.values(INTERN_STATUS),
    default: INTERN_STATUS.PRE_ONBOARDING,
    index: true
  },
  source: {
    type: String,
    enum: ['APPLICATION', 'REFERRAL', 'CAMPUS', 'WALK_IN', 'PARTNER', 'INTERNAL_TRANSFER', 'OTHER'],
    default: 'APPLICATION',
    index: true
  },
  institution: { type: String, trim: true, default: '' },
  degree: { type: String, trim: true, default: '' },
  graduationYear: { type: String, trim: true, default: '' },
  location: { type: String, trim: true, default: '' },
  internalNotes: { type: String, trim: true, default: '' },
  referral: {
    referredById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    referralName: { type: String, trim: true, default: '' },
    referralEmail: { type: String, trim: true, lowercase: true, default: '' },
    relationship: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    date: { type: Date }
  },
  compensation: {
    type: { type: String, enum: ['PAID', 'UNPAID'], default: 'UNPAID' },
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    frequency: { type: String, enum: ['MONTHLY', 'WEEKLY', 'ONE_TIME'], default: 'MONTHLY' },
    startDate: { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  candidatePayment: {
    feeType: { type: String, enum: ['FREE', 'PAID'], default: 'FREE' },
    feeAmount: { type: Number, default: 0, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    paymentStatus: { type: String, enum: ['PENDING', 'PARTIAL', 'PAID', 'WAIVED'], default: 'PENDING' },
    paymentMethod: { type: String, default: '' },
    paymentReference: { type: String, default: '' },
    paidAt: { type: Date },
    notes: { type: String, default: '' }
  },
  concessions: [{
    concessionType: { type: String, trim: true },
    description: { type: String, trim: true },
    amountOrPercentage: { type: String, trim: true },
    reason: { type: String, trim: true },
    effectiveDate: { type: Date, default: Date.now },
    approvalStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    internalRemarks: { type: String, trim: true }
  }],
  completionDetails: {
    tasksCompletedCount: { type: Number, default: 0 },
    attendancePercent: { type: Number, default: 0 },
    finalPerformanceScore: { type: Number, default: 0 },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    certificateId: { type: String }
  }
}, { timestamps: true });

internSchema.index({ organizationId: 1, status: 1 });
internSchema.index({ organizationId: 1, mentorId: 1 });

export const Intern = mongoose.models.Intern || mongoose.model('Intern', internSchema);
