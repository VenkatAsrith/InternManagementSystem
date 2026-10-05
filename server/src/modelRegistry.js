// Imports every Mongoose model so scripts (seed, QA reset, integrity verification) see the complete schema set.
import mongoose from 'mongoose';

import { Organization, Department } from './modules/organizations/organization.model.js';
import { User } from './modules/users/user.model.js';
import { Session } from './modules/auth/session.model.js';
import { Role } from './modules/roles/role.model.js';
import { RoleAssignment } from './modules/roles/roleAssignment.model.js';
import { RoleHistory } from './modules/roles/roleHistory.model.js';
import { InternshipProgram, InternshipOpening, Candidate, Application } from './modules/recruitment/recruitment.model.js';
import { Interview } from './modules/interviews/interview.model.js';
import { Offer } from './modules/offers/offer.model.js';
import { OnboardingPlan, OnboardingTask } from './modules/onboarding/onboarding.model.js';
import { Intern } from './modules/interns/intern.model.js';
import { Project } from './modules/projects/project.model.js';
import { Task, TaskSubmission } from './modules/tasks/task.model.js';
import { LearningPath, LearningModule, LearningLesson, LearningProgress } from './modules/learning/learning.model.js';
import { AttendanceRecord } from './modules/attendance/attendance.model.js';
import { Leave } from './modules/leaves/leave.model.js';
import { JournalEntry } from './modules/journals/journal.model.js';
import { Meeting } from './modules/meetings/meeting.model.js';
import { Feedback } from './modules/feedback/feedback.model.js';
import { PerformanceReview } from './modules/performance/performance.model.js';
import { Document } from './modules/documents/document.model.js';
import { ApprovalRequest } from './modules/documents/approvalRequest.model.js';
import { DocumentRequirementTemplate } from './modules/documents/documentRequirementTemplate.model.js';
import { InternDocumentRequirement } from './modules/documents/internDocumentRequirement.model.js';
import { DocumentTemplate } from './modules/templates/documentTemplate.model.js';
import { Certificate } from './modules/certificates/certificate.model.js';
import { CompensationPlan, Payment, PaymentLedger, PaymentTransaction } from './modules/finance/finance.model.js';
import { Asset } from './modules/assets/asset.model.js';
import { Exit } from './modules/exit/exit.model.js';
import { Notification } from './modules/notifications/notification.model.js';
import { EmailLog } from './modules/email/email.model.js';
import { AuditLog } from './modules/audit/audit.model.js';
import { Person } from './modules/people/people.model.js';
import { Lead, CallActivity, Bootcamp, Pass, Demo } from './modules/growth/growth.model.js';
import { TrainingProgram, TrainingBatch, TrainingEngagement } from './modules/training/training.model.js';
import { TraineeTask } from './modules/training/traineeTask.model.js';
import { TraineeAssessment } from './modules/training/traineeAssessment.model.js';
import { TraineeProject } from './modules/training/traineeProject.model.js';
import { TraineeAttendance } from './modules/training/traineeAttendance.model.js';
import { TraineeActivity } from './modules/training/traineeActivity.model.js';
import { Mailbox, MailboxAccessGrant, EmailMessage } from './modules/mail/mail.model.js';
import { UserInvitation } from './modules/users/invitation.model.js';
import { Conversation, ChatMessage } from './modules/chat/chat.model.js';
import { GoogleIntegration } from './modules/integrations/google.model.js';
import './utils/idGenerator.js'; // registers the Counter model

export const models = {
  Organization, Department, User, UserInvitation, Session, Role, RoleAssignment, RoleHistory, InternshipProgram, InternshipOpening, Candidate, Application,
  Interview, Offer, OnboardingPlan, OnboardingTask, Intern, Project, Task, TaskSubmission, LearningPath, LearningModule, LearningLesson,
  LearningProgress, AttendanceRecord, Leave, JournalEntry, Meeting, Feedback, PerformanceReview, Document, ApprovalRequest, DocumentTemplate,
  Certificate, CompensationPlan, Payment, PaymentLedger, PaymentTransaction, Asset, Exit, Notification, EmailLog, AuditLog,
  Person, Lead, CallActivity, Bootcamp, Pass, Demo, TrainingProgram, TrainingBatch, TrainingEngagement, Mailbox, MailboxAccessGrant, EmailMessage,
  Conversation, ChatMessage, GoogleIntegration, DocumentRequirementTemplate, InternDocumentRequirement,
  TraineeTask, TraineeAssessment, TraineeProject, TraineeAttendance, TraineeActivity
};

export { mongoose };
