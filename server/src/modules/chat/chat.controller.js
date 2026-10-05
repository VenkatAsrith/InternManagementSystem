import fs from 'fs';
import { Conversation, ChatMessage } from './chat.model.js';
import { User } from '../users/user.model.js';
import { Project } from '../projects/project.model.js';
import { storageService } from '../../utils/storage.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { notFound, forbidden, badRequest, conflict } from '../../utils/errors.js';
import { Validator, parsePagination, escapeRegex, isObjectId } from '../../utils/validate.js';
import { broadcastMessage } from './chat.service.js';
import { ROLES } from '../../../../shared/constants.js';

export async function getConversations(req, res) {
  const conversations = await Conversation.find({
    organizationId: req.organizationId,
    members: req.userId
  })
    .populate('members', 'firstName lastName email avatarUrl role')
    .populate('lastMessageId')
    .populate('projectId', 'name status')
    .sort({ lastMessageAt: -1 })
    .lean();

  // Compute unread message counts for each conversation
  const enhanced = await Promise.all(
    conversations.map(async (conv) => {
      const unreadCount = await ChatMessage.countDocuments({
        conversationId: conv._id,
        readBy: { $ne: req.userId }
      });
      return { ...conv, unreadCount };
    })
  );

  return successResponse(res, enhanced);
}

export async function createConversation(req, res) {
  const { type = 'DIRECT', recipientId, name, memberIds = [], projectId } = req.body;

  if (type === 'DIRECT') {
    if (!recipientId) throw badRequest('recipientId is required for DIRECT conversation');
    if (String(recipientId) === String(req.userId)) throw badRequest('Cannot start direct conversation with yourself');

    const recipient = await User.findOne({
      _id: recipientId,
      organizationId: req.organizationId,
      isActive: true
    });
    if (!recipient) throw notFound('Recipient not found in your organization');

    // Return existing DIRECT conversation if one already exists
    let existing = await Conversation.findOne({
      organizationId: req.organizationId,
      type: 'DIRECT',
      members: { $all: [req.userId, recipient._id], $size: 2 }
    })
      .populate('members', 'firstName lastName email avatarUrl role')
      .populate('lastMessageId');

    if (existing) {
      return successResponse(res, existing);
    }

    const conv = await Conversation.create({
      organizationId: req.organizationId,
      type: 'DIRECT',
      createdBy: req.userId,
      members: [req.userId, recipient._id]
    });

    const populated = await Conversation.findById(conv._id)
      .populate('members', 'firstName lastName email avatarUrl role');

    return successResponse(res, populated, 'Direct conversation created', 201);
  }

  if (type === 'GROUP') {
    if (!name || !name.trim()) throw badRequest('Group name is required');
    const validMembers = await User.find({
      _id: { $in: memberIds },
      organizationId: req.organizationId,
      isActive: true
    }).select('_id');

    const uniqueMembers = Array.from(new Set([String(req.userId), ...validMembers.map(m => String(m._id))]));

    const conv = await Conversation.create({
      organizationId: req.organizationId,
      type: 'GROUP',
      name: name.trim(),
      createdBy: req.userId,
      members: uniqueMembers
    });

    const populated = await Conversation.findById(conv._id)
      .populate('members', 'firstName lastName email avatarUrl role');

    return successResponse(res, populated, 'Group conversation created', 201);
  }

  if (type === 'PROJECT') {
    if (!projectId) throw badRequest('projectId is required for PROJECT conversation');
    const project = await Project.findOne({ _id: projectId, organizationId: req.organizationId });
    if (!project) throw notFound('Project not found');

    const isMember = (project.members || []).some(m => String(m) === String(req.userId));
    const isOwner = String(project.ownerId) === String(req.userId);
    if (!isMember && !isOwner && !req.can('projects.read')) {
      throw forbidden('You are not authorized for this project conversation', 'FORBIDDEN');
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
  }

  throw badRequest('Invalid conversation type');
}

export async function getConversationById(req, res) {
  const conv = await Conversation.findOne({
    _id: req.params.id,
    organizationId: req.organizationId,
    members: req.userId
  })
    .populate('members', 'firstName lastName email avatarUrl role')
    .populate('lastMessageId')
    .populate('projectId', 'name status');

  if (!conv) throw notFound('Conversation not found or access denied');
  return successResponse(res, conv);
}

export async function getMessages(req, res) {
  const conv = await Conversation.findOne({
    _id: req.params.id,
    organizationId: req.organizationId,
    members: req.userId
  });
  if (!conv) throw notFound('Conversation not found or access denied');

  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });

  const [messages, total] = await Promise.all([
    ChatMessage.find({ conversationId: conv._id })
      .populate('senderId', 'firstName lastName email avatarUrl role')
      .populate('replyTo', 'body senderId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ChatMessage.countDocuments({ conversationId: conv._id })
  ]);

  // Mark all fetched messages as read by current user
  await ChatMessage.updateMany(
    { conversationId: conv._id, readBy: { $ne: req.userId } },
    { $addToSet: { readBy: req.userId } }
  );

  return paginatedResponse(res, messages.reverse(), { page, limit, total });
}

