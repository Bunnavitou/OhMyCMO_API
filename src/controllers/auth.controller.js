import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';

const REFRESH_COOKIE = 'refreshToken';

function publicUser(u) {
  if (!u) return null;
  // Strip secrets before returning to the client.
  const { password, refreshToken, ...rest } = u;
  return rest;
}

function tokenPayload(user) {
  return {
    sub: user.id,
    role: user.role,
    email: user.email || null,
    username: user.username || null,
    ownerId: user.ownerId || null,
    permissions: user.permissions || null,
  };
}

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
}

async function issueTokens(user) {
  const payload = tokenPayload(user);
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  await prisma.user.update({ where: { id: user.id }, data: { refreshToken } });
  return { accessToken, refreshToken };
}

// /auth/register only creates owners (ADMIN, no ownerId).
export async function register(req, res) {
  const { email, password, name } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw ApiError.conflict('Email already registered');

  const hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email,
      password: hash,
      name,
      role: 'ADMIN',
    },
  });

  const { accessToken, refreshToken } = await issueTokens(user);
  setRefreshCookie(res, refreshToken);

  res.status(201).json({
    success: true,
    data: { user: publicUser(user), accessToken },
  });
}

export async function login(req, res) {
  const { email, username, password } = req.body;

  const user = email
    ? await prisma.user.findUnique({ where: { email } })
    : await prisma.user.findUnique({ where: { username } });

  if (!user) throw ApiError.unauthorized('Invalid credentials');
  if (!user.active) throw ApiError.unauthorized('Account is disabled');

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw ApiError.unauthorized('Invalid credentials');

  const { accessToken, refreshToken } = await issueTokens(user);
  setRefreshCookie(res, refreshToken);

  res.json({
    success: true,
    data: { user: publicUser(user), accessToken },
  });
}

export async function refresh(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;
  if (!token) throw ApiError.unauthorized('No refresh token');

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid refresh token');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.refreshToken !== token) {
    throw ApiError.unauthorized('Refresh token revoked');
  }
  if (!user.active) throw ApiError.unauthorized('Account is disabled');

  const { accessToken, refreshToken } = await issueTokens(user);
  setRefreshCookie(res, refreshToken);

  res.json({ success: true, data: { accessToken } });
}

export async function logout(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      await prisma.user
        .update({ where: { id: payload.sub }, data: { refreshToken: null } })
        .catch(() => {});
    } catch {
      // ignore
    }
  }
  clearRefreshCookie(res);
  res.json({ success: true, data: { message: 'Logged out' } });
}

export async function me(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) throw ApiError.notFound('User not found');
  res.json({ success: true, data: { user: publicUser(user) } });
}
