import mongoose from 'mongoose';
import { TASK_STATUS, TASK_PRIORITY, SUBMISSION_STATUS } from '../../../../shared/constants.js';

const taskSubmissionSchema = new mongoose.Schema({
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  description: { type: String, required: true },
  links: [{
    label: String,
    url: String
  }],
  attachments: [{
    fileName: String,
    filePath: String,
    fileSize: Number
  }],
  version: { type: Number, default: 1 },
  status: {
    type: String,
    enum: Object.values(SUBMISSION_STATUS),
    default: SUBMISSION_STATUS.SUBMITTED
  },
  reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewNotes: { type: String, default: '' },
  reviewedAt: { type: Date }
}, { timestamps: true });

const taskSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  priority: {
    type: String,
    enum: Object.values(TASK_PRIORITY),
    default: TASK_PRIORITY.MEDIUM,
    index: true
  },
  status: {
    type: String,
    enum: Object.values(TASK_STATUS),
    default: TASK_STATUS.TODO,
    index: true
  },
  startDate: { type: Date },
  dueDate: { type: Date, index: true },
  estimatedHours: { type: Number, default: 0, min: 0 },
  actualHours: { type: Number, default: 0, min: 0 },
  completedAt: { type: Date },
  tags: [{ type: String }],
  links: [{
    label: String,
    url: String
  }],
  visibility: {
    type: String,
    enum: ['PUBLIC', 'INTERNAL', 'PRIVATE'],
    default: 'PUBLIC',
    index: true
  }
}, { timestamps: true });

taskSchema.index({ organizationId: 1, status: 1 });
taskSchema.index({ organizationId: 1, assignedTo: 1 });

// A task can never have two submissions with the same version number (double-click / race safe).
taskSubmissionSchema.index({ taskId: 1, version: 1 }, { unique: true });

export const Task = mongoose.models.Task || mongoose.model('Task', taskSchema);
export const TaskSubmission = mongoose.models.TaskSubmission || mongoose.model('TaskSubmission', taskSubmissionSchema);
