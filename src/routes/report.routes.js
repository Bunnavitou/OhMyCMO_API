import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, requirePermission } from '../middleware/auth.middleware.js';
import {
  listReports,
  getReport,
  createReport,
  updateReport,
  removeReport,
  listReportLogs,
} from '../controllers/report.controller.js';
import {
  idParamSchema,
  createReportSchema,
  updateReportSchema,
} from '../validators/report.validator.js';

const router = Router();

router.use(requireAuth, requirePermission('reports'));
router.get('/', asyncHandler(listReports));
router.get('/logs', asyncHandler(listReportLogs)); // before '/:id' so it isn't captured as an id
router.get('/:id', validate(idParamSchema), asyncHandler(getReport));
router.post('/', validate(createReportSchema), asyncHandler(createReport));
router.patch('/:id', validate(updateReportSchema), asyncHandler(updateReport));
router.delete('/:id', requirePermission('reports.delete'), validate(idParamSchema), asyncHandler(removeReport));

export default router;
