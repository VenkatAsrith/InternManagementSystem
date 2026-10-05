import { Offer, formatStipend } from './offer.model.js';
import { Application } from '../recruitment/recruitment.model.js';
import { User } from '../users/user.model.js';
import { generateId, generateSecretToken, hashToken } from '../../utils/idGenerator.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { emailService } from '../email/email.service.js';
import { moveApplication } from '../recruitment/application.service.js';
import { acceptOfferAtomically, expireStaleOffers } from './offer.provisioning.js';
import {
  OFFER_STATUS, APPLICATION_STATUS, COMPENSATION_TYPE, ROLES
} from '../../../../shared/constants.js';
import { OFFER_ACCEPTABLE_STATUSES } from '../../../../shared/lifecycle.js';
import { ah } from '../../utils/asyncHandler.js';
import { notFound, conflict, gone, unprocessable } from '../../utils/errors.js';
import { Validator, parsePagination, isObjectId } from '../../utils/validate.js';
import { toDay, formatDateLong } from '../../utils/time.js';
import { env } from '../../config/env.js';

const MENTOR_ROLES = [ROLES.MENTOR, ROLES.TEAM_LEAD, ROLES.PROGRAM_MANAGER];
const MS_DAY = 24 * 3600 * 1000;

function offerValidator(body, { create }) {
  return new Validator(body)
    .string('applicationId', { required: create, max: 40 })
    .string('startDate', { required: create, max: 30 })
    .string('endDate', { required: create, max: 30 })
    .oneOf('workMode', ['REMOTE', 'HYBRID', 'ON_SITE'])
    .oneOf('compensationType', COMPENSATION_TYPE, { defaultValue: create ? COMPENSATION_TYPE.MONTHLY_STIPEND : undefined })
    .number('stipendAmount', { required: create, min: 0, max: 10_000_000 })
    .oneOf('currency', ['INR', 'USD', 'EUR', 'GBP'])
    .objectId('mentorId')
    .stringList('responsibilities', { max: 30, itemMax: 300, separator: '\n' })
    .string('terms', { max: 4000 });
}

async function validateTerms(req, merged) {
  const errors = [];
  const start = toDay(merged.startDate, req.timezone);
  const end = toDay(merged.endDate, req.timezone);
  if (!start) errors.push({ field: 'startDate', message: 'Enter a valid start date' });
  if (!end) errors.push({ field: 'endDate', message: 'Enter a valid end date' });
  if (start && end) {
    if (start.getTime() < toDay(new Date(), req.timezone).getTime()) errors.push({ field: 'startDate', message: 'Start date cannot be in the past' });
    if (end <= start) errors.push({ field: 'endDate', message: 'End date must be after the start date' });
    else if ((end - start) / MS_DAY > 400) errors.push({ field: 'endDate', message: 'An internship cannot be longer than 400 days' });
  }
  const type = merged.compensationType || COMPENSATION_TYPE.MONTHLY_STIPEND;
  const amount = Number(merged.stipendAmount);
  if (type === COMPENSATION_TYPE.UNPAID && amount !== 0) errors.push({ field: 'stipendAmount', message: 'Unpaid internships must have an amount of 0' });
  if (type !== COMPENSATION_TYPE.UNPAID && !(amount > 0)) errors.push({ field: 'stipendAmount', message: 'Enter a stipend amount greater than 0 (or choose Unpaid)' });
  if (merged.mentorId) {
    const mentor = await User.findOne({ _id: merged.mentorId, organizationId: req.organizationId, isActive: true, role: { $in: MENTOR_ROLES } });
    if (!mentor) errors.push({ field: 'mentorId', message: 'Mentor must be an active mentor, team lead or program manager in your organization' });
  }
  if (errors.length) throw unprocessable('Invalid offer terms', errors);
  return { start, end, durationDays: Math.round((end - start) / MS_DAY) + 1 };
}

async function findApplication(req, ref) {
  const clauses = [{ applicationId: String(ref) }];
  if (isObjectId(ref)) clauses.push({ _id: ref });
  return Application.findOne({ organizationId: req.organizationId, $or: clauses }).populate('openingId').populate('candidateId');
}

