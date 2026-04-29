import { z } from 'zod';

const idParam = z.object({ id: z.string().min(1) });
export const idParamSchema = z.object({ params: idParam });

// Nested arrays come from the client as opaque JSON. We accept any array
// shape — the frontend is the source of truth for nested structure.
const jsonArray = z.array(z.unknown());

const customerCore = {
  name: z.string().min(1).max(200),
  industry: z.string().max(120).nullable().optional(),
  contact: z.string().max(120).nullable().optional(),
  email: z.string().email().nullable().or(z.literal('')).optional(),
  phone: z.string().max(40).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  vatTin: z.string().max(80).nullable().optional(),
  stage: z.string().max(40).optional(),
  staff: jsonArray.optional(),
  tasks: jsonArray.optional(),
  taskGroups: jsonArray.optional(),
  files: jsonArray.optional(),
  productLinks: jsonArray.optional(),
};

export const createCustomerSchema = z.object({
  body: z.object(customerCore),
});

export const updateCustomerSchema = z.object({
  params: idParam,
  body: z
    .object({
      ...customerCore,
      name: customerCore.name.optional(),
    })
    .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' }),
});

export const appendLogSchema = z.object({
  params: idParam,
  body: z.object({
    type: z.string().min(1).max(80),
    message: z.string().min(1).max(500),
    meta: z.record(z.unknown()).nullable().optional(),
  }),
});
