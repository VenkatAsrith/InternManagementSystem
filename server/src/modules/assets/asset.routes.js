import { Router } from 'express';
import { createAsset, getAssets, assignAsset, returnAsset, getMyAssets } from './asset.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';

const router = Router();

router.use(authenticate, requireOrgContext);

router.get('/me', requirePermission('assets.read_own'), getMyAssets);
router.get('/', requirePermission('assets.read'), getAssets);
router.post('/', requirePermission('assets.manage'), createAsset);
router.post('/:id/assign', requirePermission('assets.manage'), assignAsset);
router.post('/:id/return', requirePermission('assets.manage'), returnAsset);

export default router;
