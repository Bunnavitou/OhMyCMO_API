import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { tenantIdOf, hasPermission, assertOwnTaskChangesOnly } from '../utils/tenant.js';

// Read-only roster fields — deliberately narrower than the sub-user admin
// select (no username/permissions/active), since this endpoint is open to
// every tenant member, not just those with the 'subUsers' permission.
// `pmoProducts` is included as a name/type-only summary (no price, income,
// expenses, ...) for the same reason: which Products/Services a PMO manages
// is shown here even to a viewer who lacks the separate 'products' (Billing)
// permission — only /products itself, with the financial detail, stays
// gated behind that permission.
// `supervisees` (this PMO's own reports, via the `inChargeId` self-relation)
// is included for the same reason as `pmoProducts` — so the "who supports
// this PMO" list on their card is visible to every tenant member, not just
// those with the separate 'subUsers' permission.
const PMO_SELECT = {
  id: true,
  name: true,
  username: true,
  avatar: true,
  isPmo: true,
  tasks: true,
  logs: true,
  createdAt: true,
  updatedAt: true,
  pmoProducts: { select: { id: true, name: true, type: true } },
  supervisees: { select: { id: true, name: true, username: true } },
};

const formatPmo = ({ pmoProducts, supervisees, ...rest }) => ({
  ...rest,
  products: pmoProducts,
  reports: supervisees,
});

// Whether `actorId` is this PMO themselves, or one of their reports (support
// staff — a sub-user whose `inChargeId` points at this PMO). A report gets
// the same task rights as the PMO they support, "cloned" onto this PMO's
// own page — including full edit/delete over tasks assigned to a fellow
// team member, same as the PMO themselves (see updatePmo below).
async function resolveIsPmoTeamMember(actorId, pmoId) {
  if (actorId === pmoId) return true;
  const actorRecord = await prisma.user.findUnique({
    where: { id: actorId },
    select: { inChargeId: true },
  });
  return actorRecord?.inChargeId === pmoId;
}

// Creating a brand-new PMO task, or (re)assigning one to somebody, is
// narrower than the general task self-service rule (assertOwnTaskChangesOnly
// above, which governs a plain unrelated sub-user's edits to their own task):
//   - Only the tenant owner, a 'pmo.manage' holder, or this PMO's team
//     (`isTeamMember` — the PMO themselves or one of their reports) may
//     create a task here at all — a plain unrelated sub-user may edit/delete
//     a task already assigned to them, but must not conjure a new one.
//   - The owner may assign to anyone (full tenant); this PMO's team may only
//     assign within their own team — the PMO themselves, or a fellow report
//     — never to an arbitrary third party.
// Only called when the actor lacks 'pmo.manage' (the owner is exempted by
// the same check one level up, in updatePmo).
async function assertCanWritePmoTasks(pmo, newTasks, isTeamMember, tenantId) {
  if (!Array.isArray(newTasks)) return;
  const existingById = new Map((pmo.tasks || []).map((t) => [t.id, t]));

  const reassignedTo = new Set();
  for (const after of newTasks) {
    const before = existingById.get(after.id);
    if (!before && !isTeamMember) {
      throw ApiError.forbidden('Only the account owner, this PMO, or their support staff can create tasks here');
    }
    const assigneeChanged = !before || before.assigneeId !== after.assigneeId;
    if (assigneeChanged && after.assigneeId) {
      if (!isTeamMember) {
        throw ApiError.forbidden('Only the account owner, this PMO, or their support staff can assign tasks here');
      }
      if (after.assigneeId !== pmo.id) reassignedTo.add(after.assigneeId);
    }
  }

  if (reassignedTo.size === 0) return;
  const reports = await prisma.user.findMany({
    where: { ownerId: tenantId, inChargeId: pmo.id, id: { in: [...reassignedTo] } },
    select: { id: true },
  });
  if (reports.length !== reassignedTo.size) {
    throw ApiError.forbidden('You can only assign tasks to this PMO or their support staff');
  }
}

