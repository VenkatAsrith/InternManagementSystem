import mongoose from 'mongoose';

const traineeProjectSchema = new mongoose.Schema({
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
  description: {
    type: String,
    default: ''
  },
  githubUrl: {
    type: String,
    default: '',
    trim: true
  },
  demoUrl: {
    type: String,
    default: '',
    trim: true
  },
  deadline: {
    type: Date
  },
  mentorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REVISION_REQUIRED'],
    default: 'IN_PROGRESS',
    index: true
  },
  mentorFeedback: {
    technicalSkills: { type: Number, min: 1, max: 10 },
    problemSolving: { type: Number, min: 1, max: 10 },
    communication: { type: Number, min: 1, max: 10 },
    professionalism: { type: Number, min: 1, max: 10 },
    overallNotes: { type: String, default: '' },
    reviewedAt: Date,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }
}, { timestamps: true });

traineeProjectSchema.index({ organizationId: 1, userId: 1, programId: 1 });

export const TraineeProject = mongoose.models.TraineeProject ||
  mongoose.model('TraineeProject', traineeProjectSchema);
