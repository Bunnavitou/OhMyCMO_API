import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, requirePermission } from '../middleware/auth.middleware.js';
import {
  idParamSchema,
  createCustomerSchema,
  updateCustomerSchema,
  appendLogSchema,
  checkinsSchema,
  logCheckinSchema,
} from '../validators/customer.validator.js';
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  appendCustomerLog,
  listCustomerHealth,
  listCheckins,
  logCheckin,
} from '../controllers/customer.controller.js';

const router = Router();

router.use(requireAuth, requirePermission('customers'));

router.get('/', asyncHandler(listCustomers));
router.get('/health', asyncHandler(listCustomerHealth));
router.get('/checkins', validate(checkinsSchema), asyncHandler(listCheckins));
router.get('/:id', validate(idParamSchema), asyncHandler(getCustomer));
router.post('/', validate(createCustomerSchema), asyncHandler(createCustomer));
router.patch('/:id', validate(updateCustomerSchema), asyncHandler(updateCustomer));
router.delete('/:id', requirePermission('customers.delete'), validate(idParamSchema), asyncHandler(deleteCustomer));
router.post('/:id/logs', validate(appendLogSchema), asyncHandler(appendCustomerLog));
router.post('/:id/checkins', validate(logCheckinSchema), asyncHandler(logCheckin));

export default router;
