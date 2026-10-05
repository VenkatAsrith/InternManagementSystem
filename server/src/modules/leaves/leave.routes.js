import { Router } from 'express';
import { requestLeave, getLeaves, getMyLeaves, reviewLeave, cancelLeave } from './leave.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';

const router = Router();

router.use(authenticate, requireOrgContext);

// Intern self-service
router.post('/request', requirePermission('leaves.request'), requestLeave);
router.get('/me', requirePermission('leaves.read_own'), getMyLeaves);
router.post('/:id/cancel', requirePermission('leaves.request'), cancelLeave);

// Management (mentors are limited to their own mentees inside the controller)
router.get('/', requirePermission('leaves.read'), getLeaves);
router.patch('/:id/review', requirePermission('leaves.review'), reviewLeave);

export default router;
