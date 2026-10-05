import mongoose from 'mongoose';
import { COMPENSATION_TYPE, PAYMENT_STATUS, LEDGER_ENTRY_TYPE } from '../../../../shared/constants.js';

// Compensation structure per intern
const compensationPlanSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  internId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Intern',
    required: true,
    index: true
  },
  compensationType: {
    type: String,
    enum: Object.values(COMPENSATION_TYPE),
    default: COMPENSATION_TYPE.MONTHLY_STIPEND
  },
  baseAmount: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true
  },
  paymentFrequency: {
    type: String,
    enum: ['MONTHLY', 'BI_WEEKLY', 'MILESTONE_BASED', 'ONE_TIME'],
    default: 'MONTHLY'
  },
  effectiveFrom: {
    type: Date,
    default: Date.now
  },
  effectiveTo: {
    type: Date
  },
  bankDetails: {
    accountHolderName: String,
    accountNumberMasked: String, // Masked for privacy (§81)
    bankName: String,
    ifscOrRoutingCode: String
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Master payment cycle record
const paymentSchema = new mongoose.Schema({
  paymentId: {
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
    required: true,
    index: true
  },
  cycle: {
    type: String, // e.g. "2026-09" or "September 2026"
    required: true,
    index: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  // Server-computed payroll breakdown (never supplied by the browser)
  workingDays: { type: Number, default: 0, min: 0 },
  activeDays: { type: Number, default: 0, min: 0 },
  lopDays: { type: Number, default: 0, min: 0 },
  absentDays: { type: Number, default: 0, min: 0 },
  payableDays: { type: Number, default: 0, min: 0 },
  hoursWorked: { type: Number, default: 0, min: 0 },
  compensationType: { type: String, enum: Object.values(COMPENSATION_TYPE) },
  baseAmount: { type: Number, default: 0, min: 0 },
  grossAmount: {
    type: Number,
    required: true,
    min: 0
  },
  totalDeductions: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAdditions: {
    type: Number,
    default: 0,
    min: 0
  },
  netPayable: {
    type: Number,
    required: true,
    min: 0
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true
  },
  status: {
    type: String,
    enum: Object.values(PAYMENT_STATUS),
    default: PAYMENT_STATUS.PENDING,
    index: true
  },
  paymentMethod: {
    type: String,
    enum: ['BANK_TRANSFER', 'DIRECT_DEPOSIT', 'UPI', 'CHECK', 'OTHER', 'N/A'],
    default: 'BANK_TRANSFER'
  },
  paymentReference: {
    type: String,
    trim: true
  },
  paidAt: {
    type: Date
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate stipend cycle runs for the same intern
paymentSchema.index({ organizationId: 1, internId: 1, cycle: 1 }, { unique: true });
// A bank/UTR reference can only ever settle ONE payment.
paymentSchema.index({ organizationId: 1, paymentReference: 1 }, { unique: true, sparse: true });

// Immutable financial ledger entry (§4: Never simply overwrite financial amounts)
const paymentLedgerSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: true,
    index: true
  },
  internId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Intern',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: Object.values(LEDGER_ENTRY_TYPE),
    required: true
  },
  amount: {
    type: Number,
    required: true // Positive for additions, negative or separate for deductions
  },
  currency: {
    type: String,
    default: 'INR'
  },
  description: {
    type: String,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

const paymentTransactionSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    index: true
  },
  transactionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  providerPaymentId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  personId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Person',
    index: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'],
    default: 'SUCCESS'
  },
  provider: {
    type: String,
    default: 'RAZORPAY'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

export const CompensationPlan = mongoose.models.CompensationPlan || mongoose.model('CompensationPlan', compensationPlanSchema);
export const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
export const PaymentLedger = mongoose.models.PaymentLedger || mongoose.model('PaymentLedger', paymentLedgerSchema);
export const PaymentTransaction = mongoose.models.PaymentTransaction || mongoose.model('PaymentTransaction', paymentTransactionSchema);

