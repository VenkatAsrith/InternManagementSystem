import mongoose from 'mongoose';
import { MEETING_TYPE } from '../../../../shared/constants.js';

const meetingSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  title: { type: String, required: true, trim: true },
  type: {
    type: String,
    enum: Object.values(MEETING_TYPE),
    default: MEETING_TYPE.MENTOR_1ON1
  },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  internIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Intern' }],
  mentorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingProgram', index: true },
  description: { type: String, default: '' },
  scheduledDate: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  timezone: { type: String, default: 'Asia/Kolkata' },
  meetingProvider: {
    type: String,
    enum: ['GOOGLE_MEET', 'MS_TEAMS', 'ZOOM', 'CUSTOM', 'IN_PERSON'],
    default: 'GOOGLE_MEET'
  },
  meetingLink: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v || this.meetingProvider === 'IN_PERSON') return true;
        // Require valid http/https URL, block javascript: or null
        return /^https?:\/\/[^\s$.?#].[^\s]*$/i.test(v);
      },
      message: 'Invalid meeting URL. Must start with http:// or https://'
    }
  },
  recordingUrl: { type: String, default: '' },
  agenda: { type: String, default: '' },
  notes: { type: String, default: '' },
  actionItems: [{
    title: { type: String, required: true },
    assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dueDate: { type: Date },
    isCompleted: { type: Boolean, default: false },
    convertedTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' }
  }],
  status: {
    type: String,
    enum: ['DRAFT', 'SCHEDULED', 'RESCHEDULED', 'STARTED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
    default: 'SCHEDULED',
    index: true
  },
  googleCalendarEventId: { type: String, default: '' },
  googleMeetLink: { type: String, default: '' },
  googleConferenceId: { type: String, default: '' },
  reminders: [{
    type: { type: String, enum: ['24_HOURS', '15_MINUTES', 'CUSTOM'], default: '24_HOURS' },
    offsetMinutes: { type: Number, default: 1440 },
    status: { type: String, enum: ['SCHEDULED', 'SENT', 'FAILED'], default: 'SCHEDULED' },
    scheduledFor: { type: Date },
    sentAt: { type: Date }
  }],
  idempotencyKey: { type: String, index: true },
  rescheduleHistory: [{
    previousDate: Date,
    newDate: Date,
    reason: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

meetingSchema.index({ organizationId: 1, scheduledDate: 1 });

export const Meeting = mongoose.models.Meeting || mongoose.model('Meeting', meetingSchema);