export const createOffer = ah(async (req, res) => {
  const body = offerValidator(req.body, { create: true }).done();
  const app = await findApplication(req, body.applicationId);
  if (!app) throw notFound('Application not found');
  if (![APPLICATION_STATUS.SELECTED, APPLICATION_STATUS.OFFER_EXPIRED].includes(app.status)) {
    throw conflict(`An offer can only be drafted for a SELECTED application (current: ${app.status}).`, 'INVALID_APPLICATION_STATE');
  }
  if (await Offer.findOne({ applicationId: app._id, openKey: { $exists: true } })) {
    throw conflict('This application already has an open offer. Revoke it before drafting a new one.', 'OPEN_OFFER_EXISTS');
  }
  const { start, end, durationDays } = await validateTerms(req, body);
  const opening = app.openingId;
  const compensationType = body.compensationType || COMPENSATION_TYPE.MONTHLY_STIPEND;
  const currency = body.currency || 'INR';

  let offer;
  try {
    offer = await Offer.create({
      offerId: await generateId('OFFER'),
      organizationId: req.organizationId,
      applicationId: app._id,
      candidateId: app.candidateId._id,
      programId: opening.programId,
      departmentId: opening.departmentId,
      title: `${opening.title} Internship Offer`,
      mentorId: body.mentorId,
      startDate: start, endDate: end, durationDays,
      workMode: body.workMode || opening.workMode || 'REMOTE',
      compensationType, stipendAmount: body.stipendAmount, currency,
      stipend: formatStipend(body.stipendAmount, currency, compensationType),
      responsibilities: body.responsibilities || opening.responsibilities || [],
      terms: body.terms || undefined,
      status: OFFER_STATUS.DRAFT,
      createdBy: req.userId
    });
  } catch (err) {
    if (err?.code === 11000) throw conflict('This application already has an open offer.', 'OPEN_OFFER_EXISTS');
    throw err;
  }

  try {
    moveApplication(app, APPLICATION_STATUS.OFFER_DRAFT, { req, note: `Offer ${offer.offerId} drafted.` });
    await app.save();
  } catch (err) {
    await Offer.deleteOne({ _id: offer._id });
    throw err;
  }
  await recordAuditLog({ action: 'OFFER_CREATED', entityType: 'Offer', entityId: offer._id, after: offer.toObject(), req });
  return successResponse(res, offer, 'Internship offer drafted successfully', 201);
});

export const updateOffer = ah(async (req, res) => {
  const offer = await Offer.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!offer) throw notFound('Offer not found');
  if (offer.status !== OFFER_STATUS.DRAFT) throw conflict('Only DRAFT offers can be edited.', 'OFFER_NOT_EDITABLE');
  const body = offerValidator(req.body, { create: false }).done();
  const merged = {
    startDate: body.startDate ?? offer.startDate, endDate: body.endDate ?? offer.endDate,
    compensationType: body.compensationType ?? offer.compensationType, stipendAmount: body.stipendAmount ?? offer.stipendAmount,
    mentorId: body.mentorId ?? offer.mentorId
  };
  const { start, end, durationDays } = await validateTerms(req, merged);
  const before = offer.toObject();
  offer.startDate = start; offer.endDate = end; offer.durationDays = durationDays;
  offer.compensationType = merged.compensationType; offer.stipendAmount = merged.stipendAmount;
  if (body.currency) offer.currency = body.currency;
  if (body.workMode) offer.workMode = body.workMode;
  if (body.mentorId) offer.mentorId = body.mentorId;
  if (body.responsibilities) offer.responsibilities = body.responsibilities;
  if (body.terms) offer.terms = body.terms;
  offer.stipend = formatStipend(offer.stipendAmount, offer.currency, offer.compensationType);
  await offer.save();
  await recordAuditLog({ action: 'OFFER_UPDATED', entityType: 'Offer', entityId: offer._id, before, after: offer.toObject(), req });
  return successResponse(res, offer, 'Offer updated');
});

export const getOffers = ah(async (req, res) => {
  await expireStaleOffers({ organizationId: req.organizationId });
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 200 });
  const query = { organizationId: req.organizationId };
  if (Object.values(OFFER_STATUS).includes(req.query.status)) query.status = req.query.status;
  if (isObjectId(req.query.candidateId)) query.candidateId = req.query.candidateId;
  if (isObjectId(req.query.applicationId)) query.applicationId = req.query.applicationId;

  const [offers, total] = await Promise.all([
    Offer.find(query)
      .populate('candidateId', 'firstName lastName email phone')
      .populate('departmentId', 'name code').populate('programId', 'title')
      .populate('mentorId', 'firstName lastName')
      .populate('applicationId', 'applicationId status')
      .sort({ createdAt: -1 }).skip(skip).limit(limit),
    Offer.countDocuments(query)
  ]);
  return paginatedResponse(res, offers, { page, limit, total });
});

