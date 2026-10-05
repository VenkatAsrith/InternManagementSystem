import { Router } from 'express';
import { getOnboardingPlans, getOnboardingPlanById, getMyOnboardingPlan, updateOnboardingTask } from './onboarding.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac.js';

const router = Router();

router.use(authenticate, requireOrgContext);

router.get('/', requirePermission('onboarding.read'), getOnboardingPlans);
router.get('/my-plan', requirePermission('onboarding.read_own'), getMyOnboardingPlan);
router.get('/:id', requirePermission('onboarding.read'), getOnboardingPlanById);
router.patch('/tasks/:id', requireAnyPermission('onboarding.manage', 'onboarding.update_own'), updateOnboardingTask);

export default router;
