import { Exit } from './exit.model.js';
import { evaluateExitStage, computeFinalSettlement, findOpenExit } from './exit.service.js';
import { Intern } from '../interns/intern.model.js';
import { User } from '../users/user.model.js';
import { Session } from '../auth/session.model.js';
import { Asset } from '../assets/asset.model.js';
import { Payment } from '../finance/finance.model.js';
import { loadScopedIntern, getOwnIntern } from '../interns/intern.access.js';
import { generateId } from '../../utils/idGenerator.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { createNotification } from '../notifications/notification.service.js';
import { EXIT_REASON, EXIT_STATUS as E, INTERN_STATUS as I } from '../../../../shared/constants.js';
import {
  EXIT_STAGE_ORDER, EXIT_STAGE_DEFS, EXIT_TERMINATION_REASONS, EXIT_COMPLETION_REASONS, INTERN_TRANSITIONS, assertTransition, nextExitStage
} from '../../../../shared/lifecycle.js';
import { ah } from '../../utils/asyncHandler.js';
import { notFound, conflict, forbidden, unprocessable } from '../../utils/errors.js';
import { Validator, parsePagination, isObjectId } from '../../utils/validate.js';
import { startOfDay, toDay } from '../../utils/time.js';
import { logger } from '../../config/logger.js';

const INTERN_POPULATE = [{ path: 'userId', select: 'firstName lastName email' }, { path: 'programId' }, { path: 'departmentId', select: 'name' }];

function stagesView(exit) {
  return EXIT_STAGE_ORDER.map(stage => {
    const def = EXIT_STAGE_DEFS[stage];
    const done = exit.stageHistory.find(h => h.stage === stage);
    const state = done ? (done.outcome === 'COMPLETED' ? 'DONE' : done.outcome) : (exit.status === stage ? 'CURRENT' : 'PENDING');
    return { stage, label: def.label, owner: def.owner, permission: def.permission, action: def.action, blockersDescription: def.blockers, state,
      completedAt: done?.at, completedBy: done?.actorRole, notes: done?.notes, waiveReason: done?.waiveReason };
  });
}

async function setInternStatus(intern, to) {
  if (intern.status === to) return;
  assertTransition('intern', INTERN_TRANSITIONS, intern.status, to);
  const updated = await Intern.findOneAndUpdate({ _id: intern._id, status: intern.status }, { $set: { status: to } }, { new: true });
  if (!updated) throw conflict('The intern record changed while the exit was being processed.', 'STATE_CHANGED');
  intern.status = to;
}

async function revokeAccess(userId) {
  await Session.updateMany({ userId, isRevoked: false }, { isRevoked: true, revokedAt: new Date(), revokedReason: 'Exit: access deactivated' });
  await User.updateOne({ _id: userId }, { $set: { isActive: false, deletedAt: new Date() } });
}

