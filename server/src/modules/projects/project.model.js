import mongoose from 'mongoose';
import { PROJECT_STATUS } from '../../../../shared/constants.js';

const projectSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'InternshipProgram', index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  objective: { type: String, default: '' },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: {
    type: String,
    enum: Object.values(PROJECT_STATUS),
    default: PROJECT_STATUS.ACTIVE,
    index: true
  },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  repositoryUrl: { type: String, default: '' },
  documentationUrl: { type: String, default: '' }
}, { timestamps: true });

projectSchema.index({ organizationId: 1, status: 1 });

export const Project = mongoose.models.Project || mongoose.model('Project', projectSchema);
