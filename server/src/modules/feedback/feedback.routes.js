import { Router } from 'express';
import { getFeedback, createFeedback } from './feedback.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac.js';

const router = Router();

router.use(authenticate, requireOrgContext);

router.get('/', requireAnyPermission('feedback.read', 'feedback.read_own'), getFeedback);
router.post('/', requirePermission('feedback.create'), createFeedback);

export default router;
