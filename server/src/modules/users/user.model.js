import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES } from '../../../../shared/constants.js';
import { env } from '../../config/env.js';

// Identity rule: ONE person == ONE User (email is globally unique). The same User is linked to their
// Candidate record(s) and later to their Intern engagement, so the person keeps a single identity
// from Candidate -> Intern -> Alumni.
const userSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: function() { return this.role !== ROLES.SUPER_ADMIN; },
    index: true
  },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  firstName: { type: String, required: true, trim: true, maxlength: 100 },
  lastName: { type: String, required: true, trim: true, maxlength: 100 },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  password: { type: String, required: true, select: false },
  // Role key. System roles are validated against ROLES; custom roles against the Role collection (see role.controller).
  role: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    default: ROLES.INTERN,
    index: true
  },
  phone: { type: String, default: '' },
  avatarUrl: { type: String, default: '' },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' },
  isActive: { type: Boolean, default: true, index: true },
  approvalStatus: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'APPROVED',
    index: true
  },
  requestedRole: { type: String, uppercase: true, trim: true, default: '' },
  registrationNotes: { type: String, default: '' },
  mustChangePassword: { type: Boolean, default: false },
  passwordChangedAt: { type: Date },
  passwordSetupTokenHash: { type: String, select: false, index: true },
  passwordSetupExpiresAt: { type: Date, select: false },
  lastLoginAt: { type: Date },
  deletedAt: { type: Date, default: null }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.passwordSetupTokenHash;
      delete ret.passwordSetupExpiresAt;
      delete ret.id;
      return ret;
    }
  }
});

userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`.trim();
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS);
  this.password = await bcrypt.hash(this.password, salt);
  this.passwordChangedAt = new Date();
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Compound index for querying by organization and role
userSchema.index({ organizationId: 1, role: 1, isActive: 1 });

export const User = mongoose.models.User || mongoose.model('User', userSchema);

/** Password policy: 8-128 chars, at least one letter and one digit. Returns an error message or null. */
export function passwordPolicyError(password) {
  if (typeof password !== 'string') return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (password.length > 128) return 'Password must be at most 128 characters';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Password must contain at least one letter and one number';
  return null;
}
