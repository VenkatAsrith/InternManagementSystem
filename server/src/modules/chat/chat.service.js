import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { User } from '../users/user.model.js';
import { Conversation, ChatMessage } from './chat.model.js';

let ioInstance = null;

export function initChatSocket(httpServer) {
  const allowedOrigins = new Set([
    env.CLIENT_URL,
    env.FRONTEND_URL,
    ...(process.env.CORS_ORIGINS || '').split(',').map(s => s.trim())
  ].filter(Boolean));

  ioInstance = new Server(httpServer, {
    cors: {
      origin(origin, cb) {
        if (!origin) return cb(null, true);
        if (allowedOrigins.has(origin)) return cb(null, true);
        if (env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true
    },
    pingTimeout: 30000,
    pingInterval: 10000
  });

  // JWT Handshake Authentication Middleware
  ioInstance.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
      const user = await User.findById(decoded.id).select('firstName lastName email role organizationId isActive');
      if (!user || !user.isActive) {
        return next(new Error('User account is deactivated or not found'));
      }

      socket.userId = String(user._id);
      socket.userEmail = user.email;
      socket.userRole = user.role;
      socket.organizationId = String(user.organizationId);
      next();
    } catch (err) {
      logger.warn(`[Socket.io Auth Failed] ${err.message}`);
      return next(new Error('Invalid authentication token'));
    }
  });

  ioInstance.on('connection', (socket) => {
    logger.info(`[Socket connected] User: ${socket.userEmail} (${socket.userId})`);

    // Personal room for notifications & direct updates
    socket.join(`user_${socket.userId}`);

    // Join conversation room
    socket.on('join_conversation', async ({ conversationId }, ack) => {
      try {
        const conv = await Conversation.findOne({
          _id: conversationId,
          organizationId: socket.organizationId,
          members: socket.userId
        });
        if (!conv) {
          if (ack) ack({ success: false, error: 'Unauthorized or conversation not found' });
          return;
        }

        socket.join(`conversation_${conversationId}`);
        if (ack) ack({ success: true, conversationId });
      } catch (err) {
        if (ack) ack({ success: false, error: err.message });
      }
    });

    // Leave conversation room
    socket.on('leave_conversation', ({ conversationId }) => {
      socket.leave(`conversation_${conversationId}`);
    });

    // Send Realtime Message
    socket.on('send_message', async ({ conversationId, body, replyTo }, ack) => {
      try {
        if (!body || !String(body).trim()) {
          if (ack) ack({ success: false, error: 'Message body cannot be empty' });
          return;
        }

        const conv = await Conversation.findOne({
          _id: conversationId,
          organizationId: socket.organizationId,
          members: socket.userId
        });
        if (!conv) {
          if (ack) ack({ success: false, error: 'Not authorized for this conversation' });
          return;
        }

        const msg = await ChatMessage.create({
          conversationId: conv._id,
          organizationId: socket.organizationId,
          senderId: socket.userId,
          body: String(body).trim(),
          replyTo: replyTo || undefined,
          readBy: [socket.userId]
        });

        // Update conversation lastMessage
        conv.lastMessageId = msg._id;
        conv.lastMessageAt = msg.createdAt;
        await conv.save();

        const populatedMsg = await ChatMessage.findById(msg._id)
          .populate('senderId', 'firstName lastName email avatarUrl role');

        // Broadcast to conversation room
        ioInstance.to(`conversation_${conversationId}`).emit('new_message', {
          conversationId,
          message: populatedMsg
        });

        // Broadcast unread/update notification to members' personal rooms
        for (const memberId of conv.members) {
          if (String(memberId) !== socket.userId) {
            ioInstance.to(`user_${memberId}`).emit('conversation_updated', {
              conversationId,
              lastMessage: populatedMsg
            });
          }
        }

        if (ack) ack({ success: true, message: populatedMsg });
      } catch (err) {
        logger.error(`[Socket send_message error] ${err.message}`);
        if (ack) ack({ success: false, error: err.message });
      }
    });

    // Mark as read
    socket.on('mark_read', async ({ conversationId }) => {
      try {
        await ChatMessage.updateMany(
          { conversationId, readBy: { $ne: socket.userId } },
          { $addToSet: { readBy: socket.userId } }
        );
        socket.to(`conversation_${conversationId}`).emit('message_read', {
          conversationId,
          userId: socket.userId
        });
      } catch (err) {
        logger.error(`[Socket mark_read error] ${err.message}`);
      }
    });

    socket.on('disconnect', () => {
      logger.info(`[Socket disconnected] User: ${socket.userEmail}`);
    });
  });

  return ioInstance;
}

export function getIO() {
  return ioInstance;
}

export function broadcastMessage(conversationId, message, memberIds = []) {
  if (!ioInstance) return;
  ioInstance.to(`conversation_${conversationId}`).emit('new_message', {
    conversationId,
    message
  });

  for (const memberId of memberIds) {
    ioInstance.to(`user_${memberId}`).emit('conversation_updated', {
      conversationId,
      lastMessage: message
    });
  }
}
