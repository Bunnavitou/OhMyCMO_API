import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { tenantIdOf } from '../utils/tenant.js';

// Build a tenant-scoped CRUD controller for a Prisma model.
//   modelKey  — the lowercase Prisma client key, e.g. 'product'
//   resourceName — singular for error messages, e.g. 'Product'
//   responseKey  — the JSON envelope key for one item, e.g. 'product'
export function makeCrud({ modelKey, resourceName, responseKey }) {
  const model = prisma[modelKey];
  if (!model) throw new Error(`Unknown Prisma model: ${modelKey}`);

  return {
    list: async (req, res) => {
      const tenantId = tenantIdOf(req.user);
      const items = await model.findMany({
        where: { ownerId: tenantId },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ success: true, data: { items } });
    },

    get: async (req, res) => {
      const tenantId = tenantIdOf(req.user);
      const item = await model.findFirst({
        where: { id: req.params.id, ownerId: tenantId },
      });
      if (!item) throw ApiError.notFound(`${resourceName} not found`);
      res.json({ success: true, data: { [responseKey]: item } });
    },

    create: async (req, res) => {
      const tenantId = tenantIdOf(req.user);
      const item = await model.create({
        data: { ...req.body, ownerId: tenantId },
      });
      res.status(201).json({ success: true, data: { [responseKey]: item } });
    },

    update: async (req, res) => {
      const tenantId = tenantIdOf(req.user);
      const existing = await model.findFirst({
        where: { id: req.params.id, ownerId: tenantId },
      });
      if (!existing) throw ApiError.notFound(`${resourceName} not found`);
      const item = await model.update({
        where: { id: req.params.id },
        data: req.body,
      });
      res.json({ success: true, data: { [responseKey]: item } });
    },

    remove: async (req, res) => {
      const tenantId = tenantIdOf(req.user);
      const existing = await model.findFirst({
        where: { id: req.params.id, ownerId: tenantId },
      });
      if (!existing) throw ApiError.notFound(`${resourceName} not found`);
      await model.delete({ where: { id: req.params.id } });
      res.json({ success: true, data: { message: `${resourceName} deleted` } });
    },
  };
}
