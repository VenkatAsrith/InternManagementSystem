import { Router } from 'express';
import {
  login, getCurrentUser, refreshAccessToken, changePassword, logout, logoutAll,
  setupPassword, register, getPublicOrganizations, getInvitationInfo,
  switchOrPreviewRole, exitRolePreview
} from './auth.controller.js';
import { authenticate, optionalAuthenticate } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

router.post('/login', authLimiter, login);
router.post('/register', authLimiter, register);
router.get('/organizations/public', getPublicOrganizations);
router.get('/invitation-info', authLimiter, getInvitationInfo);
router.post('/refresh', authLimiter, refreshAccessToken);
router.post('/setup-password', authLimiter, setupPassword);
router.post('/logout', optionalAuthenticate, logout);
router.post('/logout-all', authenticate, logoutAll);
router.get('/me', authenticate, getCurrentUser);
router.post('/change-password', authenticate, changePassword);
router.post('/switch-role', authenticate, switchOrPreviewRole);
router.post('/exit-preview', authenticate, exitRolePreview);

export default router;