export const initiateExit = ah(async (req, res) => {
  const v = new Validator(req.body)
    .objectId('internId', { required: true }).oneOf('reason', EXIT_REASON, { required: true })
    .string('lastWorkingDay', { required: true, max: 30 }).number('noticePeriodDays', { min: 0, max: 90, integer: true })
    .string('managerNotes', { max: 2000 }).string('hrNotes', { max: 2000 }).boolean('lorEligible', { defaultValue: false });
  const body = v.done();

  const intern = await loadScopedIntern(req, body.internId, INTERN_POPULATE);
  if (![I.ACTIVE, I.PERFORMANCE_REVIEW].includes(intern.status)) {
    throw conflict(`An exit can only be started for an ACTIVE intern (current: ${intern.status}).`, 'INTERN_NOT_ACTIVE');
  }
  const lwd = toDay(body.lastWorkingDay, req.timezone);
  if (!lwd) throw unprocessable('Enter a valid last working day', [{ field: 'lastWorkingDay', message: 'Invalid date' }]);
  if (lwd < startOfDay(new Date(), req.timezone)) throw unprocessable('Last working day cannot be in the past', [{ field: 'lastWorkingDay', message: 'Must be today or later' }]);
  if (lwd < startOfDay(intern.startDate, req.timezone)) throw unprocessable('Last working day cannot be before the internship start', [{ field: 'lastWorkingDay', message: 'Before start date' }]);
  if (await findOpenExit(intern._id)) throw conflict('An exit workflow is already in progress for this intern.', 'EXIT_ALREADY_OPEN');

  const termination = EXIT_TERMINATION_REASONS.includes(body.reason);
  const exit = await (async () => {
    try {
      return await Exit.create({
        exitId: await generateId('EXT'), organizationId: req.organizationId, internId: intern._id, userId: intern.userId._id,
        reason: body.reason, status: E.EXIT_INITIATED, initiatedBy: req.userId, lastWorkingDay: lwd, noticePeriodDays: body.noticePeriodDays || 0,
        managerNotes: body.managerNotes, hrNotes: body.hrNotes,
        // Certificates are only ever available for completion-type exits.
        certificateEligible: EXIT_COMPLETION_REASONS.includes(body.reason), lorEligible: !!body.lorEligible
      });
    } catch (err) {
      if (err?.code === 11000) throw conflict('An exit workflow is already in progress for this intern.', 'EXIT_ALREADY_OPEN');
      throw err;
    }
  })();

  try {
    await setInternStatus(intern, I.EXIT_INITIATED);
    if (termination) {
      // Misconduct / absconding: access is cut immediately, not at the end of the process.
      await revokeAccess(intern.userId._id);
      exit.accessRevoked = true; exit.accessRevokedAt = new Date();
      await exit.save();
    }
  } catch (err) {
    await Exit.deleteOne({ _id: exit._id });
    throw err;
  }
  await createNotification({
    organizationId: req.organizationId, recipientId: intern.userId._id, type: 'EXIT_INITIATED', title: 'Offboarding started',
    message: `Your last working day is ${body.lastWorkingDay}. Your mentor and HR will guide you through handover.`, entityType: 'Exit', entityId: exit._id
  });
  await recordAuditLog({ action: 'EXIT_INITIATED', entityType: 'Exit', entityId: exit._id, after: { exitId: exit.exitId, reason: body.reason, lastWorkingDay: lwd, internId: intern.internId, accessRevoked: exit.accessRevoked }, req });
  return successResponse(res, { ...exit.toObject(), stages: stagesView(exit) }, 'Exit workflow initiated successfully', 201);
});

export const getExits = ah(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 200 });
  const query = { organizationId: req.organizationId };
  if (Object.values(E).includes(req.query.status)) query.status = req.query.status;
  if (isObjectId(req.query.internId)) query.internId = req.query.internId;
  const [exits, total] = await Promise.all([
    Exit.find(query).populate({ path: 'internId', select: 'internId userId departmentId mentorId status', populate: { path: 'userId', select: 'firstName lastName email' } }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Exit.countDocuments(query)
  ]);
  return paginatedResponse(res, exits, { page, limit, total });
});

async function detail(req, exit) {
  const intern = await Intern.findById(exit.internId).populate(INTERN_POPULATE);
  const { blockers, info } = exit.completedAt || exit.cancelledAt ? { blockers: [], info: {} } : await evaluateExitStage(exit, intern, { tz: req.timezone });
  const [assets, payments] = await Promise.all([
    Asset.find({ internId: exit.internId }).select('assetTag name type status').lean(),
    Payment.find({ internId: exit.internId }).select('paymentId cycle netPayable paidAmount status currency').sort({ createdAt: -1 }).lean()
  ]);
  return { exit, intern, stages: stagesView(exit), currentStage: exit.status, blockers, stageInfo: info, assignedAssets: assets, payments, canAdvance: blockers.length === 0 };
}

export const getExitById = ah(async (req, res) => {
  const exit = await Exit.findOne({ _id: req.params.id, organizationId: req.organizationId })
    .populate({ path: 'internId', select: 'internId userId departmentId mentorId startDate expectedEndDate status', populate: { path: 'userId', select: 'firstName lastName email phone' } });
  if (!exit) throw notFound('Exit record not found');
  const view = await detail(req, exit);
  // The caller may be able to act on the CURRENT stage: tell the UI so it can hide buttons the server would refuse.
  view.permissions = { canActOnCurrentStage: req.can(EXIT_STAGE_DEFS[exit.status]?.permission || 'exit.manage'), canWaive: req.can('exit.manage'), canCancel: req.can('exit.initiate') };
  return successResponse(res, view);
});

