import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { updatePmoSchema } from '../validators/pmo.validator.js';
import { listPmos, updatePmo } from '../controllers/pmo.controller.js';

const router = Router();
router.use(requireAuth);

// Any authenticated tenant member can see who the PMOs are and their tasks —
// the PMO menu itself carries no permission gate.
router.get('/', asyncHandler(listPmos));

// No route-level permission gate here, same as customer/partner task PATCHes —
// field-level checks live inside updatePmo (self-service on your own tasks is
// always allowed; promoting/demoting or touching someone else's task needs
// 'pmo.manage').
router.patch('/:id', validate(updatePmoSchema), asyncHandler(updatePmo));

export default router;
