import { Feedback } from './feedback.model.js';
import { Intern } from '../interns/intern.model.js';
import { Task } from '../tasks/task.model.js';
import { internScope, getOwnIntern } from '../interns/intern.access.js';
import { successResponse } from '../../utils/response.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { ROLES } from '../../../../shared/constants.js';
import { ah } from '../../utils/asyncHandler.js';
import { notFound, unprocessable } from '../../utils/errors.js';
import { Validator, isObjectId } from '../../utils/validate.js';

const VISIBILITY = ['PRIVATE', 'INTERN_VISIBLE', 'MANAGER_ONLY', 'HR_ONLY'];

export const getFeedback = ah(async (req, res) => {
  const query = { organizationId: req.organizationId };
  if (req.userRole === ROLES.INTERN) {
    const intern = await getOwnIntern(req);
    query.internId = intern._id;
    query.visibility = 'INTERN_VISIBLE';
  } else {
    const internIds = await Intern.find(internScope(req)).distinct('_id');
    query.internId = { $in: internIds };
    if (isObjectId(req.query.internId)) query.internId = { $in: internIds.filter(id => String(id) === req.query.internId) };
    // HR_ONLY / MANAGER_ONLY notes are hidden from mentors and team leads unless they wrote them.
    if ([ROLES.MENTOR, ROLES.TEAM_LEAD].includes(req.userRole)) query.$or = [{ visibility: { $in: ['INTERN_VISIBLE', 'PRIVATE'] } }, { authorId: req.userId }];
  }
  const feedbacks = await Feedback.find(query)
    .populate('authorId', 'firstName lastName avatarUrl role').populate('recipientId', 'firstName lastName')
    .populate('relatedTaskId', 'title').populate('relatedProjectId', 'name').sort({ createdAt: -1 }).limit(200);
  return successResponse(res, feedbacks);
});

export const createFeedback = ah(async (req, res) => {
  const v = new Validator(req.body)
    .objectId('internId', { required: true }).number('rating', { min: 1, max: 10, integer: true })
    .string('comment', { required: true, min: 3, max: 3000 }).oneOf('visibility', VISIBILITY, { defaultValue: 'INTERN_VISIBLE' })
    .objectId('relatedTaskId').objectId('relatedProjectId');
  const body = v.done();
  const intern = await Intern.findOne({ _id: body.internId, ...internScope(req) });
  if (!intern) throw notFound('Intern not found');
  if (body.relatedTaskId && !(await Task.exists({ _id: body.relatedTaskId, organizationId: req.organizationId, assignedTo: intern.userId }))) {
    throw unprocessable('That task is not assigned to this intern.', [{ field: 'relatedTaskId', message: 'Unknown task' }]);
  }
  const type = req.userRole === ROLES.MENTOR ? 'MENTOR' : [ROLES.PROGRAM_MANAGER, ROLES.TEAM_LEAD].includes(req.userRole) ? 'MANAGER' : 'HR';
  // The recipient is ALWAYS the intern being discussed: it is derived, not trusted from the browser.
  const feedback = await Feedback.create({ organizationId: req.organizationId, type, authorId: req.userId, recipientId: intern.userId, ...body });
  await recordAuditLog({ action: 'FEEDBACK_CREATED', entityType: 'Feedback', entityId: feedback._id, after: { internId: intern.internId, visibility: body.visibility }, req });
  return successResponse(res, feedback, 'Feedback recorded successfully', 201);
});
