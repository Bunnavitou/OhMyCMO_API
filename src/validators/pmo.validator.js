import { z } from 'zod';

const jsonArray = z.array(z.unknown());

export const idParamSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const updatePmoSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z
    .object({
      isPmo: z.boolean().optional(),
      tasks: jsonArray.optional(),
      logs: jsonArray.optional(),
      // Full replace of "who supports/reports to this PMO" — sub-user ids
      // whose `inChargeId` should point at this PMO. Anyone previously
      // pointing here but omitted is cleared back to unassigned.
      reportIds: z.array(z.string().min(1)).optional(),
    })
    .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' }),
});
