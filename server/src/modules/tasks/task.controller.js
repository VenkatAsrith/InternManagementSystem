import { Task, TaskSubmission } from './task.model.js';
import { Project } from '../projects/project.model.js';
import { recomputeProjectProgress } from '../projects/project.service.js';
import { Intern } from '../interns/intern.model.js';
import { User } from '../users/user.model.js';
import { internScope } from '../interns/intern.access.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { createNotification } from '../notifications/notification.service.js';
import { TASK_STATUS, TASK_PRIORITY, SUBMISSION_STATUS, ROLES } from '../../../../shared/constants.js';
import {
  TASK_ASSIGNEE_TRANSITIONS, TASK_STAFF_TRANSITIONS, TASK_SUBMITTABLE_STATUSES, TASK_REVIEWABLE_STATUSES, INTERN_WORKING_STATUSES, assertTransition
} from '../../../../shared/lifecycle.js';
import { ah } from '../../utils/asyncHandler.js';
import { notFound, conflict, forbidden, unprocessable } from '../../utils/errors.js';
import { Validator, parsePagination, isObjectId, isSafeHttpUrl } from '../../utils/validate.js';

const MENTEE_SCOPED = [ROLES.MENTOR, ROLES.TEAM_LEAD];

/** Which tasks may this caller see? interns: assigned to them. mentors: their mentees' tasks + ones they created. Private tasks: creator only. */
async function taskScope(req) {
  const scope = { organizationId: req.organizationId };
  if (req.userRole === ROLES.INTERN) scope.assignedTo = req.userId;
  else if (MENTEE_SCOPED.includes(req.userRole)) {
    const menteeUsers = await Intern.find(internScope(req)).distinct('userId');
    scope.$or = [{ assignedTo: { $in: menteeUsers } }, { createdBy: req.userId }];
  }
  const privateFilter = {
    $or: [
      { visibility: { $ne: 'PRIVATE' } },
      { createdBy: req.userId }
    ]
  };
  if (scope.$or) {
    scope.$and = [{ $or: scope.$or }, privateFilter];
    delete scope.$or;
  } else {
    scope.$or = privateFilter.$or;
  }
  return scope;
}

async function loadScopedTask(req, id) {
  const raw = await Task.findOne({ _id: id, organizationId: req.organizationId });
  if (!raw) throw notFound('Task not found');
  if (raw.visibility === 'PRIVATE' && String(raw.createdBy) !== String(req.userId)) {
    throw forbidden('This task is private to its creator.');
  }
  const task = await Task.findOne({ ...(await taskScope(req)), _id: id });
  if (!task) throw notFound('Task not found');
  return task;
}

async function validateAssignees(req, ids) {
  if (!ids || !ids.length) return [];
  const users = await User.find({ _id: { $in: ids }, organizationId: req.organizationId, isActive: true, role: ROLES.INTERN });
  if (users.length !== ids.length) throw unprocessable('Tasks can only be assigned to active interns in your organization.', [{ field: 'assignedTo', message: 'Unknown or inactive intern' }]);
  const interns = await Intern.find({ userId: { $in: ids }, organizationId: req.organizationId });
  const notWorking = interns.filter(i => !INTERN_WORKING_STATUSES.includes(i.status));
  if (notWorking.length) throw unprocessable('Some interns are not in a working status and cannot receive tasks.', [{ field: 'assignedTo', message: `${notWorking.length} intern(s) not active` }]);
  if (MENTEE_SCOPED.includes(req.userRole)) {
    const allowed = new Set((await Intern.find(internScope(req)).distinct('userId')).map(String));
    if (ids.some(id => !allowed.has(String(id)))) throw forbidden('You can only assign tasks to interns you supervise.', 'NOT_YOUR_MENTEE');
  }
  return ids;
}

async function validateLinks(links) {
  const errors = [];
  const out = (Array.isArray(links) ? links : []).slice(0, 10).map((l, i) => {
    const label = String(l?.label || 'Link').slice(0, 60);
    const url = String(l?.url || '').trim();
    if (!isSafeHttpUrl(url)) errors.push({ field: `links[${i}].url`, message: 'Enter a valid http(s) URL' });
    return { label, url };
  });
  if (errors.length) throw unprocessable('Invalid link', errors);
  return out;
}

