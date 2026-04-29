import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { tenantIdOf } from '../utils/tenant.js';

// Ensure the storage directory exists at boot.
fs.mkdirSync(env.FILE_STORAGE_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.FILE_STORAGE_DIR),
  filename: (_req, file, cb) => {
    // Filename = <random>-<originalname>. Random prefix prevents collisions.
    const random = Math.random().toString(36).slice(2, 10);
    const safe = file.originalname.replace(/[^\w.\- ]+/g, '_').slice(0, 120);
    cb(null, `${Date.now().toString(36)}-${random}-${safe}`);
  },
});

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: env.MAX_UPLOAD_BYTES },
}).single('file');

export async function uploadFile(req, res) {
  if (!req.file) throw ApiError.badRequest('No file uploaded (field name: "file")');
  const tenantId = tenantIdOf(req.user);

  const { entityType, entityId } = req.body || {};

  const record = await prisma.file.create({
    data: {
      ownerId: tenantId,
      uploadedBy: req.user.id,
      name: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      storagePath: req.file.path,
      entityType: entityType || null,
      entityId: entityId || null,
    },
  });

  res.status(201).json({ success: true, data: { file: serializeFile(record) } });
}

function serializeFile(f) {
  return {
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    type: f.mimeType, // legacy alias to match existing frontend shape
    size: f.size,
    entityType: f.entityType,
    entityId: f.entityId,
    uploadedAt: f.createdAt,
    url: `/api/files/${f.id}/content`,
  };
}

export async function getFileMeta(req, res) {
  const tenantId = tenantIdOf(req.user);
  const f = await prisma.file.findFirst({
    where: { id: req.params.id, ownerId: tenantId },
  });
  if (!f) throw ApiError.notFound('File not found');
  res.json({ success: true, data: { file: serializeFile(f) } });
}

export async function downloadFile(req, res) {
  const tenantId = tenantIdOf(req.user);
  const f = await prisma.file.findFirst({
    where: { id: req.params.id, ownerId: tenantId },
  });
  if (!f) throw ApiError.notFound('File not found');
  if (!fs.existsSync(f.storagePath)) {
    throw ApiError.notFound('File data missing on disk');
  }
  res.setHeader('Content-Type', f.mimeType || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(f.name)}"`,
  );
  res.sendFile(path.resolve(f.storagePath));
}

export async function deleteFile(req, res) {
  const tenantId = tenantIdOf(req.user);
  const f = await prisma.file.findFirst({
    where: { id: req.params.id, ownerId: tenantId },
  });
  if (!f) throw ApiError.notFound('File not found');
  await prisma.file.delete({ where: { id: f.id } });
  fs.promises.unlink(f.storagePath).catch(() => {});
  res.json({ success: true, data: { message: 'File deleted' } });
}
