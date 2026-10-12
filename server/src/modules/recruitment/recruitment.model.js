import mongoose from 'mongoose';
import { APPLICATION_STATUS } from '../../../../shared/constants.js';
import { APPLICATION_ACTIVE_STATUSES } from '../../../../shared/lifecycle.js';

const internshipProgramSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 150 },
  slug: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  durationDays: { type: Number, default: 60, min: 1, max: 730 },
  attendanceRequirementPercent: { type: Number, default: 85, min: 0, max: 100 },
  requiredDocuments: [{ type: String }],
  completionRequirements: {
    minimumTasksCompleted: { type: Number, default: 5, min: 0 },
    projectRequired: { type: Boolean, default: true },
    finalReviewRequired: { type: Boolean, default: true },
    minimumAttendancePercent: { type: Number, default: 85, min: 0, max: 100 }
  },
  feeType: { type: String, enum: ['FREE', 'PAID'], default: 'FREE' },
  feeAmount: { type: Number, default: 0, min: 0 },
  feeInclusions: [{ type: String }],
  feeDescription: { type: String, default: '' },
  currency: { type: String, default: 'INR' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

internshipProgramSchema.index({ organizationId: 1, slug: 1 }, { unique: true });

const internshipOpeningSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'InternshipProgram', required: true },
  title: { type: String, required: true, trim: true, maxlength: 150 },
  // Slug is globally unique because the public portal resolves an opening by slug alone.
  slug: { type: String, required: true, trim: true, unique: true },
  description: { type: String, required: true },
  responsibilities: [{ type: String }],
  requiredSkills: [{ type: String }],
  preferredSkills: [{ type: String }],
  eligibility: { type: String, default: 'Open to current students and recent graduates' },
  duration: { type: String, default: '60 Days' },
  workMode: { type: String, enum: ['REMOTE', 'HYBRID', 'ON_SITE'], default: 'REMOTE' },
  location: { type: String, default: '' },
  // Display text shown on the public portal. The structured amount below prefills offers and finance.
  stipend: { type: String, default: '' },
  stipendAmount: { type: Number, min: 0 },
  stipendCurrency: { type: String, default: 'INR', uppercase: true },
  feeType: { type: String, enum: ['FREE', 'PAID'], default: 'FREE' },
  feeAmount: { type: Number, default: 0, min: 0 },
  feeInclusions: [{ type: String }],
  openPositions: { type: Number, default: 1, min: 1 },
  deadline: { type: Date, required: true },
  status: { type: String, enum: ['DRAFT', 'OPEN', 'CLOSED'], default: 'OPEN', index: true },
  closedAt: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

internshipOpeningSchema.index({ organizationId: 1, slug: 1 }, { unique: true });

// One person = one Candidate per organisation. `userId` links the SAME identity to their login account once one exists.
const candidateSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  firstName: { type: String, required: true, trim: true, maxlength: 100 },
  lastName: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  phone: { type: String, required: true, trim: true },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  country: { type: String, default: '' },
  education: {
    college: { type: String, required: true },
    degree: { type: String, required: true },
    branch: { type: String, required: true },
    graduationYear: { type: Number, required: true },
    cgpa: { type: String, default: '' }
  },
  technicalSkills: [{ type: String }],
  softSkills: [{ type: String }],
  github: { type: String, default: '' },
  linkedin: { type: String, default: '' },
  portfolio: { type: String, default: '' }
}, { timestamps: true });

candidateSchema.index({ organizationId: 1, email: 1 }, { unique: true });

const applicationSchema = new mongoose.Schema({
  applicationId: { type: String, required: true, unique: true, index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  openingId: { type: mongoose.Schema.Types.ObjectId, ref: 'InternshipOpening', required: true, index: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
  status: {
    type: String,
    enum: Object.values(APPLICATION_STATUS),
    default: APPLICATION_STATUS.APPLIED,
    index: true
  },
  // Database-level duplicate guard: while an application is "active" this holds `<openingId>:<candidateId>`
  // and a unique sparse index makes a second active application for the same opening impossible (even under a race).
  activeKey: { type: String, unique: true, sparse: true },
  resumePath: { type: String, default: '' },
  resumeOriginalName: { type: String, default: '' },
  resumeMimeType: { type: String, default: '' },
  coverLetter: { type: String, default: '' },
  preferredStartDate: { type: Date },
  score: { type: Number, default: 0 },
  assignedRecruiterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tags: [{ type: String }],
  notes: [{
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    authorName: String,
    text: String,
    createdAt: { type: Date, default: Date.now }
  }],
  timeline: [{
    stage: String,
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorName: String,
    note: String,
    timestamp: { type: Date, default: Date.now }
  }],
  privacyConsent: { type: Boolean, required: true, validate: { validator: v => v === true, message: 'Privacy consent must be given' } },
  privacyConsentAt: { type: Date }
}, { timestamps: true });

applicationSchema.pre('validate', function(next) {
  this.activeKey = APPLICATION_ACTIVE_STATUSES.includes(this.status) ? `${this.openingId}:${this.candidateId}` : undefined;
  next();
});

applicationSchema.index({ organizationId: 1, status: 1 });
applicationSchema.index({ organizationId: 1, openingId: 1 });

export const InternshipProgram = mongoose.models.InternshipProgram || mongoose.model('InternshipProgram', internshipProgramSchema);
export const InternshipOpening = mongoose.models.InternshipOpening || mongoose.model('InternshipOpening', internshipOpeningSchema);
export const Candidate = mongoose.models.Candidate || mongoose.model('Candidate', candidateSchema);
export const Application = mongoose.models.Application || mongoose.model('Application', applicationSchema);
