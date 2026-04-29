import { z } from 'zod';

const idParam = z.object({ id: z.string().min(1) });

export const getUserSchema = z.object({ params: idParam });

export const updateUserSchema = z.object({
  params: idParam,
  body: z.object({
    name: z.string().min(1).max(80).optional(),
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
    role: z.enum(['USER', 'ADMIN']).optional(),
  }).refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' }),
});

export const deleteUserSchema = z.object({ params: idParam });

export const listUsersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
  }),
});