const taskFields = (body, { create }) => new Validator(body)
  .string('title', { required: create, max: 200 })
  .string('description', { max: 5000 })
  .objectId('projectId')
  .objectIdList('assignedTo', { max: 10 })
  .oneOf('priority', TASK_PRIORITY, { defaultValue: create ? TASK_PRIORITY.MEDIUM : undefined })
  .string('startDate', { max: 30 })
  .string('dueDate', { max: 30 })
  .number('estimatedHours', { min: 0, max: 1000 })
  .stringList('tags', { max: 20, itemMax: 40 });

function checkDates(body) {
  const s = body.startDate ? new Date(body.startDate) : null;
  const d = body.dueDate ? new Date(body.dueDate) : null;
  const errors = [];
  if (s && Number.isNaN(s.getTime())) errors.push({ field: 'startDate', message: 'Invalid date' });
  if (d && Number.isNaN(d.getTime())) errors.push({ field: 'dueDate', message: 'Invalid date' });
  if (!errors.length && s && d && d < s) errors.push({ field: 'dueDate', message: 'Due date cannot be before the start date' });
  if (errors.length) throw unprocessable('Invalid task dates', errors);
  return { startDate: s || undefined, dueDate: d || undefined };
}

async function assertProject(req, projectId) {
  if (!projectId) return;
  if (!(await Project.exists({ _id: projectId, organizationId: req.organizationId }))) {
    throw unprocessable('Project not found in your organization', [{ field: 'projectId', message: 'Unknown project' }]);
  }
}

export const getTasks = ah(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 200 });
  const query = await taskScope(req);
  if (Object.values(TASK_STATUS).includes(req.query.status)) query.status = req.query.status;
  if (Object.values(TASK_PRIORITY).includes(req.query.priority)) query.priority = req.query.priority;
  if (isObjectId(req.query.projectId)) query.projectId = req.query.projectId;
  if (isObjectId(req.query.assignedTo) && req.userRole !== ROLES.INTERN) query.assignedTo = req.query.assignedTo;

  const [tasks, total] = await Promise.all([
    Task.find(query)
      .populate('assignedTo', 'firstName lastName email avatarUrl').populate('createdBy', 'firstName lastName').populate('projectId', 'name')
      .sort({ dueDate: 1, createdAt: -1 }).skip(skip).limit(limit),
    Task.countDocuments(query)
  ]);
  return paginatedResponse(res, tasks, { page, limit, total });
});

export const createTask = ah(async (req, res) => {
  const body = taskFields(req.body, { create: true }).done();
  const initial = req.body?.status === TASK_STATUS.BACKLOG ? TASK_STATUS.BACKLOG : TASK_STATUS.TODO;
  const dates = checkDates(body);
  await assertProject(req, body.projectId);
  const assignedTo = await validateAssignees(req, body.assignedTo);
  const links = await validateLinks(req.body?.links);

  const visibility = ['PUBLIC', 'INTERNAL', 'PRIVATE'].includes(req.body?.visibility) ? req.body.visibility : 'PUBLIC';
  const task = await Task.create({
    organizationId: req.organizationId, projectId: body.projectId, title: body.title, description: body.description || '',
    assignedTo, createdBy: req.userId, priority: body.priority, status: initial, ...dates,
    estimatedHours: body.estimatedHours || 0, tags: body.tags || [], links, visibility
  });
  if (task.projectId) await recomputeProjectProgress(task.projectId);
  await Promise.all(assignedTo.map(id => createNotification({
    organizationId: req.organizationId, recipientId: id, type: 'TASK_ASSIGNED', title: 'New Task Assigned',
    message: `You were assigned task "${task.title}".`, entityType: 'Task', entityId: task._id
  })));
  await recordAuditLog({ action: 'TASK_CREATED', entityType: 'Task', entityId: task._id, after: task.toObject(), req });
  return successResponse(res, task, 'Task created successfully', 201);
});

export const getTaskById = ah(async (req, res) => {
  const raw = await Task.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!raw) throw notFound('Task not found');
  if (raw.visibility === 'PRIVATE' && String(raw.createdBy) !== String(req.userId)) {
    throw forbidden('This task is private to its creator.');
  }

  const scope = await taskScope(req);
  const task = await Task.findOne({ ...scope, _id: req.params.id })
    .populate('assignedTo', 'firstName lastName email avatarUrl').populate('createdBy', 'firstName lastName email').populate('projectId');
  if (!task) throw notFound('Task not found');
  const submissions = await TaskSubmission.find({ taskId: task._id })
    .populate('submittedBy', 'firstName lastName email').populate('reviewerId', 'firstName lastName email').sort({ version: -1 });
  return successResponse(res, { task, submissions });
});

