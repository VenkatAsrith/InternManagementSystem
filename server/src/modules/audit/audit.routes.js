import { Router } from 'express';
import { getAuditLogs, exportAuditLogs } from './audit.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';

const router = Router();

router.use(authenticate, requireOrgContext);
// AUDITOR (whose whole job this is) previously had no route access at all.
router.get('/', requirePermission('audit.read'), getAuditLogs);
router.get('/export', requirePermission('audit.read'), exportAuditLogs);

export default router;
