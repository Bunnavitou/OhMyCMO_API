// One-off data migration: move inline base64 image dataUrls out of JSON
// columns and into the File store (bytes on disk + a File row), replacing the
// JSON value with a lightweight reference { fileId, name, type, size }.
//
// Why: the dashboard bootstrap fetches every entity list in parallel and blocks
// rendering until all of them arrive. Partner.cardImage held a base64 JPEG per
// row (~810 KB avg, 146 MB across 184 rows), so /partners alone shipped 146 MB
// on every login. After this migration the rows carry only a ~80-byte reference
// and the image bytes are fetched lazily, per-image, from /api/files/:id/content.
//
// Idempotent: a value that is already a reference (has fileId, no data: dataUrl)
// is skipped, so it is safe to re-run.
//
// Usage (from OhMyCMO_API/):
//   NODE_ENV=development node --env-file=.env.development prisma/migrate-base64-to-files.js
//   (or: dotenv -e .env.development -- node prisma/migrate-base64-to-files.js)

import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { env } from '../src/config/env.js';

const prisma = new PrismaClient();

fs.mkdirSync(env.FILE_STORAGE_DIR, { recursive: true });

const stats = { files: 0, bytes: 0, partners: 0, customers: 0, campaigns: 0, skipped: 0 };

// "data:image/jpeg;base64,/9j/4AA..." -> { buffer, mime }
function decodeDataUrl(dataUrl) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  const mime = m[1] || 'application/octet-stream';
  const isBase64 = !!m[2];
  const buffer = isBase64
    ? Buffer.from(m[3], 'base64')
    : Buffer.from(decodeURIComponent(m[3]), 'utf8');
  return { buffer, mime };
}

function extFromMime(mime) {
  const map = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
  return map[mime] || 'bin';
}

// Persist one legacy image object to disk + File row, return a reference.
// Returns the original value unchanged if it isn't a base64 image.
async function toFileRef(value, { ownerId, entityType, entityId }) {
  if (!value || typeof value !== 'object') return value;
  if (value.fileId) return value; // already migrated
  const dataUrl = value.dataUrl;
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return value;

  const decoded = decodeDataUrl(dataUrl);
  if (!decoded) return value;

  const { buffer, mime } = decoded;
  const type = value.type || mime;
  const baseName = (value.name || `image.${extFromMime(type)}`).replace(/[^\w.\- ]+/g, '_').slice(0, 120);
  const random = Math.random().toString(36).slice(2, 10);
  const filename = `${Date.now().toString(36)}-${random}-${baseName}`;
  const storagePath = path.join(env.FILE_STORAGE_DIR, filename);

  fs.writeFileSync(storagePath, buffer);

  const file = await prisma.file.create({
    data: {
      ownerId,
      uploadedBy: null,
      name: value.name || baseName,
      mimeType: type,
      size: buffer.length,
      storagePath,
      entityType,
      entityId,
    },
  });

  stats.files += 1;
  stats.bytes += buffer.length;

  return { fileId: file.id, name: file.name, type: file.mimeType, size: file.size };
}

async function migratePartners() {
  const rows = await prisma.partner.findMany({
    select: { id: true, ownerId: true, cardImage: true, telegramQr: true },
  });
  for (const p of rows) {
    const cardImage = await toFileRef(p.cardImage, { ownerId: p.ownerId, entityType: 'partner', entityId: p.id });
    const telegramQr = await toFileRef(p.telegramQr, { ownerId: p.ownerId, entityType: 'partner', entityId: p.id });
    if (cardImage !== p.cardImage || telegramQr !== p.telegramQr) {
      await prisma.partner.update({ where: { id: p.id }, data: { cardImage, telegramQr } });
      stats.partners += 1;
    } else {
      stats.skipped += 1;
    }
  }
}

async function migrateCustomers() {
  const rows = await prisma.customer.findMany({
    select: { id: true, ownerId: true, profileImage: true },
  });
  for (const c of rows) {
    const profileImage = await toFileRef(c.profileImage, { ownerId: c.ownerId, entityType: 'customer', entityId: c.id });
    if (profileImage !== c.profileImage) {
      await prisma.customer.update({ where: { id: c.id }, data: { profileImage } });
      stats.customers += 1;
    } else {
      stats.skipped += 1;
    }
  }
}

async function migrateCampaigns() {
  const rows = await prisma.campaign.findMany({
    select: { id: true, ownerId: true, todos: true },
  });
  for (const cmp of rows) {
    const todos = Array.isArray(cmp.todos) ? cmp.todos : [];
    let changed = false;
    const next = [];
    for (const todo of todos) {
      const t = { ...todo };
      if (t.artwork) {
        const ref = await toFileRef(t.artwork, { ownerId: cmp.ownerId, entityType: 'campaign', entityId: cmp.id });
        if (ref !== t.artwork) { t.artwork = ref; changed = true; }
      }
      if (Array.isArray(t.artworks)) {
        const arts = [];
        for (const a of t.artworks) {
          const ref = await toFileRef(a, { ownerId: cmp.ownerId, entityType: 'campaign', entityId: cmp.id });
          if (ref !== a) changed = true;
          arts.push(ref);
        }
        t.artworks = arts;
      }
      next.push(t);
    }
    if (changed) {
      await prisma.campaign.update({ where: { id: cmp.id }, data: { todos: next } });
      stats.campaigns += 1;
    }
  }
}

async function main() {
  console.log(`[migrate] storage dir: ${env.FILE_STORAGE_DIR}`);
  await migratePartners();
  await migrateCustomers();
  await migrateCampaigns();
  console.log('[migrate] done:', {
    ...stats,
    movedMB: (stats.bytes / 1024 / 1024).toFixed(1),
  });
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
