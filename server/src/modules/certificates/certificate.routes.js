import { Router } from 'express';
import {
  checkCompletionReadiness, generateCertificate, getCertificates, downloadCertificatePDF,
  sendCertificate, revokeCertificate, verifyPublicCertificate
} from './certificate.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac.js';
import { publicLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

// Public verification endpoint (no login)
router.get('/verify/:certificateId', publicLimiter, verifyPublicCertificate);

router.use(authenticate, requireOrgContext);

router.get('/readiness/:internId', requirePermission('certificates.read'), checkCompletionReadiness);
router.post('/generate', requirePermission('certificates.issue'), generateCertificate);
router.get('/', requireAnyPermission('certificates.read', 'certificates.read_own'), getCertificates);
router.get('/:id/download', requireAnyPermission('certificates.read', 'certificates.read_own'), downloadCertificatePDF);
router.post('/:id/send', requirePermission('certificates.issue'), sendCertificate);
router.post('/:id/revoke', requirePermission('certificates.revoke'), revokeCertificate);

export default router;
