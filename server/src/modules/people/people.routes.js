import { Router } from 'express';
import {
  getPeople,
  createPerson,
  getPersonById,
  updatePerson,
  mergePeople,
  getPersonTimeline
} from './people.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { ah } from '../../utils/asyncHandler.js';

const router = Router();

router.use(authenticate, requireOrgContext);

router.get('/', requirePermission('people.read'), ah(getPeople));
router.post('/', requirePermission('people.create'), ah(createPerson));
router.get('/:id', requirePermission('people.read'), ah(getPersonById));
router.patch('/:id', requirePermission('people.update'), ah(updatePerson));
router.post('/:id/merge', requirePermission('people.merge'), ah(mergePeople));
router.get('/:id/timeline', requirePermission('people.read'), ah(getPersonTimeline));

export default router;
