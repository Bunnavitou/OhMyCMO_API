import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { tenantIdOf } from '../utils/tenant.js';

// Reports use a hand-written controller (instead of the generic makeCrud) so
// every create / update / delete is recorded in ReportLog for monitoring.

// Friendly display name for the person performing the action.
async function actorNameOf(user) {
  const u = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true, username: true, email: true },
  });
  return u?.name || u?.username || u?.email || 'User';
}

async function writeLog(tenantId, actor, action, report, meta = null) {
  await prisma.reportLog.create({
    data: {
      ownerId: tenantId,
      reportId: report.id ?? null,
      actorId: actor.id,
      actorName: actor.name,
      action,
      account: report.account,
      year: report.year,
      month: report.month,
      meta,
    },
  });
}

export async function listReports(req, res) {
  const tenantId = tenantIdOf(req.user);
  const items = await prisma.report.findMany({
    where: { ownerId: tenantId },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: { items } });
}

export async function getReport(req, res) {
  const tenantId = tenantIdOf(req.user);
  const item = await prisma.report.findFirst({
    where: { id: req.params.id, ownerId: tenantId },
  });
  if (!item) throw ApiError.notFound('Report not found');
  res.json({ success: true, data: { report: item } });
}

export async function createReport(req, res) {
  const tenantId = tenantIdOf(req.user);
  const item = await prisma.report.create({
    data: { ...req.body, ownerId: tenantId },
  });
  const name = await actorNameOf(req.user);
  await writeLog(tenantId, { id: req.user.id, name }, 'create', item);
  res.status(201).json({ success: true, data: { report: item } });
}

export async function updateReport(req, res) {
  const tenantId = tenantIdOf(req.user);
  const existing = await prisma.report.findFirst({
    where: { id: req.params.id, ownerId: tenantId },
  });
  if (!existing) throw ApiError.notFound('Report not found');
  const item = await prisma.report.update({
    where: { id: req.params.id },
    data: req.body,
  });
  const name = await actorNameOf(req.user);
  await writeLog(tenantId, { id: req.user.id, name }, 'update', item);
  res.json({ success: true, data: { report: item } });
}

export async function removeReport(req, res) {
  const tenantId = tenantIdOf(req.user);
  const existing = await prisma.report.findFirst({
    where: { id: req.params.id, ownerId: tenantId },
  });
  if (!existing) throw ApiError.notFound('Report not found');
  await prisma.report.delete({ where: { id: req.params.id } });
  const name = await actorNameOf(req.user);
  await writeLog(tenantId, { id: req.user.id, name }, 'delete', existing);
  res.json({ success: true, data: { message: 'Report deleted' } });
}

// Recent activity across all of the tenant's reports (newest first).
export async function listReportLogs(req, res) {
  const tenantId = tenantIdOf(req.user);
  const items = await prisma.reportLog.findMany({
    where: { ownerId: tenantId },
    orderBy: { ts: 'desc' },
    take: 200,
  });
  res.json({ success: true, data: { items } });
}
