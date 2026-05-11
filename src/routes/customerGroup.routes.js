import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, requirePermission } from '../middleware/auth.middleware.js';
import { makeCrud } from '../controllers/_crud.js';
import {
  idParamSchema,
  createGroupSchema,
  updateGroupSchema,
} from '../validators/customerGroup.validator.js';

const crud = makeCrud({
  modelKey: 'customerGroup',
  resourceName: 'Customer group',
  responseKey: 'group',
});
const router = Router();

// Anyone with `customers` permission can manage groups too — they're a
// sub-feature of the customer workspace.
router.use(requireAuth, requirePermission('customers'));
router.get('/', asyncHandler(crud.list));
router.get('/:id', validate(idParamSchema), asyncHandler(crud.get));
router.post('/', validate(createGroupSchema), asyncHandler(crud.create));
router.patch('/:id', validate(updateGroupSchema), asyncHandler(crud.update));
router.delete('/:id', validate(idParamSchema), asyncHandler(crud.remove));

export default router;
