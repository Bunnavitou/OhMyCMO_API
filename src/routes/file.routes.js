import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  uploadMiddleware,
  uploadFile,
  getFileMeta,
  downloadFile,
  deleteFile,
} from '../controllers/file.controller.js';

const router = Router();

router.use(requireAuth);

// POST /api/files          (multipart, field name: "file"; optional entityType/entityId)
router.post('/', uploadMiddleware, asyncHandler(uploadFile));
// GET  /api/files/:id            metadata
router.get('/:id', asyncHandler(getFileMeta));
// GET  /api/files/:id/content    bytes
router.get('/:id/content', asyncHandler(downloadFile));
// DELETE /api/files/:id
router.delete('/:id', asyncHandler(deleteFile));

export default router;