// Intern-facing read-only summary of their own exit.
export const getMyExit = ah(async (req, res) => {
  const intern = await getOwnIntern(req);
  const exit = await Exit.findOne({ internId: intern._id }).sort({ createdAt: -1 });
  if (!exit) return successResponse(res, null);
  return successResponse(res, { exitId: exit.exitId, reason: exit.reason, status: exit.status, lastWorkingDay: exit.lastWorkingDay, stages: stagesView(exit).map(({ stage, label, state }) => ({ stage, label, state })) });
});

async function runSystemStages(exit, intern, req) {
  // DEACTIVATED -> ARCHIVED -> ALUMNI (or TERMINATED) run automatically once documentation is done.
  const termination = EXIT_TERMINATION_REASONS.includes(exit.reason);
  const system = (stage, notes) => exit.stageHistory.push({ stage, outcome: 'COMPLETED', notes, actorRole: 'SYSTEM', at: new Date() });

  exit.status = E.DEACTIVATED;
  await revokeAccess(intern.userId._id || intern.userId);
  exit.accessRevoked = true; exit.accessRevokedAt = exit.accessRevokedAt || new Date();
  system(E.DEACTIVATED, 'All sessions revoked and login account deactivated.');

  exit.status = E.ARCHIVED;
  exit.archivedAt = new Date();
  system(E.ARCHIVED, 'Operational record locked.');

  exit.status = E.ALUMNI;
  exit.completedAt = new Date();
  system(E.ALUMNI, termination ? 'Engagement terminated.' : 'Moved to the permanent alumni archive.');

  await setInternStatus(intern, termination ? I.TERMINATED : I.ALUMNI);
  await Intern.updateOne({ _id: intern._id }, { $set: { actualEndDate: exit.lastWorkingDay } });
  await exit.save();
}

/**
 * Complete the stage that is currently in progress and move to the next one.
 *  - the caller needs the stage's permission (mentor: handover, finance: settlement, docs: documentation, HR: the rest)
 *  - live blockers must be empty, OR the caller waives them (needs exit.manage and a reason)
 *  - the stage claim is atomic: two simultaneous advances cannot both succeed
 */
