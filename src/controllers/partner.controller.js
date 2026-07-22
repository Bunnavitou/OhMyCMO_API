import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { tenantIdOf, assertOwnTaskChangesOnly } from '../utils/tenant.js';

// Top-level fields that — when changed — are worth logging.
// Nested JSON arrays (tasks/...) generate their own per-action logs at
// higher granularity from the frontend's existing "appendPartnerLog" call
// paths, so we don't double-log them here.
const LOGGABLE_TOP_FIELDS = ['name', 'company', 'role', 'email', 'phone', 'telegram'];

function partnerWithLogs(partner) {
  if (!partner) return partner;
  // Frontend expects logs as an array on the partner object.
  const { logs, ...rest } = partner;
  return { ...rest, logs: logs || [] };
}

async function findOwn(tenantId, id) {
  return prisma.partner.findFirst({
    where: { id, ownerId: tenantId },
    include: { logs: { orderBy: { ts: 'desc' } } },
  });
}

export async function listPartners(req, res) {
  const tenantId = tenantIdOf(req.user);
  const items = await prisma.partner.findMany({
    where: { ownerId: tenantId },
    include: { logs: { orderBy: { ts: 'desc' } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: { items: items.map(partnerWithLogs) } });
}

export async function getPartner(req, res) {
  const tenantId = tenantIdOf(req.user);
  const item = await findOwn(tenantId, req.params.id);
  if (!item) throw ApiError.notFound('Partner not found');
  res.json({ success: true, data: { partner: partnerWithLogs(item) } });
}

export async function createPartner(req, res) {
  const tenantId = tenantIdOf(req.user);
  const item = await prisma.partner.create({
    data: { ...req.body, ownerId: tenantId },
    include: { logs: true },
  });
  await prisma.partnerLog.create({
    data: {
      partnerId: item.id,
      type: 'partner.create',
      message: 'Partner created',
      meta: { name: item.name, by: req.user.id },
    },
  });
  const fresh = await findOwn(tenantId, item.id);
  res.status(201).json({ success: true, data: { partner: partnerWithLogs(fresh) } });
}

export async function updatePartner(req, res) {
  const tenantId = tenantIdOf(req.user);
  const existing = await findOwn(tenantId, req.params.id);
  if (!existing) throw ApiError.notFound('Partner not found');

  const data = { ...req.body };
  if ('tasks' in data) assertOwnTaskChangesOnly(req.user, existing.tasks, data.tasks);

  // Detect changed top-level fields for the audit log.
  const changedFields = LOGGABLE_TOP_FIELDS.filter(
    (k) => k in data && data[k] !== existing[k],
  );

  const updated = await prisma.partner.update({
    where: { id: req.params.id },
    data,
  });

  if (changedFields.length > 0) {
    await prisma.partnerLog.create({
      data: {
        partnerId: updated.id,
        type: 'partner.update',
        message: `Updated ${changedFields.join(', ')}`,
        meta: {
          changed: changedFields,
          before: Object.fromEntries(changedFields.map((k) => [k, existing[k]])),
          after: Object.fromEntries(changedFields.map((k) => [k, updated[k]])),
          by: req.user.id,
        },
      },
    });
  }

  const fresh = await findOwn(tenantId, updated.id);
  res.json({ success: true, data: { partner: partnerWithLogs(fresh) } });
}

export async function deletePartner(req, res) {
  const tenantId = tenantIdOf(req.user);
  const existing = await findOwn(tenantId, req.params.id);
  if (!existing) throw ApiError.notFound('Partner not found');
  await prisma.partner.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: { message: 'Partner deleted' } });
}

export async function appendPartnerLog(req, res) {
  const tenantId = tenantIdOf(req.user);
  const existing = await prisma.partner.findFirst({
    where: { id: req.params.id, ownerId: tenantId },
  });
  if (!existing) throw ApiError.notFound('Partner not found');

  const log = await prisma.partnerLog.create({
    data: {
      partnerId: existing.id,
      type: req.body.type,
      message: req.body.message,
      meta: req.body.meta ?? null,
    },
  });
  res.status(201).json({ success: true, data: { log } });
}
