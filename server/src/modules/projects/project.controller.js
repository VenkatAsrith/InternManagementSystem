import { Project } from './project.model.js';
import { Task } from '../tasks/task.model.js';
import { User } from '../users/user.model.js';
import { Document } from '../documents/document.model.js';
import { Conversation } from '../chat/chat.model.js';
import { InternshipProgram } from '../recruitment/recruitment.model.js';
import { recomputeProjectProgress } from './project.service.js';
import { successResponse } from '../../utils/response.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { PROJECT_STATUS, TASK_STATUS, ROLES } from '../../../../shared/constants.js';
import { ah } from '../../utils/asyncHandler.js';
import { notFound, conflict, unprocessable } from '../../utils/errors.js';
import { Validator } from '../../utils/validate.js';

const PROJECT_TRANSITIONS = {
  PLANNED: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
  ON_HOLD: ['ACTIVE', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: []
};

async function validateMembers(req, ids) {
  if (!ids?.length) return [];
  const count = await User.countDocuments({ _id: { $in: ids }, organizationId: req.organizationId, isActive: true });
  if (count !== ids.length) throw unprocessable('All members must be active users in your organization.', [{ field: 'members', message: 'Unknown or inactive member' }]);
  return ids;
}

const fields = (body, create) => new Validator(body)
  .string('name', { required: create, max: 150 }).string('description', { max: 3000 }).string('objective', { max: 1000 })
  .objectId('programId').objectIdList('members', { max: 50 })
  .string('startDate', { required: create, max: 30 }).string('endDate', { required: create, max: 30 })
  .url('repositoryUrl').url('documentationUrl');

function dates(startRaw, endRaw) {
  const start = startRaw ? new Date(startRaw) : null;
  const end = endRaw ? new Date(endRaw) : null;
  const errors = [];
  if (start && Number.isNaN(start.getTime())) errors.push({ field: 'startDate', message: 'Invalid date' });
  if (end && Number.isNaN(end.getTime())) errors.push({ field: 'endDate', message: 'Invalid date' });
  if (!errors.length && start && end && end <= start) errors.push({ field: 'endDate', message: 'End date must be after the start date' });
  if (errors.length) throw unprocessable('Invalid project dates', errors);
  return { start, end };
}

export const getProjects = ah(async (req, res) => {
  const query = { organizationId: req.organizationId };
  if ([ROLES.INTERN, ROLES.INTERN_TRAINEE].includes(req.userRole)) query.$or = [{ members: req.userId }, { ownerId: req.userId }];
  const projects = await Project.find(query)
    .populate('ownerId', 'firstName lastName email').populate('members', 'firstName lastName email avatarUrl').populate('programId', 'title')
    .sort({ createdAt: -1 });
  return successResponse(res, projects);
});

export const createProject = ah(async (req, res) => {
  const body = fields(req.body, true).done();
  const { start, end } = dates(body.startDate, body.endDate);
  if (body.programId && !(await InternshipProgram.exists({ _id: body.programId, organizationId: req.organizationId }))) {
    throw unprocessable('Program not found in your organization', [{ field: 'programId', message: 'Unknown program' }]);
  }
  const members = await validateMembers(req, body.members);
  const project = await Project.create({
    organizationId: req.organizationId, programId: body.programId, name: body.name, description: body.description, objective: body.objective,
    ownerId: req.userId, members, startDate: start, endDate: end, repositoryUrl: body.repositoryUrl || '', documentationUrl: body.documentationUrl || '',
    status: PROJECT_STATUS.ACTIVE, progress: 0
  });
  await recordAuditLog({ action: 'PROJECT_CREATED', entityType: 'Project', entityId: project._id, after: project.toObject(), req });
  return successResponse(res, project, 'Project created successfully', 201);
});

export const getProjectById = ah(async (req, res) => {
  const query = { _id: req.params.id, organizationId: req.organizationId };
  if ([ROLES.INTERN, ROLES.INTERN_TRAINEE].includes(req.userRole)) query.$or = [{ members: req.userId }, { ownerId: req.userId }];
  const project = await Project.findOne(query)
    .populate('ownerId', 'firstName lastName email').populate('members', 'firstName lastName email avatarUrl role').populate('programId', 'title');
  if (!project) throw notFound('Project not found');

  const taskQuery = { projectId: project._id };
  if ([ROLES.INTERN, ROLES.INTERN_TRAINEE].includes(req.userRole)) taskQuery.assignedTo = req.userId;
  const tasks = await Task.find(taskQuery).select('title status priority dueDate assignedTo');
  const done = tasks.filter(t => t.status === TASK_STATUS.APPROVED).length;
  const open = tasks.filter(t => t.status !== TASK_STATUS.CANCELLED).length;

  const documents = await Document.find({ projectId: project._id, organizationId: req.organizationId })
    .populate('uploadedBy', 'firstName lastName email')
    .sort({ createdAt: -1 });

  return successResponse(res, { project, tasks, documents, metrics: { totalTasks: open, completedTasks: done, pendingTasks: open - done } });
});

export const updateProject = ah(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!project) throw notFound('Project not found');
  const body = fields(req.body, false).done();
  const { start, end } = dates(body.startDate || project.startDate, body.endDate || project.endDate);
  const before = project.toObject();

  for (const k of ['name', 'description', 'objective', 'repositoryUrl', 'documentationUrl']) if (body[k] !== undefined) project[k] = body[k];
  if (body.startDate) project.startDate = start;
  if (body.endDate) project.endDate = end;
  if (body.members) project.members = await validateMembers(req, body.members);

  const requested = req.body?.status;
  if (requested && requested !== project.status) {
    if (!Object.values(PROJECT_STATUS).includes(requested)) throw unprocessable('Unknown status', [{ field: 'status', message: 'Unknown status' }]);
    if (!(PROJECT_TRANSITIONS[project.status] || []).includes(requested)) throw conflict(`Project cannot move from ${project.status} to ${requested}.`, 'INVALID_TRANSITION');
    project.status = requested;
  }
  await project.save();
  await recomputeProjectProgress(project._id);
  await recordAuditLog({ action: 'PROJECT_UPDATED', entityType: 'Project', entityId: project._id, before, after: project.toObject(), req });
  return successResponse(res, project, 'Project updated successfully');
});

