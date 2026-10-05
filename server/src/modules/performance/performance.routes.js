import { Router } from 'express';
import {
  createPerformanceReview, getPerformanceReviews, getPerformanceReviewById,
  submitSelfAssessment, submitMentorAssessment, finalizePerformanceReview
} from './performance.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac.js';

const router = Router();

router.use(authenticate, requireOrgContext);

// One canonical URL per action (the previous build exposed every route twice).
router.post('/reviews', requirePermission('performance.manage'), createPerformanceReview);
router.get('/reviews', requireAnyPermission('performance.read', 'performance.read_own'), getPerformanceReviews);
router.get('/reviews/:id', requireAnyPermission('performance.read', 'performance.read_own'), getPerformanceReviewById);
router.post('/reviews/:id/self-assessment', requirePermission('performance.self_assess'), submitSelfAssessment);
router.post('/reviews/:id/mentor-assessment', requirePermission('performance.review'), submitMentorAssessment);
router.post('/reviews/:id/finalize', requirePermission('performance.manage'), finalizePerformanceReview);

export default router;
