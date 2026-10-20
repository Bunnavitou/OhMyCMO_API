import { verifyAccessToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { hasPermission } from '../utils/tenant.js';
import { prisma } from '../config/prisma.js';

// The token proves who is calling; what they may do is read from the
// database, so turning a permission off or deactivating a sub-user takes
// effect on their next request instead of when their (long-lived) token
// expires. A 2-second cache collapses the burst of requests one page makes.
const CACHE_MS = 2000;
const cache = new Map(); // userId → { at, user }

async function currentUser(id) {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.user;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, email: true, username: true, ownerId: true, permissions: true, active: true },
  });
  cache.set(id, { at: Date.now(), user });
  if (cache.size > 1000) cache.delete(cache.keys().next().value);
  return user;
}

// Drop a user's cached row after their permissions or status change, so the
// change applies on their very next request.
export function forgetUser(id) {
  cache.delete(id);
}

export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(ApiError.unauthorized('Missing or malformed Authorization header'));
  }
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return next(ApiError.unauthorized('Invalid or expired access token'));
  }
  try {
    const user = await currentUser(payload.sub);
    if (!user || user.active === false) return next(ApiError.unauthorized('Account is no longer active'));
    req.user = {
      id: user.id,
      role: user.role,
      email: user.email || null,
      username: user.username || null,
      ownerId: user.ownerId || null,
      permissions: user.permissions || null,
    };
    return next();
  } catch (err) {
    return next(err);
  }
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) return next(ApiError.forbidden('Insufficient role'));
  return next();
};

// Owners always pass. Sub-users must have permissions[key] === true.
export const requirePermission = (key) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (hasPermission(req.user, key)) return next();
  return next(ApiError.forbidden(`Missing permission: ${key}`));
};