export async function sendMessage(req, res) {
  const conv = await Conversation.findOne({
    _id: req.params.id,
    organizationId: req.organizationId,
    members: req.userId
  });
  if (!conv) throw notFound('Conversation not found or access denied');

  const bodyText = req.body?.body ? String(req.body.body).trim() : '';
  const attachments = [];

  if (req.file) {
    const stored = await storageService.saveFile({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      subDir: `chat/${req.organizationId}/${conv._id}`
    });
    attachments.push({
      fileName: stored.fileName,
      originalName: stored.originalName,
      filePath: stored.filePath,
      mimeType: stored.mimeType,
      size: stored.size
    });
  }

  if (!bodyText && attachments.length === 0) {
    throw badRequest('Message body or file attachment is required');
  }

  const msg = await ChatMessage.create({
    conversationId: conv._id,
    organizationId: req.organizationId,
    senderId: req.userId,
    body: bodyText,
    attachments,
    replyTo: isObjectId(req.body?.replyTo) ? req.body.replyTo : undefined,
    readBy: [req.userId]
  });

  conv.lastMessageId = msg._id;
  conv.lastMessageAt = msg.createdAt;
  await conv.save();

  const populated = await ChatMessage.findById(msg._id)
    .populate('senderId', 'firstName lastName email avatarUrl role')
    .populate('replyTo', 'body senderId');

  broadcastMessage(conv._id, populated, conv.members);

  return successResponse(res, populated, 'Message sent', 201);
}

export async function markAsRead(req, res) {
  const conv = await Conversation.findOne({
    _id: req.params.id,
    organizationId: req.organizationId,
    members: req.userId
  });
  if (!conv) throw notFound('Conversation not found or access denied');

  await ChatMessage.updateMany(
    { conversationId: conv._id, readBy: { $ne: req.userId } },
    { $addToSet: { readBy: req.userId } }
  );

  return successResponse(res, { marked: true }, 'Messages marked as read');
}

export async function getAvailableUsers(req, res) {
  const query = {
    organizationId: req.organizationId,
    isActive: true,
    _id: { $ne: req.userId }
  };

  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search.trim()), 'i');
    query.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }];
  }

  const users = await User.find(query)
    .select('firstName lastName email avatarUrl role departmentId')
    .populate('departmentId', 'name')
    .sort({ firstName: 1 })
    .limit(50)
    .lean();

  return successResponse(res, users);
}

export async function uploadAttachment(req, res) {
  if (!req.file) throw badRequest('No file uploaded');
  const stored = await storageService.storeUploadedFile(req.file, 'chat');
  return successResponse(res, {
    originalName: stored.originalName,
    storedName: stored.fileName,
    mimeType: stored.mimeType,
    size: stored.size,
    url: `/api/v1/chat/attachment/${stored.fileName}`
  }, 'Attachment uploaded', 201);
}

export async function getAttachment(req, res) {
  const fileName = req.params.fileName;
  const filePath = `chat/${fileName}`;
  if (!(await storageService.exists(filePath))) throw notFound('Attachment not found');
  res.setHeader('Content-Type', 'application/octet-stream');
  fs.createReadStream(storageService.getFilePath(filePath)).pipe(res);
}

