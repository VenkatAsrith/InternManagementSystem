import { Router } from 'express';
import { getTasks, createTask, getTaskById, updateTask, changeTaskStatus, submitTaskDeliverable, reviewTaskSubmission } from './task.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac.js';

const router = Router();

router.use(authenticate, requireOrgContext);

router.get('/', requireAnyPermission('tasks.read', 'tasks.read_own'), getTasks);
router.post('/', requirePermission('tasks.assign'), createTask);
router.get('/:id', requireAnyPermission('tasks.read', 'tasks.read_own'), getTaskById);
router.patch('/:id', requirePermission('tasks.assign'), updateTask);
router.post('/:id/status', requireAnyPermission('tasks.assign', 'tasks.progress'), changeTaskStatus);
router.post('/:id/submit', requirePermission('tasks.submit'), submitTaskDeliverable);
router.post('/:id/review', requirePermission('tasks.review'), reviewTaskSubmission);

export default router;
