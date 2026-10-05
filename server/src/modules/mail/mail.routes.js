import { Router } from 'express';
import {
  getMailboxes,
  createMailbox,
  grantMailboxAccess,
  getMailboxMessages,
  sendMessage
} from './mail.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { ah } from '../../utils/asyncHandler.js';

const router = Router();

router.use(authenticate, requireOrgContext);

router.get('/', ah(getMailboxes));
router.post('/', requirePermission('settings.manage'), ah(createMailbox));
router.post('/:id/grants', requirePermission('settings.manage'), ah(grantMailboxAccess));
router.get('/:id/messages', ah(getMailboxMessages));
router.post('/:id/messages/send', ah(sendMessage));

export default router;
