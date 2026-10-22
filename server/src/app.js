import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';

// Import domain module routes
import authRoutes from './modules/auth/auth.routes.js';
import organizationRoutes from './modules/organizations/organization.routes.js';
import userRoutes from './modules/users/user.routes.js';
import recruitmentRoutes from './modules/recruitment/recruitment.routes.js';
import interviewRoutes from './modules/interviews/interview.routes.js';
import offerRoutes from './modules/offers/offer.routes.js';
import onboardingRoutes from './modules/onboarding/onboarding.routes.js';
import internRoutes from './modules/interns/intern.routes.js';
import projectRoutes from './modules/projects/project.routes.js';
import taskRoutes from './modules/tasks/task.routes.js';
import learningRoutes from './modules/learning/learning.routes.js';
import attendanceRoutes from './modules/attendance/attendance.routes.js';
import leaveRoutes from './modules/leaves/leave.routes.js';
import journalRoutes from './modules/journals/journal.routes.js';
import meetingRoutes from './modules/meetings/meeting.routes.js';
import feedbackRoutes from './modules/feedback/feedback.routes.js';
import performanceRoutes from './modules/performance/performance.routes.js';
import documentRoutes from './modules/documents/document.routes.js';
import certificateRoutes from './modules/certificates/certificate.routes.js';
import financeRoutes from './modules/finance/finance.routes.js';
import assetRoutes from './modules/assets/asset.routes.js';
import exitRoutes from './modules/exit/exit.routes.js';
import templateRoutes from './modules/templates/template.routes.js';
import emailRoutes from './modules/email/email.routes.js';
import notificationRoutes from './modules/notifications/notification.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';
import roleRoutes from './modules/roles/role.routes.js';
import globalAdminRoutes from './modules/organizations/globalAdmin.routes.js';
import peopleRoutes from './modules/people/people.routes.js';
import growthRoutes from './modules/growth/growth.routes.js';
import trainingRoutes from './modules/training/training.routes.js';
import mailRoutes from './modules/mail/mail.routes.js';
import chatRoutes from './modules/chat/chat.routes.js';
import googleIntegrationRoutes from './modules/integrations/google.routes.js';

const app = express();

// Behind nginx / a load balancer the client IP comes from X-Forwarded-For (needed for rate limiting and audit).
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

// Security and utility middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-site' }
}));

// CORS: configured front-end origins, Render deployment, localhost, and preview environments
const allowedOrigins = new Set([
  env.CLIENT_URL,
  env.FRONTEND_URL,
  'https://internmanagementsystem-xm84.onrender.com',
  ...(process.env.CORS_ORIGINS || '').split(',').map(s => s.trim())
].filter(Boolean));

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // same-origin / curl / server-to-server
    if (allowedOrigins.has(origin) || allowedOrigins.has('*')) return cb(null, true);
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
    if (origin.endsWith('.onrender.com') || origin.endsWith('.vercel.app') || origin.endsWith('.netlify.app')) return cb(null, true);
    return cb(null, true);
  },
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Request ID propagation (§33 & §78)
app.use((req, res, next) => {
  const reqId = req.headers['x-request-id'] || uuidv4();
  req.requestId = reqId;
  res.setHeader('x-request-id', reqId);
  next();
});

// Health Checks (§57 & §79)
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    status: 'ok',
    database: dbState,
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', (req, res) => {
  if (mongoose.connection.readyState === 1) {
    return res.status(200).json({ status: 'ready' });
  }
  return res.status(503).json({ status: 'not_ready', message: 'Database connection pending' });
});

// Rate limiting on API v1 routes
app.use('/api/v1', apiLimiter);

// Register domain API v1 routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/organizations', organizationRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/recruitment', recruitmentRoutes);
app.use('/api/v1/interviews', interviewRoutes);
app.use('/api/v1/offers', offerRoutes);
app.use('/api/v1/onboarding', onboardingRoutes);
app.use('/api/v1/interns', internRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/learning', learningRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/leaves', leaveRoutes);
app.use('/api/v1/journals', journalRoutes);
app.use('/api/v1/meetings', meetingRoutes);
app.use('/api/v1/feedback', feedbackRoutes);
app.use('/api/v1/performance', performanceRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/certificates', certificateRoutes);
app.use('/api/v1/finance', financeRoutes);
app.use('/api/v1/assets', assetRoutes);
app.use('/api/v1/exits', exitRoutes);
app.use('/api/v1/templates', templateRoutes);
app.use('/api/v1/emails', emailRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/audit-logs', auditRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/global-admin', globalAdminRoutes);
app.use('/api/v1/people', peopleRoutes);
app.use('/api/v1/growth', growthRoutes);
// Direct aliases so both /api/v1/growth/bootcamps and /api/v1/bootcamps work without 404
app.use('/api/v1/bootcamps', (req, res, next) => {
  req.url = '/bootcamps' + (req.url === '/' ? '' : req.url);
  return growthRoutes(req, res, next);
});
app.use('/api/v1/passes', (req, res, next) => {
  req.url = '/passes' + (req.url === '/' ? '' : req.url);
  return growthRoutes(req, res, next);
});
app.use('/api/v1/public/passes', (req, res, next) => {
  req.url = '/public/passes' + (req.url === '/' ? '' : req.url);
  return growthRoutes(req, res, next);
});
app.use('/api/v1/training', trainingRoutes);
app.use('/api/v1/mailboxes', mailRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/integrations/google', googleIntegrationRoutes);

// Unknown API routes answer with JSON, then everything funnels through the central error handler.
app.use('/api', notFoundHandler);
app.use(errorHandler);

// IMS Enhanced Master App
export default app;
