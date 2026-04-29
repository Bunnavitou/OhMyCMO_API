import { z } from 'zod';

const usernameSchema = z
  .string()
  .min(2, 'Username must be at least 2 characters')
  .max(40)
  .regex(/^[a-zA-Z0-9._-]+$/, 'Username may contain letters, digits, dot, underscore, dash');

const permissionsSchema = z.object({
  customers: z.boolean().optional(),
  products: z.boolean().optional(),
  partners: z.boolean().optional(),
  marketing: z.boolean().optional(),
  assets: z.boolean().optional(),
  subUsers: z.boolean().optional(),
}).partial();

export const createSubUserSchema = z.object({
  body: z.object({
    username: usernameSchema,
    password: z.string().min(4, 'Password must be at least 4 characters'),
    name: z.string().max(80).optional(),
    active: z.boolean().optional(),
    permissions: permissionsSchema.optional(),
  }),
});

export const updateSubUserSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z
    .object({
      username: usernameSchema.optional(),
      password: z.string().min(4).optional(),
      name: z.string().max(80).nullable().optional(),
      active: z.boolean().optional(),
      permissions: permissionsSchema.optional(),
    })
    .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});