export const addProjectMember = ah(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!project) throw notFound('Project not found');
  const { userId } = new Validator(req.body).objectId('userId', { required: true }).done();
  const user = await User.findOne({ _id: userId, organizationId: req.organizationId, isActive: true });
  if (!user) throw notFound('User not found in your organization');

  if (!project.members.some(m => String(m) === String(userId))) {
    project.members.push(userId);
    await project.save();
    await recordAuditLog({ action: 'PROJECT_MEMBER_ADDED', entityType: 'Project', entityId: project._id, after: { memberId: userId }, req });
  }

  // Also add to project conversation if exists
  await Conversation.updateOne(
    { projectId: project._id, organizationId: req.organizationId },
    { $addToSet: { members: userId } }
  );

  const updated = await Project.findById(project._id)
    .populate('ownerId', 'firstName lastName email').populate('members', 'firstName lastName email avatarUrl role').populate('programId', 'title');
  return successResponse(res, updated, 'Member added successfully');
});

export const removeProjectMember = ah(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!project) throw notFound('Project not found');
  const memberId = req.params.memberId;

  project.members = project.members.filter(m => String(m) !== String(memberId));
  await project.save();

  // Also remove from project conversation
  await Conversation.updateOne(
    { projectId: project._id, organizationId: req.organizationId },
    { $pull: { members: memberId } }
  );

  await recordAuditLog({ action: 'PROJECT_MEMBER_REMOVED', entityType: 'Project', entityId: project._id, after: { memberId }, req });

  const updated = await Project.findById(project._id)
    .populate('ownerId', 'firstName lastName email').populate('members', 'firstName lastName email avatarUrl role').populate('programId', 'title');
  return successResponse(res, updated, 'Member removed successfully');
});

export const getProjectConversation = ah(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!project) throw notFound('Project not found');

  const isMember = (project.members || []).some(m => String(m) === String(req.userId));
  const isOwner = String(project.ownerId) === String(req.userId);
  if (!isMember && !isOwner && !req.can('projects.read')) {
    throw forbidden('You are not authorized to access this project chat.', 'FORBIDDEN');
  }

  let conv = await Conversation.findOne({ projectId: project._id, organizationId: req.organizationId })
    .populate('members', 'firstName lastName email avatarUrl role');

  if (!conv) {
    const memberSet = new Set([String(project.ownerId), ...(project.members || []).map(String)]);
    conv = await Conversation.create({
      organizationId: req.organizationId,
      type: 'PROJECT',
      name: `${project.name} Chat`,
      projectId: project._id,
      createdBy: req.userId,
      members: Array.from(memberSet)
    });
    conv = await Conversation.findById(conv._id).populate('members', 'firstName lastName email avatarUrl role');
  }

  return successResponse(res, conv);
});
