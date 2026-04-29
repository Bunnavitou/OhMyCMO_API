import { z } from 'zod';

const idParam = z.object({ id: z.string().min(1) });
export const idParamSchema = z.object({ params: idParam });

const jsonArray = z.array(z.unknown());

const productCore = {
  name: z.string().min(1).max(200),
  type: z.string().max(40).optional(),
  price: z.number().nonnegative().optional(),
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
