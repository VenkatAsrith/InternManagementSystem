import { Router } from 'express';
import {
  getGoogleIntegrationStatus,
  getGoogleOAuthUrl,
  handleGoogleOAuthCallback,
  disconnectGoogleIntegration,
  createInstantGoogleMeet
} from './google.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requireAnyPermission } from '../../middleware/rbac.js';

const router = Router();

// Public OAuth callback receiver (Google redirects the admin's browser here directly)
router.get('/oauth-callback', handleGoogleOAuthCallback);
router.get('/callback', handleGoogleOAuthCallback);

// Authenticated integration routes
router.use(authenticate, requireOrgContext);

router.get('/status', requireAnyPermission('settings.manage', 'meetings.read', 'meetings.manage'), getGoogleIntegrationStatus);
router.get('/auth-url', requireAnyPermission('settings.manage', 'meetings.manage'), getGoogleOAuthUrl);
router.post('/disconnect', requireAnyPermission('settings.manage', 'meetings.manage'), disconnectGoogleIntegration);
router.post('/instant-meet', requireAnyPermission('meetings.manage', 'meetings.read', 'settings.manage'), createInstantGoogleMeet);

export default router;
