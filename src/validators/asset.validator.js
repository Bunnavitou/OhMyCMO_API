import { z } from 'zod';

const idParam = z.object({ id: z.string().min(1) });
export const idParamSchema = z.object({ params: idParam });

const assetCore = {
  name: z.string().min(1).max(200),
  category: z.string().max(80).nullable().optional(),
  assignee: z.string().max(120).nullable().optional(),
  serial: z.string().max(120).nullable().optional(),
  status: z.string().max(40).optional(),
};

export const createAssetSchema = z.object({ body: z.object(assetCore) });
export const updateAssetSchema = z.object({
  params: idParam,
  body: z
    .object({ ...assetCore, name: assetCore.name.optional() })
    .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' }),
});
