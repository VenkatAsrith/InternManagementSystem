import mongoose from 'mongoose';
import { INTERVIEW_STATUS, INTERVIEW_RECOMMENDATION } from '../../../../shared/constants.js';

const interviewFeedbackSchema = new mongoose.Schema({
  interviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  technicalKnowledge: { type: Number, min: 1, max: 10, required: true },
  communication: { type: Number, min: 1, max: 10, required: true },
  problemSolving: { type: Number, min: 1, max: 10, required: true },
  relevantExperience: { type: Number, min: 1, max: 10, required: true },
  learningAbility: { type: Number, min: 1, max: 10, required: true },
  cultureFit: { type: Number, min: 1, max: 10, required: true },
  recommendation: {
    type: String,
    enum: Object.values(INTERVIEW_RECOMMENDATION),
    required: true
  },
  comments: { type: String, required: true },
  submittedAt: { type: Date, default: Date.now }
});

const interviewSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
  title: { type: String, default: 'Internship Evaluation Interview' },
  type: {
    type: String,
    enum: ['TECHNICAL', 'HR', 'MANAGERIAL', 'FINAL'],
    default: 'TECHNICAL'
  },
  round: { type: Number, default: 1, min: 1 },
  interviewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // scheduledDate = organisation-local midnight of the interview day; startTime/endTime are 24h "HH:mm" in that timezone;
  // startsAt/endsAt are the resulting absolute instants (used for past-date and overlap checks).
  scheduledDate: { type: Date, required: true },
  startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  mode: { type: String, enum: ['ONLINE', 'IN_PERSON'], default: 'ONLINE' },
  meetingLink: { type: String, default: '' },
  location: { type: String, default: '' },
  notes: { type: String, default: '' },
  task: {
    assigned: { type: Boolean, default: false },
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    documentUrl: { type: String, default: '' },
    documentName: { type: String, default: '' },
    dueDate: { type: Date },
    submissionInstructions: { type: String, default: '' }
  },
  emailSentAt: { type: Date },
  emailDeliveryStatus: { type: String, enum: ['PENDING', 'SENT', 'FAILED'], default: 'PENDING' },
  status: {
    type: String,
    enum: Object.values(INTERVIEW_STATUS),
    default: INTERVIEW_STATUS.SCHEDULED,
    index: true
  },
  feedback: [interviewFeedbackSchema],
  rescheduleHistory: [{
    previousStartsAt: Date,
    newStartsAt: Date,
    reason: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now }
  }],
  cancelledAt: { type: Date },
  cancelReason: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

interviewSchema.index({ organizationId: 1, scheduledDate: 1 });
interviewSchema.index({ interviewers: 1, startsAt: 1 });
interviewSchema.index({ applicationId: 1, status: 1 });

export const Interview = mongoose.models.Interview || mongoose.model('Interview', interviewSchema);
