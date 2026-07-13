import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { sendSchema } from '../validators/zoho.validator.js';
import { getStatus, sendReport } from '../controllers/zoho.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/status', asyncHandler(getStatus));
router.post('/send', validate(sendSchema), asyncHandler(sendReport));

export default router;
