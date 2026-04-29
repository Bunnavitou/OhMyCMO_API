import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
};

export async function listUsers(req, res) {
  const { page, limit, search } = req.query;
  const skip = (page - 1) * limit;

  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  res.json({
    success: true,
    data: { items, page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function getUser(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: USER_SELECT,
  });
  if (!user) throw ApiError.notFound('User not found');
  res.json({ success: true, data: { user } });
}

export async function updateUser(req, res) {
  const { id } = req.params;
  const isSelf = req.user.id === id;
  const isAdmin = req.user.role === 'ADMIN';
  if (!isSelf && !isAdmin) throw ApiError.forbidden('Cannot update other users');

  const data = { ...req.body };
  // Only admin can change role.
  if (data.role && !isAdmin) delete data.role;
  if (data.password) {
    data.password = await bcrypt.hash(data.password, env.BCRYPT_ROUNDS);
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: USER_SELECT,
  });
  res.json({ success: true, data: { user } });
}

export async function deleteUser(req, res) {
  const { id } = req.params;
  const isSelf = req.user.id === id;
  const isAdmin = req.user.role === 'ADMIN';
  if (!isSelf && !isAdmin) throw ApiError.forbidden('Cannot delete other users');

  await prisma.user.delete({ where: { id } });
  res.json({ success: true, data: { message: 'User deleted' } });
}
