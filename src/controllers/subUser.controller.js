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
  isPmo: true,
  tasks: true,
  logs: true,
  ownerId: true,
  inChargeId: true,
  inCharge: { select: { id: true, name: true, username: true } },
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

// inChargeId of '' or null means "reports to the tenant owner". A non-empty
// value must be another sub-user within the same tenant (never the sub-user
// themselves, to avoid a self-loop).
async function resolveInChargeId(tenantId, inChargeId, selfId) {
  if (inChargeId === undefined) return undefined;
  if (!inChargeId) return null;
  if (inChargeId === selfId) throw ApiError.badRequest('A sub-user cannot be their own incharge');
  const incharge = await prisma.user.findFirst({ where: { id: inChargeId, ownerId: tenantId } });
  if (!incharge) throw ApiError.badRequest('Incharge must be an existing sub-user in this team');
  return inChargeId;
}

export async function createSubUser(req, res) {
  const tenantId = tenantIdOf(req.user);
  const { username, password, name, active, permissions, isPmo, tasks, inChargeId } = req.body;

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
      isPmo: isPmo ?? false,
      tasks: tasks ?? [],
      inChargeId: (await resolveInChargeId(tenantId, inChargeId, null)) ?? null,
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

  if ('inChargeId' in data) {
    data.inChargeId = await resolveInChargeId(tenantId, data.inChargeId, id);
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
