import { Router } from 'express';
import {
  checkIn, checkOut, getTodayAttendance, getMyAttendanceHistory, getOrganizationAttendance, getAttendanceSummary, correctAttendance
} from './attendance.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac.js';

const router = Router();

router.use(authenticate, requireOrgContext);

router.post('/check-in', requirePermission('attendance.check_in'), checkIn);
router.post('/check-out', requirePermission('attendance.check_out'), checkOut);
router.get('/today', requirePermission('attendance.read_own'), getTodayAttendance);
router.get('/my-history', requirePermission('attendance.read_own'), getMyAttendanceHistory);
router.get('/summary', requireAnyPermission('attendance.read_own', 'attendance.read'), getAttendanceSummary);
router.get('/overview', requirePermission('attendance.read'), getOrganizationAttendance);
router.patch('/:id', requirePermission('attendance.manage'), correctAttendance);

export default router;
