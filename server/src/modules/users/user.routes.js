import { Router } from 'express';
import { getUsers, createUser, updateUser, deactivateUser, reactivateUser, getPendingRegistrations, approveRegistration, rejectRegistration } from './user.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';

const router = Router();

router.use(authenticate, requireOrgContext);

router.get('/pending-registrations', requirePermission('users.read'), getPendingRegistrations);
router.post('/:id/approve-registration', requirePermission('users.manage'), approveRegistration);
router.post('/:id/reject-registration', requirePermission('users.manage'), rejectRegistration);

router.get('/', requirePermission('users.read'), getUsers);
router.post('/', requirePermission('users.create'), createUser);
router.patch('/:id', requirePermission('users.manage'), updateUser);
router.post('/:id/deactivate', requirePermission('users.manage'), deactivateUser);
router.post('/:id/reactivate', requirePermission('users.manage'), reactivateUser);

export default router;