// Whitelisted edit. Status is deliberately NOT editable here (see changeTaskStatus / submit / review).
export const updateTask = ah(async (req, res) => {
  const task = await loadScopedTask(req, req.params.id);
  if ([TASK_STATUS.APPROVED, TASK_STATUS.CANCELLED].includes(task.status)) throw conflict(`A ${task.status} task can no longer be edited.`, 'TASK_LOCKED');
  const body = taskFields(req.body, { create: false }).done();
  const dates = checkDates({ startDate: body.startDate ?? task.startDate, dueDate: body.dueDate ?? task.dueDate });
  if (body.projectId) await assertProject(req, body.projectId);
  const before = task.toObject();
  const newAssignees = body.assignedTo ? await validateAssignees(req, body.assignedTo) : null;

  for (const k of ['title', 'description', 'projectId', 'priority', 'estimatedHours', 'tags']) if (body[k] !== undefined) task[k] = body[k];
  if (body.startDate) task.startDate = dates.startDate;
  if (body.dueDate) task.dueDate = dates.dueDate;
  if (req.body?.links !== undefined) task.links = await validateLinks(req.body.links);
  let added = [];
  if (newAssignees) {
    added = newAssignees.filter(id => !task.assignedTo.some(a => String(a) === String(id)));
    task.assignedTo = newAssignees;
  }
  await task.save();
  if (task.projectId) await recomputeProjectProgress(task.projectId);
  if (String(before.projectId || '') !== String(task.projectId || '') && before.projectId) await recomputeProjectProgress(before.projectId);
  await Promise.all(added.map(id => createNotification({
    organizationId: req.organizationId, recipientId: id, type: 'TASK_ASSIGNED', title: 'New Task Assigned', message: `You were assigned task "${task.title}".`, entityType: 'Task', entityId: task._id
  })));
  await recordAuditLog({ action: 'TASK_UPDATED', entityType: 'Task', entityId: task._id, before, after: task.toObject(), req });
  return successResponse(res, task, 'Task updated successfully');
});

export const changeTaskStatus = ah(async (req, res) => {
  const { status } = new Validator(req.body).oneOf('status', TASK_STATUS, { required: true }).done();
  const task = await loadScopedTask(req, req.params.id);
  const isAssignee = task.assignedTo.some(a => String(a) === String(req.userId));
  const isStaff = req.can('tasks.assign');

  // Who is acting decides which transition table applies.
  let table;
  if (isStaff) table = TASK_STAFF_TRANSITIONS;
  else if (isAssignee && req.can('tasks.progress')) table = TASK_ASSIGNEE_TRANSITIONS;
  else throw forbidden('Only the assignee or a task manager can change this task.', 'FORBIDDEN');
  assertTransition('task', table, task.status, status);

  // Atomic against the status we validated: a concurrent change makes this fail instead of overwriting.
  const updated = await Task.findOneAndUpdate({ _id: task._id, status: task.status }, { $set: { status } }, { new: true });
  if (!updated) throw conflict('The task changed while you were updating it. Refresh and try again.', 'STATE_CHANGED');
  if (updated.projectId) await recomputeProjectProgress(updated.projectId);
  await recordAuditLog({ action: 'TASK_STATUS_CHANGED', entityType: 'Task', entityId: task._id, before: { status: task.status }, after: { status }, req });
  return successResponse(res, updated, `Task moved to ${status}`);
});

