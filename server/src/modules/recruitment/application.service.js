import {
  APPLICATION_TRANSITIONS, APPLICATION_MANUAL_TRANSITIONS, APPLICATION_NOTE_REQUIRED, assertTransition
} from '../../../../shared/lifecycle.js';
import { OFFER_STATUS, INTERVIEW_STATUS } from '../../../../shared/constants.js';
import { Interview } from '../interviews/interview.model.js';
import { Offer } from '../offers/offer.model.js';
import { unprocessable } from '../../utils/errors.js';

function actorName(req) {
  return req?.user ? `${req.user.firstName} ${req.user.lastName}`.trim() : 'System';
}

/**
 * The ONLY place an Application changes status. Validates against the canonical transition table
 * (manual = what an HR user may request; system = what workflows may do), records the timeline entry and
 * returns the previous status. The caller saves the document.
 */
export function moveApplication(app, to, { req = null, note = '', manual = false } = {}) {
  const table = manual ? APPLICATION_MANUAL_TRANSITIONS : APPLICATION_TRANSITIONS;
  if (APPLICATION_NOTE_REQUIRED.includes(to) && manual && !String(note || '').trim()) {
    throw unprocessable(`A reason is required to move an application to ${to}.`, [{ field: 'note', message: 'Reason is required' }]);
  }
  const from = app.status;
  assertTransition('application', table, from, to);
  app.status = to;
  app.timeline.push({
    stage: to,
    actorId: req?.userId,
    actorName: actorName(req),
    note: note || `Stage updated to ${to}`,
    timestamp: new Date()
  });
  return from;
}

/** Side effects of an application leaving the pipeline (REJECTED / WITHDRAWN): no orphaned interviews or offers. */
export async function closePipelineDependents(app, reason, req = null) {
  const now = new Date();
  await Interview.updateMany(
    { applicationId: app._id, status: { $in: [INTERVIEW_STATUS.SCHEDULED, INTERVIEW_STATUS.RESCHEDULED] } },
    { $set: { status: INTERVIEW_STATUS.CANCELLED, cancelledAt: now, cancelReason: reason || 'Application closed' } }
  );
  // Revoke via save() so the openKey / token cleanup hooks run.
  const openOffers = await Offer.find({ applicationId: app._id, status: { $in: [OFFER_STATUS.DRAFT, OFFER_STATUS.SENT, OFFER_STATUS.VIEWED] } });
  for (const offer of openOffers) {
    offer.status = OFFER_STATUS.REVOKED;
    offer.revokedAt = now;
    offer.revokedReason = reason || 'Application closed';
    offer.acceptTokenHash = undefined;
    await offer.save();
  }
  return { revokedOffers: openOffers.length };
}
