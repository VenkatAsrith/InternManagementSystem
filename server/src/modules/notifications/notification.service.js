import { Notification } from './notification.model.js';
import { logger } from '../../config/logger.js';

export async function createNotification({
  organizationId,
  recipientId,
  type,
  title,
  message,
  entityType = null,
  entityId = null,
  channel = 'IN_APP'
}) {
  try {
    const notification = await Notification.create({
      organizationId,
      recipientId,
      type,
      title,
      message,
      entityType,
      entityId: entityId ? String(entityId) : undefined,
      channel
    });
    return notification;
  } catch (err) {
    logger.error('Failed to create notification:', err);
    return null;
  }
}
