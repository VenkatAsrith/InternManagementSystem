import mongoose from 'mongoose';
import { PERFORMANCE_REVIEW_TYPE, PERFORMANCE_REVIEW_STATUS } from '../../../../shared/constants.js';

const metricScoreSchema = new mongoose.Schema({
  metricName: { type: String, required: true },
  weightPercent: { type: Number, default: 0 }, // e.g. 20
  score: { type: Number, min: 0, max: 10, default: 0 }, // score out of 10
  comments: { type: String, default: '' }
});

const performanceReviewSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  internId: { type: mongoose.Schema.Types.ObjectId, ref: 'Intern', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  cycleTitle: { type: String, default: 'Standard Internship Evaluation' },
  type: {
    type: String,
    enum: Object.values(PERFORMANCE_REVIEW_TYPE),
    default: PERFORMANCE_REVIEW_TYPE.MID_TERM,
    index: true
  },
  metrics: [metricScoreSchema],
  selfAssessment: {
    scores: [metricScoreSchema],
    strengths: { type: String, default: '' },
    growthAreas: { type: String, default: '' },
    generalComments: { type: String, default: '' },
    submittedAt: { type: Date }
  },
  mentorAssessment: {
    scores: [metricScoreSchema],
    feedback: { type: String, default: '' },
    evaluatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    submittedAt: { type: Date }
  },
  managerReview: {
    comments: { type: String, default: '' },
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date }
  },
  finalScore: { type: Number, default: 0 }, // Out of 10
  status: {
    type: String,
    enum: Object.values(PERFORMANCE_REVIEW_STATUS),
    default: PERFORMANCE_REVIEW_STATUS.SELF_ASSESSMENT_PENDING,
    index: true
  },
  finalizedAt: { type: Date }
}, { timestamps: true });

performanceReviewSchema.index({ organizationId: 1, internId: 1, type: 1 });

export const PerformanceReview = mongoose.models.PerformanceReview || mongoose.model('PerformanceReview', performanceReviewSchema);