export const getOfferById = ah(async (req, res) => {
  await expireStaleOffers({ _id: req.params.id, organizationId: req.organizationId });
  const offer = await Offer.findOne({ _id: req.params.id, organizationId: req.organizationId })
    .populate('candidateId').populate('departmentId').populate('programId').populate('mentorId', 'firstName lastName email')
    .populate('applicationId', 'applicationId status');
  if (!offer) throw notFound('Offer not found');
  return successResponse(res, offer);
});

export const sendOffer = ah(async (req, res) => {
  const existing = await Offer.findOne({ _id: req.params.id, organizationId: req.organizationId }).populate('candidateId');
  if (!existing) throw notFound('Offer not found');

  const token = generateSecretToken();
  const validUntil = new Date(Date.now() + env.OFFER_VALIDITY_DAYS * MS_DAY);
  // Atomic claim: a double click can send only once.
  const offer = await Offer.findOneAndUpdate(
    { _id: existing._id, status: OFFER_STATUS.DRAFT },
    { $set: { status: OFFER_STATUS.SENT, sentAt: new Date(), validUntil, acceptTokenHash: hashToken(token) } },
    { new: true }
  );
  if (!offer) throw conflict(`Only DRAFT offers can be sent (current: ${existing.status}).`, 'OFFER_NOT_DRAFT');

  const app = await Application.findById(offer.applicationId);
  try {
    moveApplication(app, APPLICATION_STATUS.OFFER_SENT, { req, note: `Offer ${offer.offerId} sent to candidate. Valid until ${formatDateLong(validUntil, req.timezone)}.` });
    await app.save();
  } catch (err) {
    await Offer.updateOne({ _id: offer._id }, { $set: { status: OFFER_STATUS.DRAFT }, $unset: { sentAt: '', validUntil: '', acceptTokenHash: '' } });
    throw err;
  }

  const offerLink = `${env.FRONTEND_URL}/offer/${token}`;
  emailService.queueEmail({
    to: existing.candidateId.email, subject: `Your internship offer: ${offer.title}`, template: 'OFFER_LETTER',
    text: `Hi ${existing.candidateId.firstName}, congratulations! Review and respond to your offer here (valid until ${formatDateLong(validUntil, req.timezone)}): ${offerLink}`,
    organizationId: req.organizationId
  });
  await recordAuditLog({ action: 'OFFER_SENT', entityType: 'Offer', entityId: offer._id, after: { offerId: offer.offerId, validUntil }, req });
  // The link is only ever shown to the authorised HR user (and emailed); it is stored as a hash.
  return successResponse(res, { offer, offerLink }, 'Offer sent to candidate');
});

export const revokeOffer = ah(async (req, res) => {
  const { reason } = new Validator(req.body).string('reason', { required: true, min: 3, max: 300 }).done();
  const existing = await Offer.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!existing) throw notFound('Offer not found');
  const offer = await Offer.findOneAndUpdate(
    { _id: existing._id, status: { $in: [OFFER_STATUS.DRAFT, ...OFFER_ACCEPTABLE_STATUSES] } },
    { $set: { status: OFFER_STATUS.REVOKED, revokedAt: new Date(), revokedReason: reason }, $unset: { openKey: '', acceptTokenHash: '' } },
    { new: true }
  );
  if (!offer) throw conflict(`An offer in status ${existing.status} cannot be revoked.`, 'OFFER_NOT_REVOCABLE');
  const app = await Application.findById(offer.applicationId);
  if (app && [APPLICATION_STATUS.OFFER_DRAFT, APPLICATION_STATUS.OFFER_SENT].includes(app.status)) {
    moveApplication(app, APPLICATION_STATUS.SELECTED, { req, note: `Offer ${offer.offerId} revoked: ${reason}` });
    await app.save();
  }
  await recordAuditLog({ action: 'OFFER_REVOKED', entityType: 'Offer', entityId: offer._id, after: { reason }, req });
  return successResponse(res, offer, 'Offer revoked');
});

