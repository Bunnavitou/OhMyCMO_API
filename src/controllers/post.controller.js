import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';

const POST_INCLUDE = {
  author: { select: { id: true, email: true, name: true } },
};

export async function listPosts(req, res) {
  const { page, limit, published, authorId, search } = req.query;
  const skip = (page - 1) * limit;

  const where = {
    ...(published !== undefined ? { published: published === 'true' } : {}),
    ...(authorId ? { authorId } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { content: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.post.findMany({
      where,
      include: POST_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.post.count({ where }),
  ]);

  res.json({
    success: true,
    data: { items, page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function getPost(req, res) {
  const post = await prisma.post.findUnique({
    where: { id: req.params.id },
    include: POST_INCLUDE,
  });
  if (!post) throw ApiError.notFound('Post not found');
  res.json({ success: true, data: { post } });
}

export async function createPost(req, res) {
  const post = await prisma.post.create({
    data: { ...req.body, authorId: req.user.id },
    include: POST_INCLUDE,
  });
  res.status(201).json({ success: true, data: { post } });
}

export async function updatePost(req, res) {
  const existing = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('Post not found');

  const isAuthor = existing.authorId === req.user.id;
  const isAdmin = req.user.role === 'ADMIN';
  if (!isAuthor && !isAdmin) throw ApiError.forbidden('Cannot modify others\' posts');

  const post = await prisma.post.update({
    where: { id: req.params.id },
    data: req.body,
    include: POST_INCLUDE,
  });
  res.json({ success: true, data: { post } });
}

export async function deletePost(req, res) {
  const existing = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('Post not found');

  const isAuthor = existing.authorId === req.user.id;
  const isAdmin = req.user.role === 'ADMIN';
  if (!isAuthor && !isAdmin) throw ApiError.forbidden('Cannot delete others\' posts');

  await prisma.post.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: { message: 'Post deleted' } });
}
