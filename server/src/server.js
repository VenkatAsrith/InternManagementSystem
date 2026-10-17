import http from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { logger } from './config/logger.js';
import { expireStaleOffers } from './modules/offers/offer.provisioning.js';
import { initChatSocket } from './modules/chat/chat.service.js';
import { MeetingReminderService } from './modules/meetings/meetingReminder.service.js';
import { bootstrapSystem } from './database/bootstrap.js';

async function startServer() {
  await connectDB();
  await bootstrapSystem();

  const server = http.createServer(app);
  initChatSocket(server);

  server.listen(env.PORT, () => {
    logger.info(`========================================================`);
    logger.info(`IMS Backend Server running on http://localhost:${env.PORT}`);
    logger.info(`Environment: ${env.NODE_ENV}`);
    logger.info(`Health check: http://localhost:${env.PORT}/health`);
    logger.info(`API Base URL: http://localhost:${env.PORT}/api/v1`);
    logger.info(`========================================================`);
  });

  // Offers whose validity window has passed are expired (and their applications updated) every 10 minutes.
  const sweep = setInterval(() => expireStaleOffers().catch(err => logger.error(`Offer expiry sweep failed: ${err.message}`)), 10 * 60 * 1000);
  sweep.unref();
  expireStaleOffers().catch(err => logger.error(`Initial offer expiry sweep failed: ${err.message}`));

  // Automated meeting reminders worker (24h and 15m notifications)
  MeetingReminderService.startWorker();

  const shutdown = async (signal) => {
    logger.info(`${signal} received. Initiating graceful shutdown...`);
    server.close(async () => {
      await disconnectDB();
      logger.info('Server closed. Process terminating.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (reason) => logger.error(`Unhandled promise rejection: ${reason?.stack || reason}`));

startServer().catch(err => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
