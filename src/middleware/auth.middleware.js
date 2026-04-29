import { verifyAccessToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { hasPermission } from '../utils/tenant.js';

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(ApiError.unauthorized('Missing or malformed Authorization header'));
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
      email: payload.email || null,
      username: payload.username || null,
      ownerId: payload.ownerId || null,
      permissions: payload.permissions || null,
    };
    return next();
  } catch {
    return next(ApiError.unauthorized('Invalid or expired access token'));
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
