import mongoose from 'mongoose';
import { ASSET_TYPE, ASSET_STATUS } from '../../../../shared/constants.js';

const assetSchema = new mongoose.Schema({
  assetTag: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  internId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Intern',
    index: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: Object.values(ASSET_TYPE),
    required: true,
    index: true
  },
  serialNumber: {
    type: String,
    trim: true
  },
  specifications: {
    type: String
  },
  status: {
    type: String,
    enum: Object.values(ASSET_STATUS),
    default: ASSET_STATUS.AVAILABLE,
    index: true
  },
  assignedDate: {
    type: Date
  },
  returnDueDate: {
    type: Date
  },
  returnDate: {
    type: Date
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedReturnBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  conditionNotes: {
    type: String
  },
  // Custody history: one row per hand-over. Returning an asset clears `internId` and closes the current row,
  // so the item can be reassigned while its full history is preserved.
  assignments: [{
    internId: { type: mongoose.Schema.Types.ObjectId, ref: 'Intern' },
    assignedDate: Date,
    returnDate: Date,
    outcome: { type: String, enum: ['RETURNED', 'DAMAGED', 'LOST', 'WAIVED'] },
    conditionNotes: String,
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }]
}, {
  timestamps: true
});

assetSchema.index({ organizationId: 1, internId: 1, status: 1 });
assetSchema.index({ organizationId: 1, serialNumber: 1 }, { unique: true, partialFilterExpression: { serialNumber: { $type: 'string' } } });

export const Asset = mongoose.models.Asset || mongoose.model('Asset', assetSchema);
