import { Router } from 'express';
import { getInterns, createIntern, getMyInternProfile, getInternById, updateIntern, getInternTimeline, getInternWorkRecord } from './intern.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac.js';

const router = Router();

router.use(authenticate, requireOrgContext);

router.get('/me', requireAnyPermission('interns.read_own', 'interns.read'), getMyInternProfile);
router.get('/', requirePermission('interns.read'), getInterns);
router.post('/', requireAnyPermission('interns.update', 'interns.manage'), createIntern);
// Detail views are open to staff (scoped inside the controller) and to the intern themself.
router.get('/:id', requireAnyPermission('interns.read', 'interns.read_own'), getInternById);
router.patch('/:id', requirePermission('interns.update'), updateIntern);
router.get('/:id/timeline', requireAnyPermission('interns.read', 'interns.read_own'), getInternTimeline);
router.get('/:id/work-record', requireAnyPermission('interns.read', 'interns.read_own'), getInternWorkRecord);

export default router;
