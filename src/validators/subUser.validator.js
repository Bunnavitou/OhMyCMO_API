import { z } from 'zod';

const usernameSchema = z
  .string()
  .min(2, 'Username must be at least 2 characters')
  .max(40)
  .regex(/^[a-zA-Z0-9._-]+$/, 'Username may contain letters, digits, dot, underscore, dash');

// Menu access keys (opt-in) plus per-menu action abilities (opt-out, dotted
// keys like 'billing.send'). Accept any string→boolean map so new abilities
// don't require a validator change.
const permissionsSchema = z.record(z.boolean());

const jsonArray = z.array(z.unknown());

export const createSubUserSchema = z.object({
  body: z.object({
    username: usernameSchema,
    password: z.string().min(4, 'Password must be at least 4 characters'),
    name: z.string().max(80).optional(),
    active: z.boolean().optional(),
    permissions: permissionsSchema.optional(),
    isPmo: z.boolean().optional(),
    tasks: jsonArray.optional(),
    inChargeId: z.string().min(1).nullable().optional(),
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
      isPmo: z.boolean().optional(),
      tasks: jsonArray.optional(),
      logs: jsonArray.optional(),
      inChargeId: z.string().min(1).nullable().optional(),
    })
    .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});
