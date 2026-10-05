import { Offer } from './offer.model.js';
import { Application, Candidate, InternshipProgram } from '../recruitment/recruitment.model.js';
import { User } from '../users/user.model.js';
import { Intern } from '../interns/intern.model.js';
import { OnboardingPlan, OnboardingTask, DEFAULT_ONBOARDING_TASKS } from '../onboarding/onboarding.model.js';
import { CompensationPlan } from '../finance/finance.model.js';
import { generateId, generateSecretToken, hashToken } from '../../utils/idGenerator.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { createNotification } from '../notifications/notification.service.js';
import { emailService } from '../email/email.service.js';
import { moveApplication } from '../recruitment/application.service.js';
import {
  OFFER_STATUS, APPLICATION_STATUS, ROLES, INTERN_STATUS, ONBOARDING_STATUS, COMPENSATION_TYPE
} from '../../../../shared/constants.js';
import { OFFER_ACCEPTABLE_STATUSES } from '../../../../shared/lifecycle.js';
import { AppError, notFound, conflict, gone } from '../../utils/errors.js';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';

/**
 * Expires every offer whose validity window has passed and moves its application to OFFER_EXPIRED.
 * Called lazily (list / public link / accept) and periodically by the server.
 */
export async function expireStaleOffers(filter = {}) {
  const stale = await Offer.find({ ...filter, status: { $in: OFFER_ACCEPTABLE_STATUSES }, validUntil: { $lte: new Date() } });
  for (const offer of stale) {
    const claimed = await Offer.findOneAndUpdate(
      { _id: offer._id, status: { $in: OFFER_ACCEPTABLE_STATUSES } },
      { $set: { status: OFFER_STATUS.EXPIRED }, $unset: { openKey: '', acceptTokenHash: '' } },
      { new: true }
    );
    if (!claimed) continue;
    const app = await Application.findById(claimed.applicationId);
    if (app && app.status === APPLICATION_STATUS.OFFER_SENT) {
      moveApplication(app, APPLICATION_STATUS.OFFER_EXPIRED, { note: `Offer ${claimed.offerId} expired without a response.` });
      await app.save();
    }
    await recordAuditLog({
      organizationId: claimed.organizationId, actorRole: 'SYSTEM', action: 'OFFER_EXPIRED',
      entityType: 'Offer', entityId: claimed._id, after: { offerId: claimed.offerId, validUntil: claimed.validUntil }
    });
  }
  return stale.length;
}

function maybeInjectFault(req, step) {
  if (env.QA_FAULT_INJECTION && req?.headers?.['x-qa-fail-step'] === step) {
    throw new Error(`QA fault injected after step '${step}'`);
  }
}

/** Explains WHY an offer could not be claimed (used when the atomic claim finds nothing). */
async function explainClaimFailure(offerId, filter) {
  const offer = await Offer.findOne({ _id: offerId, ...filter });
  if (!offer) throw notFound('Offer not found');
  switch (offer.status) {
    case OFFER_STATUS.ACCEPTED: throw conflict('This offer has already been accepted.', 'OFFER_ALREADY_ACCEPTED', { internId: offer.provisioning?.internId });
    case OFFER_STATUS.EXPIRED: throw gone('This offer has expired.', 'OFFER_EXPIRED');
    case OFFER_STATUS.REVOKED: throw gone('This offer was withdrawn by the organization.', 'OFFER_REVOKED');
    case OFFER_STATUS.DECLINED: throw conflict('This offer was declined and can no longer be accepted.', 'OFFER_DECLINED');
    case OFFER_STATUS.DRAFT: throw conflict('This offer has not been sent to the candidate yet.', 'OFFER_NOT_SENT');
    default:
      if (offer.validUntil && offer.validUntil <= new Date()) throw gone('This offer has expired.', 'OFFER_EXPIRED');
      throw conflict(`Offer cannot be accepted in status ${offer.status}.`, 'OFFER_NOT_ACCEPTABLE');
  }
}

/**
 * ATOMIC OFFER ACCEPTANCE
 *
 *   claim   : Offer SENT/VIEWED -> ACCEPTED   (single findOneAndUpdate; only ONE concurrent caller can win)
 *   provision: Application, User, Intern, OnboardingPlan(+tasks), CompensationPlan, identity links
 *   rollback: if ANY step fails, every completed step is undone in reverse order and the offer is restored
 *             to its pre-claim state. Nothing is left half-provisioned.
 *
 * (MongoDB multi-document transactions need a replica set. This saga gives the same all-or-nothing outcome on a
 *  standalone server, and the same code path is used everywhere.)
 */
