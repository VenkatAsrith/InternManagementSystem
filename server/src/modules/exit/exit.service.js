import { Exit } from './exit.model.js';
import { Task } from '../tasks/task.model.js';
import { Asset } from '../assets/asset.model.js';
import { Payment, CompensationPlan } from '../finance/finance.model.js';
import { Certificate } from '../certificates/certificate.model.js';
import { Document } from '../documents/document.model.js';
import { evaluateCertificateEligibility } from '../certificates/certificate.service.js';
import { ASSET_STATUS, DOCUMENT_TYPE, DOCUMENT_STATUS, PAYMENT_STATUS, COMPENSATION_TYPE } from '../../../../shared/constants.js';
import { EXIT_COMPLETION_REASONS, TASK_OPEN_STATUSES, PAYMENT_UNSETTLED_STATUSES } from '../../../../shared/lifecycle.js';
import { EXIT_STATUS as E } from '../../../../shared/constants.js';
import { startOfDay, ymdInTz, round2 } from '../../utils/time.js';

const MS_DAY = 86400000;

/**
 * Live blocking conditions for the stage that is currently in progress.
 * Returns { blockers:[{code,message,detail}], info } - `info` carries what the UI needs to act on the stage.
 */
export async function evaluateExitStage(exit, intern, { tz }) {
  const blockers = [];
  const info = {};
  const userId = intern.userId?._id || intern.userId;

  switch (exit.status) {
    case E.NOTICE_PERIOD: {
      const elapsed = Math.floor((Date.now() - new Date(exit.initiatedDate).getTime()) / MS_DAY);
      const remaining = Math.max(0, exit.noticePeriodDays - elapsed);
      info.noticeDaysRemaining = remaining;
      if (remaining > 0) blockers.push({ code: 'NOTICE_NOT_ELAPSED', message: `${remaining} day(s) of the notice period remain.`, detail: { remaining } });
      break;
    }
    case E.HANDOVER: {
      const open = await Task.find({ organizationId: exit.organizationId, assignedTo: userId, status: { $in: TASK_OPEN_STATUSES } }).select('title status').lean();
      info.openTasks = open;
      if (open.length) blockers.push({ code: 'OPEN_TASKS', message: `${open.length} task(s) are still open: complete, reassign or cancel them.`, detail: { count: open.length } });
      break;
    }
    case E.ASSET_CLEARANCE: {
      const out = await Asset.find({ internId: exit.internId, status: { $in: [ASSET_STATUS.ASSIGNED, ASSET_STATUS.RETURN_PENDING] } }).select('assetTag name type status').lean();
      info.unreturnedAssets = out;
      if (out.length) blockers.push({ code: 'UNRETURNED_ASSETS', message: `${out.length} asset(s) have not been returned: ${out.map(a => a.assetTag).join(', ')}.`, detail: { count: out.length } });
      break;
    }
    case E.FINAL_SETTLEMENT: {
      const unsettled = await Payment.find({ internId: exit.internId, status: { $in: PAYMENT_UNSETTLED_STATUSES } }).select('paymentId cycle netPayable status currency').lean();
      info.unsettledPayments = unsettled;
      info.unsettledTotal = round2(unsettled.reduce((s, p) => s + p.netPayable, 0));
      if (unsettled.length) blockers.push({ code: 'UNSETTLED_PAYMENTS', message: `${unsettled.length} payment(s) are not settled (total ${info.unsettledTotal}).`, detail: { count: unsettled.length } });

      // The month of the last working day must have been paid out (pro-rated by the payroll engine) when a plan exists.
      const fmt = ymdInTz(exit.lastWorkingDay, tz).slice(0, 7);
      info.finalCycle = fmt;
      const plan = await CompensationPlan.findOne({ internId: exit.internId, isActive: true });
      const payable = plan && ![COMPENSATION_TYPE.UNPAID, COMPENSATION_TYPE.PERFORMANCE_BONUS].includes(plan.compensationType);
      info.finalCycleRequired = !!payable;
      if (payable && !(await Payment.exists({ internId: exit.internId, cycle: fmt }))) {
        blockers.push({ code: 'FINAL_CYCLE_NOT_GENERATED', message: `Generate the ${fmt} payment (pro-rated to the last working day) before settling.`, detail: { cycle: fmt } });
      }
      break;
    }
    case E.DOCUMENTATION: {
      const completion = EXIT_COMPLETION_REASONS.includes(exit.reason);
      info.completionExit = completion;
      if (completion) {
        const [cert, letter, eligibility] = await Promise.all([
          Certificate.findOne({ internId: exit.internId, status: 'ACTIVE' }).select('certificateId'),
          Document.findOne({ internId: exit.internId, source: 'GENERATED', documentType: DOCUMENT_TYPE.EXPERIENCE_LETTER, status: { $in: [DOCUMENT_STATUS.GENERATED, DOCUMENT_STATUS.SENT] } }).select('documentId'),
          evaluateCertificateEligibility(intern, { tz, endDate: exit.lastWorkingDay })
        ]);
        info.certificate = cert; info.experienceLetter = letter; info.eligibility = eligibility;
        if (exit.certificateEligible) {
          if (!eligibility.eligible) blockers.push({ code: 'NOT_CERTIFICATE_ELIGIBLE', message: `Certificate requirements not met: ${eligibility.reasons.join('; ')}`, detail: { reasons: eligibility.reasons } });
          else if (!cert) blockers.push({ code: 'CERTIFICATE_NOT_ISSUED', message: 'Issue the certificate of completion.', detail: {} });
        }
        if (!letter) blockers.push({ code: 'EXPERIENCE_LETTER_NOT_ISSUED', message: 'Issue the experience / relieving letter.', detail: {} });
      }
      break;
    }
    default:
      break;
  }
  return { blockers, info };
}

/** Sum actually paid for the final settlement (the cycle of the last working day). */
export async function computeFinalSettlement(exit) {
  const payments = await Payment.find({ internId: exit.internId, status: PAYMENT_STATUS.PAID }).sort({ createdAt: -1 }).limit(12).lean();
  const last = payments.filter(p => p.endDate >= startOfDay(exit.initiatedDate));
  return { amount: round2(last.reduce((s, p) => s + (p.paidAmount || 0), 0)), currency: last[0]?.currency || payments[0]?.currency, paymentIds: last.map(p => p._id) };
}

export async function findOpenExit(internId) {
  return Exit.findOne({ internId, completedAt: { $exists: false }, cancelledAt: { $exists: false } });
}
