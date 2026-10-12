import { Router } from 'express';
import {
  getInterns,
  createIntern,
  getMyInternProfile,
  getInternById,
  updateIntern,
  getInternTimeline,
  getInternWorkRecord,
  resetInternPassword,
  assignInternProject,
  assignInternDocumentTask,
  getInternDocumentsList
} from './intern.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac.js';

const router = Router();

router.use(authenticate, requireOrgContext);

router.get('/me', requireAnyPermission('interns.read_own', 'interns.read'), getMyInternProfile);
router.get('/', requirePermission('interns.read'), getInterns);
router.post('/', requireAnyPermission('interns.update', 'interns.manage'), createIntern);

// Password Reset & Management
router.post('/:id/reset-password', requireAnyPermission('interns.update', 'interns.manage', 'users.manage'), resetInternPassword);

// Project Assignment
router.post('/:id/assign-project', requireAnyPermission('interns.update', 'projects.manage', 'interns.manage'), assignInternProject);

// Documents Assignment & Listing
router.post('/:id/assign-document', requireAnyPermission('interns.update', 'documents.manage', 'interns.manage'), assignInternDocumentTask);
router.get('/:id/documents', requireAnyPermission('interns.read', 'documents.read'), getInternDocumentsList);

// Detail views are open to staff (scoped inside the controller) and to the intern themself.
router.get('/:id', requireAnyPermission('interns.read', 'interns.read_own'), getInternById);
router.patch('/:id', requirePermission('interns.update'), updateIntern);
router.get('/:id/timeline', requireAnyPermission('interns.read', 'interns.read_own'), getInternTimeline);
router.get('/:id/work-record', requireAnyPermission('interns.read', 'interns.read_own'), getInternWorkRecord);

export default router;
