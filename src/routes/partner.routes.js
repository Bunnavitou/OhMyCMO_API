import { Router } from 'express';
import { convertPartnerToCustomer } from '../controllers/sale.controller.js';
import { convertPartnerSchema } from '../validators/sale.validator.js';
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
// Business card → customer (Sales, PHASE-1-ACTIVITIES.md §2.1); also needs Customers access.
router.post('/:id/convert', requirePermission('customers'), validate(convertPartnerSchema), asyncHandler(convertPartnerToCustomer));

export default router;
