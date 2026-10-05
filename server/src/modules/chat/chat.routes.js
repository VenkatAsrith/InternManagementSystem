import { Router } from 'express';
import {
  getConversations,
  createConversation,
  getConversationById,
  getMessages,
  sendMessage,
  markAsRead,
  getAvailableUsers,
  uploadAttachment,
  getAttachment
} from './chat.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { uploadSingle } from '../../middleware/upload.js';
import { ah } from '../../utils/asyncHandler.js';

const router = Router();

router.use(authenticate, requireOrgContext);

router.get('/conversations', ah(getConversations));
router.post('/conversations', ah(createConversation));
router.get('/conversations/:id', ah(getConversationById));
router.get('/conversations/:id/messages', ah(getMessages));
router.post('/conversations/:id/messages', uploadSingle('attachment'), ah(sendMessage));
router.post('/conversations/:id/read', ah(markAsRead));
router.get('/peers', ah(getAvailableUsers));
router.get('/users', ah(getAvailableUsers));
router.post('/upload', uploadSingle('file'), ah(uploadAttachment));
router.get('/attachment/:fileName', ah(getAttachment));

export default router;
