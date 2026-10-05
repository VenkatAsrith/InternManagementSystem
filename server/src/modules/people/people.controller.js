import { Person } from './people.model.js';
import { AuditLog } from '../audit/audit.model.js';
import { successResponse, paginatedResponse, errorResponse } from '../../utils/response.js';
import { Validator, parsePagination, escapeRegex } from '../../utils/validate.js';
import { notFound, conflict, badRequest } from '../../utils/errors.js';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizePhone(phone) {
  return String(phone || '').replace(/[^0-9+]/g, '');
}

export async function getPeople(req, res) {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const filter = { organizationId: req.organizationId };

  if (req.query.status) {
    filter.status = req.query.status;
  } else {
    filter.status = { $ne: 'MERGED' };
  }

  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search.trim()), 'i');
    filter.$or = [
      { firstName: rx },
      { lastName: rx },
      { email: rx },
      { phone: rx }
    ];
  }

  const [people, total] = await Promise.all([
    Person.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Person.countDocuments(filter)
  ]);

  return paginatedResponse(res, people, { page, limit, total });
}

export async function createPerson(req, res) {
  const v = new Validator(req.body)
    .string('firstName', { required: true, min: 1, max: 100 })
    .string('lastName', { required: true, min: 1, max: 100 })
    .email('email', { required: true })
    .phone('phone', { required: true });

  const data = v.done();
  const normEmail = normalizeEmail(data.email);
  const normPhone = normalizePhone(data.phone);

  const existing = await Person.findOne({
    organizationId: req.organizationId,
    $or: [{ normalizedEmail: normEmail }, { normalizedPhone: normPhone }],
    status: { $ne: 'MERGED' }
  });

  if (existing) {
    if (!req.body.allowDuplicateReview) {
      return errorResponse(res, 'A Person with this email or phone already exists.', 409, 'DUPLICATE_PERSON', {
        existingPersonId: existing._id,
        matchedOn: existing.normalizedEmail === normEmail ? 'email' : 'phone'
      });
    }
  }

  const person = await Person.create({
    organizationId: req.organizationId,
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    normalizedEmail: normEmail,
    phone: data.phone,
    normalizedPhone: normPhone,
    status: existing ? 'DUPLICATE_REVIEW' : 'ACTIVE',
    metadata: req.body.metadata || {},
    timeline: [{
      event: 'PERSON_CREATED',
      timestamp: new Date(),
      details: { actor: req.user.email, source: req.body.source || 'MANUAL' },
      actorId: req.user._id
    }]
  });

  return successResponse(res, person, 'Person created successfully', 201);
}

export async function getPersonById(req, res) {
  const person = await Person.findOne({
    _id: req.params.id,
    organizationId: req.organizationId
  }).lean();

  if (!person) throw notFound('Person not found');
  return successResponse(res, person);
}

export async function updatePerson(req, res) {
  const person = await Person.findOne({
    _id: req.params.id,
    organizationId: req.organizationId
  });

  if (!person) throw notFound('Person not found');
  if (person.status === 'MERGED') throw badRequest('Cannot update a merged Person');

  const updates = {};
  if (req.body.firstName) updates.firstName = req.body.firstName.trim();
  if (req.body.lastName) updates.lastName = req.body.lastName.trim();
  if (req.body.email) {
    updates.email = req.body.email.trim();
    updates.normalizedEmail = normalizeEmail(req.body.email);
  }
  if (req.body.phone) {
    updates.phone = req.body.phone.trim();
    updates.normalizedPhone = normalizePhone(req.body.phone);
  }
  if (req.body.metadata) updates.metadata = { ...person.metadata, ...req.body.metadata };

  Object.assign(person, updates);
  person.timeline.push({
    event: 'PERSON_UPDATED',
    timestamp: new Date(),
    details: updates,
    actorId: req.user._id
  });

  await person.save();
  return successResponse(res, person, 'Person updated successfully');
}

export async function mergePeople(req, res) {
  const sourcePersonId = req.params.id;
  const { canonicalPersonId, reason = 'Duplicate identity resolution' } = req.body;

  if (!canonicalPersonId || String(sourcePersonId) === String(canonicalPersonId)) {
    throw badRequest('Must provide a valid distinct canonicalPersonId');
  }

  const [sourcePerson, targetPerson] = await Promise.all([
    Person.findOne({ _id: sourcePersonId, organizationId: req.organizationId }),
    Person.findOne({ _id: canonicalPersonId, organizationId: req.organizationId })
  ]);

  if (!sourcePerson) throw notFound('Source Person not found');
  if (!targetPerson) throw notFound('Canonical Person not found');
  if (sourcePerson.status === 'MERGED') throw badRequest('Source Person is already merged');

  // Mark source person as merged
  sourcePerson.status = 'MERGED';
  sourcePerson.mergedInto = targetPerson._id;
  sourcePerson.timeline.push({
    event: 'PERSON_MERGED_OUT',
    timestamp: new Date(),
    details: { mergedInto: targetPerson._id, reason, actor: req.user.email },
    actorId: req.user._id
  });
  await sourcePerson.save();

  // Update target person timeline
  targetPerson.timeline.push({
    event: 'PERSON_MERGED_IN',
    timestamp: new Date(),
    details: { mergedFrom: sourcePerson._id, reason, actor: req.user.email },
    actorId: req.user._id
  });
  await targetPerson.save();

  // Create immutable AuditLog
  await AuditLog.create({
    organizationId: req.organizationId,
    actorId: req.user._id,
    actorRole: req.user.role,
    action: 'PERSON_MERGE',
    entityType: 'Person',
    entityId: sourcePerson._id,
    diff: {
      sourcePersonId: sourcePerson._id,
      canonicalPersonId: targetPerson._id,
      reason
    }
  });

  return successResponse(res, {
    canonicalPerson: targetPerson,
    sourcePerson
  }, 'Person merged successfully');
}

export async function getPersonTimeline(req, res) {
  const person = await Person.findOne({
    _id: req.params.id,
    organizationId: req.organizationId
  }).select('timeline firstName lastName email').lean();

  if (!person) throw notFound('Person not found');
  return successResponse(res, {
    personId: person._id,
    name: `${person.firstName} ${person.lastName}`,
    email: person.email,
    timeline: person.timeline || []
  });
}
