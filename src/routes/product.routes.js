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

// Any sub-user with the 'products' menu permission sees every tenant
// Product/Service, same as Customers/Partners/Marketing/Assets/Reports.
// Only the tenant owner or a 'pmo.manage' holder may set/change `pmoOwnerId`
// (via `ownerOnlyFields`/`ownerOnlyFieldsUnless`, below) — a PMO or task
// assignee can't self-assign or reassign a record.
const crud = makeCrud({
  modelKey: 'product',
  resourceName: 'Product',
  responseKey: 'product',
  include: { pmoOwner: { select: { id: true, name: true, username: true, avatar: true } } },
  ownerOnlyFields: ['pmoOwnerId'],
  ownerOnlyFieldsUnless: 'pmo.manage',
});
const router = Router();

router.use(requireAuth, requirePermission('products'));
router.get('/', asyncHandler(crud.list));
router.get('/:id', validate(idParamSchema), asyncHandler(crud.get));
router.post('/', requirePermission('billing.create'), validate(createProductSchema), asyncHandler(crud.create));
router.patch('/:id', validate(updateProductSchema), asyncHandler(crud.update));
router.delete('/:id', requirePermission('billing.delete'), validate(idParamSchema), asyncHandler(crud.remove));

export default router;
