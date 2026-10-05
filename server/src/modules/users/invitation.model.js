import mongoose from 'mongoose';

const userInvitationSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  personId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Person'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  firstName: { type: String, trim: true, default: '' },
  lastName: { type: String, trim: true, default: '' },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  role: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  permissions: [{ type: String }],
  scope: { type: String, default: 'ORGANIZATION' },
  tokenHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'SENT', 'OPENED', 'ACCEPTED', 'EXPIRED', 'REVOKED'],
    default: 'SENT',
    index: true
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  acceptedAt: { type: Date },
  revokedAt: { type: Date }
}, {
  timestamps: true
});

userInvitationSchema.index({ organizationId: 1, email: 1 });

export const UserInvitation = mongoose.models.UserInvitation || mongoose.model('UserInvitation', userInvitationSchema);
