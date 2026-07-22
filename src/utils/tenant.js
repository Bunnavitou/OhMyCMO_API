import { ApiError } from './ApiError.js';

// The tenant id of a user is the owner's id.
// - For owners (no ownerId): they are the tenant root, so tenantId = self.id.
// - For sub-users: tenantId = ownerId.
//
// Every domain row carries ownerId = tenantIdOf(creator), so all members of
// a tenant see the same data.
export function tenantIdOf(user) {
  if (!user) return null;
  return user.ownerId || user.id;
}

export function isOwner(user) {
  return !!user && !user.ownerId;
}

export const PERMISSION_KEYS = ['tasks', 'customers', 'products', 'partners', 'marketing', 'assets', 'subUsers'];

// Owners have implicit full access. For sub-users: menu keys are opt-in
// (=== true); any other key is a per-menu action ability, opt-out (allowed
// unless explicitly false), e.g. 'billing.send', 'customers.delete'.
export function hasPermission(user, key) {
  if (!user) return false;
  if (isOwner(user)) return true;
  const p = user.permissions || {};
  if (PERMISSION_KEYS.includes(key)) return p[key] === true;
  return p[key] !== false;
}

// Sub-users may only add/edit tasks assigned to themselves — they can see
// the whole team's board but must not change another member's task (status,
// due date, etc.). Unassigned tasks are open to anyone. Removing a task
// additionally requires the 'tasks.delete' ability. Tenant owners are
// exempt (implicit full access, same as hasPermission).
export function assertOwnTaskChangesOnly(user, existingTasks, newTasks) {
  if (!Array.isArray(newTasks) || isOwner(user)) return;
  const newById = new Map(newTasks.map((t) => [t.id, t]));
  for (const before of existingTasks || []) {
    const after = newById.get(before.id);
    if (!after) {
      if (!hasPermission(user, 'tasks.delete')) {
        throw ApiError.forbidden('You do not have permission to delete tasks');
      }
      if (before.assigneeId && before.assigneeId !== user.id) {
        throw ApiError.forbidden('You can only delete tasks assigned to you');
      }
      continue;
    }
    if (!before.assigneeId || before.assigneeId === user.id) continue;
    if (JSON.stringify(after) !== JSON.stringify(before)) {
      throw ApiError.forbidden('You can only update tasks assigned to you');
    }
  }
}