export const submitTaskDeliverable = ah(async (req, res) => {
  const body = new Validator(req.body).string('description', { required: true, min: 5, max: 5000 }).done();
  const task = await Task.findOne({ _id: req.params.id, organizationId: req.organizationId, assignedTo: req.userId });
  if (!task) throw notFound('Task not found');
  if (!TASK_SUBMITTABLE_STATUSES.includes(task.status)) {
    throw conflict(task.status === TASK_STATUS.TODO ? 'Start the task (move it to In Progress) before submitting.' : `A ${task.status} task cannot be submitted.`, 'INVALID_TRANSITION');
  }
  const links = await validateLinks(req.body?.links);

  // Atomic claim first: only one submission can move the task to SUBMITTED.
  const claimed = await Task.findOneAndUpdate({ _id: task._id, status: task.status }, { $set: { status: TASK_STATUS.SUBMITTED } }, { new: true });
  if (!claimed) throw conflict('This task was already submitted.', 'ALREADY_SUBMITTED');

  let submission;
  try {
    const latest = await TaskSubmission.findOne({ taskId: task._id }).sort({ version: -1 });
    submission = await TaskSubmission.create({ taskId: task._id, submittedBy: req.userId, description: body.description, links, version: latest ? latest.version + 1 : 1, status: SUBMISSION_STATUS.SUBMITTED });
  } catch (err) {
    await Task.updateOne({ _id: task._id }, { $set: { status: task.status } }); // undo the claim
    throw err;
  }
  if (task.projectId) await recomputeProjectProgress(task.projectId);
  await createNotification({
    organizationId: req.organizationId, recipientId: task.createdBy, type: 'TASK_SUBMITTED', title: 'Task Deliverable Submitted',
    message: `${req.user.firstName} submitted work for review on "${task.title}".`, entityType: 'Task', entityId: task._id
  });
  await recordAuditLog({ action: 'TASK_SUBMISSION_CREATED', entityType: 'Task', entityId: task._id, after: { version: submission.version, submissionId: submission._id }, req });
  return successResponse(res, { task: claimed, submission }, 'Task deliverable submitted for review', 201);
});

export const reviewTaskSubmission = ah(async (req, res) => {
  const v = new Validator(req.body)
    .objectId('submissionId', { required: true })
    .oneOf('decision', [SUBMISSION_STATUS.APPROVED, SUBMISSION_STATUS.REVISION_REQUIRED, SUBMISSION_STATUS.REJECTED], { required: true })
    .string('reviewNotes', { max: 2000 });
  const { submissionId, decision, reviewNotes } = v.done();
  if (decision !== SUBMISSION_STATUS.APPROVED && !reviewNotes) {
    throw unprocessable('Explain what needs to change.', [{ field: 'reviewNotes', message: 'Review notes are required' }]);
  }

  const task = await loadScopedTask(req, req.params.id);
  if (task.assignedTo.some(a => String(a) === String(req.userId))) throw forbidden('You cannot review your own work.', 'SELF_REVIEW');
  if (!TASK_REVIEWABLE_STATUSES.includes(task.status)) throw conflict(`A ${task.status} task is not awaiting review.`, 'INVALID_TRANSITION');

  // The submission must belong to THIS task and be its latest, still-pending version.
  const latest = await TaskSubmission.findOne({ taskId: task._id }).sort({ version: -1 });
  if (!latest || String(latest._id) !== String(submissionId)) throw unprocessable('That submission is not the latest submission of this task.', [{ field: 'submissionId', message: 'Not the latest submission' }]);
  const claimed = await TaskSubmission.findOneAndUpdate(
    { _id: latest._id, status: SUBMISSION_STATUS.SUBMITTED },
    { $set: { status: decision, reviewerId: req.userId, reviewNotes: reviewNotes || '', reviewedAt: new Date() } }, { new: true }
  );
  if (!claimed) throw conflict('This submission has already been reviewed.', 'ALREADY_REVIEWED');

  const next = { APPROVED: TASK_STATUS.APPROVED, REVISION_REQUIRED: TASK_STATUS.REVISION_REQUIRED, REJECTED: TASK_STATUS.IN_PROGRESS }[decision];
  const set = { status: next };
  if (next === TASK_STATUS.APPROVED) set.completedAt = new Date();
  const updated = await Task.findOneAndUpdate({ _id: task._id, status: { $in: TASK_REVIEWABLE_STATUSES } }, { $set: set }, { new: true });
  if (!updated) throw conflict('The task changed during review.', 'STATE_CHANGED');
  if (updated.projectId) await recomputeProjectProgress(updated.projectId);

  await Promise.all(task.assignedTo.map(id => createNotification({
    organizationId: req.organizationId, recipientId: id, type: decision === 'APPROVED' ? 'TASK_APPROVED' : 'REVISION_REQUESTED',
    title: decision === 'APPROVED' ? 'Task Approved!' : 'Task Revision Requested',
    message: `Your task "${task.title}" was reviewed: ${decision}. Notes: ${reviewNotes || 'None'}`, entityType: 'Task', entityId: task._id
  })));
  await recordAuditLog({ action: 'TASK_REVIEWED', entityType: 'Task', entityId: task._id, before: { status: task.status }, after: { decision, status: next, reviewNotes: reviewNotes || '' }, req });
  return successResponse(res, { task: updated, submission: claimed }, `Task review completed: ${decision}`);
});
