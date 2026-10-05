import mongoose from 'mongoose';

const curriculumMilestoneSchema = new mongoose.Schema({
  milestoneIndex: { type: Number, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  checkpointRequired: { type: Boolean, default: true }
});

const trainingProgramSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  title: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true },
  duration: { type: String, default: '' }, // e.g. "3 Months", "8 Weeks"
  durationWeeks: { type: Number, default: 8, min: 1 },
  startDate: { type: Date },
  endDate: { type: Date },
  feeType: { type: String, enum: ['FREE', 'PAID'], default: 'PAID' },
  grossFee: { type: Number, default: 0, min: 0 },
  paymentStatus: { type: String, enum: ['PENDING', 'PARTIAL', 'PAID'], default: 'PENDING' },
  amountPaid: { type: Number, default: 0, min: 0 },
  trainer: { type: String, default: '' },
  trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  description: { type: String, default: '' },
  capacity: { type: Number, default: 50 },
  eligibility: { type: String, default: '' },
  location: { type: String, default: '' },
  mode: { type: String, enum: ['ONLINE', 'OFFLINE', 'HYBRID'], default: 'ONLINE' },
  resources: [{ title: { type: String, default: '' }, url: { type: String, default: '' } }],
  attachments: [{ name: { type: String, default: '' }, url: { type: String, default: '' } }],
  status: { type: String, enum: ['UPCOMING', 'ACTIVE', 'COMPLETED', 'ARCHIVED'], default: 'ACTIVE' },
  skills: [{ type: String, trim: true }],
  learningObjectives: [{ type: String, trim: true }],
  modules: [{
    moduleNumber: { type: Number, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    topics: [{ type: String, trim: true }],
    estimatedHours: { type: Number, default: 10 },
    isPublished: { type: Boolean, default: true }
  }],
  milestones: [curriculumMilestoneSchema],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

trainingProgramSchema.index({ organizationId: 1, code: 1 }, { unique: true });

const trainingBatchSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingProgram', required: true, index: true },
  trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  trainer: { type: String, default: '' },
  cohortCode: { type: String, required: true, trim: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  feeType: { type: String, enum: ['FREE', 'PAID'], default: 'PAID' },
  fee: { type: Number, default: 0, min: 0 },
  paymentStatus: { type: String, enum: ['PENDING', 'PARTIAL', 'PAID'], default: 'PENDING' },
  amountPaid: { type: Number, default: 0, min: 0 },
  status: {
    type: String,
    enum: ['UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
    default: 'ACTIVE',
    index: true
  }
}, { timestamps: true });

trainingBatchSchema.index({ organizationId: 1, cohortCode: 1 }, { unique: true });

const checkpointGradingSchema = new mongoose.Schema({
  milestoneIndex: { type: Number, required: true },
  milestoneTitle: { type: String, default: '' },
  score: { type: Number, min: 0, max: 100 },
  status: {
    type: String,
    enum: ['PENDING', 'PASSED', 'NEEDS_REVISION'],
    default: 'PENDING'
  },
  feedback: { type: String, default: '' },
  evaluatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  evaluatedAt: { type: Date }
});

const trainingEngagementSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true, index: true },
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingProgram', required: true, index: true },
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingBatch', index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  internId: { type: mongoose.Schema.Types.ObjectId, ref: 'Intern', index: true },
  mentorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  status: {
    type: String,
    enum: [
      'ENROLLED',
      'ACTIVE',
      'ACTIVE_TRAINING',
      'CHECKPOINT_PENDING',
      'TRAINING_IN_PROGRESS',
      'TRAINING_COMPLETED',
      'COMPLETED',
      'ELIGIBLE_FOR_COMPANY_INTERNSHIP',
      'PAUSED',
      'DROPPED',
      'TERMINATED'
    ],
    default: 'ENROLLED',
    index: true
  },
  overallProgress: { type: Number, default: 0, min: 0, max: 100 },
  completedModuleNumbers: [{ type: Number }],
  attendancePercent: { type: Number, default: 100, min: 0, max: 100 },
  isAtRisk: { type: Boolean, default: false, index: true },
  atRiskReasons: [{ type: String }],
  lastActivityAt: { type: Date, default: Date.now },
  certificateId: { type: String, default: '' },
  checkpoints: [checkpointGradingSchema],
  mentorFeedback: [{
    mentorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now },
    technicalSkills: { type: Number, min: 1, max: 5 },
    communication: { type: Number, min: 1, max: 5 },
    problemSolving: { type: Number, min: 1, max: 5 },
    taskCompletion: { type: Number, min: 1, max: 5 },
    professionalism: { type: Number, min: 1, max: 5 },
    overallFeedback: { type: String, trim: true }
  }],
  enrolledAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  completionSnapshot: {
    isEligible: { type: Boolean, default: false },
    completedAt: { type: Date },
    attendanceRate: { type: Number, default: 0 },
    tasksApprovedCount: { type: Number, default: 0 },
    assessmentsPassedCount: { type: Number, default: 0 },
    projectApproved: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }
}, { timestamps: true });

trainingEngagementSchema.index({ organizationId: 1, personId: 1, batchId: 1 }, { unique: true, sparse: true });
trainingEngagementSchema.index({ organizationId: 1, userId: 1, programId: 1 });

export const TrainingProgram = mongoose.models.TrainingProgram || mongoose.model('TrainingProgram', trainingProgramSchema);
export const TrainingBatch = mongoose.models.TrainingBatch || mongoose.model('TrainingBatch', trainingBatchSchema);
export const TrainingEngagement = mongoose.models.TrainingEngagement || mongoose.model('TrainingEngagement', trainingEngagementSchema);
