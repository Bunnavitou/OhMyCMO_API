import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, requirePermission } from '../middleware/auth.middleware.js';
import {
  createSubUserSchema,
  updateSubUserSchema,
  idParamSchema,
} from '../validators/subUser.validator.js';
import {
  listSubUsers,
  getSubUser,
  createSubUser,
  updateSubUser,
  deleteSubUser,
} from '../controllers/subUser.controller.js';

const router = Router();

// All sub-user management requires the 'subUsers' permission.
// Owners always have it; sub-users only if explicitly granted.
router.use(requireAuth, requirePermission('subUsers'));

router.get('/', asyncHandler(listSubUsers));
router.get('/:id', validate(idParamSchema), asyncHandler(getSubUser));
router.post('/', validate(createSubUserSchema), asyncHandler(createSubUser));
router.patch('/:id', validate(updateSubUserSchema), asyncHandler(updateSubUser));
router.delete('/:id', validate(idParamSchema), asyncHandler(deleteSubUser));

export default router;
