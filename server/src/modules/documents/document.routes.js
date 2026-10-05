import { Router } from 'express';
import {
  uploadDocument, getDocuments, getDocumentById, downloadDocument, approveDocument, rejectDocument, deleteDocument,
  generateDocument, sendDocument, revokeDocument, verifyPublicDocument
} from './document.controller.js';
import {
  getComplianceDashboard, getRequirementTemplates, createRequirementTemplate,
  assignRequirementTemplate, getMyRequirements, getInternRequirements,
  uploadRequirementDocument, reviewDocumentRequirement
} from './documentRequirement.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac.js';
import { uploadSingle } from '../../middleware/upload.js';
import { publicLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

// Public authenticity check (no login, no private data)
router.get('/verify/:documentId', publicLimiter, verifyPublicDocument);

router.use(authenticate, requireOrgContext);

router.post('/upload', requirePermission('documents.upload'), uploadSingle('file'), uploadDocument);
router.get('/', requireAnyPermission('documents.read', 'documents.read_own'), getDocuments);

// Document Requirement Templates & Compliance Workflow
router.get('/requirements/compliance', requirePermission('documents.read'), getComplianceDashboard);
router.get('/requirements/templates', requirePermission('documents.read'), getRequirementTemplates);
router.post('/requirements/templates', requirePermission('documents.approve'), createRequirementTemplate);
router.post('/requirements/assign', requirePermission('documents.approve'), assignRequirementTemplate);
router.get('/requirements/my', requireAnyPermission('documents.read_own', 'documents.read'), getMyRequirements);
router.get('/requirements/intern/:internId', requirePermission('documents.read'), getInternRequirements);
router.post('/requirements/:id/upload', requireAnyPermission('documents.upload', 'documents.read_own'), uploadSingle('file'), uploadRequirementDocument);
router.post('/requirements/:id/review', requirePermission('documents.approve'), reviewDocumentRequirement);

router.get('/:id', requireAnyPermission('documents.read', 'documents.read_own'), getDocumentById);
router.get('/:id/download', requireAnyPermission('documents.read', 'documents.read_own'), downloadDocument);
router.post('/generate', requirePermission('documents.generate'), generateDocument);
router.post('/:id/send', requirePermission('documents.generate'), sendDocument);
router.post('/:id/revoke', requirePermission('documents.generate'), revokeDocument);
router.post('/:id/approve', requirePermission('documents.approve'), approveDocument);
router.post('/:id/reject', requirePermission('documents.approve'), rejectDocument);
router.delete('/:id', requireAnyPermission('documents.upload', 'documents.approve'), deleteDocument);

export default router;
