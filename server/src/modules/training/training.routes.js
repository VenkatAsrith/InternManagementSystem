import { Router } from 'express';
import {
  getPrograms,
  getProgramById,
  createProgram,
  updateProgram,
  getBatches,
  createBatch,
  enrollPerson,
  getEngagements,
  getEngagementById,
  evaluateCheckpoint
} from './training.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac.js';
import { ah } from '../../utils/asyncHandler.js';

import {
  getAvailablePrograms, enrollTrainee, createAndEnrollTrainee, getMyTraineeProfile, submitTraineeTask,
  completeModule, getAdminTrainees, getAdminTraineeDetail, updateAdminTrainee, createTraineeTask,
  reviewTraineeTask, recordAttendance, recordAssessment, updateProject,
  completeTraineeProgram, recordMentorFeedback
} from './trainee.controller.js';

const router = Router();

router.use(authenticate, requireOrgContext);

// Trainee Participant Routes
router.get('/trainee/programs', ah(getAvailablePrograms));
router.post('/trainee/programs', requireAnyPermission('training.manage', 'programs.manage'), ah(createProgram));
router.get('/trainee/available-programs', ah(getAvailablePrograms));
router.post('/trainee/enroll', ah(enrollTrainee));
router.get('/trainee/my', ah(getMyTraineeProfile));
router.get('/trainee/me', ah(getMyTraineeProfile));
router.post('/trainee/tasks/:id/submit', ah(submitTraineeTask));
router.post('/trainees/:engagementId/tasks/:id/submit', ah(submitTraineeTask));
router.post('/trainee/modules/complete', ah(completeModule));
router.put('/trainee/project', ah(updateProject));

// Admin / Trainer Trainee Operations
router.post('/trainees', requireAnyPermission('training.manage', 'programs.manage', 'interns.create', 'users.manage'), ah(createAndEnrollTrainee));
router.post('/trainees/create-and-enroll', requireAnyPermission('training.manage', 'programs.manage', 'interns.create', 'users.manage'), ah(createAndEnrollTrainee));
router.get('/trainees', requireAnyPermission('training.manage', 'programs.manage', 'interns.read'), ah(getAdminTrainees));
router.get('/trainees/:id', requireAnyPermission('training.manage', 'programs.manage', 'interns.read'), ah(getAdminTraineeDetail));
router.patch('/trainees/:id', requireAnyPermission('training.manage', 'programs.manage', 'interns.update'), ah(updateAdminTrainee));
router.post('/trainees/tasks', requireAnyPermission('training.manage', 'programs.manage', 'tasks.manage'), ah(createTraineeTask));
router.post('/trainees/:engagementId/tasks', requireAnyPermission('training.manage', 'programs.manage', 'tasks.manage'), ah(createTraineeTask));
router.post('/trainees/tasks/:id/review', requireAnyPermission('training.manage', 'programs.manage', 'tasks.manage'), ah(reviewTraineeTask));
router.patch('/trainees/:engagementId/tasks/:id/review', requireAnyPermission('training.manage', 'programs.manage', 'tasks.manage'), ah(reviewTraineeTask));
router.post('/trainees/attendance', requireAnyPermission('training.manage', 'attendance.manage', 'attendance.mark'), ah(recordAttendance));
router.post('/trainees/:engagementId/attendance', requireAnyPermission('training.manage', 'attendance.manage', 'attendance.mark'), ah(recordAttendance));
router.post('/trainees/assessments', requireAnyPermission('training.manage', 'performance.manage'), ah(recordAssessment));
router.post('/trainees/:engagementId/assessments', requireAnyPermission('training.manage', 'performance.manage'), ah(recordAssessment));
router.post('/trainees/:engagementId/mentor-feedback', requireAnyPermission('training.manage', 'performance.manage'), ah(recordMentorFeedback));
router.post('/trainees/:id/complete', requireAnyPermission('training.manage', 'certificates.manage'), ah(completeTraineeProgram));

router.get('/programs', requireAnyPermission('training.manage', 'programs.manage', 'programs.read'), ah(getPrograms));
router.post('/programs', requireAnyPermission('training.manage', 'programs.manage'), ah(createProgram));
router.get('/programs/:id', requireAnyPermission('training.manage', 'programs.manage', 'programs.read'), ah(getProgramById));
router.patch('/programs/:id', requireAnyPermission('training.manage', 'programs.manage'), ah(updateProgram));

router.get('/batches', requirePermission('training.manage'), ah(getBatches));
router.post('/batches', requirePermission('training.manage'), ah(createBatch));

router.post('/enroll', requirePermission('training.manage'), ah(enrollPerson));
router.get('/engagements', requirePermission('training.manage'), ah(getEngagements));
router.get('/engagements/:id', requirePermission('training.manage'), ah(getEngagementById));
router.post('/engagements/:id/checkpoints/:milestoneIndex/evaluate', requirePermission('training.evaluate'), ah(evaluateCheckpoint));

export default router;
