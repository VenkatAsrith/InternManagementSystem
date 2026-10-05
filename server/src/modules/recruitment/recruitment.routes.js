import { Router } from 'express';
import {
  getPublicOpenings, getPublicOpeningBySlug, submitPublicApplication, getPublicApplicationStatus,
  getPrograms, createProgram, updateProgram, archiveProgram,
  getOpenings, createOpening, updateOpening,
  getApplications, getApplicationById, updateApplicationStage, addApplicationNote, downloadApplicationResume,
  getMyApplications
} from './recruitment.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac.js';
import { uploadSingle, RESUME_MIME_TYPES } from '../../middleware/upload.js';
import { publicLimiter, applyLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

// ---- Public (anonymous) ------------------------------------------------------
router.get('/openings/public', publicLimiter, getPublicOpenings);
router.get('/openings/public/:slug', publicLimiter, getPublicOpeningBySlug);
router.post('/applications/public', applyLimiter, uploadSingle('resume', { mimeTypes: RESUME_MIME_TYPES }), submitPublicApplication);
router.get('/applications/public/status/:applicationId', publicLimiter, getPublicApplicationStatus);

// ---- Authenticated -----------------------------------------------------------
router.use(authenticate);
router.get('/applications/mine', requirePermission('applications.read_own'), getMyApplications);

router.use(requireOrgContext);

router.get('/programs', requireAnyPermission('programs.read', 'programs.manage'), getPrograms);
router.post('/programs', requirePermission('programs.manage'), createProgram);
router.patch('/programs/:id', requirePermission('programs.manage'), updateProgram);
router.post('/programs/:id/archive', requirePermission('programs.manage'), archiveProgram);

router.get('/openings', requirePermission('openings.read'), getOpenings);
router.post('/openings', requirePermission('openings.manage'), createOpening);
router.patch('/openings/:id', requirePermission('openings.manage'), updateOpening);

router.get('/applications', requirePermission('applications.read'), getApplications);
router.get('/applications/:id', requirePermission('applications.read'), getApplicationById);
router.get('/applications/:id/resume', requirePermission('applications.read'), downloadApplicationResume);
router.patch('/applications/:id/stage', requirePermission('applications.stage'), updateApplicationStage);
router.post('/applications/:id/notes', requirePermission('applications.notes'), addApplicationNote);

export default router;
