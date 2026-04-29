import { z } from 'zod';

const idParam = z.object({ id: z.string().min(1) });

export const createPostSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    content: z.string().max(10000).optional(),
    published: z.boolean().optional(),
  }),
});

export const updatePostSchema = z.object({
  params: idParam,
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    content: z.string().max(10000).nullable().optional(),
    published: z.boolean().optional(),
  }).refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' }),
});

export const getPostSchema = z.object({ params: idParam });
export const deletePostSchema = z.object({ params: idParam });

export const listPostsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    published: z.enum(['true', 'false']).optional(),
    authorId: z.string().optional(),
    search: z.string().optional(),
  }),
});
