import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, uppercase: true, trim: true },
  description: { type: String, default: '' },
  headOfDepartment: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true },
  archivedAt: { type: Date }
}, { timestamps: true });

departmentSchema.index({ organizationId: 1, code: 1 }, { unique: true });

const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  domain: { type: String, trim: true },
  email: { type: String, required: true, trim: true },
  phone: { type: String, default: '' },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  website: { type: String, default: '' },
  logoUrl: { type: String, default: '' },
  timezone: { type: String, default: 'Asia/Kolkata' },
  signatory: {
    name: { type: String, default: 'Head of Talent & Engineering' },
    title: { type: String, default: 'Director of Programs' }
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'SUSPENDED', 'INACTIVE'],
    default: 'ACTIVE'
  }
}, { timestamps: true });

export const Organization = mongoose.models.Organization || mongoose.model('Organization', organizationSchema);
export const Department = mongoose.models.Department || mongoose.model('Department', departmentSchema);
