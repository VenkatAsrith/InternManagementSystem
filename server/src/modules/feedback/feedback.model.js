import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  type: {
    type: String,
    enum: ['MENTOR', 'MANAGER', 'PEER', 'HR', 'SELF'],
    default: 'MENTOR'
  },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  internId: { type: mongoose.Schema.Types.ObjectId, ref: 'Intern', required: true, index: true },
  relatedTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
  relatedProjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  rating: { type: Number, min: 1, max: 10 },
  comment: { type: String, required: true },
  visibility: {
    type: String,
    enum: ['PRIVATE', 'INTERN_VISIBLE', 'MANAGER_ONLY', 'HR_ONLY'],
    default: 'INTERN_VISIBLE'
  }
}, { timestamps: true });

feedbackSchema.index({ organizationId: 1, internId: 1 });

export const Feedback = mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema);
