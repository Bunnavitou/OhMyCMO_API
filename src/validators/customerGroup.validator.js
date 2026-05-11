import { z } from 'zod';

const idParam = z.object({ id: z.string().min(1) });
export const idParamSchema = z.object({ params: idParam });

const groupCore = {
  name: z.string().min(1).max(80),
  color: z.string().max(40).nullable().optional(),
};

export const createGroupSchema = z.object({ body: z.object(groupCore) });
export const updateGroupSchema = z.object({
  params: idParam,
  body: z
    .object({ ...groupCore, name: groupCore.name.optional() })
    .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' }),
});
