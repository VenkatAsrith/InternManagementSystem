import { OnboardingPlan, OnboardingTask } from './onboarding.model.js';
import { Intern } from '../interns/intern.model.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { createNotification } from '../notifications/notification.service.js';
import { INTERN_STATUS, ONBOARDING_STATUS } from '../../../../shared/constants.js';
import { INTERN_TRANSITIONS, assertTransition } from '../../../../shared/lifecycle.js';

/** First onboarding activity moves the intern PRE_ONBOARDING -> ONBOARDING (system transition). */
export async function markOnboardingStarted(internId, req = null) {
  const intern = await Intern.findOneAndUpdate(
    { _id: internId, status: INTERN_STATUS.PRE_ONBOARDING },
    { $set: { status: INTERN_STATUS.ONBOARDING } },
    { new: true }
  );
  if (intern) {
    assertTransition('intern', INTERN_TRANSITIONS, INTERN_STATUS.PRE_ONBOARDING, INTERN_STATUS.ONBOARDING);
    await recordAuditLog({
      organizationId: intern.organizationId, action: 'INTERN_ONBOARDING_STARTED', entityType: 'Intern', entityId: intern._id,
      before: { status: INTERN_STATUS.PRE_ONBOARDING }, after: { status: INTERN_STATUS.ONBOARDING }, req, actorRole: req ? undefined : 'SYSTEM'
    });
  }
  return intern;
}

/**
 * Recalculates plan progress from REQUIRED tasks only and, when everything required is done, activates the intern
 * (ONBOARDING -> ACTIVE). Safe to call repeatedly.
 */
export async function recomputeOnboarding(planId, req = null) {
  const plan = await OnboardingPlan.findById(planId);
  if (!plan) return null;
  const required = await OnboardingTask.find({ onboardingPlanId: plan._id, required: true }).select('status').lean();
  const done = required.filter(t => t.status === ONBOARDING_STATUS.COMPLETED).length;
  const progress = required.length ? Math.round(done / required.length * 100) : 100;

  plan.progress = progress;
  if (progress === 100) {
    plan.status = ONBOARDING_STATUS.COMPLETED;
    plan.completedAt = plan.completedAt || new Date();
  } else {
    plan.status = ONBOARDING_STATUS.IN_PROGRESS;
    plan.completedAt = undefined;
  }
  await plan.save();

  let activated = null;
  if (progress === 100 && plan.internId) {
    activated = await Intern.findOneAndUpdate(
      { _id: plan.internId, status: INTERN_STATUS.ONBOARDING },
      { $set: { status: INTERN_STATUS.ACTIVE, activatedAt: new Date() } },
      { new: true }
    );
    if (activated) {
      await recordAuditLog({
        organizationId: activated.organizationId, action: 'INTERN_ACTIVATED', entityType: 'Intern', entityId: activated._id,
        before: { status: INTERN_STATUS.ONBOARDING }, after: { status: INTERN_STATUS.ACTIVE }, req, actorRole: req ? undefined : 'SYSTEM'
      });
      await createNotification({
        organizationId: activated.organizationId, recipientId: activated.userId, type: 'INTERN_ACTIVATED', title: 'You are now active',
        message: 'Onboarding is complete. Your internship workspace is fully open.', entityType: 'Intern', entityId: activated._id
      });
    }
  }
  return { plan, activated };
}
