import mongoose from 'mongoose';

// Call activity log for leads
const callActivitySchema = new mongoose.Schema({
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  timestamp: { type: Date, default: Date.now },
  durationMinutes: { type: Number, default: 0, min: 0 },
  outcome: { type: String, required: true },
  notes: { type: String, default: '' },
  nextFollowUpAt: { type: Date }
}, { timestamps: true });

// Lead schema
const leadSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  phone: { type: String, required: true, trim: true },
  source: {
    type: String,
    enum: ['WEBSITE', 'CAMPUS', 'INSTAGRAM', 'REFERRAL', 'WALK_IN', 'GOOGLE_FORMS', 'OTHER'],
    default: 'WEBSITE'
  },
  assignedEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  status: {
    type: String,
    enum: [
      'NEW',
      'CONTACTED',
      'INTERESTED',
      'BOOTCAMP_BOOKED',
      'DEMO_SCHEDULED',
      'DIRECT_TRAINING',
      'FOLLOW_UP',
      'CONVERTED',
      'LOST'
    ],
    default: 'NEW',
    index: true
  },
  programOfInterest: { type: String, default: '' },
  notes: { type: String, default: '' },
  lostReason: { type: String, default: '' },
  nextFollowUpAt: { type: Date, index: true },
  convertedAt: { type: Date }
}, { timestamps: true });

// Bootcamp Slot subdocument
const bootcampSlotSchema = new mongoose.Schema({
  slotName: { type: String, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  capacity: { type: Number, required: true, min: 1 },
  bookedCount: { type: Number, default: 0, min: 0 },
  checkedInCount: { type: Number, default: 0, min: 0 }
});

// Bootcamp schema
const bootcampSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  duration: { type: String, default: '' },
  startDate: { type: Date },
  endDate: { type: Date },
  date: { type: Date, required: true, index: true },
  venue: { type: String, default: 'TechMecha Torque Lab' },
  totalCapacity: { type: Number, required: true, min: 1 },
  registrationCutoff: { type: Date },
  status: {
    type: String,
    enum: ['DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED'],
    default: 'PUBLISHED',
    index: true
  },
  attachments: [{
    name: { type: String, required: true },
    url: { type: String, default: '' },
    filePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now }
  }],
  googleForm: {
    formUrl: { type: String, trim: true, default: '' },
    formId: { type: String, trim: true, default: '' },
    sheetUrl: { type: String, trim: true, default: '' },
    isConnected: { type: Boolean, default: false },
    isValidated: { type: Boolean, default: false },
    validatedAt: { type: Date },
    fieldMapping: {
      fullName: { type: String, default: 'Full Name' },
      email: { type: String, default: 'Email Address' },
      phone: { type: String, default: 'Phone Number' },
      college: { type: String, default: 'College' },
      course: { type: String, default: 'Course' },
      linkedIn: { type: String, default: 'LinkedIn Profile' },
      resume: { type: String, default: 'Resume Link' }
    },
    lastSyncedAt: { type: Date },
    syncStats: {
      newResponses: { type: Number, default: 0 },
      updatedResponses: { type: Number, default: 0 },
      duplicates: { type: Number, default: 0 },
      failed: { type: Number, default: 0 }
    }
  },
  feeType: { type: String, enum: ['FREE', 'PAID'], default: 'FREE' },
  feeAmount: { type: Number, default: 0, min: 0 },
  paymentUpiId: { type: String, default: 'techmechatorque@upi' },
  paymentInstructions: { type: String, default: '' },
  customForm: {
    isEnabled: { type: Boolean, default: true },
    bannerUrl: { type: String, default: '' },
    instructions: { type: String, default: '' },
    fields: [{
      id: { type: String, required: true },
      label: { type: String, required: true },
      fieldType: { type: String, enum: ['TEXT', 'TEXTAREA', 'SELECT', 'RADIO', 'CHECKBOX', 'NUMBER'], default: 'TEXT' },
      required: { type: Boolean, default: false },
      placeholder: { type: String, default: '' },
      options: [{ type: String }]
    }]
  },
  slots: [bootcampSlotSchema]
}, { timestamps: true });

