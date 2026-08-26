import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, requirePermission } from '../middleware/auth.middleware.js';
import { sendSchema, mailSettingsSchema, verifyMailSchema } from '../validators/zoho.validator.js';
import {
  getStatus, sendReport, getMailSettings, updateMailSettings, verifySettings,
} from '../controllers/zoho.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/status', asyncHandler(getStatus));
// Sending is an opt-out ability: allowed unless an admin disabled `send`.
router.post('/send', requirePermission('billing.send'), validate(sendSchema), asyncHandler(sendReport));

// Mail settings are per user — every team member manages their own row, no
// extra permission gate beyond being signed in (requireAuth above).
router.get('/settings', asyncHandler(getMailSettings));
router.put('/settings', validate(mailSettingsSchema), asyncHandler(updateMailSettings));
router.post('/verify', validate(verifyMailSchema), asyncHandler(verifySettings));

export default router;
