import { Router } from 'express';
import {
  getPayments, getPaymentById, createCompensationPlan, generateCyclePayments, addAdjustment, processPayment,
  changePaymentStatus, getInternFinancialSummary, getFinanceSummary, downloadPayslip, handlePaymentWebhook
} from './finance.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac.js';

const router = Router();

// Public / webhook receiver for payment gateways (idempotent)
router.post('/payments/webhook', handlePaymentWebhook);

router.use(authenticate, requireOrgContext);

// One canonical URL per action.
router.get('/me', requirePermission('finance.read_own'), getInternFinancialSummary);
router.get('/summary', requireAnyPermission('finance.read'), getFinanceSummary);
router.get('/intern-summary', requirePermission('finance.read'), getInternFinancialSummary);

router.get('/payments', requirePermission('finance.read'), getPayments);
router.get('/payments/:id', requireAnyPermission('finance.read', 'finance.read_own'), getPaymentById);
router.get('/payments/:id/payslip', requireAnyPermission('finance.read', 'finance.read_own'), downloadPayslip);

router.post('/compensation', requirePermission('finance.manage'), createCompensationPlan);
router.post('/generate-cycle', requirePermission('finance.manage'), generateCyclePayments);
router.post('/payments/:id/adjustments', requirePermission('finance.manage'), addAdjustment);
router.post('/payments/:id/status', requirePermission('finance.manage'), changePaymentStatus);
router.post('/payments/:id/process', requirePermission('finance.process'), processPayment);

export default router;