// Pass / Registration schema
const passSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  bootcampId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bootcamp', required: true, index: true },
  slotId: { type: mongoose.Schema.Types.ObjectId, required: true },
  personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', index: true },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', index: true },
  candidateName: { type: String, required: true },
  candidateEmail: { type: String, required: true, lowercase: true, trim: true },
  candidatePhone: { type: String, default: '' },
  college: { type: String, default: '' },
  course: { type: String, default: '' },
  resumeUrl: { type: String, default: '' },
  source: { type: String, enum: ['DIRECT', 'GOOGLE_FORMS', 'REFERRAL', 'WEBSITE', 'FORM_BUILDER'], default: 'DIRECT' },
  candidateFee: {
    feeType: { type: String, enum: ['FREE', 'PAID'], default: 'FREE' },
    feeAmount: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ['FREE', 'PAID', 'PENDING', 'WAIVED'], default: 'FREE' },
    paymentMethod: { type: String, default: 'UPI' },
    paymentReference: { type: String, default: '' },
    receiptNumber: { type: String, default: '' },
    paidAt: { type: Date }
  },
  customResponses: { type: mongoose.Schema.Types.Mixed, default: {} },
  googleFormResponseId: { type: String, sparse: true, index: true },
  passCode: { type: String, required: true, unique: true, index: true },
  hmacToken: { type: String, required: true, index: true },
  qrToken: { type: String, index: true },
  status: {
    type: String,
    enum: ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW', 'WAITLISTED', 'APPROVED', 'REJECTED'],
    default: 'CONFIRMED',
    index: true
  },
  checkedInAt: { type: Date },
  checkedInBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  checkInMethod: { type: String, enum: ['QR_SCAN', 'MANUAL_SEARCH'], default: 'QR_SCAN' },
  linkedInUrl: { type: String, default: '' },
  instagramUrl: { type: String, default: '' },
  callStatus: {
    type: String,
    enum: ['NOT_CALLED', 'ANSWERED', 'NOT_ANSWERED'],
    default: 'NOT_CALLED',
    index: true
  },
  callNotes: { type: String, default: '' },
  calledAt: { type: Date },
  socialVerificationStatus: {
    type: String,
    enum: ['NOT_SUBMITTED', 'SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED'],
    default: 'NOT_SUBMITTED',
    index: true
  },
  socialVerifiedAt: { type: Date },
  socialVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  socialVerificationNotes: { type: String, default: '' },
  certificateId: { type: String, index: true },
  certificateStatus: { type: String, enum: ['NONE', 'PENDING', 'ISSUED', 'FAILED'], default: 'NONE' },
  certificateGeneratedAt: { type: Date },
  whatsAppStatus: {
    type: String,
    enum: ['NOT_SENT', 'PENDING', 'SENT', 'DELIVERED', 'FAILED', 'PENDING_CONFIGURATION'],
    default: 'NOT_SENT'
  },
  whatsAppSentAt: { type: Date }
}, { timestamps: true });

// Demo session schema
const demoSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true, index: true },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', index: true },
  assignedEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  scheduledAt: { type: Date, required: true, index: true },
  mode: { type: String, enum: ['ONLINE', 'OFFLINE'], default: 'ONLINE' },
  meetingLink: { type: String, default: 'https://meet.google.com/tmt-demo' },
  status: {
    type: String,
    enum: ['DEMO_TO_SCHEDULE', 'DEMO_SCHEDULED', 'REMINDER_SENT', 'ATTENDED', 'NO_SHOW', 'CANCELLED', 'RESCHEDULED'],
    default: 'DEMO_SCHEDULED',
    index: true
  },
  outcome: {
    type: String,
    enum: ['PENDING', 'HIGH_INTEREST', 'NEEDS_FOLLOW_UP', 'ENROLLED', 'REJECTED'],
    default: 'PENDING'
  },
  notes: { type: String, default: '' }
}, { timestamps: true });

export const Lead = mongoose.models.Lead || mongoose.model('Lead', leadSchema);
export const CallActivity = mongoose.models.CallActivity || mongoose.model('CallActivity', callActivitySchema);
export const Bootcamp = mongoose.models.Bootcamp || mongoose.model('Bootcamp', bootcampSchema);
export const Pass = mongoose.models.Pass || mongoose.model('Pass', passSchema);
export const Demo = mongoose.models.Demo || mongoose.model('Demo', demoSchema);
