import { Router } from 'express';
import {
  getLeads,
  createLead,
  getLeadById,
  updateLead,
  addCallActivity,
  getBootcamps,
  getBootcampById,
  addBootcampSlot,
  createBootcamp,
  registerForBootcamp,
  checkInPass,
  getPassById,
  renderPassPdf,
  sendPassCommunication,
  getDemos,
  scheduleDemo,
  recordDemoOutcome,
  uploadBootcampAttachment,
  downloadBootcampAttachment,
  deleteBootcampAttachment,
  updateSocialVerification,
  generateBulkCertificates,
  sendPassCertificate,
  bulkSendCertificates,
  downloadPassCertificate,
  configureBootcampGoogleForm,
  syncBootcampGoogleFormResponses,
  updatePassStatus,
  updatePassCallStatus,
  getPublicBootcampForm,
  submitPublicBootcampForm,
  updateBootcampFormBuilder,
  downloadPassFeeReceipt
} from './growth.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac.js';
import { uploadSingle } from '../../middleware/upload.js';
import { ah } from '../../utils/asyncHandler.js';

const router = Router();

// Public Bootcamp Registration Form & Passes (unauthenticated)
router.get('/bootcamps/:id/public-form', ah(getPublicBootcampForm));
router.post('/bootcamps/:id/public-submit', ah(submitPublicBootcampForm));
router.get('/public/passes/:id/pdf', ah(renderPassPdf));
router.get('/public/passes/:id/receipt', ah(downloadPassFeeReceipt));

router.use(authenticate, requireOrgContext);

// Form Builder & Pass Fee Receipts (authenticated)
router.put('/bootcamps/:id/form-builder', requirePermission('bootcamps.manage'), ah(updateBootcampFormBuilder));
router.get('/passes/:id/receipt', requireAnyPermission('bootcamps.read', 'passes.generate'), ah(downloadPassFeeReceipt));

// Leads
router.get('/leads', requirePermission('leads.read'), ah(getLeads));
router.post('/leads', requirePermission('leads.manage'), ah(createLead));
router.get('/leads/:id', requirePermission('leads.read'), ah(getLeadById));
router.patch('/leads/:id', requirePermission('leads.manage'), ah(updateLead));
router.post('/leads/:id/calls', requirePermission('leads.manage'), ah(addCallActivity));

// Bootcamps & Passes
router.get('/bootcamps', requireAnyPermission('bootcamps.read', 'bootcamps.manage'), ah(getBootcamps));
router.get('/bootcamps/:id', requireAnyPermission('bootcamps.read', 'bootcamps.manage'), ah(getBootcampById));
router.post('/bootcamps', requirePermission('bootcamps.manage'), ah(createBootcamp));
router.post('/bootcamps/:id/slots', requirePermission('bootcamps.manage'), ah(addBootcampSlot));
router.post('/bootcamps/:id/register', requirePermission('passes.generate'), ah(registerForBootcamp));
router.post('/passes/check-in', requireAnyPermission('attendance.mark', 'attendance.manage', 'bootcamps.manage', 'passes.generate'), ah(checkInPass));
router.get('/passes/:id', requireAnyPermission('bootcamps.read', 'passes.generate'), ah(getPassById));
router.get('/passes/:id/pdf', requireAnyPermission('bootcamps.read', 'passes.generate'), ah(renderPassPdf));
router.post('/passes/:id/send', requireAnyPermission('bootcamps.manage', 'passes.generate'), ah(sendPassCommunication));

// Bootcamp Attachments & Media
router.post('/bootcamps/:id/attachments', requirePermission('bootcamps.manage'), uploadSingle('file'), ah(uploadBootcampAttachment));
router.get('/bootcamps/:id/attachments/:attachmentId', requireAnyPermission('bootcamps.read', 'bootcamps.manage'), ah(downloadBootcampAttachment));
router.delete('/bootcamps/:id/attachments/:attachmentId', requirePermission('bootcamps.manage'), ah(deleteBootcampAttachment));

// Passes Social Verification & Bulk Certificates
router.patch('/passes/:id/social-verification', requireAnyPermission('bootcamps.manage', 'passes.generate'), ah(updateSocialVerification));
router.patch('/passes/:id/status', requirePermission('bootcamps.manage'), ah(updatePassStatus));
router.patch('/passes/:id/call-status', requireAnyPermission('bootcamps.manage', 'passes.generate'), ah(updatePassCallStatus));
router.post('/bootcamps/:id/bulk-certificates', requireAnyPermission('certificates.manage', 'bootcamps.manage'), ah(generateBulkCertificates));
router.post('/bootcamps/:id/bulk-send-certificates', requireAnyPermission('certificates.manage', 'bootcamps.manage'), ah(bulkSendCertificates));
router.post('/passes/:id/send-certificate', requireAnyPermission('certificates.manage', 'bootcamps.manage'), ah(sendPassCertificate));
router.get('/passes/:id/certificate', requireAnyPermission('bootcamps.read', 'passes.generate', 'certificates.manage'), ah(downloadPassCertificate));

// Bootcamp Google Forms Integration
router.post('/bootcamps/:id/google-form', requirePermission('bootcamps.manage'), ah(configureBootcampGoogleForm));
router.post('/bootcamps/:id/google-form/sync', requirePermission('bootcamps.manage'), ah(syncBootcampGoogleFormResponses));

// Demos
router.get('/demos', requirePermission('demos.manage'), ah(getDemos));
router.post('/demos', requirePermission('demos.schedule'), ah(scheduleDemo));
router.post('/demos/:id/outcome', requirePermission('demos.manage'), ah(recordDemoOutcome));

export default router;
