import { OnboardingPlan, OnboardingTask } from './onboarding.model.js';
import { markOnboardingStarted, recomputeOnboarding } from './onboarding.service.js';
import { Intern } from '../interns/intern.model.js';
import { getOwnIntern } from '../interns/intern.access.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { ONBOARDING_STATUS, INTERN_STATUS } from '../../../../shared/constants.js';
import { INTERN_CLOSED_STATUSES } from '../../../../shared/lifecycle.js';
import { ah } from '../../utils/asyncHandler.js';
import { notFound, conflict, forbidden, unprocessable } from '../../utils/errors.js';
import { Validator, parsePagination } from '../../utils/validate.js';

export const getOnboardingPlans = ah(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 200 });
  const query = { organizationId: req.organizationId };
  if (Object.values(ONBOARDING_STATUS).includes(req.query.status)) query.status = req.query.status;
  const [plans, total] = await Promise.all([
    OnboardingPlan.find(query)
      .populate('candidateId', 'firstName lastName email phone')
      .populate('offerId', 'offerId title startDate')
      .populate({ path: 'internId', select: 'internId status startDate' })
      .sort({ createdAt: -1 }).skip(skip).limit(limit),
    OnboardingPlan.countDocuments(query)
  ]);
  return paginatedResponse(res, plans, { page, limit, total });
});

async function planPayload(plan) {
  const tasks = await OnboardingTask.find({ onboardingPlanId: plan._id }).populate('documentId', 'status originalName version createdAt').sort({ createdAt: 1 });
  return { plan, tasks };
}

export const getOnboardingPlanById = ah(async (req, res) => {
  const plan = await OnboardingPlan.findOne({ _id: req.params.id, organizationId: req.organizationId })
    .populate('candidateId', 'firstName lastName email phone').populate('offerId').populate('internId', 'internId status');
  if (!plan) throw notFound('Onboarding plan not found');
  return successResponse(res, await planPayload(plan));
});

export const getMyOnboardingPlan = ah(async (req, res) => {
  const intern = await getOwnIntern(req);
  const plan = await OnboardingPlan.findOne({ organizationId: req.organizationId, internId: intern._id }).populate('offerId', 'offerId title startDate');
  if (!plan) throw notFound('No onboarding plan found for your profile', 'ONBOARDING_PLAN_NOT_FOUND');
  return successResponse(res, { ...(await planPayload(plan)), internStatus: intern.status });
});

/**
 * Task rules
 *   - document tasks (INTERN + documentType) are driven by the document lifecycle, never toggled by hand
 *   - the intern may only complete their OWN non-document tasks
 *   - HR/ADMIN/MENTOR-owned tasks are completed by staff with onboarding.manage
 *   - required tasks cannot be skipped; nothing can change after the intern is ACTIVE... except HR reopening is blocked too
 */
export const updateOnboardingTask = ah(async (req, res) => {
  const v = new Validator(req.body)
    .oneOf('status', [ONBOARDING_STATUS.PENDING, ONBOARDING_STATUS.COMPLETED, ONBOARDING_STATUS.SKIPPED, ONBOARDING_STATUS.BLOCKED], { required: true })
    .string('notes', { max: 500 });
  const { status, notes } = v.done();

  const task = await OnboardingTask.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!task) throw notFound('Onboarding task not found');
  const plan = await OnboardingPlan.findById(task.onboardingPlanId);
  const intern = await Intern.findById(plan.internId);
  if (!intern) throw notFound('Intern not found');

  const isOwnerIntern = String(intern.userId) === String(req.userId);
  const isManager = req.can('onboarding.manage');
  if (!isManager && !(isOwnerIntern && req.can('onboarding.update_own'))) throw forbidden('You cannot update this onboarding task.', 'FORBIDDEN');
  if (INTERN_CLOSED_STATUSES.includes(intern.status) || ![INTERN_STATUS.PRE_ONBOARDING, INTERN_STATUS.ONBOARDING].includes(intern.status)) {
    throw conflict('Onboarding is finished. Tasks can no longer be changed.', 'ONBOARDING_LOCKED');
  }

  if (!isManager) {
    if (task.owner !== 'INTERN' || task.documentType) throw forbidden('You can only complete your own non-document tasks.', 'FORBIDDEN');
    if (![ONBOARDING_STATUS.COMPLETED, ONBOARDING_STATUS.PENDING].includes(status)) throw forbidden('You can only mark your tasks complete or pending.', 'FORBIDDEN');
  }
  if (task.documentType && task.owner === 'INTERN') {
    throw conflict('This task is completed by uploading the document and having HR approve it.', 'DOCUMENT_TASK');
  }
  if (status === ONBOARDING_STATUS.SKIPPED && task.required) throw unprocessable('Required tasks cannot be skipped.', [{ field: 'status', message: 'Required task' }]);

  const before = { status: task.status };
  task.status = status;
  if (notes !== undefined) task.notes = notes;
  if (status === ONBOARDING_STATUS.COMPLETED) { task.completedAt = new Date(); task.completedBy = req.userId; }
  else { task.completedAt = undefined; task.completedBy = undefined; }
  await task.save();

  await markOnboardingStarted(intern._id, req);
  const result = await recomputeOnboarding(plan._id, req);
  await recordAuditLog({ action: 'ONBOARDING_TASK_UPDATED', entityType: 'OnboardingTask', entityId: task._id, before, after: { status, progress: result.plan.progress }, req });
  const freshIntern = await Intern.findById(intern._id).select('status');
  return successResponse(res, { task, planProgress: result.plan.progress, internStatus: freshIntern.status, activated: !!result.activated }, 'Task status updated');
});

