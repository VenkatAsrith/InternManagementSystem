import { Notification } from './notification.model.js';
import { successResponse, errorResponse } from '../../utils/response.js';

export async function getNotifications(req, res, next) {
  try {
    const notifications = await Notification.find({ recipientId: req.userId })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({ recipientId: req.userId, isRead: false });

    return successResponse(res, { notifications, unreadCount });
  } catch (err) {
    next(err);
  }
}

export async function markNotificationRead(req, res, next) {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) return errorResponse(res, 'Notification not found', 404);

    return successResponse(res, notification, 'Notification marked as read');
  } catch (err) {
    next(err);
  }
}

export async function markAllNotificationsRead(req, res, next) {
  try {
    await Notification.updateMany(
      { recipientId: req.userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    return successResponse(res, {}, 'All notifications marked as read');
  } catch (err) {
    next(err);
  }
}
