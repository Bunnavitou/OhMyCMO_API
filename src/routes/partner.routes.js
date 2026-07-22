import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, requirePermission } from '../middleware/auth.middleware.js';
import {
  idParamSchema,
  createPartnerSchema,
  updatePartnerSchema,
  appendLogSchema,
} from '../validators/partner.validator.js';
import {
  listPartners,
  getPartner,
  createPartner,
  updatePartner,
  deletePartner,
  appendPartnerLog,
} from '../controllers/partner.controller.js';

const router = Router();

router.use(requireAuth, requirePermission('partners'));
router.get('/', asyncHandler(listPartners));
router.get('/:id', validate(idParamSchema), asyncHandler(getPartner));
router.post('/', validate(createPartnerSchema), asyncHandler(createPartner));
router.patch('/:id', validate(updatePartnerSchema), asyncHandler(updatePartner));
router.delete('/:id', requirePermission('partners.delete'), validate(idParamSchema), asyncHandler(deletePartner));
router.post('/:id/logs', validate(appendLogSchema), asyncHandler(appendPartnerLog));

export default router;
