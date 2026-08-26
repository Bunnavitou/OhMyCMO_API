import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { tenantIdOf, isOwner, hasPermission } from '../utils/tenant.js';

// Build a tenant-scoped CRUD controller for a Prisma model.
//   modelKey     — the lowercase Prisma client key, e.g. 'product'
//   resourceName — singular for error messages, e.g. 'Product'
//   responseKey  — the JSON envelope key for one item, e.g. 'product'
//   include      — optional Prisma `include` clause applied to list/get/create/update
//   scopeWhere(req) — optional extra `where` clause merged into list/get/update/remove,
//     for row-level visibility narrower than the tenant that CAN be expressed as a plain
//     column match. Tenant owners are unaffected — only sub-users are narrowed.
//   visibleTo(item, req) — optional JS-level visibility predicate, applied after fetch.
//     Use this instead of/alongside scopeWhere when visibility depends on nested JSON
//     data (e.g. "assigned as this task's assignee") that Prisma's `where` can't express
//     as a column filter. Tenant owners always pass; sub-users must satisfy it.
//   ownerOnlyFields — optional list of body fields only a tenant owner may set; silently
//     stripped from a sub-user's create/update body.
//   ownerOnlyFieldsUnless — optional permission key that also exempts a sub-user from
//     that stripping (e.g. a scoped ability narrower than full tenant ownership).
export function makeCrud({
  modelKey, resourceName, responseKey, include, scopeWhere, visibleTo, ownerOnlyFields, ownerOnlyFieldsUnless,
}) {
  const model = prisma[modelKey];
  if (!model) throw new Error(`Unknown Prisma model: ${modelKey}`);

  const extraWhere = (req) => (scopeWhere && !isOwner(req.user) ? scopeWhere(req) : {});
  const isVisible = (req, item) => isOwner(req.user) || !visibleTo || visibleTo(item, req);
  const stripOwnerOnlyFields = (req, body) => {
    if (!ownerOnlyFields || isOwner(req.user)) return body;
    if (ownerOnlyFieldsUnless && hasPermission(req.user, ownerOnlyFieldsUnless)) return body;
    const copy = { ...body };
    for (const f of ownerOnlyFields) delete copy[f];
    return copy;
  };

  return {
    list: async (req, res) => {
      const tenantId = tenantIdOf(req.user);
      let items = await model.findMany({
        where: { ownerId: tenantId, ...extraWhere(req) },
        orderBy: { createdAt: 'desc' },
        ...(include ? { include } : {}),
      });
      if (visibleTo) items = items.filter((item) => isVisible(req, item));
      res.json({ success: true, data: { items } });
    },

    get: async (req, res) => {
      const tenantId = tenantIdOf(req.user);
      const item = await model.findFirst({
        where: { id: req.params.id, ownerId: tenantId, ...extraWhere(req) },
        ...(include ? { include } : {}),
      });
      if (!item || !isVisible(req, item)) throw ApiError.notFound(`${resourceName} not found`);
      res.json({ success: true, data: { [responseKey]: item } });
    },

    create: async (req, res) => {
      const tenantId = tenantIdOf(req.user);
      const item = await model.create({
        data: { ...stripOwnerOnlyFields(req, req.body), ownerId: tenantId },
        ...(include ? { include } : {}),
      });
      res.status(201).json({ success: true, data: { [responseKey]: item } });
    },

    update: async (req, res) => {
      const tenantId = tenantIdOf(req.user);
      const existing = await model.findFirst({
        where: { id: req.params.id, ownerId: tenantId, ...extraWhere(req) },
      });
      if (!existing || !isVisible(req, existing)) throw ApiError.notFound(`${resourceName} not found`);
      const item = await model.update({
        where: { id: req.params.id },
        data: stripOwnerOnlyFields(req, req.body),
        ...(include ? { include } : {}),
      });
      res.json({ success: true, data: { [responseKey]: item } });
    },

    remove: async (req, res) => {
      const tenantId = tenantIdOf(req.user);
      const existing = await model.findFirst({
        where: { id: req.params.id, ownerId: tenantId, ...extraWhere(req) },
      });
      if (!existing || !isVisible(req, existing)) throw ApiError.notFound(`${resourceName} not found`);
      await model.delete({ where: { id: req.params.id } });
      res.json({ success: true, data: { message: `${resourceName} deleted` } });
    },
  };
}
