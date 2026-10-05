import { Router } from 'express';
import {
  getTemplates, getTemplateById, createTemplateVersion, previewTemplate, renderPDFPreviewEndpoint, seedTemplates
} from './template.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';

const router = Router();

router.use(authenticate, requireOrgContext);

router.post('/seed', requirePermission('templates.manage'), seedTemplates);
router.get('/', requirePermission('templates.read'), getTemplates);
router.post('/', requirePermission('templates.manage'), createTemplateVersion);
router.get('/:id/pdf-preview', requirePermission('templates.read'), renderPDFPreviewEndpoint);
router.post('/:id/preview', requirePermission('templates.read'), previewTemplate);
router.get('/:id', requirePermission('templates.read'), getTemplateById);

export default router;
