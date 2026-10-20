import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { tenantIdOf, assertOwnTaskChangesOnly } from '../utils/tenant.js';
import { HEALTH_STAGES, THRESHOLDS, customerHealth } from '../utils/health.js';

// Top-level fields that — when changed — are worth logging.
// Nested JSON arrays (tasks/staff/files/...) generate their own
// per-action logs at higher granularity from the frontend's existing
// "appendCustomerLog" call paths, so we don't double-log them here.
const LOGGABLE_TOP_FIELDS = ['name', 'industry', 'contact', 'email', 'phone', 'address', 'vatTin', 'stage', 'groupId'];

// Reject groupId values that don't belong to the caller's tenant.
async function ensureGroupBelongsToTenant(tenantId, groupId) {
  if (!groupId) return;
  const g = await prisma.customerGroup.findFirst({
    where: { id: groupId, ownerId: tenantId },
    select: { id: true },
  });
  if (!g) throw ApiError.badRequest('Unknown groupId for this tenant');
}

function customerWithLogs(customer) {
  if (!customer) return customer;
  // Frontend expects logs as an array on the customer object.
  const { logs, ...rest } = customer;
  return { ...rest, logs: logs || [] };
}

async function findOwn(tenantId, id) {
  return prisma.customer.findFirst({
    where: { id, ownerId: tenantId },
    include: { logs: { orderBy: { ts: 'desc' } } },
  });
}

export async function listCustomers(req, res) {
  const tenantId = tenantIdOf(req.user);
  const items = await prisma.customer.findMany({
    where: { ownerId: tenantId },
    include: { logs: { orderBy: { ts: 'desc' } } },
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
  });
  res.json({ success: true, data: { items: items.map(customerWithLogs) } });
}

export async function getCustomer(req, res) {
  const tenantId = tenantIdOf(req.user);
  const item = await findOwn(tenantId, req.params.id);
  if (!item) throw ApiError.notFound('Customer not found');
  res.json({ success: true, data: { customer: customerWithLogs(item) } });
}

export async function createCustomer(req, res) {
  const tenantId = tenantIdOf(req.user);
  await ensureGroupBelongsToTenant(tenantId, req.body.groupId);
  const item = await prisma.customer.create({
    data: { ...req.body, ownerId: tenantId },
    include: { logs: true },
  });
  await prisma.customerLog.create({
    data: {
      customerId: item.id,
      type: 'customer.create',
      message: 'Customer created',
      meta: { name: item.name, by: req.user.id },
    },
  });
  const fresh = await findOwn(tenantId, item.id);
  res.status(201).json({ success: true, data: { customer: customerWithLogs(fresh) } });
}

export async function updateCustomer(req, res) {
  const tenantId = tenantIdOf(req.user);
  const existing = await findOwn(tenantId, req.params.id);
  if (!existing) throw ApiError.notFound('Customer not found');

  const data = { ...req.body };
  if ('groupId' in data) await ensureGroupBelongsToTenant(tenantId, data.groupId);
  if ('tasks' in data) assertOwnTaskChangesOnly(req.user, existing.tasks, data.tasks);

  // Detect changed top-level fields for the audit log.
  const changedFields = LOGGABLE_TOP_FIELDS.filter(
    (k) => k in data && data[k] !== existing[k],
  );

  const updated = await prisma.customer.update({
    where: { id: req.params.id },
    data,
  });

  if (changedFields.length > 0) {
    await prisma.customerLog.create({
      data: {
        customerId: updated.id,
        type: 'customer.update',
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
  res.json({ success: true, data: { customer: customerWithLogs(fresh) } });
}

export async function deleteCustomer(req, res) {
  const tenantId = tenantIdOf(req.user);
  const existing = await findOwn(tenantId, req.params.id);
  if (!existing) throw ApiError.notFound('Customer not found');
  // Sales are history — they block the delete rather than being removed
  // with the customer (PHASE-1-ACTIVITIES.md, A5).
  const sales = await prisma.sale.count({ where: { customerId: existing.id } });
  if (sales > 0) {
    throw ApiError.conflict(`Customer has ${sales} sale(s) and cannot be deleted`);
  }
  await prisma.customer.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: { message: 'Customer deleted' } });
}

// Health of every customer being served (utils/health.js). Computed here
// because it reads sales and activities, which the client loads per screen.
export async function listCustomerHealth(req, res) {
  const tenantId = tenantIdOf(req.user);
  const customers = await prisma.customer.findMany({
    where: { ownerId: tenantId, stage: { in: HEALTH_STAGES } },
    select: { id: true, name: true, createdAt: true, tasks: true, productLinks: true },
  });
  const ids = customers.map((c) => c.id);
  const [sales, products, sends] = await Promise.all([
    prisma.sale.findMany({
      where: { ownerId: tenantId, customerId: { in: ids } },
      select: {
        customerId: true, saleAt: true, status: true,
        activities: { select: { status: true, dueDate: true, doneAt: true } },
      },
    }),
    prisma.product.findMany({ where: { ownerId: tenantId }, select: { income: true } }),
    prisma.customerLog.groupBy({
      by: ['customerId'],
      where: { customerId: { in: ids }, type: 'invoice.send' },
      _max: { ts: true },
    }),
  ]);

  // Invoice dates per customer. Older entries carry only the customer's name
  // (`source`), so fall back to matching it.
  const byName = new Map(customers.map((c) => [c.name.trim().toLowerCase(), c.id]));
  const invoiceDates = new Map();
  for (const p of products) {
    for (const entry of Array.isArray(p.income) ? p.income : []) {
      const id = entry.customerId || byName.get(String(entry.customerName || entry.source || '').trim().toLowerCase());
      if (!id || !entry.date) continue;
      if (!invoiceDates.has(id)) invoiceDates.set(id, []);
      invoiceDates.get(id).push(String(entry.date).slice(0, 10));
    }
  }

  const items = customers.map((c) => customerHealth(c, {
    sales: sales.filter((s) => s.customerId === c.id),
    invoiceDates: invoiceDates.get(c.id) || [],
    lastInvoiceSend: sends.find((s) => s.customerId === c.id)?._max.ts,
  }));
  res.json({ success: true, data: { items, thresholds: THRESHOLDS } });
}

export async function appendCustomerLog(req, res) {
  const tenantId = tenantIdOf(req.user);
  const existing = await prisma.customer.findFirst({
    where: { id: req.params.id, ownerId: tenantId },
  });
  if (!existing) throw ApiError.notFound('Customer not found');

  const log = await prisma.customerLog.create({
    data: {
      customerId: existing.id,
      type: req.body.type,
      message: req.body.message,
      meta: req.body.meta ?? null,
    },
  });
  res.status(201).json({ success: true, data: { log } });
}
