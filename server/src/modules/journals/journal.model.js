import mongoose from 'mongoose';
import { JOURNAL_STATUS } from '../../../../shared/constants.js';

const journalEntrySchema = new mongoose.Schema({
  internId: { type: mongoose.Schema.Types.ObjectId, ref: 'Intern', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  date: { type: Date, required: true },
  dayNumber: { type: Number, required: true },
  workSummary: { type: String, required: true },
  tasksCompleted: [{ type: String }],
  whatILearned: { type: String, required: true },
  challenges: { type: String, default: '' },
  blockers: { type: String, default: '' },
  nextSteps: { type: String, default: '' },
  hoursWorked: { type: Number, required: true, min: 0, max: 24 },
  status: {
    type: String,
    enum: Object.values(JOURNAL_STATUS),
    default: JOURNAL_STATUS.SUBMITTED,
    index: true
  },
  mentorReview: {
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    comments: { type: String, default: '' },
    reviewedAt: { type: Date }
  }
}, { timestamps: true });

journalEntrySchema.index({ internId: 1, date: 1 }, { unique: true });

export const JournalEntry = mongoose.models.JournalEntry || mongoose.model('JournalEntry', journalEntrySchema);
