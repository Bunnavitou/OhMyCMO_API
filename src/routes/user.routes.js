import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import {
  listUsersSchema,
  getUserSchema,
  updateUserSchema,
  deleteUserSchema,
} from '../validators/user.validator.js';
import {
  listTeam,
  listUsers,
  getUser,
  updateUser,
  deleteUser,
} from '../controllers/user.controller.js';

const router = Router();

router.use(requireAuth);

// Any authenticated member can read the tenant roster (names only).
router.get('/team', asyncHandler(listTeam));

router.get('/', requireRole('ADMIN'), validate(listUsersSchema), asyncHandler(listUsers));
router.get('/:id', validate(getUserSchema), asyncHandler(getUser));
router.patch('/:id', validate(updateUserSchema), asyncHandler(updateUser));
router.delete('/:id', validate(deleteUserSchema), asyncHandler(deleteUser));

export default router;
