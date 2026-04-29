import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, requirePermission } from '../middleware/auth.middleware.js';
import { makeCrud } from '../controllers/_crud.js';
import {
  idParamSchema,
  createProductSchema,
  updateProductSchema,
} from '../validators/product.validator.js';

const crud = makeCrud({ modelKey: 'product', resourceName: 'Product', responseKey: 'product' });
const router = Router();

router.use(requireAuth, requirePermission('products'));
router.get('/', asyncHandler(crud.list));
router.get('/:id', validate(idParamSchema), asyncHandler(crud.get));
router.post('/', validate(createProductSchema), asyncHandler(crud.create));
router.patch('/:id', validate(updateProductSchema), asyncHandler(crud.update));
router.delete('/:id', validate(idParamSchema), asyncHandler(crud.remove));

export default router;
