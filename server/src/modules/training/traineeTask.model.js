import mongoose from 'mongoose';

const traineeTaskSchema = new mongoose.Schema({
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
  assignedTo: {
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
  moduleNumber: {
    type: Number,
    default: 1
  },
  dueDate: {
    type: Date
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
    default: 'MEDIUM'
  },
  status: {
    type: String,
    enum: ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REVISION_REQUIRED'],
    default: 'ASSIGNED',
    index: true
  },
  submission: {
    submittedAt: Date,
    workNotes: { type: String, default: '' },
    githubUrl: { type: String, default: '' },
    demoUrl: { type: String, default: '' },
    fileUrl: { type: String, default: '' },
    fileName: { type: String, default: '' }
  },
  review: {
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    feedback: { type: String, default: '' },
    score: { type: Number, min: 0, max: 100 }
  }
}, { timestamps: true });

traineeTaskSchema.index({ organizationId: 1, assignedTo: 1, status: 1 });

export const TraineeTask = mongoose.models.TraineeTask || mongoose.model('TraineeTask', traineeTaskSchema);
