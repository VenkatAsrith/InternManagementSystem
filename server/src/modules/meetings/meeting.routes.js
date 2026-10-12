import { Router } from 'express';
import { getMeetings, getMeetingById, createMeeting, addMeetingActionItem, rescheduleMeeting, updateMeetingStatus } from './meeting.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac.js';

const router = Router();

router.use(authenticate, requireOrgContext);

router.get('/', requireAnyPermission('meetings.read', 'meetings.read_own'), getMeetings);
router.get('/:id', requireAnyPermission('meetings.read', 'meetings.read_own'), getMeetingById);
router.post('/', requirePermission('meetings.manage'), createMeeting);
router.post('/:id/reschedule', requirePermission('meetings.manage'), rescheduleMeeting);
router.patch('/:id/status', requirePermission('meetings.manage'), updateMeetingStatus);
router.post('/:id/action-items', requirePermission('meetings.manage'), addMeetingActionItem);

export default router;
