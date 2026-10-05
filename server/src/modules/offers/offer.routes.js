import { Router } from 'express';
import {
  createOffer, updateOffer, getOffers, getOfferById, sendOffer, revokeOffer, acceptOfferOnBehalf,
  getPublicOffer, acceptPublicOffer, declinePublicOffer
} from './offer.controller.js';
import { authenticate, requireOrgContext } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { publicLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

// ---- Public: candidate responds through the secret link (declared before the authenticated routes) ----
router.get('/public/:token', publicLimiter, getPublicOffer);
router.post('/public/:token/accept', publicLimiter, acceptPublicOffer);
router.post('/public/:token/decline', publicLimiter, declinePublicOffer);

// ---- Staff -------------------------------------------------------------------------------------------
router.use(authenticate, requireOrgContext);

router.post('/', requirePermission('offers.create'), createOffer);
router.get('/', requirePermission('offers.read'), getOffers);
router.get('/:id', requirePermission('offers.read'), getOfferById);
router.patch('/:id', requirePermission('offers.create'), updateOffer);
router.post('/:id/send', requirePermission('offers.send'), sendOffer);
router.post('/:id/revoke', requirePermission('offers.send'), revokeOffer);
router.post('/:id/accept', requirePermission('offers.accept'), acceptOfferOnBehalf);

export default router;
