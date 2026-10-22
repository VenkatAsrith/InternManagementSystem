import mongoose from 'mongoose';

const traineeAssessmentSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  programId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TrainingProgram',
    required: true,
    index: true
  },
  engagementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TrainingEngagement',
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  moduleNumber: {
    type: Number,
    default: 1
  },
  assessmentDate: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date
  },
  assessmentUrl: {
    type: String,
    default: '',
    trim: true
  },
  platformName: {
    type: String,
    default: 'Learning Spaces',
    trim: true
  },
  score: {
    type: Number,
    default: 0,
    min: 0
  },
  maxScore: {
    type: Number,
    default: 100,
    min: 1
  },
  passingScore: {
    type: Number,
    default: 70,
    min: 0
  },
  percentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  status: {
    type: String,
    enum: ['SCHEDULED', 'PENDING', 'IN_PROGRESS', 'SUBMITTED', 'PASSED', 'FAILED', 'NEEDS_REVISION'],
    default: 'PASSED',
    index: true
  },
  feedback: {
    type: String,
    default: ''
  },
  instructions: {
    type: String,
    default: ''
  },
  evaluatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

traineeAssessmentSchema.index({ organizationId: 1, userId: 1, programId: 1 });

export const TraineeAssessment = mongoose.models.TraineeAssessment ||
  mongoose.model('TraineeAssessment', traineeAssessmentSchema);
