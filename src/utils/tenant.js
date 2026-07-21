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

export const PERMISSION_KEYS = ['customers', 'products', 'partners', 'marketing', 'assets', 'subUsers'];

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
