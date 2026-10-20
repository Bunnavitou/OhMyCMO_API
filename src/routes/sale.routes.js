import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, requirePermission } from '../middleware/auth.middleware.js';
import {
  idParamSchema,
  listSalesSchema,
  followupsSchema,
  calendarSchema,
  createSaleSchema,
  updateSaleSchema,
  updateActivitySchema,
  winSaleSchema,
  dashboardSchema,
} from '../validators/sale.validator.js';
import {
  listSales,
  listFollowups,
  getSale,
  createSale,
  updateSale,
  deleteSale,
  listActivities,
  updateActivity,
  winSale,
  dashboard,
} from '../controllers/sale.controller.js';

const router = Router();

router.use(requireAuth, requirePermission('sales'));

router.get('/', validate(listSalesSchema), asyncHandler(listSales));
router.get('/followups', validate(followupsSchema), asyncHandler(listFollowups));
router.get('/dashboard', validate(dashboardSchema), asyncHandler(dashboard));
router.get('/activities', validate(calendarSchema), asyncHandler(listActivities));
router.patch('/activities/:id', validate(updateActivitySchema), asyncHandler(updateActivity));
router.get('/:id', validate(idParamSchema), asyncHandler(getSale));
router.post('/', validate(createSaleSchema), asyncHandler(createSale));
router.patch('/:id', validate(updateSaleSchema), asyncHandler(updateSale));
router.delete('/:id', validate(idParamSchema), asyncHandler(deleteSale));
router.post('/:id/win', validate(winSaleSchema), asyncHandler(winSale));

export default router;
