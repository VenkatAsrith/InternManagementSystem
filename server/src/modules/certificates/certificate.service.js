import { Task } from '../tasks/task.model.js';
import { Asset } from '../assets/asset.model.js';
import { Payment } from '../finance/finance.model.js';
import { PerformanceReview } from '../performance/performance.model.js';
import { InternshipProgram } from '../recruitment/recruitment.model.js';
import { attendanceSummary } from '../attendance/attendance.service.js';
import { ASSET_STATUS, PERFORMANCE_REVIEW_STATUS, PERFORMANCE_REVIEW_TYPE } from '../../../../shared/constants.js';
import { TASK_DONE_STATUSES, PAYMENT_UNSETTLED_STATUSES } from '../../../../shared/lifecycle.js';
import { env } from '../../config/env.js';

/**
 * CERTIFICATE ELIGIBILITY ENGINE
 * Calculated ONLY from stored records (never from browser values):
 *   attendance   : attended / expected working days  >= program requirement   (default 85%)
 *   tasks        : approved tasks                    >= program minimum        (default 5)
 *   finalReview  : a FINALIZED FINAL performance review exists (when the program requires one)
 *   assets       : no equipment is still out with the intern
 *   finance      : no unsettled payments
 * Returns every check with the actual and required values so the UI can show exactly WHY something is missing.
 */
export async function evaluateCertificateEligibility(intern, { tz, endDate } = {}) {
  const program = intern.programId?.completionRequirements
    ? intern.programId
    : await InternshipProgram.findById(intern.programId).lean();
  const req = program?.completionRequirements || {};
  const requiredAttendance = req.minimumAttendancePercent ?? program?.attendanceRequirementPercent ?? env.DEFAULT_ATTENDANCE_REQUIREMENT_PERCENT;
  const requiredTasks = req.minimumTasksCompleted ?? env.DEFAULT_MIN_TASKS_FOR_CERTIFICATE;
  const finalReviewRequired = req.finalReviewRequired ?? true;

  const userId = intern.userId?._id || intern.userId;
  const [attendance, approvedTasks, finalReview, assetsOut, unsettled] = await Promise.all([
    attendanceSummary(intern, { tz, endDate }),
    Task.countDocuments({ organizationId: intern.organizationId, assignedTo: userId, status: { $in: TASK_DONE_STATUSES } }),
    PerformanceReview.findOne({ internId: intern._id, type: PERFORMANCE_REVIEW_TYPE.FINAL, status: PERFORMANCE_REVIEW_STATUS.FINALIZED }).sort({ finalizedAt: -1 }),
    Asset.countDocuments({ internId: intern._id, status: { $in: [ASSET_STATUS.ASSIGNED, ASSET_STATUS.RETURN_PENDING] } }),
    Payment.countDocuments({ internId: intern._id, status: { $in: PAYMENT_UNSETTLED_STATUSES } })
  ]);

  const checks = [
    {
      key: 'attendance', label: 'Attendance', required: requiredAttendance, actual: attendance.percent, unit: '%',
      satisfied: attendance.percent !== null && attendance.percent >= requiredAttendance,
      detail: attendance.percent === null ? 'No working days have elapsed yet.' : `${attendance.attendedDays} of ${attendance.expectedDays} expected days attended.`
    },
    {
      key: 'tasks', label: 'Approved tasks', required: requiredTasks, actual: approvedTasks, unit: '',
      satisfied: approvedTasks >= requiredTasks, detail: `${approvedTasks} approved of ${requiredTasks} required.`
    },
    {
      key: 'finalReview', label: 'Final evaluation', required: finalReviewRequired ? 'Finalized' : 'Not required',
      actual: finalReview ? `Finalized (${finalReview.finalScore}/10)` : 'Pending', unit: '',
      satisfied: !finalReviewRequired || !!finalReview, detail: finalReview ? 'Final review finalized.' : 'A FINAL performance review has not been finalized.'
    },
    {
      key: 'assets', label: 'Asset clearance', required: 'All equipment returned', actual: assetsOut ? `${assetsOut} item(s) outstanding` : 'Cleared', unit: '',
      satisfied: assetsOut === 0, detail: assetsOut ? `${assetsOut} asset(s) are still assigned to the intern.` : 'No equipment outstanding.'
    },
    {
      key: 'finance', label: 'Financial clearance', required: 'No unsettled payments', actual: unsettled ? `${unsettled} unsettled` : 'Cleared', unit: '',
      satisfied: unsettled === 0, detail: unsettled ? `${unsettled} payment(s) are not settled.` : 'All payments settled.'
    }
  ];
  const failed = checks.filter(c => !c.satisfied);
  return {
    eligible: failed.length === 0,
    checks,
    reasons: failed.map(c => `${c.label}: ${c.actual}${c.unit} / required ${c.required}${c.unit}`),
    attendance
  };
}
