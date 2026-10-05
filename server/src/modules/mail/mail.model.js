import mongoose from 'mongoose';

const mailboxSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true, trim: true },
  emailAddress: { type: String, required: true, lowercase: true, trim: true },
  provider: { type: String, default: 'smtp' },
  isActive: { type: Boolean, default: true },
  // Sensitive credentials (SMTP password etc.) are marked select: false so they never leak in queries
  smtpHost: { type: String, default: 'smtp.techmecha.internal' },
  smtpUser: { type: String, default: '' },
  smtpPassEncrypted: { type: String, select: false }
}, { timestamps: true });

mailboxSchema.index({ organizationId: 1, emailAddress: 1 }, { unique: true });

const mailboxAccessGrantSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  mailboxId: { type: mongoose.Schema.Types.ObjectId, ref: 'Mailbox', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  canRead: { type: Boolean, default: true },
  canSend: { type: Boolean, default: false },
  canReply: { type: Boolean, default: false }
}, { timestamps: true });

mailboxAccessGrantSchema.index({ mailboxId: 1, userId: 1 }, { unique: true });

const emailMessageSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  mailboxId: { type: mongoose.Schema.Types.ObjectId, ref: 'Mailbox', required: true, index: true },
  sender: { type: String, required: true },
  recipient: { type: String, required: true },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  direction: { type: String, enum: ['INBOUND', 'OUTBOUND'], default: 'OUTBOUND' },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sentAt: { type: Date, default: Date.now }
}, { timestamps: true });

export const Mailbox = mongoose.models.Mailbox || mongoose.model('Mailbox', mailboxSchema);
export const MailboxAccessGrant = mongoose.models.MailboxAccessGrant || mongoose.model('MailboxAccessGrant', mailboxAccessGrantSchema);
export const EmailMessage = mongoose.models.EmailMessage || mongoose.model('EmailMessage', emailMessageSchema);
