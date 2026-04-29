import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, requirePermission } from '../middleware/auth.middleware.js';
import { makeCrud } from '../controllers/_crud.js';
import {
  idParamSchema,
  createPartnerSchema,
  updatePartnerSchema,
} from '../validators/partner.validator.js';

const crud = makeCrud({ modelKey: 'partner', resourceName: 'Partner', responseKey: 'partner' });
const router = Router();

router.use(requireAuth, requirePermission('partners'));
router.get('/', asyncHandler(crud.list));
router.get('/:id', validate(idParamSchema), asyncHandler(crud.get));
router.post('/', validate(createPartnerSchema), asyncHandler(crud.create));
router.patch('/:id', validate(updatePartnerSchema), asyncHandler(crud.update));
router.delete('/:id', validate(idParamSchema), asyncHandler(crud.remove));

export default router;
