import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, requirePermission } from '../middleware/auth.middleware.js';
import { makeCrud } from '../controllers/_crud.js';
import {
  idParamSchema,
  createAssetSchema,
  updateAssetSchema,
} from '../validators/asset.validator.js';

const crud = makeCrud({ modelKey: 'asset', resourceName: 'Asset', responseKey: 'asset' });
const router = Router();

router.use(requireAuth, requirePermission('assets'));
router.get('/', asyncHandler(crud.list));
router.get('/:id', validate(idParamSchema), asyncHandler(crud.get));
router.post('/', validate(createAssetSchema), asyncHandler(crud.create));
router.patch('/:id', validate(updateAssetSchema), asyncHandler(crud.update));
router.delete('/:id', validate(idParamSchema), asyncHandler(crud.remove));

export default router;
