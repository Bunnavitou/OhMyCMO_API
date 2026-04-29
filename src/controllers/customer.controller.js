import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { tenantIdOf } from '../utils/tenant.js';

// Top-level fields that — when changed — are worth logging.
// Nested JSON arrays (tasks/staff/files/...) generate their own
// per-action logs at higher granularity from the frontend's existing
// "appendCustomerLog" call paths, so we don't double-log them here.
const LOGGABLE_TOP_FIELDS = ['name', 'industry', 'contact', 'email', 'phone', 'address', 'vatTin', 'stage'];

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
    orderBy: { createdAt: 'desc' },
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
  await prisma.customer.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: { message: 'Customer deleted' } });
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
