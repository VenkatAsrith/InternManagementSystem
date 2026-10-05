import { Router } from 'express';
import {
  getOrganizations, getCurrentOrganization, updateOrganization,
  getDepartments, createDepartment, updateDepartment, archiveDepartment, restoreDepartment
} from './organization.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requireRole, requirePermission } from '../../middleware/rbac.js';
import { ROLES } from '../../../../shared/constants.js';

const router = Router();

router.use(authenticate);

// Platform-level list of tenants (used by the tenant switcher). SUPER_ADMIN only.
router.get('/', requireRole(ROLES.SUPER_ADMIN), getOrganizations);

router.use(requireOrgContext);
router.get('/current', getCurrentOrganization);
router.patch('/current', requirePermission('settings.manage'), updateOrganization);

router.get('/departments', requirePermission('departments.read'), getDepartments);
router.post('/departments', requirePermission('departments.manage'), createDepartment);
router.patch('/departments/:id', requirePermission('departments.manage'), updateDepartment);
router.post('/departments/:id/archive', requirePermission('departments.manage'), archiveDepartment);
router.post('/departments/:id/restore', requirePermission('departments.manage'), restoreDepartment);

export default router;