export async function acceptOfferAtomically({ offerId, filter = {}, via, actor = null, note = '', req = null }) {
  const now = new Date();

  // ---- 1. claim -----------------------------------------------------------------------------------------------
  const before = await Offer.findOneAndUpdate(
    { _id: offerId, ...filter, status: { $in: OFFER_ACCEPTABLE_STATUSES }, validUntil: { $gt: now } },
    {
      $set: { status: OFFER_STATUS.ACCEPTED, acceptedAt: now, acceptedVia: via, acceptanceNote: note, acceptedById: actor?._id },
      $unset: { acceptTokenHash: '' }
    },
    { new: false }
  ).select('+acceptTokenHash');
  if (!before) {
    await expireStaleOffers({ _id: offerId });
    await explainClaimFailure(offerId, filter);
  }

  const undo = [];
  const created = {};
  try {
    const app = await Application.findById(before.applicationId);
    const candidate = await Candidate.findById(before.candidateId);
    const program = await InternshipProgram.findById(before.programId);
    if (!app || !candidate || !program) throw new AppError('The offer references records that no longer exist.', 500, 'OFFER_DATA_INCONSISTENT');

    // ---- 2a. application -> OFFER_ACCEPTED ----------------------------------------------------------------------
    const prevApp = await Application.findOneAndUpdate(
      { _id: app._id, status: APPLICATION_STATUS.OFFER_SENT },
      { $set: { status: APPLICATION_STATUS.OFFER_ACCEPTED }, $push: { timeline: {
        stage: APPLICATION_STATUS.OFFER_ACCEPTED,
        actorId: actor?._id,
        actorName: actor ? `${actor.firstName} ${actor.lastName}` : candidate.firstName + ' ' + candidate.lastName,
        note: `Offer ${before.offerId} accepted (${via === 'CANDIDATE_LINK' ? 'by the candidate' : 'recorded by HR'}). Provisioning started.`,
        timestamp: now
      } } },
      { new: false }
    );
    if (!prevApp) throw conflict('The application is no longer awaiting an offer response.', 'APPLICATION_STATE_CHANGED');
    undo.push(() => Application.updateOne({ _id: app._id }, { $set: { status: prevApp.status }, $pop: { timeline: 1 } }));
    maybeInjectFault(req, 'application');

    // ---- 2b. identity: ONE person = ONE user --------------------------------------------------------------------
    let user = await User.findOne({ email: candidate.email }).select('+passwordSetupTokenHash');
    let setupToken = null;
    if (!user) {
      setupToken = generateSecretToken();
      user = await User.create({
        organizationId: before.organizationId,
        departmentId: before.departmentId,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        email: candidate.email,
        phone: candidate.phone,
        role: ROLES.INTERN,
        candidateId: candidate._id,
        password: generateSecretToken(24), // unguessable placeholder, replaced when the intern sets their own password
        mustChangePassword: true,
        passwordSetupTokenHash: hashToken(setupToken),
        passwordSetupExpiresAt: new Date(Date.now() + env.PASSWORD_SETUP_TTL_HOURS * 3600 * 1000),
        isActive: true
      });
      created.user = user;
      undo.push(() => User.deleteOne({ _id: user._id }));
    } else if (String(user.organizationId) !== String(before.organizationId)) {
      throw conflict('This email address already belongs to an account in a different organization.', 'EMAIL_IN_OTHER_ORG');
    } else if (user.role === ROLES.CANDIDATE) {
      // Candidate account -> Intern: SAME identity, upgraded in place.
      const previousRole = user.role;
      setupToken = generateSecretToken();
      user.role = ROLES.INTERN;
      user.departmentId = before.departmentId;
      user.passwordSetupTokenHash = hashToken(setupToken);
      user.passwordSetupExpiresAt = new Date(Date.now() + env.PASSWORD_SETUP_TTL_HOURS * 3600 * 1000);
      await user.save();
      undo.push(() => User.updateOne({ _id: user._id }, { $set: { role: previousRole }, $unset: { passwordSetupTokenHash: '', passwordSetupExpiresAt: '' } }));
    } else if (user.role === ROLES.INTERN) {
      throw conflict('This person already has an internship record. Returning-intern engagements must be created by an administrator.', 'ALREADY_INTERN');
    } else {
      throw conflict(`This email belongs to an existing ${user.role} account and cannot be converted to an intern.`, 'EMAIL_BELONGS_TO_STAFF');
    }
    maybeInjectFault(req, 'user');

    // ---- 2c. intern engagement ------------------------------------------------------------------------------------
    if (await Intern.findOne({ userId: user._id })) throw conflict('An internship record already exists for this person.', 'ALREADY_INTERN');
    const internId = await generateId('INT');
    const intern = await Intern.create({
      internId, userId: user._id, applicationId: app._id, candidateId: candidate._id, offerId: before._id,
      organizationId: before.organizationId, departmentId: before.departmentId, programId: before.programId,
      mentorId: before.mentorId || undefined, workMode: before.workMode,
      startDate: before.startDate, expectedEndDate: before.endDate,
      status: INTERN_STATUS.PRE_ONBOARDING
    });
    created.intern = intern;
    undo.push(() => Intern.deleteOne({ _id: intern._id }));
    maybeInjectFault(req, 'intern');

    // ---- 2d. onboarding plan + checklist ----------------------------------------------------------------------------
    const plan = await OnboardingPlan.create({
      organizationId: before.organizationId, applicationId: app._id, candidateId: candidate._id, internId: intern._id,
      offerId: before._id, status: ONBOARDING_STATUS.IN_PROGRESS, progress: 0
    });
    created.plan = plan;
    undo.push(() => OnboardingPlan.deleteOne({ _id: plan._id }));
    const tasks = await OnboardingTask.insertMany(DEFAULT_ONBOARDING_TASKS.map(t => ({
      ...t, onboardingPlanId: plan._id, organizationId: before.organizationId, status: ONBOARDING_STATUS.PENDING, dueDate: before.startDate
    })));
    undo.push(() => OnboardingTask.deleteMany({ onboardingPlanId: plan._id }));
    maybeInjectFault(req, 'onboarding');

    // ---- 2e. compensation (single source: the offer) --------------------------------------------------------------
    const compensation = await CompensationPlan.create({
      organizationId: before.organizationId, internId: intern._id,
      compensationType: before.compensationType || COMPENSATION_TYPE.MONTHLY_STIPEND,
      baseAmount: before.stipendAmount || 0, currency: before.currency || 'INR',
      paymentFrequency: 'MONTHLY', effectiveFrom: before.startDate, isActive: true
    });
    created.compensation = compensation;
    undo.push(() => CompensationPlan.deleteOne({ _id: compensation._id }));
    maybeInjectFault(req, 'compensation');

    // ---- 2f. identity links + offer bookkeeping ---------------------------------------------------------------------
    const priorCandidateUser = candidate.userId;
    await Candidate.updateOne({ _id: candidate._id }, { $set: { userId: user._id } });
    undo.push(() => Candidate.updateOne({ _id: candidate._id }, priorCandidateUser ? { $set: { userId: priorCandidateUser } } : { $unset: { userId: '' } }));
    await Offer.updateOne({ _id: before._id }, { $set: { provisioning: {
      userId: user._id, internId: intern._id, onboardingPlanId: plan._id, compensationPlanId: compensation._id, completedAt: new Date()
    } }, $unset: { openKey: '' } });
    maybeInjectFault(req, 'links');

    // ---- 3. success side effects (must never undo a committed acceptance) -------------------------------------------
    const finalOffer = await Offer.findById(before._id);
    const setupLink = setupToken ? `${env.FRONTEND_URL}/set-password?token=${setupToken}` : null;
    try {
      await recordAuditLog({
        organizationId: before.organizationId,
        actorId: actor?._id, actorEmail: actor?.email || candidate.email, actorRole: actor?.role || ROLES.CANDIDATE,
        action: 'OFFER_ACCEPTED', entityType: 'Offer', entityId: before._id,
        before: { status: before.status }, after: { status: OFFER_STATUS.ACCEPTED, via, internId: intern.internId, userId: user._id, onboardingPlanId: plan._id, tasks: tasks.length },
        metadata: { note }, req
      });
      await createNotification({
        organizationId: before.organizationId, recipientId: user._id, type: 'OFFER_ACCEPTED', title: 'Welcome to the Team!',
        message: `Your internship offer ${before.offerId} is confirmed. Complete your onboarding checklist to get started.`,
        entityType: 'Intern', entityId: intern._id
      });
      if (before.mentorId) {
        await createNotification({
          organizationId: before.organizationId, recipientId: before.mentorId, type: 'MENTEE_ASSIGNED', title: 'New mentee assigned',
          message: `${candidate.firstName} ${candidate.lastName} (${internId}) will start on ${before.startDate.toISOString().slice(0, 10)}.`,
          entityType: 'Intern', entityId: intern._id
        });
      }
      emailService.queueEmail({
        to: candidate.email, subject: `Welcome to ${program.title}`, template: 'OFFER_ACCEPTED_WELCOME',
        text: `Hi ${candidate.firstName}, your offer ${before.offerId} is confirmed (Intern ID ${internId}).${setupLink ? ` Set your password: ${setupLink}` : ''}`,
        organizationId: before.organizationId
      });
    } catch (sideEffectError) {
      logger.error(`Post-acceptance side effect failed for ${before.offerId}: ${sideEffectError.message}`);
    }

    return { offer: finalOffer, intern, user, plan, tasks, compensation, setupLink };
  } catch (error) {
    // ---- ROLLBACK: undo everything, newest first, then restore the offer exactly as it was ------------------------
    logger.warn(`Offer acceptance failed for ${before.offerId} (${error.message}). Rolling back ${undo.length} step(s).`);
    for (const fn of undo.reverse()) {
      try { await fn(); } catch (undoError) { logger.error(`Rollback step failed: ${undoError.message}`); }
    }
    await Offer.updateOne({ _id: before._id }, {
      $set: { status: before.status, openKey: String(before.applicationId), acceptTokenHash: before.acceptTokenHash },
      $unset: { acceptedAt: '', acceptedVia: '', acceptanceNote: '', acceptedById: '', provisioning: '' }
    });
    throw error;
  }
}
