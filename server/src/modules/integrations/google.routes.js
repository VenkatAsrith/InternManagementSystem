import { Router } from 'express';
import {
  getGoogleIntegrationStatus,
  connectGoogleIntegration,
  disconnectGoogleIntegration,
  createInstantGoogleMeet
} from './google.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac.js';

const router = Router();

router.use(authenticate, requireOrgContext);

router.get('/status', requireAnyPermission('settings.manage', 'meetings.read', 'meetings.manage'), getGoogleIntegrationStatus);
router.post('/connect', requireAnyPermission('settings.manage', 'meetings.manage'), connectGoogleIntegration);
router.post('/disconnect', requireAnyPermission('settings.manage', 'meetings.manage'), disconnectGoogleIntegration);
router.post('/instant-meet', requireAnyPermission('meetings.manage', 'meetings.read', 'settings.manage'), createInstantGoogleMeet);

export default router;
