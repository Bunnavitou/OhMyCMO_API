import { z } from 'zod';

const idParam = z.object({ id: z.string().min(1) });
export const idParamSchema = z.object({ params: idParam });

const jsonArray = z.array(z.unknown());

const logoSchema = z
  .object({
    fileId: z.string().min(1).optional(),
    dataUrl: z.string().min(1).optional(),
    name: z.string().max(255).optional(),
    type: z.string().max(120).optional(),
    size: z.number().nonnegative().optional(),
  })
  .refine((v) => !!(v.fileId || v.dataUrl), {
    message: 'logo must include fileId or dataUrl',
  })
  .nullable()
  .optional();

const productCore = {
  name: z.string().min(1).max(200),
  type: z.string().max(40).optional(),
  price: z.number().nonnegative().optional(),
  logo: logoSchema,
  pmoOwnerId: z.string().min(1).nullable().optional(),
  stage: z.string().max(40).optional(),
  staff: jsonArray.optional(),
  tasks: jsonArray.optional(),
  logs: jsonArray.optional(),
  lastActivityAt: z.string().datetime().nullable().optional(),
  income: jsonArray.optional(),
  expenses: jsonArray.optional(),
  assets: jsonArray.optional(),
};

export const createProductSchema = z.object({ body: z.object(productCore) });
export const updateProductSchema = z.object({
  params: idParam,
  body: z
    .object({ ...productCore, name: productCore.name.optional() })
    .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' }),
});

// Per-entry writes into a product's JSON array columns. Entries stay `unknown`
// shaped for the same reason the whole-array fields above do: the billing UI
// owns their shape and older rows carry legacy keys.
const childEntry = z.record(z.unknown());
const childParams = idParam.extend({ field: z.enum(['income', 'expenses']) });
const childEntryParams = childParams.extend({ entryId: z.string().min(1) });

export const addProductChildrenSchema = z.object({
  params: childParams,
  body: z
    .object({
      item: childEntry.optional(),
      items: z.array(childEntry).min(1).max(200).optional(),
    })
    .refine((b) => !b.item !== !b.items, {
      message: 'Provide exactly one of item or items',
    }),
});

export const updateProductChildSchema = z.object({
  params: childEntryParams,
  body: z.object({ patch: childEntry }),
});

export const productChildParamsSchema = z.object({ params: childEntryParams });
