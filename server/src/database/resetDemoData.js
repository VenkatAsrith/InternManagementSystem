import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { Organization, Department } from '../modules/organizations/organization.model.js';
import { User } from '../modules/users/user.model.js';
import { InternshipProgram, InternshipOpening, Candidate, Application } from '../modules/recruitment/recruitment.model.js';
import { Interview } from '../modules/interviews/interview.model.js';
import { Offer } from '../modules/offers/offer.model.js';
import { OnboardingPlan, OnboardingTask } from '../modules/onboarding/onboarding.model.js';
import { Intern } from '../modules/interns/intern.model.js';
import { Project } from '../modules/projects/project.model.js';
import { Task, TaskSubmission } from '../modules/tasks/task.model.js';
import { LearningPath, LearningModule, LearningLesson, LearningProgress } from '../modules/learning/learning.model.js';
import { AttendanceRecord } from '../modules/attendance/attendance.model.js';
import { JournalEntry } from '../modules/journals/journal.model.js';
import { Meeting } from '../modules/meetings/meeting.model.js';
import { Feedback } from '../modules/feedback/feedback.model.js';
import { PerformanceReview } from '../modules/performance/performance.model.js';
import { Certificate } from '../modules/certificates/certificate.model.js';
import { Document } from '../modules/documents/document.model.js';
import { Notification } from '../modules/notifications/notification.model.js';
import { AuditLog } from '../modules/audit/audit.model.js';
import { CompensationPlan, Payment, PaymentLedger } from '../modules/finance/finance.model.js';
import { Asset } from '../modules/assets/asset.model.js';
import { Leave } from '../modules/leaves/leave.model.js';
import { Exit } from '../modules/exit/exit.model.js';
import { Bootcamp, Pass } from '../modules/growth/growth.model.js';
import { ROLES } from '../../../shared/constants.js';

export async function resetDemoData({ dryRun = false } = {}) {
  try {
    logger.info(`Starting data reset (dryRun: ${dryRun})...`);
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.MONGO_URI);
    }

    const org = await Organization.findOne({ slug: 'techmecha-torque' }) || await Organization.findOne({});
    if (!org) {
      logger.warn('No organization found. Initializing base setup required.');
      return;
    }

    // Preserve core admins
    const coreAdminEmails = [
      'admin@techmecha.com',
      'orgadmin@techmecha.com',
      'hr@techmecha.com'
    ];

    const counts = {
      demoUsers: await User.countDocuments({ email: { $nin: coreAdminEmails } }),
      interns: await Intern.countDocuments({}),
      applications: await Application.countDocuments({}),
      candidates: await Candidate.countDocuments({}),
      interviews: await Interview.countDocuments({}),
      offers: await Offer.countDocuments({}),
      onboardingPlans: await OnboardingPlan.countDocuments({}),
      onboardingTasks: await OnboardingTask.countDocuments({}),
      projects: await Project.countDocuments({}),
      tasks: await Task.countDocuments({}),
      submissions: await TaskSubmission.countDocuments({}),
      attendance: await AttendanceRecord.countDocuments({}),
      journals: await JournalEntry.countDocuments({}),
      meetings: await Meeting.countDocuments({}),
      performanceReviews: await PerformanceReview.countDocuments({}),
      certificates: await Certificate.countDocuments({}),
      bootcamps: await Bootcamp.countDocuments({}),
      passes: await Pass.countDocuments({}),
      documents: await Document.countDocuments({}),
      notifications: await Notification.countDocuments({}),
      leaves: await Leave.countDocuments({}),
      assets: await Asset.countDocuments({}),
      payments: await Payment.countDocuments({})
    };

    logger.info('Demo records audit counts:', counts);

    if (dryRun) {
      logger.info('DRY-RUN completed. No records modified.');
      return counts;
    }

    // Remove demo records
    await Promise.all([
      User.deleteMany({ email: { $nin: coreAdminEmails } }),
      Intern.deleteMany({}),
      Candidate.deleteMany({}),
      Application.deleteMany({}),
      Interview.deleteMany({}),
      Offer.deleteMany({}),
      OnboardingPlan.deleteMany({}),
      OnboardingTask.deleteMany({}),
      Project.deleteMany({}),
      Task.deleteMany({}),
      TaskSubmission.deleteMany({}),
      AttendanceRecord.deleteMany({}),
      JournalEntry.deleteMany({}),
      Meeting.deleteMany({}),
      Feedback.deleteMany({}),
      PerformanceReview.deleteMany({}),
      Certificate.deleteMany({}),
      Bootcamp.deleteMany({}),
      Pass.deleteMany({}),
      Document.deleteMany({}),
      Notification.deleteMany({}),
      CompensationPlan.deleteMany({}),
      Payment.deleteMany({}),
      PaymentLedger.deleteMany({}),
      Asset.deleteMany({}),
      Leave.deleteMany({}),
      Exit.deleteMany({})
    ]);

    logger.info('Demo data reset completed. Core admins, organization, and departments preserved.');
    return { success: true, deletedCounts: counts };
  } catch (err) {
    logger.error('Error during data reset:', err);
    throw err;
  }
}

// Direct execution CLI support
if (process.argv[1]?.endsWith('resetDemoData.js')) {
  const isConfirm = process.argv.includes('--confirm');
  const isDryRun = process.argv.includes('--dry-run') || !isConfirm;

  resetDemoData({ dryRun: isDryRun })
    .then(() => {
      logger.info('Reset script finished.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Reset script failed:', err);
      process.exit(1);
    });
}
