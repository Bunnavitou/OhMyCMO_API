import { z } from 'zod';

const idParam = z.object({ id: z.string().min(1) });
export const idParamSchema = z.object({ params: idParam });

const jsonArray = z.array(z.unknown());

const campaignCore = {
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  productId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  status: z.string().max(40).optional(),
  todos: jsonArray.optional(),
};

export const createCampaignSchema = z.object({ body: z.object(campaignCore) });
export const updateCampaignSchema = z.object({
  params: idParam,
  body: z
    .object({ ...campaignCore, name: campaignCore.name.optional() })
    .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' }),
});
