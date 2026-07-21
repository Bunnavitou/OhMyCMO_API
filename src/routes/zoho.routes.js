import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, requirePermission } from '../middleware/auth.middleware.js';
import { sendSchema } from '../validators/zoho.validator.js';
import { getStatus, sendReport } from '../controllers/zoho.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/status', asyncHandler(getStatus));
// Sending is an opt-out ability: allowed unless an admin disabled `send`.
router.post('/send', requirePermission('billing.send'), validate(sendSchema), asyncHandler(sendReport));

export default router;
