import mongoose from 'mongoose';

const traineeAttendanceSchema = new mongoose.Schema({
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
  date: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['PRESENT', 'ABSENT', 'LATE'],
    default: 'PRESENT',
    index: true
  },
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

traineeAttendanceSchema.index({ organizationId: 1, userId: 1, date: 1 }, { unique: true });

export const TraineeAttendance = mongoose.models.TraineeAttendance ||
  mongoose.model('TraineeAttendance', traineeAttendanceSchema);
