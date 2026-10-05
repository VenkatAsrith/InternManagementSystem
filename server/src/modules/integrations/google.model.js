import mongoose from 'mongoose';

const googleIntegrationSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    unique: true,
    index: true
  },
  isConnected: {
    type: Boolean,
    default: false,
    index: true
  },
  accountEmail: {
    type: String,
    trim: true,
    lowercase: true,
    default: ''
  },
  scope: [{
    type: String
  }],
  // Secure server-side credential storage; never returned to frontend
  tokens: {
    accessToken: { type: String, select: false },
    refreshToken: { type: String, select: false },
    expiryDate: { type: Date, select: false },
    tokenType: { type: String, default: 'Bearer', select: false }
  },
  calendarId: {
    type: String,
    default: 'primary'
  },
  meetAvailable: {
    type: Boolean,
    default: true
  },
  connectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  connectedAt: {
    type: Date
  },
  lastRefreshedAt: {
    type: Date
  },
  lastError: {
    type: String,
    default: ''
  }
}, { timestamps: true });

// Transform to safely return public integration status without leaking tokens
googleIntegrationSchema.methods.toSafeStatus = function() {
  return {
    isConnected: !!this.isConnected,
    accountEmail: this.accountEmail || '',
    calendarConnected: !!this.isConnected,
    meetAvailable: !!this.meetAvailable && !!this.isConnected,
    connectedAt: this.connectedAt || null,
    connectedBy: this.connectedBy || null,
    lastRefreshedAt: this.lastRefreshedAt || null,
    lastError: this.lastError || ''
  };
};

export const GoogleIntegration = mongoose.models.GoogleIntegration || mongoose.model('GoogleIntegration', googleIntegrationSchema);
