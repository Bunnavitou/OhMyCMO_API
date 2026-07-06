import { z } from 'zod';

const idParam = z.object({ id: z.string().min(1) });
export const idParamSchema = z.object({ params: idParam });

const jsonArray = z.array(z.unknown());
const cardImageSchema = z
  .object({
    fileId: z.string().min(1).optional(),
    dataUrl: z.string().min(1).optional(),
    name: z.string().max(255).optional(),
    type: z.string().max(120).optional(),
    size: z.number().nonnegative().optional(),
  })
  .refine((v) => !!(v.fileId || v.dataUrl), {
    message: 'image must include fileId or dataUrl',
  })
  .nullable()
  .optional();

const partnerCore = {
  name: z.string().min(1).max(200),
  company: z.string().max(200).nullable().optional(),
  role: z.string().max(120).nullable().optional(),
  email: z.string().email().nullable().or(z.literal('')).optional(),
  phone: z.string().max(40).nullable().optional(),
  telegram: z.string().max(120).nullable().optional(),
  cardImage: cardImageSchema,
  telegramQr: cardImageSchema,
  tasks: jsonArray.optional(),
  activities: jsonArray.optional(),
};

export const createPartnerSchema = z.object({ body: z.object(partnerCore) });
export const updatePartnerSchema = z.object({
  params: idParam,
  body: z
    .object({ ...partnerCore, name: partnerCore.name.optional() })
    .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' }),
});
