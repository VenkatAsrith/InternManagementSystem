import { Router } from 'express';
import { getDashboardAnalytics } from './analytics.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';

const router = Router();

router.use(authenticate, requireOrgContext);
router.get('/dashboard', requirePermission('analytics.read'), getDashboardAnalytics);

export default router;
