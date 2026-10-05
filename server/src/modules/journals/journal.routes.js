import { Router } from 'express';
import { submitJournal, updateJournal, getJournals, getJournalById, reviewJournal } from './journal.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac.js';

const router = Router();

router.use(authenticate, requireOrgContext);

router.post('/', requirePermission('journals.create'), submitJournal);
router.get('/', requireAnyPermission('journals.read', 'journals.read_own'), getJournals);
router.get('/:id', requireAnyPermission('journals.read', 'journals.read_own'), getJournalById);
router.put('/:id', requirePermission('journals.create'), updateJournal);
router.post('/:id/review', requirePermission('journals.review'), reviewJournal);

export default router;