export async function listPmos(req, res) {
  const tenantId = tenantIdOf(req.user);
  const items = await prisma.user.findMany({
    where: { ownerId: tenantId, isPmo: true },
    select: PMO_SELECT,
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: { items: items.map(formatPmo) } });
}

// Promote/demote a PMO, or edit their PMO-scoped tasks/log. The target need
// not already be a PMO (promoting a new one flips isPmo on a plain sub-user),
// so this looks up any tenant sub-user, not just existing PMOs.
//
// Field-level checks, same shape as customer/partner tasks:
//   isPmo — promoting/demoting is real PMO management: owner or 'pmo.manage' only.
//   tasks — a plain unrelated sub-user may still edit/delete a task already
//     assigned to them, or an unassigned one (see assertOwnTaskChangesOnly),
//     same as customer/partner tasks. This PMO themselves and their reports
//     (isTeamMember) instead get full control over EVERY task in this list —
//     including one assigned to a fellow team member — same as the owner;
//     only creating a task, or (re)assigning one, stays scoped to their own
//     team (see assertCanWritePmoTasks below).
//   logs — always accepted alongside a tasks edit; carries no extra capability.
//   reportIds — who supports this PMO (their `inChargeId` reports): owner or
//     'pmo.manage' only, same as isPmo.
export async function updatePmo(req, res) {
  const tenantId = tenantIdOf(req.user);
  const { id } = req.params;
  const existing = await prisma.user.findFirst({ where: { id, ownerId: tenantId } });
  if (!existing) throw ApiError.notFound('PMO not found');

  const data = {};
  if ('isPmo' in req.body) {
    if (!hasPermission(req.user, 'pmo.manage')) {
      throw ApiError.forbidden('Missing permission: pmo.manage');
    }
    data.isPmo = req.body.isPmo;
  }
  if ('tasks' in req.body) {
    if (!hasPermission(req.user, 'pmo.manage')) {
      const isTeamMember = await resolveIsPmoTeamMember(req.user.id, id);
      // A plain unrelated sub-user is still limited to their own/unassigned
      // tasks; the PMO themselves and their reports get full control here.
      if (!isTeamMember) {
        assertOwnTaskChangesOnly(req.user, existing.tasks, req.body.tasks);
      }
      await assertCanWritePmoTasks(existing, req.body.tasks, isTeamMember, tenantId);
    }
    data.tasks = req.body.tasks;
  }
  if ('logs' in req.body) data.logs = req.body.logs;

  // Full replace of this PMO's reports (their supporting staff) — owner,
  // 'pmo.manage', or this PMO themselves (deciding their own support), same
  // as who may create/assign their tasks. Sets `inChargeId` on every listed
  // sub-user to this PMO's id, and clears it on anyone previously pointing
  // here but now omitted.
  if ('reportIds' in req.body) {
    if (!hasPermission(req.user, 'pmo.manage') && req.user.id !== id) {
      throw ApiError.forbidden('Only the account owner or this PMO can set their reports');
    }
    const ids = [...new Set(req.body.reportIds)].filter((rid) => rid !== id);
    if (ids.length) {
      const targets = await prisma.user.findMany({
        where: { ownerId: tenantId, id: { in: ids } },
        select: { id: true },
      });
      if (targets.length !== ids.length) {
        throw ApiError.badRequest('reportIds must be existing sub-users in this team');
      }
    }
    await prisma.user.updateMany({
      where: { ownerId: tenantId, inChargeId: id, id: { notIn: ids } },
      data: { inChargeId: null },
    });
    if (ids.length) {
      await prisma.user.updateMany({ where: { id: { in: ids } }, data: { inChargeId: id } });
    }
  }

  const item = await prisma.user.update({ where: { id }, data, select: PMO_SELECT });
  res.json({ success: true, data: { pmo: formatPmo(item) } });
}
