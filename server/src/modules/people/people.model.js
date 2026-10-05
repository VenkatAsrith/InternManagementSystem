import mongoose from 'mongoose';

const personTimelineEventSchema = new mongoose.Schema({
  event: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  details: { type: mongoose.Schema.Types.Mixed },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: false });

const personSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  firstName: { type: String, required: true, trim: true, maxlength: 100 },
  lastName: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, lowercase: true, trim: true },
  normalizedEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
  phone: { type: String, required: true, trim: true },
  normalizedPhone: { type: String, required: true, trim: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', index: true },
  internId: { type: mongoose.Schema.Types.ObjectId, ref: 'Intern', index: true },
  status: {
    type: String,
    enum: ['ACTIVE', 'DUPLICATE_REVIEW', 'MERGED', 'ARCHIVED'],
    default: 'ACTIVE',
    index: true
  },
  mergedInto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Person',
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timeline: [personTimelineEventSchema]
}, {
  timestamps: true
});

personSchema.index({ organizationId: 1, normalizedEmail: 1 });
personSchema.index({ organizationId: 1, normalizedPhone: 1 });

export const Person = mongoose.models.Person || mongoose.model('Person', personSchema);
