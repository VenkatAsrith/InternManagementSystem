import mongoose from 'mongoose';
import { ONBOARDING_STATUS } from '../../../../shared/constants.js';

const onboardingTaskSchema = new mongoose.Schema({
  onboardingPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'OnboardingPlan', required: true, index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  key: { type: String },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  owner: { type: String, enum: ['INTERN', 'HR', 'ADMIN', 'MENTOR'], default: 'INTERN' },
  status: {
    type: String,
    enum: Object.values(ONBOARDING_STATUS),
    default: ONBOARDING_STATUS.PENDING
  },
  required: { type: Boolean, default: true },
  dueDate: { type: Date },
  completedAt: { type: Date },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String, default: '' },
  // Document tasks are completed by the document lifecycle: upload -> IN_PROGRESS, HR approval -> COMPLETED,
  // HR rejection -> back to PENDING with the reason in `notes`.
  documentType: { type: String },
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' }
}, { timestamps: true });

const onboardingPlanSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', index: true, sparse: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' },
  internId: { type: mongoose.Schema.Types.ObjectId, ref: 'Intern', index: true },
  offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
  status: {
    type: String,
    enum: Object.values(ONBOARDING_STATUS),
    default: ONBOARDING_STATUS.IN_PROGRESS,
    index: true
  },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
}, { timestamps: true });

export const OnboardingPlan = mongoose.models.OnboardingPlan || mongoose.model('OnboardingPlan', onboardingPlanSchema);
export const OnboardingTask = mongoose.models.OnboardingTask || mongoose.model('OnboardingTask', onboardingTaskSchema);

// Default checklist seeded into every plan (10 items, all required).
export const DEFAULT_ONBOARDING_TASKS = [
  { key: 'GOV_ID', title: 'Submit Government ID Proof', description: 'Upload a valid government issued photo identification document.', owner: 'INTERN', documentType: 'ID_PROOF', required: true },
  { key: 'COLLEGE_ID', title: 'Submit College/University ID Card', description: 'Upload verified student identity card or bona fide certificate.', owner: 'INTERN', documentType: 'COLLEGE_ID', required: true },
  { key: 'TRANSCRIPTS', title: 'Submit Academic Transcripts', description: 'Upload your latest semester grade sheet or cumulative transcript.', owner: 'INTERN', documentType: 'OTHER', required: true },
  { key: 'AGREEMENT', title: 'Sign Internship Agreement', description: 'Upload the signed terms of the internship appointment.', owner: 'INTERN', documentType: 'AGREEMENT', required: true },
  { key: 'NDA', title: 'Sign Non-Disclosure Agreement (NDA)', description: 'Upload the signed confidentiality and intellectual property agreement.', owner: 'INTERN', documentType: 'NDA', required: true },
  { key: 'PROFILE', title: 'Complete Intern Profile', description: 'Confirm your emergency contacts, GitHub link and personal information.', owner: 'INTERN', required: true },
  { key: 'ORIENTATION', title: 'Complete Orientation Briefing', description: 'Attend company overview and engineering culture onboarding.', owner: 'HR', required: true },
  { key: 'ACCESS', title: 'Provision Developer Account & Access', description: 'Setup corporate email, GitHub organization, and Slack access.', owner: 'ADMIN', required: true },
  { key: 'MENTOR_1ON1', title: 'First 1-on-1 with Assigned Mentor', description: 'Introductory call to align on expectations and working hours.', owner: 'HR', required: true },
  { key: 'FIRST_TASK', title: 'Receive Project & Initial Task Assignment', description: 'Get assigned to your first milestone project and tasks.', owner: 'HR', required: true }
];
