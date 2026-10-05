import { Router } from 'express';
import {
  getLearningPaths, getLearningPathDetails, completeLesson, submitQuiz, createLearningPath, createModule, createLesson
} from './learning.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';

const router = Router();

router.use(authenticate, requireOrgContext);

router.get('/paths', requirePermission('learning.read'), getLearningPaths);
router.get('/paths/:id', requirePermission('learning.read'), getLearningPathDetails);
router.post('/paths', requirePermission('learning.manage'), createLearningPath);
router.post('/paths/:id/modules', requirePermission('learning.manage'), createModule);
router.post('/modules/:moduleId/lessons', requirePermission('learning.manage'), createLesson);
router.post('/lessons/:lessonId/complete', requirePermission('learning.progress'), completeLesson);
router.post('/lessons/:lessonId/quiz', requirePermission('learning.progress'), submitQuiz);

export default router;