export const advanceExit = ah(async (req, res) => {
  const v = new Validator(req.body).string('notes', { max: 1000 }).boolean('waive', { defaultValue: false }).string('waiveReason', { max: 500 });
  const body = v.done();

  const exit = await Exit.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!exit) throw notFound('Exit record not found');
  if (exit.completedAt) throw conflict('This exit is already complete.', 'EXIT_COMPLETE');
  if (exit.cancelledAt) throw conflict('This exit was cancelled.', 'EXIT_CANCELLED');

  const current = exit.status;
  const def = EXIT_STAGE_DEFS[current];
  if (!req.can(def.permission)) throw forbidden(`The ${def.label} stage is owned by ${def.owner}. You do not have permission to complete it.`, 'STAGE_NOT_YOURS');

  const intern = await Intern.findById(exit.internId).populate(INTERN_POPULATE);
  const { blockers } = await evaluateExitStage(exit, intern, { tz: req.timezone });
  let outcome = 'COMPLETED';
  if (blockers.length) {
    if (!body.waive) throw conflict(`Cannot complete ${def.label}: ${blockers.map(b => b.message).join(' ')}`, 'STAGE_BLOCKED', { blockers });
    if (!req.can('exit.manage')) throw forbidden('Only HR / organization administrators can waive a blocking condition.', 'WAIVE_FORBIDDEN');
    if (!body.waiveReason || body.waiveReason.trim().length < 5) throw unprocessable('A reason (at least 5 characters) is required to waive blockers.', [{ field: 'waiveReason', message: 'Reason is required' }]);
    outcome = 'WAIVED';
  }

  let next = nextExitStage(current);
  const skipped = [];
  if (next === E.NOTICE_PERIOD && exit.noticePeriodDays === 0) { skipped.push(E.NOTICE_PERIOD); next = nextExitStage(next); }

  const entries = [{ stage: current, outcome, notes: body.notes || '', waiveReason: outcome === 'WAIVED' ? body.waiveReason : undefined, blockersAtCompletion: blockers.map(b => ({ code: b.code, message: b.message })), actorId: req.userId, actorRole: req.userRole, at: new Date() },
    ...skipped.map(s => ({ stage: s, outcome: 'SKIPPED', notes: 'Notice period is 0 days.', actorRole: 'SYSTEM', at: new Date() }))];

  // Atomic stage claim.
  const claimed = await Exit.findOneAndUpdate({ _id: exit._id, status: current, completedAt: { $exists: false }, cancelledAt: { $exists: false } }, { $set: { status: next }, $push: { stageHistory: { $each: entries } } }, { new: true });
  if (!claimed) throw conflict('This exit was advanced by someone else. Refresh to see the current stage.', 'STATE_CHANGED');

  try {
    if (current === E.FINAL_SETTLEMENT) {
      claimed.finalSettlement = { ...(await computeFinalSettlement(claimed)), computedAt: new Date() };
    }
    const mirror = EXIT_STAGE_DEFS[next].internStatus;
    if (next !== E.DEACTIVATED && next !== E.ARCHIVED && next !== E.ALUMNI) {
      await setInternStatus(intern, mirror);
      await claimed.save();
    } else {
      await setInternStatus(intern, I.CERTIFICATION);
      await runSystemStages(claimed, intern, req);
    }
  } catch (err) {
    // Roll the stage back so the process never sits half-way between two states.
    logger.warn(`Exit ${exit.exitId} advance from ${current} failed (${err.message}). Restoring stage.`);
    await Exit.updateOne({ _id: exit._id }, { $set: { status: current }, $pop: { stageHistory: entries.length } });
    throw err;
  }

  await recordAuditLog({
    action: 'EXIT_STAGE_COMPLETED', entityType: 'Exit', entityId: exit._id,
    before: { stage: current }, after: { stage: claimed.status, outcome, waived: outcome === 'WAIVED', waiveReason: body.waiveReason || '', blockers: blockers.map(b => b.code) }, req
  });
  const fresh = await Exit.findById(exit._id).populate({ path: 'internId', select: 'internId userId status', populate: { path: 'userId', select: 'firstName lastName email' } });
  return successResponse(res, await detail(req, fresh), `${def.label} completed. Exit is now at ${EXIT_STAGE_DEFS[fresh.status].label}.`);
});

// Only before assets/finance work has started may an exit be called off. Terminations are irreversible.
export const cancelExit = ah(async (req, res) => {
  const { reason } = new Validator(req.body).string('reason', { required: true, min: 3, max: 500 }).done();
  const exit = await Exit.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!exit) throw notFound('Exit record not found');
  if (exit.completedAt || exit.cancelledAt) throw conflict('This exit is already closed.', 'EXIT_CLOSED');
  if (![E.EXIT_INITIATED, E.NOTICE_PERIOD, E.HANDOVER].includes(exit.status)) throw conflict('An exit can only be cancelled before asset clearance begins.', 'TOO_LATE_TO_CANCEL');
  if (EXIT_TERMINATION_REASONS.includes(exit.reason)) throw conflict('A termination cannot be cancelled here.', 'TERMINATION_IRREVERSIBLE');

  const claimed = await Exit.findOneAndUpdate({ _id: exit._id, status: exit.status, cancelledAt: { $exists: false } }, { $set: { cancelledAt: new Date(), cancelReason: reason }, $unset: { openKey: '' } }, { new: true });
  if (!claimed) throw conflict('The exit changed while you were cancelling it.', 'STATE_CHANGED');
  const intern = await Intern.findById(exit.internId);
  await setInternStatus(intern, I.ACTIVE);
  await recordAuditLog({ action: 'EXIT_CANCELLED', entityType: 'Exit', entityId: exit._id, after: { reason }, req });
  return successResponse(res, claimed, 'Exit cancelled. The intern is active again.');
});
