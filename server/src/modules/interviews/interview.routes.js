import { Router } from 'express';
import {
  scheduleInterview, getInterviews, getInterviewById, submitInterviewFeedback, updateInterviewStatus, rescheduleInterview
} from './interview.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';

const router = Router();

router.use(authenticate, requireOrgContext);

router.get('/', requirePermission('interviews.read'), getInterviews);
router.post('/', requirePermission('interviews.schedule'), scheduleInterview);
router.get('/:id', requirePermission('interviews.read'), getInterviewById);
router.post('/:id/feedback', requirePermission('interviews.feedback'), submitInterviewFeedback);
router.post('/:id/reschedule', requirePermission('interviews.schedule'), rescheduleInterview);
router.patch('/:id/status', requirePermission('interviews.schedule'), updateInterviewStatus);

export default router;
