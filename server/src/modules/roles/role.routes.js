import { Router } from 'express';
import {
  getRoles, getPermissionCatalog, createCustomRole, updateCustomRole, archiveRole, deleteRole,
  previewRoleChange, assignUserRole, getUserRoleHistory
} from './role.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('roles.read'), getRoles);
router.get('/catalog/permissions', requirePermission('roles.read'), getPermissionCatalog);
router.get('/users/:userId/history', requirePermission('roles.read'), getUserRoleHistory);

router.post('/preview-change', requirePermission('roles.assign'), previewRoleChange);
router.post('/assign', requirePermission('roles.assign'), assignUserRole);

router.post('/', requirePermission('roles.manage'), createCustomRole);
router.patch('/:id', requirePermission('roles.manage'), updateCustomRole);
router.post('/:id/archive', requirePermission('roles.manage'), archiveRole);
router.delete('/:id', requirePermission('roles.manage'), deleteRole);

export default router;
