import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { Organization, Department } from '../modules/organizations/organization.model.js';
import { User } from '../modules/users/user.model.js';
import { Intern } from '../modules/interns/intern.model.js';
import { Meeting } from '../modules/meetings/meeting.model.js';
import { Bootcamp, Pass } from '../modules/growth/growth.model.js';
import {
  TrainingProgram,
  Course,
  TrainingBatch,
  TrainingEngagement
} from '../modules/training/training.model.js';
import { InternshipProgram, InternshipOpening, Candidate, Application } from '../modules/recruitment/recruitment.model.js';
import { Interview } from '../modules/interviews/interview.model.js';
import { Offer } from '../modules/offers/offer.model.js';
import { OnboardingPlan, OnboardingTask } from '../modules/onboarding/onboarding.model.js';
import { Certificate } from '../modules/certificates/certificate.model.js';
import { Document } from '../modules/documents/document.model.js';
import { Project } from '../modules/projects/project.model.js';
import { Task, TaskSubmission } from '../modules/tasks/task.model.js';
import { AttendanceRecord } from '../modules/attendance/attendance.model.js';
import { JournalEntry } from '../modules/journals/journal.model.js';
import { Feedback } from '../modules/feedback/feedback.model.js';
import { PerformanceReview } from '../modules/performance/performance.model.js';
import { CompensationPlan, Payment, PaymentLedger } from '../modules/finance/finance.model.js';
import { Asset } from '../modules/assets/asset.model.js';
import { Leave } from '../modules/leaves/leave.model.js';
import { Exit } from '../modules/exit/exit.model.js';
import { Notification } from '../modules/notifications/notification.model.js';
import { GoogleIntegration } from '../modules/integrations/google.model.js';
import { Conversation, ChatMessage } from '../modules/chat/chat.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CORE_ADMIN_EMAILS = [
  env.ADMIN_EMAIL,
  'admin@tmt.com',
  'admin@techmecha.com',
  'orgadmin@techmecha.com',
  'hr@techmecha.com'
].filter(Boolean);

