import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { tenantIdOf } from '../utils/tenant.js';

const SUB_USER_SELECT = {
  id: true,
  username: true,
  name: true,
  role: true,
  active: true,
  permissions: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
};

export async function listSubUsers(req, res) {
  const tenantId = tenantIdOf(req.user);
  const items = await prisma.user.findMany({
    where: { ownerId: tenantId },
    select: SUB_USER_SELECT,
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: { items } });
}

export async function getSubUser(req, res) {
  const tenantId = tenantIdOf(req.user);
  const item = await prisma.user.findFirst({
    where: { id: req.params.id, ownerId: tenantId },
    select: SUB_USER_SELECT,
  });
  if (!item) throw ApiError.notFound('Sub-user not found');
  res.json({ success: true, data: { subUser: item } });
}

export async function createSubUser(req, res) {
  const tenantId = tenantIdOf(req.user);
  const { username, password, name, active, permissions } = req.body;

  // Username must be globally unique. Surface a friendly 409.
  const taken = await prisma.user.findUnique({ where: { username } });
  if (taken) throw ApiError.conflict('Username is already taken');

  const hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  const item = await prisma.user.create({
    data: {
      username,
      password: hash,
      name: name || null,
      role: 'USER',
      active: active ?? true,
      ownerId: tenantId,
      permissions: permissions ?? {},
    },
    select: SUB_USER_SELECT,
  });

  res.status(201).json({ success: true, data: { subUser: item } });
}

export async function updateSubUser(req, res) {
  const tenantId = tenantIdOf(req.user);
  const { id } = req.params;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing || existing.ownerId !== tenantId) {
    throw ApiError.notFound('Sub-user not found');
  }

  const data = { ...req.body };

  if (data.username && data.username !== existing.username) {
    const taken = await prisma.user.findUnique({ where: { username: data.username } });
    if (taken) throw ApiError.conflict('Username is already taken');
  }

  if (data.password) {
    data.password = await bcrypt.hash(data.password, env.BCRYPT_ROUNDS);
  } else {
    delete data.password; // empty/missing means "keep current"
  }

  const item = await prisma.user.update({
    where: { id },
    data,
    select: SUB_USER_SELECT,
  });
  res.json({ success: true, data: { subUser: item } });
}

export async function deleteSubUser(req, res) {
  const tenantId = tenantIdOf(req.user);
  const { id } = req.params;
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing || existing.ownerId !== tenantId) {
    throw ApiError.notFound('Sub-user not found');
  }
  await prisma.user.delete({ where: { id } });
  res.json({ success: true, data: { message: 'Sub-user deleted' } });
}
