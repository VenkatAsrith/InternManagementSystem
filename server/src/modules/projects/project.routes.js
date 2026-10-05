import { Router } from 'express';
import { getProjects, createProject, getProjectById, updateProject, addProjectMember, removeProjectMember, getProjectConversation } from './project.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac.js';

const router = Router();

router.use(authenticate, requireOrgContext);

router.get('/', requireAnyPermission('projects.read', 'projects.read_own'), getProjects);
router.post('/', requirePermission('projects.manage'), createProject);
router.get('/:id', requireAnyPermission('projects.read', 'projects.read_own'), getProjectById);
router.patch('/:id', requirePermission('projects.manage'), updateProject);
router.post('/:id/members', requirePermission('projects.manage'), addProjectMember);
router.delete('/:id/members/:memberId', requirePermission('projects.manage'), removeProjectMember);
router.get('/:id/conversation', requireAnyPermission('projects.read', 'projects.read_own'), getProjectConversation);

export default router;
