import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, requirePermission } from '../middleware/auth.middleware.js';
import { makeCrud } from '../controllers/_crud.js';
import {
  idParamSchema,
  createCampaignSchema,
  updateCampaignSchema,
} from '../validators/campaign.validator.js';

const crud = makeCrud({ modelKey: 'campaign', resourceName: 'Campaign', responseKey: 'campaign' });
const router = Router();

router.use(requireAuth, requirePermission('marketing'));
router.get('/', asyncHandler(crud.list));
router.get('/:id', validate(idParamSchema), asyncHandler(crud.get));
router.post('/', validate(createCampaignSchema), asyncHandler(crud.create));
router.patch('/:id', validate(updateCampaignSchema), asyncHandler(crud.update));
router.delete('/:id', validate(idParamSchema), asyncHandler(crud.remove));

export default router;
