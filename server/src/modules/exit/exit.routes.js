import { Router } from 'express';
import { initiateExit, getExits, getExitById, getMyExit, advanceExit, cancelExit } from './exit.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac.js';

const router = Router();

router.use(authenticate, requireOrgContext);

router.get('/mine', requirePermission('exit.read_own'), getMyExit);
router.get('/', requirePermission('exit.read'), getExits);
router.get('/:id', requirePermission('exit.read'), getExitById);
router.post('/initiate', requirePermission('exit.initiate'), initiateExit);
// Stage-level permission (handover / finance / documents / manage) is enforced inside the controller because
// it depends on WHICH stage the exit is currently in. Any exit-capable role may call the endpoint.
router.post('/:id/advance', requireAnyPermission('exit.manage', 'exit.handover', 'exit.finance', 'exit.documents'), advanceExit);
router.post('/:id/cancel', requirePermission('exit.initiate'), cancelExit);

export default router;