export async function resetAllTestData({ dryRun = true } = {}) {
  logger.info(`========================================================`);
  logger.info(`IMS SYSTEM DATA RESET AUDIT & CLEANUP UTILITY`);
  logger.info(`Environment: ${env.NODE_ENV} | Target URI: ${env.MONGO_URI}`);
  logger.info(`Execution Mode: ${dryRun ? 'DRY-RUN (No changes applied)' : 'LIVE RESET (--confirm applied)'}`);
  logger.info(`========================================================`);

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.MONGO_URI);
  }

  const db = mongoose.connection.db;

  // 1. Audit core administrative accounts
  const preservedAdmins = await User.find({ email: { $in: CORE_ADMIN_EMAILS } }).select('email role firstName lastName');
  logger.info(`Preserved System Admins (${preservedAdmins.length}):`);
  preservedAdmins.forEach(u => logger.info(`  • ${u.email} [${u.role}]`));

  // 2. Audit all collections and test counts
  const auditTargetCounts = {
    testUsers: await User.countDocuments({ email: { $nin: CORE_ADMIN_EMAILS } }),
    interns: await Intern.countDocuments({}),
    meetings: await Meeting.countDocuments({}),
    bootcamps: await Bootcamp.countDocuments({}),
    passes: await Pass.countDocuments({}),
    trainingPrograms: await TrainingProgram.countDocuments({}),
    courses: await Course.countDocuments({}),
    trainingBatches: await TrainingBatch.countDocuments({}),
    trainingEngagements: await TrainingEngagement.countDocuments({}),
    traineeTasks: await db.collection('traineetasks').countDocuments().catch(() => 0),
    traineeAttendances: await db.collection('traineeattendances').countDocuments().catch(() => 0),
    traineeActivities: await db.collection('traineeactivities').countDocuments().catch(() => 0),
    traineeAssessments: await db.collection('traineeassessments').countDocuments().catch(() => 0),
    certificates: await Certificate.countDocuments({}),
    onboardingPlans: await OnboardingPlan.countDocuments({}),
    onboardingTasks: await OnboardingTask.countDocuments({}),
    applications: await Application.countDocuments({}),
    candidates: await Candidate.countDocuments({}),
    interviews: await Interview.countDocuments({}),
    offers: await Offer.countDocuments({}),
    projects: await Project.countDocuments({}),
    tasks: await Task.countDocuments({}),
    submissions: await TaskSubmission.countDocuments({}),
    attendance: await AttendanceRecord.countDocuments({}),
    journals: await JournalEntry.countDocuments({}),
    reviews: await PerformanceReview.countDocuments({}),
    feedbacks: await Feedback.countDocuments({}),
    leaves: await Leave.countDocuments({}),
    assets: await Asset.countDocuments({}),
    exits: await Exit.countDocuments({}),
    payments: await Payment.countDocuments({}),
    googleIntegrations: await GoogleIntegration.countDocuments({}),
    conversations: await Conversation.countDocuments({}),
    chatMessages: await ChatMessage.countDocuments({})
  };

  logger.info('\nIdentified Test / Demo Records for Purge:');
  for (const [key, val] of Object.entries(auditTargetCounts)) {
    logger.info(`  - ${key.padEnd(22)}: ${val}`);
  }

  if (dryRun) {
    logger.info('\n[DRY RUN SUMMARY] No data was deleted. Pass --confirm to execute reset.');
    return { dryRun: true, auditCounts: auditTargetCounts };
  }

  // 3. Create JSON Backup
  const backupDir = path.resolve(__dirname, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupPath = path.resolve(backupDir, `ims_test_data_backup_${Date.now()}.json`);
  const snapshot = {
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    counts: auditTargetCounts,
    demoUserEmails: (await User.find({ email: { $nin: CORE_ADMIN_EMAILS } }).select('email')).map(u => u.email),
    meetings: (await Meeting.find({}).select('title meetingLink scheduledDate')).map(m => ({ title: m.title, link: m.meetingLink })),
    bootcamps: (await Bootcamp.find({}).select('title')).map(b => b.title),
    programs: (await TrainingProgram.find({}).select('title')).map(p => p.title)
  };
  fs.writeFileSync(backupPath, JSON.stringify(snapshot, null, 2), 'utf8');
  logger.info(`Backup written to: ${backupPath}`);

  // 4. Perform Safe Deletion
  logger.info('\nPurging test & demo records...');

  await Promise.all([
    User.deleteMany({ email: { $nin: CORE_ADMIN_EMAILS } }),
    Intern.deleteMany({}),
    Meeting.deleteMany({}),
    Bootcamp.deleteMany({}),
    Pass.deleteMany({}),
    TrainingProgram.deleteMany({}),
    Course.deleteMany({}),
    TrainingBatch.deleteMany({}),
    TrainingEngagement.deleteMany({}),
    Certificate.deleteMany({}),
    OnboardingPlan.deleteMany({}),
    OnboardingTask.deleteMany({}),
    Application.deleteMany({}),
    Candidate.deleteMany({}),
    Interview.deleteMany({}),
    Offer.deleteMany({}),
    Project.deleteMany({}),
    Task.deleteMany({}),
    TaskSubmission.deleteMany({}),
    AttendanceRecord.deleteMany({}),
    JournalEntry.deleteMany({}),
    PerformanceReview.deleteMany({}),
    Feedback.deleteMany({}),
    Leave.deleteMany({}),
    Asset.deleteMany({}),
    Exit.deleteMany({}),
    CompensationPlan.deleteMany({}),
    Payment.deleteMany({}),
    PaymentLedger.deleteMany({}),
    Notification.deleteMany({}),
    GoogleIntegration.deleteMany({}),
    Conversation.deleteMany({}),
    ChatMessage.deleteMany({})
  ]);

  // Clean raw collection references if they exist
  const additionalRawCollections = [
    'interndocumentrequirements',
    'internshipopenings',
    'internshipprograms',
    'learninglessons',
    'learningmodules',
    'learningpaths',
    'learningprogresses',
    'people',
    'traineetasks',
    'traineeattendances',
    'traineeactivities',
    'traineeassessments',
    'traineeprojects',
    'callactivities',
    'leads'
  ];

  for (const collName of additionalRawCollections) {
    try {
      const exists = await db.listCollections({ name: collName }).hasNext();
      if (exists) {
        await db.collection(collName).deleteMany({});
        logger.info(`  - Purged collection: ${collName}`);
      }
    } catch (e) {
      logger.warn(`Could not purge ${collName}:`, e.message);
    }
  }

  // 5. Verification of clean state
  const remainingUsers = await User.find({}).select('email role');
  const remainingInterns = await Intern.countDocuments({});
  const remainingMeetings = await Meeting.countDocuments({});
  const remainingBootcamps = await Bootcamp.countDocuments({});
  const remainingPrograms = await TrainingProgram.countDocuments({});

  logger.info('\n========================================================');
  logger.info('DATA RESET COMPLETE & VERIFIED:');
  logger.info(`Remaining Users: ${remainingUsers.length} (Only core administrators preserved)`);
  remainingUsers.forEach(u => logger.info(`  • ${u.email} [${u.role}]`));
  logger.info(`Remaining Interns: ${remainingInterns}`);
  logger.info(`Remaining Meetings: ${remainingMeetings}`);
  logger.info(`Remaining Bootcamps: ${remainingBootcamps}`);
  logger.info(`Remaining Training Programs: ${remainingPrograms}`);
  logger.info('========================================================\n');

  return {
    success: true,
    deletedCounts: auditTargetCounts,
    preservedUsers: remainingUsers.map(u => u.email)
  };
}

// CLI Support
if (process.argv[1]?.endsWith('resetAllTestData.js')) {
  const isConfirm = process.argv.includes('--confirm');
  resetAllTestData({ dryRun: !isConfirm })
    .then(() => {
      logger.info('Script execution completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Data reset failed:', err);
      process.exit(1);
    });
}
