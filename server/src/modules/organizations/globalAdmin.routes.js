import { Router } from 'express';
import {
  getGlobalAdminOverview,
  getGlobalOrganizations,
  createOrganization,
  updateOrganizationStatus,
  getGlobalUsers,
  updateUserAccountStatus,
  createGlobalUser,
  getGlobalPendingRegistrations,
  approveGlobalRegistration,
  rejectGlobalRegistration
} from './globalAdmin.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { ROLES } from '../../../../shared/constants.js';

const router = Router();

// Strictly locked to SUPER_ADMIN
router.use(authenticate, requireRole(ROLES.SUPER_ADMIN));

router.get('/overview', getGlobalAdminOverview);
router.get('/organizations', getGlobalOrganizations);
router.post('/organizations', createOrganization);
router.patch('/organizations/:id/status', updateOrganizationStatus);

router.get('/pending-registrations', getGlobalPendingRegistrations);
router.post('/users/:id/approve-registration', approveGlobalRegistration);
router.post('/users/:id/reject-registration', rejectGlobalRegistration);

router.get('/users', getGlobalUsers);
router.post('/users', createGlobalUser);
router.patch('/users/:id/status', updateUserAccountStatus);

export default router;
