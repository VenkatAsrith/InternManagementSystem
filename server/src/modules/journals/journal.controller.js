import { JournalEntry } from './journal.model.js';
import { Intern } from '../interns/intern.model.js';
import { getOwnIntern, internScope } from '../interns/intern.access.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { createNotification } from '../notifications/notification.service.js';
import { JOURNAL_STATUS, ROLES } from '../../../../shared/constants.js';
import { INTERN_WORKING_STATUSES } from '../../../../shared/lifecycle.js';
import { ah } from '../../utils/asyncHandler.js';
import { notFound, conflict, forbidden } from '../../utils/errors.js';
import { Validator, parsePagination, isObjectId } from '../../utils/validate.js';
import { startOfDay } from '../../utils/time.js';

const MS_DAY = 86400000;

const journalFields = (body) => new Validator(body)
  .string('workSummary', { required: true, min: 10, max: 4000 })
  .string('whatILearned', { required: true, min: 5, max: 3000 })
  .string('challenges', { max: 2000 }).string('blockers', { max: 2000 }).string('nextSteps', { max: 2000 })
  .stringList('tasksCompleted', { max: 30, itemMax: 200 })
  .number('hoursWorked', { required: true, min: 0.5, max: 24 });

export const submitJournal = ah(async (req, res) => {
  const body = journalFields(req.body).done();
  const intern = await getOwnIntern(req);
  if (!INTERN_WORKING_STATUSES.includes(intern.status)) throw conflict(`Journals can only be logged while active (status: ${intern.status}).`, 'INTERN_NOT_ACTIVE');

  const today = startOfDay(new Date(), req.timezone);
  const start = startOfDay(intern.startDate, req.timezone);
  if (today < start) throw conflict('Your internship has not started yet.', 'BEFORE_START_DATE');
  // Day 1 is the start date itself; there is no off-by-one and no absolute value hiding a future start.
  const dayNumber = Math.round((today - start) / MS_DAY) + 1;

  try {
    const journal = await JournalEntry.create({
      internId: intern._id, userId: req.userId, organizationId: req.organizationId, date: today, dayNumber,
      workSummary: body.workSummary, tasksCompleted: body.tasksCompleted || [], whatILearned: body.whatILearned,
      challenges: body.challenges || '', blockers: body.blockers || '', nextSteps: body.nextSteps || '',
      hoursWorked: body.hoursWorked, status: JOURNAL_STATUS.SUBMITTED
    });
    if (intern.mentorId) {
      await createNotification({
        organizationId: req.organizationId, recipientId: intern.mentorId, type: 'JOURNAL_SUBMITTED', title: 'Daily Journal Submitted',
        message: `${req.user.firstName} submitted the Day ${dayNumber} journal.`, entityType: 'JournalEntry', entityId: journal._id
      });
    }
    await recordAuditLog({ action: 'JOURNAL_SUBMITTED', entityType: 'JournalEntry', entityId: journal._id, after: { dayNumber, hoursWorked: body.hoursWorked }, req });
    return successResponse(res, journal, 'Daily journal submitted successfully', 201);
  } catch (err) {
    if (err?.code === 11000) throw conflict('You have already submitted a journal for today. You can edit it until your mentor reviews it.', 'JOURNAL_EXISTS');
    throw err;
  }
});

// Same-day edit of your own journal, only until a mentor has reviewed it.
export const updateJournal = ah(async (req, res) => {
  const body = journalFields(req.body).done();
  const intern = await getOwnIntern(req);
  const journal = await JournalEntry.findOne({ _id: req.params.id, internId: intern._id });
  if (!journal) throw notFound('Journal entry not found');
  if (journal.status !== JOURNAL_STATUS.SUBMITTED) throw conflict('A reviewed journal can no longer be edited.', 'JOURNAL_LOCKED');
  if (journal.date.getTime() !== startOfDay(new Date(), req.timezone).getTime()) throw conflict('Only today\'s journal can be edited.', 'JOURNAL_LOCKED');
  Object.assign(journal, { ...body, tasksCompleted: body.tasksCompleted || [] });
  await journal.save();
  await recordAuditLog({ action: 'JOURNAL_UPDATED', entityType: 'JournalEntry', entityId: journal._id, req });
  return successResponse(res, journal, 'Journal updated');
});

export const getJournals = ah(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 30, maxLimit: 100 });
  const internIds = await Intern.find(internScope(req)).distinct('_id');
  const query = { organizationId: req.organizationId, internId: { $in: internIds } };
  if (isObjectId(req.query.internId) && req.userRole !== ROLES.INTERN) query.internId = { $in: internIds.filter(id => String(id) === req.query.internId) };
  if (Object.values(JOURNAL_STATUS).includes(req.query.status)) query.status = req.query.status;

  const [journals, total] = await Promise.all([
    JournalEntry.find(query).populate('userId', 'firstName lastName email avatarUrl').populate('internId', 'internId programId')
      .sort({ date: -1 }).skip(skip).limit(limit),
    JournalEntry.countDocuments(query)
  ]);
  return paginatedResponse(res, journals, { page, limit, total });
});

export const getJournalById = ah(async (req, res) => {
  const internIds = await Intern.find(internScope(req)).distinct('_id');
  const journal = await JournalEntry.findOne({ _id: req.params.id, organizationId: req.organizationId, internId: { $in: internIds } })
    .populate('userId', 'firstName lastName email avatarUrl').populate('mentorReview.reviewerId', 'firstName lastName email');
  if (!journal) throw notFound('Journal entry not found');
  return successResponse(res, journal);
});

export const reviewJournal = ah(async (req, res) => {
  const { comments } = new Validator(req.body).string('comments', { required: true, min: 3, max: 2000 }).done();
  const internIds = await Intern.find(internScope(req)).distinct('_id');
  const journal = await JournalEntry.findOne({ _id: req.params.id, organizationId: req.organizationId, internId: { $in: internIds } });
  if (!journal) throw notFound('Journal entry not found');
  if (String(journal.userId) === String(req.userId)) throw forbidden('You cannot review your own journal.', 'SELF_REVIEW');

  const updated = await JournalEntry.findOneAndUpdate(
    { _id: journal._id, status: JOURNAL_STATUS.SUBMITTED },
    { $set: { status: JOURNAL_STATUS.REVIEWED, mentorReview: { reviewerId: req.userId, comments, reviewedAt: new Date() } } },
    { new: true }
  );
  if (!updated) throw conflict('This journal has already been reviewed.', 'ALREADY_REVIEWED');
  await createNotification({
    organizationId: req.organizationId, recipientId: journal.userId, type: 'JOURNAL_REVIEWED', title: 'Journal Entry Reviewed',
    message: `Your mentor left feedback on your Day ${journal.dayNumber} journal.`, entityType: 'JournalEntry', entityId: journal._id
  });
  await recordAuditLog({ action: 'JOURNAL_REVIEWED', entityType: 'JournalEntry', entityId: journal._id, after: { comments }, req });
  return successResponse(res, updated, 'Journal entry reviewed successfully');
});