// HR records an acceptance the candidate communicated outside the portal (email / phone / in person).
export const acceptOfferOnBehalf = ah(async (req, res) => {
  const v = new Validator(req.body).oneOf('channel', ['EMAIL', 'PHONE', 'IN_PERSON'], { required: true }).string('note', { required: true, min: 3, max: 500 });
  const { channel, note } = v.done();
  const result = await acceptOfferAtomically({
    offerId: req.params.id, filter: { organizationId: req.organizationId }, via: 'HR_ON_BEHALF',
    actor: req.user, note: `[${channel}] ${note}`, req
  });
  return successResponse(res, {
    offer: result.offer, intern: result.intern, onboardingPlan: result.plan, setupLink: result.setupLink
  }, 'Offer acceptance recorded. Intern workspace and onboarding checklist created.');
});

// ===========================================================================
// PUBLIC (candidate) endpoints - the secret link IS the credential
// ===========================================================================
async function loadByToken(token) {
  if (typeof token !== 'string' || token.length < 20) throw notFound('This offer link is not valid.', 'OFFER_LINK_INVALID');
  const found = await Offer.findOne({ acceptTokenHash: hashToken(token) }).select('_id');
  if (!found) throw notFound('This offer link is not valid or is no longer active.', 'OFFER_LINK_INVALID');
  await expireStaleOffers({ _id: found._id });
  return found._id;
}

export const getPublicOffer = ah(async (req, res) => {
  const id = await loadByToken(req.params.token);
  let offer = await Offer.findById(id).populate('candidateId', 'firstName').populate('departmentId', 'name')
    .populate('mentorId', 'firstName lastName').populate('organizationId', 'name logoUrl');
  if (offer.status === OFFER_STATUS.EXPIRED) throw gone('This offer has expired. Please contact the organization.', 'OFFER_EXPIRED');
  if (offer.status === OFFER_STATUS.SENT) {
    await Offer.updateOne({ _id: offer._id, status: OFFER_STATUS.SENT }, { $set: { status: OFFER_STATUS.VIEWED, viewedAt: new Date() } });
    offer = await Offer.findById(id).populate('candidateId', 'firstName').populate('departmentId', 'name')
      .populate('mentorId', 'firstName lastName').populate('organizationId', 'name logoUrl');
  }
  return successResponse(res, {
    offerId: offer.offerId, status: offer.status, title: offer.title, candidateFirstName: offer.candidateId?.firstName,
    organization: offer.organizationId, department: offer.departmentId?.name,
    mentor: offer.mentorId ? `${offer.mentorId.firstName} ${offer.mentorId.lastName}` : null,
    startDate: offer.startDate, endDate: offer.endDate, durationDays: offer.durationDays, workMode: offer.workMode,
    stipend: offer.stipend, responsibilities: offer.responsibilities, terms: offer.terms, validUntil: offer.validUntil
  });
});

export const acceptPublicOffer = ah(async (req, res) => {
  const id = await loadByToken(req.params.token);
  const result = await acceptOfferAtomically({ offerId: id, via: 'CANDIDATE_LINK', note: 'Accepted through the secure offer link.', req });
  return successResponse(res, {
    status: OFFER_STATUS.ACCEPTED, internId: result.intern.internId, setupLink: result.setupLink,
    message: 'Offer accepted. Set your password to sign in to your intern workspace.'
  }, 'Offer accepted successfully');
});

export const declinePublicOffer = ah(async (req, res) => {
  const id = await loadByToken(req.params.token);
  const { reason } = new Validator(req.body).string('reason', { max: 500 }).done();
  const offer = await Offer.findOneAndUpdate(
    { _id: id, status: { $in: OFFER_ACCEPTABLE_STATUSES }, validUntil: { $gt: new Date() } },
    { $set: { status: OFFER_STATUS.DECLINED, declinedAt: new Date(), declineReason: reason || '' }, $unset: { openKey: '', acceptTokenHash: '' } },
    { new: true }
  );
  if (!offer) throw conflict('This offer can no longer be declined.', 'OFFER_NOT_ACTIONABLE');
  const app = await Application.findById(offer.applicationId);
  if (app && app.status === APPLICATION_STATUS.OFFER_SENT) {
    moveApplication(app, APPLICATION_STATUS.OFFER_DECLINED, { note: `Offer ${offer.offerId} declined by the candidate.${reason ? ' Reason: ' + reason : ''}` });
    await app.save();
  }
  await recordAuditLog({ organizationId: offer.organizationId, actorRole: ROLES.CANDIDATE, action: 'OFFER_DECLINED', entityType: 'Offer', entityId: offer._id, after: { reason: reason || '' }, req });
  return successResponse(res, { status: OFFER_STATUS.DECLINED }, 'Offer declined');
});
