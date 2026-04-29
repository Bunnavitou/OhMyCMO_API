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

// Owners have implicit full access. Sub-users follow their permissions JSON.
export function hasPermission(user, key) {
  if (!user) return false;
  if (isOwner(user)) return true;
  const p = user.permissions || {};
  return p[key] === true;
}

export const PERMISSION_KEYS = ['customers', 'products', 'partners', 'marketing', 'assets', 'subUsers'];
